# Nối Sentry → receiver

1. Sentry → Settings → Developer Settings → **Create New Integration** → *Internal Integration*
2. Webhook URL: `http://<IP-VPS>:8080/webhook/sentry` (nên để sau Caddy/nginx có HTTPS khi làm thật)
3. Bật **Alert Rule Action** và webhook **issue: created**
4. Permissions: Issue & Event → Read
5. Lấy **Client Secret** → `SENTRY_CLIENT_SECRET` trong `.env` (receiver verify HMAC bằng cái này)
6. Project demo-app → Alerts → tạo rule "A new issue is created" → action: gửi tới integration vừa tạo
7. Test: `demo-app/simulate-customers.sh http://<IP-VPS>:3000 3` (3 khách). Muốn Sentry tự lọc ngưỡng: Alert rule "The issue is seen by more than 3 users in 30 minutes" → chỉ gọi webhook khi đủ → xem `journalctl -u oncall-receiver -f`
