# MCP dùng trong demo Level 2 (2c)

| Server | Lệnh thêm | Dùng để | Bật khi |
|---|---|---|---|
| Notion | `claude mcp add --transport http notion https://mcp.notion.com/mcp` | đọc spec, ghi kết quả vào task | project có spec trên Notion |
| Postgres | `claude mcp add postgres -- npx -y @modelcontextprotocol/server-postgres $DATABASE_URL` | query schema thật thay vì đoán | làm việc với DB |
| Playwright | `claude mcp add playwright -- npx -y @playwright/mcp@latest` | tự mở web, bấm, chụp màn hình để test UI | có frontend |
| GitHub | `claude mcp add --transport http github https://api.githubcopilot.com/mcp/` | đọc issue, comment PR | repo trên GitHub |
| Sentry | `claude mcp add --transport http sentry https://mcp.sentry.dev/mcp` | đọc issue/stack trace | Level 3 on-call (thay cho webhook payload rút gọn) |

Bẫy: mỗi server thêm tool description vào context. `claude mcp list` để xem đang bật gì; tắt cái không dùng cho project này.
Lệnh chính xác đổi theo thời gian — kiểm tra `claude mcp add --help` và trang của từng server trước khi quay.
