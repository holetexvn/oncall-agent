# oncall-agent

Pipeline: khách gặp lỗi → Sentry → `receiver/` (đếm ngưỡng) → `worker/` chạy `claude -p` với skill `incident-triage` → PR → duyệt qua Telegram.

## Stack
Node 24, Express 5, ESM. Test: `node --test demo-app/*.test.js`. Không dùng TypeScript.

## Bố cục
- `receiver/` — webhook Sentry, verify HMAC, đếm số khách gặp cùng lỗi, spawn worker
- `worker/` — dựng câu lệnh `claude -p` + `task.md` + `result-schema.json`
- `reporter/` — gửi Telegram, nút duyệt PR
- `demo-app/` — app mẫu có bug cài sẵn để quay demo
- `.claude/` — skill, hook, subagent (đây là Level 2 của video)

## ĐỪNG LÀM
- Đừng sửa `worker/index.js` khi đang xử lý incident — đó là code chạy chính bạn.
- Đừng chạm `.env`, đừng in giá trị token ra log.
- Đừng merge PR, đừng deploy, đừng restart service. Mở PR rồi để người duyệt.
- Đừng push thẳng lên `main`.

## Khi xử lý incident
Theo skill `incident-triage`. Verify bằng tái hiện trước, fix tối thiểu, test phải fail trước pass sau.
