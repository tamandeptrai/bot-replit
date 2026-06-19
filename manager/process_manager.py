"""Subprocess lifecycle + log capture + auto-restart supervisor."""
from __future__ import annotations

import os
import re
import subprocess
import threading
import time
from collections import deque
from datetime import datetime, timezone
from typing import Optional

import registry

IS_WINDOWS = os.name == "nt"
ERROR_RE = re.compile(r"(Traceback|Error|Exception|Lỗi|loi|ECONNREFUSED|UnhandledPromise)", re.IGNORECASE)
LAUNCHER = os.path.join(os.path.dirname(os.path.abspath(__file__)), "bot_launcher.py")


def build_command(bot: dict) -> list[str]:
    """Wrap python bots in the launcher so their dir is on sys.path."""
    entry = list(bot["entry"])
    if entry and entry[0] == "python":
        return ["python", "-u", LAUNCHER, *entry[1:]]
    return entry


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class BotProcess:
    def __init__(self, bot: dict):
        self.bot = bot
        self.proc: Optional[subprocess.Popen] = None
        self.status = "stopped"  # stopped | starting | running | crashed | stopping
        self.last_error: Optional[str] = None
        self.started_at: Optional[float] = None
        self.exit_code: Optional[int] = None
        self.restart_count = 0
        self._intentional_stop = False
        self._lock = threading.Lock()
        self._log_buf: deque = deque(maxlen=4000)
        self._seq = 0
        self._log_path = os.path.join(registry.LOG_DIR, f"{bot['id']}.log")

    # --- logging ----------------------------------------------------------
    def _add_log(self, line: str, kind: str = "out") -> None:
        line = line.rstrip("\n")
        with self._lock:
            self._seq += 1
            entry = {"seq": self._seq, "ts": _now(), "kind": kind, "text": line}
            self._log_buf.append(entry)
            if kind == "err" or ERROR_RE.search(line):
                self.last_error = line[:500]
        try:
            with open(self._log_path, "a", encoding="utf-8", errors="replace") as f:
                f.write(line + "\n")
        except Exception:
            pass

    def get_logs_since(self, after_seq: int, limit: int = 500) -> list[dict]:
        with self._lock:
            items = [e for e in self._log_buf if e["seq"] > after_seq]
        return items[-limit:]

    def tail(self, n: int = 200) -> list[dict]:
        with self._lock:
            return list(self._log_buf)[-n:]

    # --- process lifecycle ------------------------------------------------
    def is_alive(self) -> bool:
        return self.proc is not None and self.proc.poll() is None

    def start(self) -> dict:
        if self.is_alive():
            return {"ok": True, "status": self.status, "message": "Bot dang chay roi."}
        self._intentional_stop = False
        self.last_error = None
        self.exit_code = None
        self.status = "starting"

        env = os.environ.copy()
        env["PYTHONUNBUFFERED"] = "1"
        env["PYTHONIOENCODING"] = "utf-8"
        ov = registry.read_overlay(self.bot["id"])
        proxy = ov.get("proxy")
        if proxy:
            env["HTTP_PROXY"] = proxy
            env["HTTPS_PROXY"] = proxy

        creationflags = 0
        if IS_WINDOWS:
            creationflags = subprocess.CREATE_NEW_PROCESS_GROUP

        cmd = build_command(self.bot)
        try:
            self.proc = subprocess.Popen(
                cmd,
                cwd=self.bot["abs_dir"],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                env=env,
                bufsize=1,
                universal_newlines=True,
                encoding="utf-8",
                errors="replace",
                creationflags=creationflags,
            )
        except Exception as e:
            self.status = "crashed"
            self.last_error = f"Khong the khoi dong: {e}"
            self._add_log(f"[manager] {self.last_error}", "err")
            return {"ok": False, "status": self.status, "message": self.last_error}

        self.started_at = time.time()
        self.status = "running"
        self._add_log(f"[manager] Da khoi dong: {' '.join(cmd)} (cwd={self.bot['abs_dir']})")
        threading.Thread(target=self._reader, daemon=True).start()
        return {"ok": True, "status": self.status, "message": "Da khoi dong bot."}

    def _reader(self) -> None:
        assert self.proc is not None
        try:
            for line in self.proc.stdout:  # type: ignore
                self._add_log(line, "out")
        except Exception as e:
            self._add_log(f"[manager] Loi doc log: {e}", "err")
        finally:
            self.exit_code = self.proc.poll()
            if self._intentional_stop:
                self.status = "stopped"
                self._add_log("[manager] Bot da dung.")
            else:
                self.status = "crashed"
                self._add_log(f"[manager] Bot thoat bat thuong (code={self.exit_code}).", "err")

    def stop(self) -> dict:
        self._intentional_stop = True
        self.status = "stopping"
        if not self.is_alive():
            self.status = "stopped"
            return {"ok": True, "status": self.status, "message": "Bot da dung san."}
        pid = self.proc.pid  # type: ignore
        try:
            if IS_WINDOWS:
                subprocess.run(["taskkill", "/F", "/T", "/PID", str(pid)],
                               capture_output=True, timeout=20)
            else:
                self.proc.terminate()  # type: ignore
                try:
                    self.proc.wait(timeout=10)  # type: ignore
                except Exception:
                    self.proc.kill()  # type: ignore
        except Exception as e:
            self._add_log(f"[manager] Loi khi dung bot: {e}", "err")
        self.status = "stopped"
        self._add_log("[manager] Da gui lenh dung bot.")
        return {"ok": True, "status": self.status, "message": "Da dung bot."}

    def restart(self) -> dict:
        self.stop()
        time.sleep(1.5)
        return self.start()

    def info(self) -> dict:
        uptime = int(time.time() - self.started_at) if (self.started_at and self.is_alive()) else 0
        return {
            "status": self.status,
            "alive": self.is_alive(),
            "pid": self.proc.pid if self.is_alive() else None,
            "uptime": uptime,
            "exit_code": self.exit_code,
            "last_error": self.last_error,
            "restart_count": self.restart_count,
        }


class Supervisor:
    """Auto-restart crashed bots with exponential backoff (the 'auto-fix')."""

    def __init__(self):
        self.procs: dict[str, BotProcess] = {b["id"]: BotProcess(b) for b in registry.all_bots()}
        self._backoff: dict[str, float] = {}
        self._next_try: dict[str, float] = {}
        self._stop = False
        threading.Thread(target=self._loop, daemon=True).start()

    def get(self, bot_id: str) -> Optional[BotProcess]:
        return self.procs.get(bot_id)

    def _loop(self) -> None:
        while not self._stop:
            for bot_id, bp in self.procs.items():
                ov = registry.read_overlay(bot_id)
                if bp.status == "crashed" and ov.get("autorestart", True) and not bp._intentional_stop:
                    now = time.time()
                    if now >= self._next_try.get(bot_id, 0):
                        backoff = min(self._backoff.get(bot_id, 5) * 1.5, 120)
                        self._backoff[bot_id] = backoff
                        self._next_try[bot_id] = now + backoff
                        bp.restart_count += 1
                        bp._add_log(f"[auto-fix] Tu dong khoi dong lai (lan {bp.restart_count}, backoff {int(backoff)}s).")
                        bp.start()
                elif bp.status == "running":
                    self._backoff[bot_id] = 5  # reset backoff once healthy
            time.sleep(3)
