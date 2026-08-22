#!/usr/bin/env bash
# Chạy GIỮA CÁC LẦN QUAY LẠI — đưa mọi thứ về trạng thái ban đầu để quay take mới.
#   ssh <vps-cua-ban> 'cd /srv/oncall-agent && ./deploy/reset-demo.sh'
cd "$(dirname "$0")/.." || exit 1
export PATH="$HOME/.local/bin:$PATH"
set -a; [ -f .env ] && . ./.env; set +a
echo "→ xoá trạng thái đếm ngưỡng + log lần chạy trước"
rm -rf receiver/state worker/runs demo-app/logs; mkdir -p demo-app/logs
echo "→ trả code về nguyên trạng (bỏ fix của agent, xoá nhánh fix cũ)"
git checkout -q main 2>/dev/null
git reset -q --hard HEAD          # bỏ sửa đổi của agent, KHÔNG kéo về origin/main (có thể cũ)
git clean -qfd -e .env -e demo-app/logs 2>/dev/null
git branch --list 'fix/incident-*' | tr -d ' ' | xargs -r -n1 git branch -qD 2>/dev/null
echo "→ đóng PR on-call còn mở (nếu có)"
if gh auth status >/dev/null 2>&1; then
  for n in $(gh pr list --label on-call --state open --json number -q '.[].number' 2>/dev/null); do
    gh pr close "$n" --delete-branch >/dev/null 2>&1 && echo "   đã đóng PR #$n"
  done
fi
# chốt chặn: nếu bug demo đã bị vá (do merge PR của agent) thì cảnh báo ngay
if ! grep -q "BUG cài sẵn" demo-app/index.js 2>/dev/null; then
  echo "⚠️  demo-app KHÔNG còn bug cài sẵn — lần demo sau agent sẽ báo not_a_bug."
  echo "   Sửa: git revert <commit fix> && git push, hoặc khôi phục demo-app/index.js về bản có bug."
fi
echo "→ khởi động lại dịch vụ"
sudo -n systemctl restart oncall-receiver demo-app 2>/dev/null || { pkill -f receiver/index.js; pkill -f demo-app/index.js; }
sleep 2
curl -fsS -m 3 localhost:8080/health && echo
curl -fsS -m 3 localhost:3000/health && echo
echo "Sẵn sàng take mới:  ./demo-app/simulate-customers.sh http://localhost:3000 3"
