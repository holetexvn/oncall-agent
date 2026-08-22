#!/usr/bin/env bash
# Case 3 — sự kiện là giờ. Cron 1h sáng: quét repo, mở đúng MỘT issue "hôm nay nên sửa 3 thứ".
# crontab: 0 1 * * * /srv/oncall-agent/scripts/case3-nightly-audit.sh >> /var/log/oncall/nightly.log 2>&1
set -euo pipefail
cd "${REPO_DIR:?}"
SCHEMA='{"type":"object","properties":{"title":{"type":"string"},"body":{"type":"string"}},"required":["title","body"]}'
OUT=$(claude -p --bare --permission-mode dontAsk --output-format json --json-schema "$SCHEMA" \
  --tools "Bash,Read,Grep,Glob" --disallowedTools "mcp__*" "Bash(rm *)" "Bash(git push*)" \
  --max-budget-usd 2.00 --max-turns 25 \
  "Audit repo này: dependency lỗi thời có CVE, test flaky, dead code, TODO quá 90 ngày. Chọn đúng 3 thứ đáng sửa nhất hôm nay. Trả về title ngắn và body markdown có lý do + gợi ý cách sửa. Không sửa gì cả.")
TITLE=$(echo "$OUT" | node -e 'const e=JSON.parse(require("fs").readFileSync(0,"utf8"));const r=e.structured_output??JSON.parse(e.result);process.stdout.write(r.title)')
BODY=$(echo "$OUT"  | node -e 'const e=JSON.parse(require("fs").readFileSync(0,"utf8"));const r=e.structured_output??JSON.parse(e.result);process.stdout.write(r.body+"\n\n_cost: $"+e.total_cost_usd+"_")')
gh issue create --title "[nightly] $TITLE" --body "$BODY" --label "nightly-audit"
