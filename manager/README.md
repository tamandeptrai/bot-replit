# Zalo Bot Manager

Trang web quản lý tập trung cho nhiều bot Zalo (Python & Node.js). Một chỗ để:

- **Đăng nhập lại bằng QR** → tự ghi cookie + imei mới vào từng bot (sửa lỗi *API hết hạn* và *bot chạy nhưng không nhận lệnh từ Zalo* — cả hai đều do phiên đăng nhập Zalo cũ).
- **Bật / Tắt / Khởi động lại** bot.
- **Xem log trực tiếp** (streaming) và **danh sách lệnh** của từng bot.
- **Tự động sửa lỗi**: bot crash thì tự khởi động lại (auto-restart, backoff luỹ thừa).
- **Gắn email / cookie / imei / proxy** và **API key (Gemini / OpenAI)** cho từng bot.
- **Đổi qua lại giữa các bot** ở cột bên trái.

Chỉ dùng **thư viện chuẩn của Python** + `requests`, nên **không cần `pip install`** gì nhiều.

## Chạy

```bash
cd manager
python app.py
# Mở http://localhost:8500
```

Đổi cổng: đặt biến môi trường `PORT` (mặc định `8500`).

## Bot nằm ở đâu? (`BOTS_ROOT`)

Manager đọc danh sách bot từ `bots.json`. Mỗi bot có trường `dir` là đường dẫn **tương đối** so với `BOTS_ROOT`.

- Mặc định `BOTS_ROOT` = thư mục **cha** của `manager/` (đặt `manager/` cạnh các thư mục bot).
- Hoặc trỏ thẳng:

```bash
BOTS_ROOT="/đường/dẫn/tới/thư-mục-chứa-bot" python app.py
```

Cấu trúc mong đợi:

```
<BOTS_ROOT>/
├── manager/                      # app này
├── hhh-pycon/zalo-bot-master/    # bot 1 (python)
├── betiencute/bétiêncute/        # bot 2 (python)
├── botksang/200ka/1/2/3/         # bot 3 (python)
└── Bot_Zalo_Version/.../sele/    # bot 4 (node)
```

## Thêm / đổi bot

Sửa `bots.json`. Mỗi mục:

```json
{
  "id": "id_ngan_gon",
  "name": "Tên hiển thị",
  "type": "python",            // hoặc "node"
  "dir": "duong/dan/toi/bot",  // tương đối với BOTS_ROOT
  "entry": ["python", "main.py"],
  "config_py": "config.py",     // file cấu hình python
  "settings_json": "seting.json", // null nếu prefix/admin nằm trong config.py
  "prefix_in_config": false,
  "ai_key": { "name": "GEMINI_API_KEY", "file": "config.py" }
}
```

Bot Node dùng `config_js`, `cookie_txt`, `env_file` thay cho `config_py`.

## Phụ thuộc của từng bot

Manager chạy bot bằng `python`/`node` có sẵn. **Bản thân mỗi bot vẫn cần cài thư viện riêng** trước khi chạy được:

- Bot Python: xem `requirements-bots.txt` (gộp từ 4 bot) — `pip install -r requirements-bots.txt`.
- Bot Node: `cd <thư-mục-bot> && npm install`.

## Lưu ý

- Trang web **không có đăng nhập** — chỉ dùng nội bộ (localhost / mạng tin cậy).
- Cookie + imei là **thông tin nhạy cảm**; thư mục `data/` đã được `.gitignore`.
