# Chạy từ số không — 3 lệnh

> Cần một VPS Ubuntu luôn bật. Trong video mình dùng **Hostinger VPS** với template **Claude Code cài sẵn**
> (đỡ được bước cài Claude Code): `hostinger.com/vps/claude-code-hosting` · mã `HOLETEXAGENTS`.
> Không dùng Hostinger cũng chạy được — script tự cài những gì còn thiếu.

## 1. SSH vào VPS rồi chạy 3 lệnh này

```bash
git clone https://github.com/holetexvn/oncall-agent.git ~/oncall-agent
cd ~/oncall-agent
./deploy/setup-vps.sh
```

Script tự lo: Node 24 · GitHub CLI · Claude Code · thư viện · timezone Việt Nam ·
3 service chạy nền (systemd) · mở tường lửa. Chạy lại nhiều lần cũng không sao.

## 2. Điền 3 token vào `.env`

```bash
nano ~/oncall-agent/.env
```

| Biến | Lấy ở đâu |
|---|---|
| `CLAUDE_CODE_OAUTH_TOKEN` | chạy `claude setup-token` ngay trên VPS, copy chuỗi in ra |
| `GH_TOKEN` | GitHub → Settings → Developer settings → **Fine-grained token**, chỉ repo này, quyền **Contents: write** + **Pull requests: write**. Xong chạy `gh auth setup-git` |
| `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` | @BotFather tạo bot; nhắn bot 1 tin rồi mở `https://api.telegram.org/bot<TOKEN>/getUpdates` để lấy chat id |

Rồi bật bot duyệt PR: `sudo systemctl start oncall-approve-bot`

## 3. Kiểm tra và chạy thử

```bash
./deploy/preflight.sh                                   # phải xanh hết
./demo-app/simulate-customers.sh http://localhost:3000 3
```

Sẽ thấy: 2 khách đầu → *chờ*, khách thứ 3 → **TRIGGER** → agent tái hiện lỗi, sửa, chạy test,
mở PR → Telegram báo về kèm nút **✅ Merge**.

Xem agent đang làm gì: `sudo journalctl -u oncall-receiver -f`

## Quay lại từ đầu (giữa các lần thử)

```bash
./deploy/reset-demo.sh
```
Xoá trạng thái đếm, trả code về nguyên trạng, đóng PR cũ, khởi động lại service.

## Chi phí thật đo được
Một incident: **~$1.59** tiền API, **167 giây** từ lúc kích hoạt tới lúc PR mở (Claude Code 2.1.235).
Trần chi tiêu đặt trong `.env` qua `MAX_BUDGET_USD` — chạm trần là dừng.

## Không muốn cài gì cả, chỉ muốn xem pipeline chạy?
```bash
npm install && DRY_RUN=1 npm run test:e2e     # chạy giả lập, không tốn tiền, không cần token
```
