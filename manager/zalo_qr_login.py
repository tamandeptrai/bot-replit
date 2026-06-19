"""Standalone Zalo QR login.

Implements the Zalo web QR-login HTTP flow with only the ``requests`` library
(no websockets / zlapi import). On success it returns the fresh session
cookies + a freshly generated imei, which can be written into each bot's
config to refresh an expired session.

This is the single fix for both reported problems:
  * "API/cookie expired"
  * "bot runs but does not receive commands from Zalo"
Both are caused by a stale Zalo session; a fresh QR login restores it.
"""
from __future__ import annotations

import base64
import hashlib
import re
import time
import uuid
from typing import Callable, Optional

import requests

DEFAULT_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)


class ZaloQRLoginError(Exception):
    pass


class ZaloQRLogin:
    def __init__(self, user_agent: Optional[str] = None, proxy: Optional[str] = None):
        self.user_agent = user_agent or DEFAULT_UA
        self.session = requests.Session()
        if proxy:
            self.session.proxies.update({"http": proxy, "https": proxy})

    # --- low level helpers ------------------------------------------------
    def _post_headers(self) -> dict:
        return {
            "Accept": "*/*",
            "Content-Type": "application/x-www-form-urlencoded",
            "Referer": "https://id.zalo.me/account?continue=https%3A%2F%2Fzalo.me%2Fpc",
            "User-Agent": self.user_agent,
        }

    def _load_login_page(self) -> str:
        url = "https://id.zalo.me/account?continue=https%3A%2F%2Fchat.zalo.me%2F"
        headers = {
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Referer": "https://chat.zalo.me/",
            "User-Agent": self.user_agent,
        }
        r = self.session.get(url, headers=headers, timeout=30)
        r.raise_for_status()
        m = re.search(r"https:\/\/stc-zlogin\.zdn\.vn\/main-([\d.]+)\.js", r.text)
        if not m:
            raise ZaloQRLoginError("Khong xac dinh duoc phien ban dang nhap Zalo.")
        return m.group(1)

    def _get_login_info(self, version: str) -> None:
        url = "https://id.zalo.me/account/logininfo"
        data = {"continue": "https://zalo.me/pc", "v": version}
        self.session.post(url, headers=self._post_headers(), data=data, timeout=30).raise_for_status()

    def _verify_client(self, version: str) -> None:
        url = "https://id.zalo.me/account/verify-client"
        data = {"type": "device", "continue": "https://zalo.me/pc", "v": version}
        self.session.post(url, headers=self._post_headers(), data=data, timeout=30).raise_for_status()

    def _generate(self, version: str) -> dict:
        url = "https://id.zalo.me/account/authen/qr/generate"
        data = {"continue": "https://zalo.me/pc", "v": version}
        r = self.session.post(url, headers=self._post_headers(), data=data, timeout=30)
        r.raise_for_status()
        result = r.json()
        if result.get("error_code") != 0:
            raise ZaloQRLoginError(f"Tao QR that bai: {result.get('error_message')}")
        return result.get("data", {})

    def _wait_for_scan(self, version: str, code: str, timeout: int, stop) -> dict:
        url = "https://id.zalo.me/account/authen/qr/waiting-scan"
        data = {"code": code, "continue": "https://chat.zalo.me/", "v": version}
        start = time.time()
        while time.time() - start < timeout:
            if stop and stop():
                raise ZaloQRLoginError("Da huy dang nhap.")
            r = self.session.post(url, headers=self._post_headers(), data=data, timeout=30)
            r.raise_for_status()
            result = r.json()
            if result.get("error_code") == 0 and result.get("data"):
                return result["data"]
            if result.get("error_code") != 8:
                raise ZaloQRLoginError(f"Loi khi cho quet ma: {result.get('error_message')}")
            time.sleep(1)
        raise ZaloQRLoginError("Het thoi gian cho quet ma QR.")

    def _wait_for_confirm(self, version: str, code: str, timeout: int, stop) -> dict:
        url = "https://id.zalo.me/account/authen/qr/waiting-confirm"
        data = {
            "code": code, "gToken": "", "gAction": "CONFIRM_QR",
            "continue": "https://chat.zalo.me/", "v": version,
        }
        start = time.time()
        while time.time() - start < timeout:
            if stop and stop():
                raise ZaloQRLoginError("Da huy dang nhap.")
            r = self.session.post(url, headers=self._post_headers(), data=data, timeout=30)
            r.raise_for_status()
            result = r.json()
            if result.get("error_code") != 8:
                return result
            time.sleep(1)
        raise ZaloQRLoginError("Het thoi gian cho xac nhan dang nhap.")

    def _check_session(self) -> None:
        url = "https://id.zalo.me/account/checksession?continue=https%3A%2F%2Fchat.zalo.me%2Findex.html"
        headers = {
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Referer": "https://id.zalo.me/account?continue=https%3A%2F%2Fchat.zalo.me%2F",
            "User-Agent": self.user_agent,
        }
        self.session.get(url, headers=headers, timeout=30).raise_for_status()

    def _get_user_info(self) -> dict:
        url = "https://jr.chat.zalo.me/jr/userinfo"
        headers = {"Accept": "*/*", "Referer": "https://chat.zalo.me/", "User-Agent": self.user_agent}
        r = self.session.get(url, headers=headers, timeout=30)
        r.raise_for_status()
        return r.json()

    def _finalize(self) -> dict:
        cookies = self.session.cookies.get_dict()
        imei = f"{uuid.uuid4()}-{hashlib.md5(self.user_agent.encode()).hexdigest()}"
        url = (
            "https://wpa.chat.zalo.me/api/login/getLoginInfo?"
            f"imei={imei}&type=30&client_version=650&ts={int(time.time() * 1000)}"
        )
        r = self.session.get(url, headers={"User-Agent": self.user_agent}, timeout=30)
        r.raise_for_status()
        data = r.json()
        uid = None
        if data.get("error_code") == 0 and "data" in data:
            uid = str(data["data"].get("uid"))
        return {"cookies": cookies, "imei": imei, "uid": uid}

    # --- public flow ------------------------------------------------------
    def login(
        self,
        qr_path: str,
        on_qr_generated: Optional[Callable[[str], None]] = None,
        stop: Optional[Callable[[], bool]] = None,
        scan_timeout: int = 120,
    ) -> dict:
        version = self._load_login_page()
        self._get_login_info(version)
        self._verify_client(version)

        qr_data = self._generate(version)
        code = qr_data.get("code")
        image_b64 = qr_data.get("image", "").replace("data:image/png;base64,", "")
        if not (code and image_b64):
            raise ZaloQRLoginError(f"Tao ma QR that bai. Phan hoi: {qr_data}")

        with open(qr_path, "wb") as f:
            f.write(base64.b64decode(image_b64))
        if on_qr_generated:
            on_qr_generated(qr_path)

        scan_info = self._wait_for_scan(version, code, scan_timeout, stop)
        display_name = scan_info.get("display_name", "Nguoi dung")

        confirm = self._wait_for_confirm(version, code, scan_timeout, stop)
        if confirm.get("error_code") == -13:
            raise ZaloQRLoginError("Dang nhap da bi tu choi tren dien thoai.")
        if confirm.get("error_code") != 0:
            raise ZaloQRLoginError(f"Xac nhan dang nhap that bai. Phan hoi: {confirm}")

        self._check_session()
        user_info = self._get_user_info()
        if not user_info.get("data", {}).get("logged"):
            raise ZaloQRLoginError("Phien dang nhap khong hop le.")

        result = self._finalize()
        info = user_info["data"].get("info", {})
        result["name"] = info.get("name") or display_name
        result["user_agent"] = self.user_agent
        return result
