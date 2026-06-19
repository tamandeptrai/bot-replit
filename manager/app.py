"""Zalo Bot Manager - stdlib-only web dashboard to run/manage 4 Zalo bots.

Uses only the Python standard library (+ requests, which is preinstalled) so it
runs without any pip install. Features: QR login, start/stop/restart, live logs
(SSE), command list, auto-restart (auto-fix), per-bot settings
(email / cookie / imei / proxy / AI key), bot switch.
"""
from __future__ import annotations

import json
import os
import re
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import config_writer
import registry
from process_manager import Supervisor
from qr_manager import QRManager

HERE = os.path.dirname(os.path.abspath(__file__))
PORT = int(os.environ.get("PORT", "8500"))

supervisor = Supervisor()
qr_manager = QRManager()


# --------------------------------------------------------------------------
# business helpers (framework-agnostic)
# --------------------------------------------------------------------------
def bot_payload(bot: dict) -> dict:
    bp = supervisor.get(bot["id"])
    cfg = registry.read_config_status(bot)
    ov = registry.read_overlay(bot["id"])
    return {
        "id": bot["id"],
        "name": bot["name"],
        "type": bot["type"],
        "dir": bot["dir"],
        "process": bp.info() if bp else {},
        "config": cfg,
        "overlay": {
            "email": ov.get("email", ""),
            "proxy": ov.get("proxy", ""),
            "enabled": ov.get("enabled", True),
            "autorestart": ov.get("autorestart", True),
        },
    }


def parse_cookie_input(raw: str) -> dict:
    raw = (raw or "").strip()
    if not raw:
        return {}
    try:
        data = json.loads(raw)
        if isinstance(data, dict):
            return {str(k): str(v) for k, v in data.items()}
        if isinstance(data, list):
            return {c.get("key", c.get("name")): c.get("value") for c in data}
    except Exception:
        pass
    cookies = {}
    for part in re.split(r";\s*", raw):
        if "=" in part:
            k, v = part.split("=", 1)
            cookies[k.strip()] = v.strip()
    return cookies


def apply_settings(bot: dict, body: dict) -> None:
    overlay_updates = {k: body[k] for k in ("email", "proxy", "enabled", "autorestart") if k in body}
    if overlay_updates:
        registry.write_overlay(bot["id"], overlay_updates)

    prefix = body.get("prefix")
    admin = body.get("admin")
    name_bot = body.get("name_bot")
    ai_key = body.get("ai_key")
    cookie_raw = body.get("cookie")
    imei = body.get("imei")

    if bot["type"] == "python":
        cfg_path = os.path.join(bot["abs_dir"], bot["config_py"])
        if bot.get("settings_json"):
            config_writer.update_setting_json(
                os.path.join(bot["abs_dir"], bot["settings_json"]),
                {"prefix": prefix, "admin": admin, "name_bot": name_bot})
        else:
            config_writer.write_python_prefix_admin(cfg_path, prefix, admin)
        if ai_key:
            ai = bot.get("ai_key") or {}
            if ai.get("name"):
                config_writer.write_python_ai_key(cfg_path, ai["name"], ai_key)
        if cookie_raw or imei:
            config_writer.write_python_session(cfg_path, parse_cookie_input(cookie_raw), imei or "")
    else:
        if ai_key:
            config_writer.write_env_key(
                os.path.join(bot["abs_dir"], bot["env_file"]), "OPENAI_API_KEY", ai_key)
        if cookie_raw or imei:
            config_writer.write_node_session(
                os.path.join(bot["abs_dir"], bot["cookie_txt"]),
                os.path.join(bot["abs_dir"], bot["config_js"]),
                parse_cookie_input(cookie_raw), imei or "")


# --------------------------------------------------------------------------
# HTTP handler
# --------------------------------------------------------------------------
CONTENT_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml",
}


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *args):  # silence default noisy logging
        pass

    # --- response helpers ---
    def _json(self, obj, status=200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _file(self, path):
        if not os.path.isfile(path):
            return self._json({"detail": "Not found"}, 404)
        ext = os.path.splitext(path)[1]
        with open(path, "rb") as f:
            body = f.read()
        self.send_response(200)
        self.send_header("Content-Type", CONTENT_TYPES.get(ext, "application/octet-stream"))
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_body(self) -> dict:
        length = int(self.headers.get("Content-Length", 0) or 0)
        if not length:
            return {}
        raw = self.rfile.read(length)
        try:
            return json.loads(raw.decode("utf-8"))
        except Exception:
            return {}

    def _bot(self, bot_id):
        bot = registry.get_bot(bot_id)
        if not bot:
            self._json({"detail": "Bot khong ton tai"}, 404)
            return None
        return bot

    # --- routing ---
    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        qs = parse_qs(parsed.query)

        if path == "/":
            return self._file(os.path.join(HERE, "templates", "index.html"))
        if path.startswith("/static/"):
            rel = path[len("/static/"):]
            return self._file(os.path.join(HERE, "static", os.path.basename(rel)))
        if path == "/api/bots":
            return self._json({"bots": [bot_payload(b) for b in registry.all_bots()]})

        m = re.match(r"^/api/bots/([^/]+)(/.*)?$", path)
        if m:
            bot_id, rest = m.group(1), (m.group(2) or "")
            bot = self._bot(bot_id)
            if not bot:
                return
            if rest in ("", "/", "/settings"):
                payload = bot_payload(bot)
                payload["commands"] = registry.scan_commands(bot)
                return self._json(payload)
            if rest == "/commands":
                return self._json({"commands": registry.scan_commands(bot)})
            if rest == "/logs":
                after = int((qs.get("after", ["0"])[0]) or 0)
                return self._json({"logs": supervisor.get(bot_id).get_logs_since(after)})
            if rest == "/logs/stream":
                return self._sse(bot_id)
            if rest == "/qr/status":
                sess = qr_manager.get(bot_id)
                if not sess:
                    return self._json({"state": "idle", "message": "Chua bat dau dang nhap QR."})
                return self._json({
                    "state": sess.state, "message": sess.message,
                    "qr_image": sess.qr_image_b64, "result": sess.result,
                })
        return self._json({"detail": "Not found"}, 404)

    def do_POST(self):
        path = urlparse(self.path).path
        m = re.match(r"^/api/bots/([^/]+)(/.*)?$", path)
        if not m:
            return self._json({"detail": "Not found"}, 404)
        bot_id, rest = m.group(1), (m.group(2) or "")
        bot = self._bot(bot_id)
        if not bot:
            return
        bp = supervisor.get(bot_id)
        if rest == "/start":
            return self._json(bp.start())
        if rest == "/stop":
            return self._json(bp.stop())
        if rest == "/restart":
            return self._json(bp.restart())
        if rest == "/settings":
            apply_settings(bot, self._read_body())
            return self._json({"ok": True, "bot": bot_payload(bot)})
        if rest == "/qr/start":
            sess = qr_manager.start(bot_id)
            return self._json({"ok": True, "state": sess.state, "message": sess.message})
        if rest == "/qr/cancel":
            qr_manager.cancel(bot_id)
            return self._json({"ok": True})
        return self._json({"detail": "Not found"}, 404)

    # --- SSE log stream ---
    def _sse(self, bot_id):
        bp = supervisor.get(bot_id)
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "keep-alive")
        self.end_headers()
        last = 0
        try:
            for e in bp.tail(120):
                last = e["seq"]
                self.wfile.write(f"data: {json.dumps(e)}\n\n".encode("utf-8"))
            self.wfile.flush()
            while True:
                items = bp.get_logs_since(last)
                if items:
                    for e in items:
                        last = e["seq"]
                        self.wfile.write(f"data: {json.dumps(e)}\n\n".encode("utf-8"))
                    self.wfile.flush()
                else:
                    self.wfile.write(b": ping\n\n")
                    self.wfile.flush()
                time.sleep(1)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            return
        except Exception:
            return


def main():
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"Zalo Bot Manager dang chay tai http://localhost:{PORT}")
    print(f"Quan ly {len(registry.all_bots())} bot. Nhan Ctrl+C de dung.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.shutdown()


if __name__ == "__main__":
    main()
