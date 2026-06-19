"""Write Zalo session (cookies + imei) and settings into each bot's own config.

Python bots store ``IMEI`` and ``SESSION_COOKIES`` as module-level assignments
in ``config.py``. The Node bot reads a raw cookie string from ``cookie.txt`` and
``imei`` from ``config.js``.
"""
from __future__ import annotations

import json
import os
import re
from typing import Optional


def _read(path: str) -> str:
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def _write(path: str, content: str) -> None:
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)


def cookies_to_raw(cookies: dict) -> str:
    return "; ".join(f"{k}={v}" for k, v in cookies.items())


# --------------------------------------------------------------------------
# Python config.py editing
# --------------------------------------------------------------------------
def _replace_assignment(src: str, var: str, new_literal: str) -> str:
    """Replace ``VAR = <something>`` (single line) with ``VAR = new_literal``."""
    pattern = re.compile(rf"^(\s*){re.escape(var)}\s*=\s*.*$", re.MULTILINE)
    if pattern.search(src):
        return pattern.sub(rf"\g<1>{var} = {new_literal}", src, count=1)
    return src.rstrip() + f"\n{var} = {new_literal}\n"


def _replace_dict_assignment(src: str, var: str, new_dict: dict) -> str:
    """Replace ``VAR = {...}`` (possibly multi-line, flat dict) with new dict."""
    literal = json.dumps(new_dict, ensure_ascii=False)
    pattern = re.compile(rf"{re.escape(var)}\s*=\s*\{{.*?\}}", re.DOTALL)
    if pattern.search(src):
        return pattern.sub(f"{var} = {literal}", src, count=1)
    return src.rstrip() + f"\n{var} = {literal}\n"


def write_python_session(config_py_path: str, cookies: dict, imei: str) -> None:
    src = _read(config_py_path)
    src = _replace_assignment(src, "IMEI", json.dumps(imei))
    src = _replace_dict_assignment(src, "SESSION_COOKIES", cookies)
    _write(config_py_path, src)


def write_python_ai_key(config_py_path: str, var_name: str, value: str) -> None:
    src = _read(config_py_path)
    src = _replace_assignment(src, var_name, json.dumps(value))
    _write(config_py_path, src)


def write_python_prefix_admin(config_py_path: str, prefix: Optional[str], admin: Optional[str]) -> None:
    src = _read(config_py_path)
    if prefix is not None:
        src = _replace_assignment(src, "PREFIX", json.dumps(prefix))
    if admin is not None:
        src = _replace_assignment(src, "ADMIN", json.dumps(admin))
    _write(config_py_path, src)


# --------------------------------------------------------------------------
# seting.json editing (bots that read prefix/admin/name from JSON)
# --------------------------------------------------------------------------
def update_setting_json(path: str, updates: dict) -> None:
    data = {}
    if os.path.exists(path):
        try:
            data = json.loads(_read(path))
        except Exception:
            data = {}
    for k, v in updates.items():
        if v is not None:
            data[k] = v
    _write(path, json.dumps(data, ensure_ascii=False, indent=4))


# --------------------------------------------------------------------------
# Node bot (config.js + cookie.txt + .env)
# --------------------------------------------------------------------------
def write_node_session(cookie_txt_path: str, config_js_path: str, cookies: dict, imei: str) -> None:
    _write(cookie_txt_path, cookies_to_raw(cookies))
    src = _read(config_js_path)
    src = re.sub(r'imei\s*:\s*"[^"]*"', f'imei: "{imei}"', src, count=1)
    _write(config_js_path, src)


def write_env_key(env_path: str, key: str, value: str) -> None:
    lines = []
    if os.path.exists(env_path):
        lines = _read(env_path).splitlines()
    found = False
    for i, line in enumerate(lines):
        if re.match(rf"^\s*{re.escape(key)}\s*=", line):
            lines[i] = f"{key}={value}"
            found = True
            break
    if not found:
        lines.append(f"{key}={value}")
    _write(env_path, "\n".join(lines) + "\n")
