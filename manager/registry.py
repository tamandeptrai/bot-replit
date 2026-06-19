"""Bot registry: load bots.json, resolve paths, read settings, scan commands."""
from __future__ import annotations

import json
import os
import re
from typing import Optional

HERE = os.path.dirname(os.path.abspath(__file__))
BOTS_ROOT = os.environ.get("BOTS_ROOT", os.path.dirname(HERE))
DATA_DIR = os.path.join(HERE, "data")
OVERLAY_DIR = os.path.join(DATA_DIR, "bots")
LOG_DIR = os.path.join(DATA_DIR, "logs")
SESSION_DIR = os.path.join(DATA_DIR, "sessions")

for _d in (OVERLAY_DIR, LOG_DIR, SESSION_DIR):
    os.makedirs(_d, exist_ok=True)


def load_bots() -> list[dict]:
    with open(os.path.join(HERE, "bots.json"), "r", encoding="utf-8") as f:
        bots = json.load(f)["bots"]
    for b in bots:
        b["abs_dir"] = os.path.join(BOTS_ROOT, b["dir"])
    return bots


_BOTS = {b["id"]: b for b in load_bots()}


def get_bot(bot_id: str) -> Optional[dict]:
    return _BOTS.get(bot_id)


def all_bots() -> list[dict]:
    return list(_BOTS.values())


# --------------------------------------------------------------------------
# Manager-side overlay (email, proxy, enabled, autorestart)
# --------------------------------------------------------------------------
def _overlay_path(bot_id: str) -> str:
    return os.path.join(OVERLAY_DIR, f"{bot_id}.json")


def read_overlay(bot_id: str) -> dict:
    path = _overlay_path(bot_id)
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {"enabled": True, "autorestart": True, "email": "", "proxy": ""}


def write_overlay(bot_id: str, updates: dict) -> dict:
    data = read_overlay(bot_id)
    data.update({k: v for k, v in updates.items() if v is not None})
    with open(_overlay_path(bot_id), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    return data


# --------------------------------------------------------------------------
# Reading current bot config (status of session / keys / prefix)
# --------------------------------------------------------------------------
def _safe_read(path: str) -> str:
    try:
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    except Exception:
        return ""


def read_config_status(bot: dict) -> dict:
    """Return a snapshot of what's currently configured for this bot."""
    status = {
        "imei_set": False,
        "cookie_count": 0,
        "prefix": None,
        "admin": None,
        "name_bot": bot["name"],
        "ai_key_set": False,
        "ai_key_name": (bot.get("ai_key") or {}).get("name"),
        "last_login": None,
    }
    if bot["type"] == "python":
        cfg = _safe_read(os.path.join(bot["abs_dir"], bot["config_py"]))
        m = re.search(r'IMEI\s*=\s*"([^"]*)"', cfg)
        status["imei_set"] = bool(m and m.group(1))
        mc = re.search(r"SESSION_COOKIES\s*=\s*(\{.*?\})", cfg, re.DOTALL)
        if mc:
            try:
                status["cookie_count"] = len(json.loads(mc.group(1)))
            except Exception:
                status["cookie_count"] = mc.group(1).count(":")
        ai = bot.get("ai_key") or {}
        if ai.get("name"):
            ma = re.search(rf'{ai["name"]}\s*=\s*"([^"]*)"', cfg)
            status["ai_key_set"] = bool(ma and ma.group(1) and ma.group(1) != "api_key")
        if bot.get("settings_json"):
            sj = _safe_read(os.path.join(bot["abs_dir"], bot["settings_json"]))
            try:
                sd = json.loads(sj)
                status["prefix"] = sd.get("prefix")
                status["admin"] = sd.get("admin")
                status["name_bot"] = sd.get("name_bot", bot["name"])
            except Exception:
                pass
        else:
            mp = re.search(r"PREFIX\s*=\s*'([^']*)'|PREFIX\s*=\s*\"([^\"]*)\"", cfg)
            if mp:
                status["prefix"] = mp.group(1) or mp.group(2)
            mad = re.search(r"ADMIN\s*=\s*'([^']*)'|ADMIN\s*=\s*\"([^\"]*)\"", cfg)
            if mad:
                status["admin"] = mad.group(1) or mad.group(2)
    else:  # node
        cookie = _safe_read(os.path.join(bot["abs_dir"], bot["cookie_txt"]))
        status["cookie_count"] = cookie.count("=") if cookie.strip() else 0
        cfg = _safe_read(os.path.join(bot["abs_dir"], bot["config_js"]))
        m = re.search(r'imei\s*:\s*"([^"]*)"', cfg)
        status["imei_set"] = bool(m and m.group(1))
        mp = re.search(r'botPrefix\s*:\s*"([^"]*)"', cfg)
        if mp:
            status["prefix"] = mp.group(1)
        env = _safe_read(os.path.join(bot["abs_dir"], bot.get("env_file", ".env")))
        me = re.search(r'OPENAI_API_KEY\s*=\s*(\S+)', env)
        status["ai_key_set"] = bool(me and me.group(1))
    ov = read_overlay(bot["id"])
    status["last_login"] = ov.get("last_login")
    return status


def current_imei(bot: dict) -> str:
    """Read the imei currently written in this bot's config (empty if none)."""
    if bot["type"] == "python":
        cfg = _safe_read(os.path.join(bot["abs_dir"], bot["config_py"]))
        m = re.search(r'IMEI\s*=\s*"([^"]*)"', cfg)
        return m.group(1) if m else ""
    cfg = _safe_read(os.path.join(bot["abs_dir"], bot["config_js"]))
    m = re.search(r'imei\s*:\s*"([^"]*)"', cfg)
    return m.group(1) if m else ""


# --------------------------------------------------------------------------
# Command scanning
# --------------------------------------------------------------------------
_SKIP = {"__pycache__", "__init__.py", "node_modules"}


def scan_commands(bot: dict) -> list[str]:
    cmds: set[str] = set()
    base = bot["abs_dir"]
    if bot["type"] == "python":
        for sub in ("commands", "modules", "cmd", "plugins"):
            d = os.path.join(base, sub)
            if os.path.isdir(d):
                for f in os.listdir(d):
                    if f.endswith(".py") and f not in _SKIP and not f.startswith("_"):
                        cmds.add(f[:-3])
    else:
        for sub in ("commands", "modules", "plugins", "scripts/cmds"):
            d = os.path.join(base, sub)
            if os.path.isdir(d):
                for f in os.listdir(d):
                    if f.endswith(".js") and f not in _SKIP:
                        cmds.add(f[:-3])
    return sorted(cmds)
