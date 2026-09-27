# Decision Tree Seminar

Bộ slide thuyết trình HTML/CSS về **Decision Tree**, kèm **demo realtime** (Socket.IO).

## Chạy (bắt buộc cho demo live)

```bash
npm install
npm start
```

Mở:
- Slides (màn hình chiếu): http://localhost:3000/
- Control (admin chọn slide): http://localhost:3000/control
- Setting (ẩn/hiện + sửa text): http://localhost:3000/setting
- Join (điện thoại): http://localhost:3000/join.html  
  (hoặc quét QR trên slide **Live demo** / dùng IP LAN cùng WiFi)

## Điều khiển từ xa

1. Mở **Slides** trên máy chiếu
2. Mở **Control** trên điện thoại / laptop phụ
3. Bấm slide trong danh sách (hoặc ← →) → màn hình chiếu nhảy đúng trang

Cả hai trang đồng bộ realtime qua Socket.IO.

## Tuỳ chỉnh slide (kiểu PowerPoint)

Mở http://localhost:3000/setting

1. Dải **thumbnail** bên trái — chọn slide, nút Hiện/Ẩn từng slide
2. **Canvas giữa** — bấm trực tiếp vào chữ trên slide để sửa (như PowerPoint)
3. **Lưu** (hoặc `Ctrl/Cmd+S`) → refresh trang slides để trình chiếu
4. **Reset gốc** xoá toàn bộ tuỳ chỉnh

Cấu hình lưu tại `data/settings.json`.

## Điều khiển slide

| Phím / thao tác | Hành động |
|-----------------|-----------|
| `→` `Space` `Enter` | Slide tiếp |
| `←` `Backspace` | Slide trước |
| Vuốt trái/phải | Chuyển slide |

## Live demo

1. Mở slides trên máy chiếu → tới slide **Demo: có tham dự buổi thuyết trình?**
2. Khán giả quét QR → nhập tên + chọn Rảnh / Thích chủ đề / Hình thức / Tham dự
3. Bảng và cây quyết định trên màn hình **cập nhật ngay** (ID3 / Information Gain)
4. Nút **Reset dữ liệu** trả về 3 mẫu: Luân, Thông, Kiên

## Nội dung slide

Mở đầu → khái niệm → ví dụ → Entropy/Gini → picnic → thuật toán → ưu/nhược → **live demo (thuyết trình)** → Q&A
