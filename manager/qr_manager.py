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
    def __init__(self, bot_id: str, target_ids: list[str] | None = None):
        self.bot_id = bot_id
        # bots that the resulting session will be written into
        self.target_ids = target_ids or [bot_id]
        self.applied: list[str] = []
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

    def start(self, bot_id: str, target_ids: list[str] | None = None) -> QRSession:
        """Start a QR login. bot_id == "__all__" logs in once and applies the
        resulting session to every bot in target_ids (default: all bots)."""
        if bot_id == "__all__":
            ids = target_ids or [b["id"] for b in registry.all_bots()]
            ids = [i for i in ids if registry.get_bot(i)]
            if not ids:
                raise ValueError("Khong co bot nao de ap dung")
            targets, proxy_id = ids, ids[0]
        else:
            bot = registry.get_bot(bot_id)
            if not bot:
                raise ValueError("Bot khong ton tai")
            targets, proxy_id = [bot_id], bot_id
        with self._lock:
            old = self.sessions.get(bot_id)
            if old:
                old.stop()
            sess = QRSession(bot_id, targets)
            self.sessions[bot_id] = sess
        threading.Thread(target=self._run, args=(sess, proxy_id), daemon=True).start()
        return sess

    def get(self, bot_id: str) -> QRSession | None:
        return self.sessions.get(bot_id)

    def cancel(self, bot_id: str) -> None:
        sess = self.sessions.get(bot_id)
        if sess:
            sess.stop()
            sess.state = "cancelled"
            sess.message = "Da huy."

    def _run(self, sess: QRSession, proxy_id: str) -> None:
        qr_path = os.path.join(registry.SESSION_DIR, f"{sess.bot_id}_qr.png")
        proxy = registry.read_overlay(proxy_id).get("proxy") or None

        def on_qr(path: str) -> None:
            with open(path, "rb") as f:
                sess.qr_image_b64 = base64.b64encode(f.read()).decode()
            sess.state = "waiting_scan"
            sess.message = "Quet ma QR bang Zalo tren dien thoai cua tai khoan nay."

        try:
            client = ZaloQRLogin(proxy=proxy)
            result = client.login(qr_path=qr_path, on_qr_generated=on_qr, stop=lambda: sess._stop)
            applied: list[str] = []
            for bid in sess.target_ids:
                b = registry.get_bot(bid)
                if not b:
                    continue
                self._apply_session(b, result)
                applied.append(b["name"])
            sess.applied = applied
            sess.result = {k: v for k, v in result.items() if k != "cookies"}
            sess.result["cookie_count"] = len(result.get("cookies", {}))
            sess.result["applied_to"] = applied
            sess.state = "success"
            if len(applied) > 1:
                sess.message = (f"Dang nhap thanh cong ({result.get('name')}). "
                                f"Da ap dung cho {len(applied)} bot: {', '.join(applied)}")
            else:
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
