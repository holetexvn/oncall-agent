# oncall-kit — plugin đóng gói cả Level 2

Bốn thứ đã dựng rời ở `.claude/` nay gói thành **một** thứ cài được bằng một lệnh:

| Trong plugin | Gồm |
|---|---|
| `skills/` | `incident-triage` (runbook lúc sự cố) · `postmortem` (báo cáo sau sự cố) |
| `agents/` | `security-reviewer` · `test-runner` · `explorer` |
| `hooks/hooks.json` | chặn lệnh phá · chặn ghi secret · chặn agent sửa luật của chính nó · cổng test |
| `.mcp.json` | MCP server đọc kho incident |

## Cài
```bash
claude plugin validate ./plugin/oncall-kit     # kiểm tra manifest hợp lệ
claude plugin install ./plugin/oncall-kit      # hoặc trỏ tới marketplace của team
claude plugin details oncall-kit               # xem nó nạp gì, tốn bao nhiêu context
```

## Vì sao đóng gói
Level 2 làm rời thì chỉ máy bạn có. Đóng thành plugin thì **người mới vào team cài một lệnh là có
đúng quy trình, đúng luật an toàn, đúng bộ subagent** — không ai phải chép tay `.claude/` của người khác.

⚠️ **Bẫy:** cài plugin của người lạ nghĩa là **hook của người lạ chạy shell trên máy bạn**.
Mở `hooks/hooks.json` và `hooks-handlers/*` đọc trước khi cài. Plugin này chỉ có 4 hook, đều là script
thuần bash, đọc hết trong 2 phút.
