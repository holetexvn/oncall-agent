#!/usr/bin/env bash
# Chạy TRƯỚC KHI QUAY. Kiểm tra mọi thứ, in PASS/FAIL. Không sửa gì.
#   ssh <vps-cua-ban> 'cd /srv/oncall-agent && ./deploy/preflight.sh'
cd "$(dirname "$0")/.." || exit 1
export PATH="$HOME/.local/bin:$PATH"
PASS=0; FAIL=0
ok(){ printf "  \033[32m✔\033[0m %s\n" "$1"; PASS=$((PASS+1)); }
no(){ printf "  \033[31m✘\033[0m %s\n" "$1"; FAIL=$((FAIL+1)); }
hd(){ printf "\n\033[1m%s\033[0m\n" "$1"; }
set -a; [ -f .env ] && . ./.env; set +a

hd "1. Công cụ"
node -v >/dev/null 2>&1 && ok "node $(node -v)" || no "thiếu node"
command -v claude >/dev/null && ok "claude $(claude --version 2>&1 | head -1)" || no "thiếu claude"
command -v gh >/dev/null && ok "gh $(gh --version | head -1 | cut -d' ' -f3)" || no "thiếu gh"
[ -x node_modules/.bin/prettier ] && ok "prettier cục bộ (hook format nhanh)" || no "chưa cài prettier cục bộ: npm i -D prettier"

hd "2. Sẵn sàng lên hình"
TZN=$(timedatectl show -p Timezone --value 2>/dev/null)
[ "$TZN" = "Asia/Ho_Chi_Minh" ] && ok "timezone $TZN — timestamp khớp đồng hồ trong phòng" || no "timezone đang là $TZN, đặt lại: sudo timedatectl set-timezone Asia/Ho_Chi_Minh"
case "$LANG" in *UTF-8*) ok "locale $LANG — tiếng Việt hiển thị đúng";; *) no "locale $LANG không phải UTF-8, tiếng Việt sẽ vỡ";; esac

hd "3. Xác thực (3 thứ này phải có mới chạy được demo thật)"
if claude auth status >/dev/null 2>&1; then ok "claude đã đăng nhập"
elif [ -n "$CLAUDE_CODE_OAUTH_TOKEN" ] || [ -n "$ANTHROPIC_API_KEY" ]; then ok "có token Claude trong .env"
else no "CHƯA có Claude auth — chạy 'claude setup-token' rồi điền CLAUDE_CODE_OAUTH_TOKEN vào .env"; fi
if gh auth status >/dev/null 2>&1; then ok "gh đã đăng nhập ($(gh api user -q .login 2>/dev/null))"
else no "CHƯA có GitHub auth — điền GH_TOKEN vào .env rồi 'gh auth setup-git'"; fi
[ -n "$TELEGRAM_BOT_TOKEN" ] && [ -n "$TELEGRAM_CHAT_ID" ] && ok "Telegram đã cấu hình" || no "CHƯA có Telegram — không có nút duyệt PR trên điện thoại"

hd "4. Dịch vụ"
for s in oncall-receiver demo-app; do systemctl is-active --quiet $s && ok "$s đang chạy" || no "$s KHÔNG chạy: sudo systemctl start $s"; done
if [ -n "$TELEGRAM_BOT_TOKEN" ]; then
  if systemctl is-active --quiet oncall-approve-bot; then
    APID=$(systemctl show -p MainPID --value oncall-approve-bot)
    if sudo -n tr '\0' '\n' < /proc/$APID/environ 2>/dev/null | grep -q '^GH_TOKEN=..*'; then ok "approve-bot đang chạy và có GH_TOKEN"
    else no "approve-bot đang chạy NHƯNG thiếu GH_TOKEN (bấm Merge sẽ báo sai) — sudo systemctl restart oncall-approve-bot"; fi
  else no "approve-bot chưa chạy: sudo systemctl start oncall-approve-bot"; fi
fi
curl -fsS -m 3 localhost:8080/health >/dev/null 2>&1 && ok "receiver :8080 trả lời" || no "receiver :8080 không trả lời"
curl -fsS -m 3 localhost:3000/health >/dev/null 2>&1 && ok "demo-app :3000 trả lời" || no "demo-app :3000 không trả lời"

hd "5. Level 2 — hook, skill, MCP"
H=.claude/hooks
t(){ printf '%s' "$2" | $H/$1 >/dev/null 2>&1; [ "$?" = "$3" ]; }
t block-dangerous.sh '{"tool_input":{"command":"git push origin main"}}' 2 && ok "hook chặn push thẳng main" || no "hook block-dangerous sai"
t block-dangerous.sh '{"tool_input":{"command":"git push origin fix/x"}}' 0 && ok "hook cho qua push nhánh fix" || no "hook chặn nhầm nhánh fix"
t no-secrets.sh '{"tool_input":{"file_path":"a.js","content":"k=\"ghp_AbCdEfGhIjKlMnOpQrStUvWxYz0123456789\""}}' 2 && ok "hook chặn ghi secret" || no "hook no-secrets sai"
t protect-self.sh '{"tool_input":{"file_path":"/srv/oncall-agent/.claude/settings.json"}}' 2 && ok "hook chặn agent sửa luật của chính nó" || no "hook protect-self sai"
echo '{}' | $H/test-gate.sh >/dev/null 2>&1 && ok "cổng test: đang xanh, cho dừng" || no "cổng test: test đang FAIL, agent sẽ không được dừng"
[ -f .claude/skills/incident-triage/SKILL.md ] && ok "skill incident-triage" || no "thiếu skill incident-triage"
[ -f .claude/skills/postmortem/SKILL.md ] && ok "skill postmortem" || no "thiếu skill postmortem"
ls .claude/agents/*.md >/dev/null 2>&1 && ok "$(ls .claude/agents/*.md | wc -l | tr -d ' ') custom subagent" || no "thiếu subagent"
MCPOUT=$(printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | timeout 10 node mcp/incident-store.js 2>/dev/null)
printf '%s' "$MCPOUT" | grep -q incident_stats && ok "MCP server trả lời tools/list" || no "MCP server lỗi"

hd "6. Pipeline (dry-run, không tốn tiền)"
rm -rf receiver/state worker/runs
if DRY_RUN=1 RECEIVER_PORT=18080 timeout 90 npm run --silent test:e2e 2>&1 | grep -q "worker chạy đúng 1 lần"; then
  ok "3 khách → vượt ngưỡng → worker chạy đúng 1 lần"
else no "pipeline dry-run FAIL — xem: DRY_RUN=1 npm run test:e2e"; fi
rm -rf receiver/state worker/runs

hd "7. Git"
git rev-parse --abbrev-ref HEAD | grep -qx main && ok "đang ở nhánh main" || no "đang ở nhánh $(git rev-parse --abbrev-ref HEAD), nên về main trước khi quay"
[ -z "$(git status --porcelain)" ] && ok "cây làm việc sạch" || no "còn thay đổi chưa commit (PR của agent sẽ lẫn vào)"

printf "\n\033[1m%s\033[0m\n" "KẾT QUẢ: $PASS pass · $FAIL fail"
[ "$FAIL" = 0 ] && echo "Sẵn sàng quay." || echo "Sửa mấy dòng ✘ ở trên trước khi quay."
exit 0
