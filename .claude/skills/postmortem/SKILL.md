---
name: postmortem
description: Viết postmortem không đổ lỗi sau khi một incident đã được xử lý xong. Dùng khi PR fix đã merge, khi người dùng nói "viết postmortem", "tổng kết sự cố", "làm báo cáo hậu sự cố", hoặc cuối tuần tổng kết các incident đã qua.
---

# Postmortem — không đổ lỗi, ra được việc

Nguồn dữ liệu: `receiver/state/issues.json` (số khách, mốc thời gian), `worker/runs/run-<id>.json`
(chẩn đoán của agent, chi phí, thời gian), và PR đã merge.

## Nguyên tắc
- **Không nêu tên ai làm sai.** Hỏi "hệ thống nào cho phép chuyện này xảy ra", không hỏi "ai gây ra".
- Mỗi action item phải **có người chịu trách nhiệm và ngày**, nếu không thì nó không tồn tại.
- Phân biệt rõ: cái gì **đã sửa** (fix) và cái gì **ngăn tái diễn** (prevent). Postmortem chỉ có fix là postmortem hỏng.

## Cấu trúc bắt buộc
1. **Tóm tắt** — 3 câu: chuyện gì, ai bị ảnh hưởng, kéo dài bao lâu.
2. **Mức ảnh hưởng** — số khách, số request lỗi, khoảng thời gian, endpoint nào.
3. **Dòng thời gian** — mốc đầu tiên gặp lỗi → lúc vượt ngưỡng → lúc agent mở PR → lúc merge. Ghi giờ thật.
4. **Nguyên nhân gốc** — đi tới tầng cơ chế, không dừng ở "thiếu validate". Vì sao thiếu validate lại lọt được tới production?
5. **Vì sao không phát hiện sớm hơn** — thiếu test? thiếu cảnh báo? ngưỡng quá cao?
6. **Đã làm gì** — fix, PR nào, ai duyệt.
7. **Ngăn tái diễn** — 2–4 action item, mỗi cái có chủ và deadline. Ví dụ: thêm schema validation cho toàn bộ handler; thêm test cho input thiếu field; hạ ngưỡng cảnh báo cho endpoint thanh toán.
8. **Đã học được gì** — kể cả điều tốt: cái gì đã hoạt động đúng.

## Đầu ra
Ghi vào `postmortems/<ngày>-<id>.md`. Không sửa code trong lúc viết postmortem.
