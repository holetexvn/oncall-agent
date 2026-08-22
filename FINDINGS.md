# Đã verify trên máy thật — Claude Code 2.1.235 (macOS, 19/08/2026)

Dùng để điền các chỗ `***` trong script và để tự tin đọc lời thoại.

## 1. `--bare` KHÔNG dùng được đăng nhập keychain
`claude -p --bare ...` trả `"result": "Not logged in · Please run /login"` dù `claude` thường đã login.
Help ghi rõ `--bare` skip *keychain reads*. → Trên VPS phải có `ANTHROPIC_API_KEY` **hoặc** `CLAUDE_CODE_OAUTH_TOKEN` (từ `claude setup-token`) trong env.
Lời thoại Section 4/5: "`--bare` không đọc keychain, nên script phải cầm token trong env — đó cũng là lý do `setup-token` tồn tại."
(Cần thử lại trên VPS với CLAUDE_CODE_OAUTH_TOKEN để chốt câu "Mình dùng đường ***".)

## 2. Envelope `--output-format json` (không --bare)
```json
{
  "type": "result", "subtype": "success", "is_error": false,
  "session_id": "3e01f72f-…", "num_turns": 2, "total_cost_usd": 0.1024,
  "terminal_reason": "completed",
  "result": "{\"answer\":\"Xanh\"}",
  "structured_output": { "answer": "Xanh" },
  "duration_ms": 1791, "permission_denials": [], "usage": {…}, "modelUsage": {…}
}
```
→ Có `structured_output` là object khi dùng `--json-schema`; `result` là chuỗi JSON. Worker parse `structured_output ?? JSON.parse(result)`.

## 3. Chạm trần ngân sách trông như thế nào
`--max-budget-usd 0.05` với structured output (tốn 1 tool call) →
```json
{ "is_error": true, "subtype": "error_max_budget_usd", "terminal_reason": "budget_exhausted",
  "errors": ["Reached maximum budget ($0.05)"], "total_cost_usd": 0.1024, "num_turns": 2 }
```
→ Cảnh Section 4 việc 3: cho chạy với trần thấp, hiện đúng dòng này. Lưu ý: cost thực có thể **vượt nhẹ** trần (0.10 > 0.05) vì dừng sau lượt đang chạy — nói thật điều này.

## 4. Structured output tốn 1 lượt tool
`--json-schema` cần ≥ 2 turns (1 lượt gọi tool trả structured output). `--max-turns 1` sẽ fail. Worker để 20.

## 5. MCP noise trên stderr
Không --bare thì stderr in cảnh báo MCP của máy local. Trên VPS sạch không có. Worker dùng --bare nên không sao; nếu bỏ --bare, thêm `--strict-mcp-config --mcp-config '{"mcpServers":{}}'`.

## 6. Flag/subcommand có trong `--help` bản 2.1.235
`--json-schema`, `--max-budget-usd`, `--max-turns`, `--permission-mode` (acceptEdits|auto|bypassPermissions|manual|dontAsk|plan), `--tools`, `--disallowedTools`, `--bare`, `claude ultrareview [target] --json|--post|--timeout`, `claude remote-control --name`.

## Còn phải thử trên VPS
- [ ] `claude setup-token` → export `CLAUDE_CODE_OAUTH_TOKEN` → `claude -p --bare` chạy được không
- [ ] `claude auth status` exit code
- [ ] `--disallowedTools "Bash(systemctl *)"` chặn thật (cho agent thử `systemctl restart demo-app`)
- [ ] `claude ultrareview <PR> --json` trên repo này
- [ ] `claude --bg`, `claude agents --json`, `claude respawn` (nếu còn dùng trong Section 7)

## 7. Skill trong repo CÓ được nạp cho `claude -p` — với điều kiện (verify 19/08)
- Worker KHÔNG dùng `--bare` (bare bỏ skill). Chạy trong `REPO_DIR` có `.claude/skills/incident-triage/SKILL.md`.
- `--tools` phải chứa **`Skill`**. Với `--tools ""` thì không có danh sách skill (mô hình còn bịa ra nội dung). Với `--tools "Skill,Read"` nó chép đúng nguyên văn description → skill được inject.
- Đây là cầu nối Level 2 → Level 3 trong video: skill viết ở level 2, agent headless dùng ở level 3.

## 8. `--mcp-config` là flag nhận NHIỀU giá trị
Đặt `--mcp-config '{...}'` ngay trước prompt thì nó nuốt prompt làm đường dẫn file → "MCP config file not found". Để prompt sau một flag đơn trị (vd `--max-budget-usd`), hoặc để `--strict-mcp-config --mcp-config` lên đầu.

## 9. ⭐ `--permission-mode dontAsk` TỪ CHỐI mọi thứ chưa allow — phải có `--allowedTools` (verify 22/08, chạy thật)
Lần chạy đầu với `--tools "Skill,Bash,Read,Edit,Write,..."` + `--permission-mode dontAsk` nhưng KHÔNG có `--allowedTools`:
agent tìm ra root cause chính xác nhưng **mọi Bash/Edit/Write đều bị deny**, `permission_denials` đầy, kết luận `needs_human`,
tự báo: *"Agent bị chặn toàn bộ quyền ghi/chạy trong phiên này nên chưa tái hiện bằng curl và chưa mở được PR"*. Tốn $0.98 mà không ra PR.

→ `--tools` chỉ **nạp** tool vào phiên; `dontAsk` vẫn cần **luật cho phép** mới chạy được. Thêm:
```
--allowedTools "Edit" "Write" "Bash(node *)" "Bash(npm *)" "Bash(curl *)" "Bash(git checkout*)" \
  "Bash(git add*)" "Bash(git commit*)" "Bash(git push*)" "Bash(gh pr create*)" ...
```
Deny (`--disallowedTools`) vẫn thắng allow: `Bash(git push*)` được cho phép nhưng `Bash(git push origin main*)` và
`Bash(git push --force*)` vẫn bị chặn. **Đây là ranh giới đẹp nhất để lên hình**: allow việc, deny đường tắt.

## 10. Số thật từ lần chạy end-to-end thành công (22/08, laptop, Claude Code 2.1.235)
| Chỉ số | Giá trị |
|---|---|
| Thời gian từ lúc TRIGGER tới khi PR mở | **167 giây** |
| Chi phí một incident | **$1.59** (12→~20 turns, trần $2.00) |
| Lần chạy hỏng vì thiếu allowedTools | $0.98 |
| Kết quả | PR #1 `[on-call]`, +45/−2, 2 file |
| Confidence agent tự chấm | 0.95 |

Agent tự thích ứng: không được chạy server nền (deny) nên **tái hiện bằng test HTTP thật** (`node --test`, ephemeral port)
thay vì curl — vẫn chứng minh 500 trước / 400 sau. PR body có mục "Đã verify thế nào" kèm request mẫu, và **tự khai báo**
`npm run test:e2e` đã fail sẵn từ trước, không phải do thay đổi này. Đây là chi tiết đắt cho video: agent trung thực về phạm vi.
