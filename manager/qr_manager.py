"""Run Zalo QR login in a background thread and write the result into bot config."""
from __future__ import annotations

import base64
import os
import threading
import time
from datetime import datetime, timezone

import config_writer
import registry
from zalo_qr_login import ZaloQRLogin, ZaloQRLoginError


class QRSession:
    def __init__(self, bot_id: str):
        self.bot_id = bot_id
        self.state = "starting"  # starting | waiting_scan | success | error | cancelled
        self.message = ""
        self.qr_image_b64: str | None = None
        self.result: dict | None = None
        self._stop = False
        self.created = time.time()

    def stop(self) -> None:
        self._stop = True


class QRManager:
    def __init__(self):
        self.sessions: dict[str, QRSession] = {}
        self._lock = threading.Lock()

    def start(self, bot_id: str) -> QRSession:
        bot = registry.get_bot(bot_id)
        if not bot:
            raise ValueError("Bot khong ton tai")
        with self._lock:
            old = self.sessions.get(bot_id)
            if old:
                old.stop()
            sess = QRSession(bot_id)
            self.sessions[bot_id] = sess
        threading.Thread(target=self._run, args=(bot, sess), daemon=True).start()
        return sess

    def get(self, bot_id: str) -> QRSession | None:
        return self.sessions.get(bot_id)

    def cancel(self, bot_id: str) -> None:
        sess = self.sessions.get(bot_id)
        if sess:
            sess.stop()
            sess.state = "cancelled"
            sess.message = "Da huy."

    def _run(self, bot: dict, sess: QRSession) -> None:
        qr_path = os.path.join(registry.SESSION_DIR, f"{bot['id']}_qr.png")
        ov = registry.read_overlay(bot["id"])
        proxy = ov.get("proxy") or None

        def on_qr(path: str) -> None:
            with open(path, "rb") as f:
                sess.qr_image_b64 = base64.b64encode(f.read()).decode()
            sess.state = "waiting_scan"
            sess.message = "Quet ma QR bang Zalo tren dien thoai cua tai khoan nay."

        try:
            client = ZaloQRLogin(proxy=proxy)
            result = client.login(qr_path=qr_path, on_qr_generated=on_qr, stop=lambda: sess._stop)
            self._apply_session(bot, result)
            sess.result = {k: v for k, v in result.items() if k != "cookies"}
            sess.result["cookie_count"] = len(result.get("cookies", {}))
            sess.state = "success"
            sess.message = f"Dang nhap thanh cong: {result.get('name')}"
        except ZaloQRLoginError as e:
            sess.state = "error"
            sess.message = str(e)
        except Exception as e:  # noqa: BLE001
            sess.state = "error"
            sess.message = f"Loi khong mong muon: {e}"

    def _apply_session(self, bot: dict, result: dict) -> None:
        cookies = result["cookies"]
        imei = result["imei"]
        if bot["type"] == "python":
            config_writer.write_python_session(
                os.path.join(bot["abs_dir"], bot["config_py"]), cookies, imei)
        else:
            config_writer.write_node_session(
                os.path.join(bot["abs_dir"], bot["cookie_txt"]),
                os.path.join(bot["abs_dir"], bot["config_js"]),
                cookies, imei)
        registry.write_overlay(bot["id"], {
            "last_login": {
                "name": result.get("name"),
                "uid": result.get("uid"),
                "at": datetime.now(timezone.utc).isoformat(),
            }
        })
