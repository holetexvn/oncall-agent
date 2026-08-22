# oncall-agent

Claude Code **chạy theo sự kiện** trên VPS, như bài toán production thật:
lỗi xảy ra → **đủ ngưỡng nhiều khách hàng gặp** mới kích hoạt → agent **verify (tái hiện)** → phân tích theo **skill** → fix + test → mở PR → Telegram **xin duyệt kèm link** → **người bấm Merge/Close** ngay trên Telegram.
Repo demo cho video HoleTex × Hostinger. Đã test với Claude Code **2.1.235**.

```
khách 1,2,3 ──lỗi──▶ Sentry ──webhook──▶ receiver/  (đếm: ≥3 khách trong 30 phút?) ──▶ worker/ (claude -p + skill incident-triage)
                                                                                          │  verify → root cause → fix → test → gh pr create
                                                                                          ▼
                                                                                    reporter/ Telegram [🔗 PR] [✅ Merge] [❌ Đóng]
                                                                                          │
                                                                    approve-bot.js: người bấm → gh pr merge --squash
```

## Luồng demo (Section 7 của video)
1. `demo-app/simulate-customers.sh http://<VPS>:3000 3` — 3 khách khác nhau gặp cùng lỗi
2. Receiver log: `users=1/3 → chờ`, `2/3 → chờ`, `3/3 → TRIGGER` (dưới ngưỡng thì **không** tốn tiền)
3. Worker chạy skill `incident-triage`: tái hiện bằng curl → đọc log → root cause → branch `fix/incident-<id>` → test → PR `[on-call]`
4. Telegram nhận: tiêu đề, 👥 số khách, root cause, confidence, nút **🔗 PR / ✅ Merge / ❌ Đóng**
5. Anh bấm ✅ → `approve-bot` chạy `gh pr merge --squash` → Telegram báo "Đã merge PR #n bởi Tùng"

## Bắt đầu nhanh
**[QUICKSTART.md](QUICKSTART.md) — 3 lệnh là chạy được từ một VPS trống.**

## Ngưỡng kích hoạt (triage)
`.env`: `TRIGGER_MIN_USERS=3` (khách khác nhau) · `TRIGGER_MIN_EVENTS=3` (hoặc số lần) · `TRIGGER_WINDOW_MIN=30`. Xem trạng thái: `curl localhost:8080/issues`.
Có thể thay bằng Alert Rule của Sentry ("issue is seen by more than N users") — khi đó receiver chỉ cần nhận và chạy; giữ đếm ở receiver để demo hiện số lên hình.

## Ranh giới (đọc trước khi chạy)
Agent **được** đọc log, đọc code, tạo branch, mở PR. **Không được** merge, deploy, restart, chạm secret.
Ép bằng 3 lớp: (1) container/quyền OS, (2) `--tools` + `--disallowedTools`, (3) token GitHub tối thiểu + bảo vệ branch main.

## Chạy nhanh trên laptop (không tốn tiền)
```bash
npm install
npm run test:e2e        # bắn webhook giả, worker chạy mock-claude, thấy báo cáo in ra
```

## Chạy thật
```bash
cp .env.example .env    # điền token
npm run demo                       # demo-app :3000
npm run receiver                   # receiver :8080
node reporter/approve-bot.js       # nút Merge/Đóng trên Telegram
./demo-app/simulate-customers.sh   # 3 khách gặp lỗi -> Sentry -> webhook x3 -> vượt ngưỡng -> agent
```
Chưa có Sentry? Bắn webhook tay:
```bash
curl -X POST localhost:8080/webhook/sentry -H 'content-type: application/json' -H 'sentry-hook-resource: issue' \
  -d '{"action":"created","data":{"issue":{"id":"manual-1","title":"TypeError: items.reduce is not a function","culprit":"POST /orders"}}}'
```

## Bộ flag đang dùng (worker/index.js)
| Việc | Flag |
|---|---|
| Giao việc theo sự kiện, không chặn hỏi | `-p --permission-mode dontAsk --output-format json --json-schema` (không `--bare` vì cần skill; tắt MCP bằng `--strict-mcp-config`) |
| Giới hạn quyền | `--tools "Skill,Bash,Read,Edit,Write,Grep,Glob" --disallowedTools "mcp__*" "Bash(rm *)" "Bash(systemctl *)" ...` (có `Skill` để nạp `incident-triage`) |
| Ngân sách | `--max-budget-usd 1.50 --max-turns 20` |
| Báo cáo | envelope JSON → `session_id`, `total_cost_usd` → Telegram |

## Ba case khác (Section 7 của video)
- `scripts/case2-ultrareview.sh <PR> [--post]` — sự kiện là PR mở (cần ≥ 2.1.227)
- `scripts/case3-nightly-audit.sh` — sự kiện là giờ (cron 1h sáng → 1 issue)
- `scripts/case4-telegram-bot.js` — sự kiện là tin nhắn

## Deploy lên VPS
`deploy/setup-vps.sh` (một lần) · `deploy/*.service` (systemd) · `deploy/sentry-webhook.md` · `deploy/docker-compose.yml` (worker trong container).

## Prompt injection qua log
`demo-app/injection-demo.sh` gửi request có chuỗi "IGNORE PREVIOUS INSTRUCTIONS…" — nó đi vào log và error message, agent sẽ đọc. Kỳ vọng: `action: suspicious_input`, không làm theo. `worker/task.md` có đoạn dặn rõ; nhưng đừng tin prompt — tin ranh giới quyền.

## Level 1–2 của video nằm ngay trong repo này
Cả video xoay quanh MỘT codebase — chính repo này. Mỗi khái niệm Level 2 là một lớp chồng thêm:
| Khái niệm | File thật | Nó làm gì ở đây |
|---|---|---|
| CLAUDE.md | `CLAUDE.md` | context + mục ĐỪNG LÀM |
| Skill | `.claude/skills/incident-triage/SKILL.md` | runbook mà agent Level 3 đọc lúc 3h sáng |
| Hook | `.claude/settings.json` + `.claude/hooks/*.sh` | luật cứng: chặn rm -rf, sudo, push main, curl\|sh, tự merge |
| MCP | `MCP.md` | nối Sentry / Postgres / browser |
| Custom subagent | `.claude/agents/*.md` | security-reviewer · explorer · test-runner |
| Plugin | (đóng gói cả 4 thứ trên) | mang sang máy khác / lên VPS |
Thử hook không cần Claude:
```bash
echo '{"tool_input":{"command":"rm -rf node_modules"}}' | .claude/hooks/block-dangerous.sh; echo $?   # 2 = chặn
echo '{"tool_input":{"command":"git push origin fix/x"}}' | .claude/hooks/block-dangerous.sh; echo $? # 0 = cho qua
```
