#!/usr/bin/env bash
# Stop — chạy khi agent định kết thúc lượt. Test fail thì exit 2 => nó PHẢI làm tiếp, không được báo "xong".
# Đây là thứ đổi hành vi agent mạnh nhất: "xong" không còn do agent tự tuyên bố.
INPUT=$(cat)
printf '%s' "$INPUT" | grep -q '"stop_hook_active":true' && exit 0   # tránh lặp vô hạn
[ -f package.json ] || exit 0
grep -q '"test":' package.json || exit 0
if ! npm test --silent >/tmp/claude-test-gate.log 2>&1; then
  echo "Test đang FAIL — chưa được dừng. Sửa cho xanh rồi hãy kết thúc:" >&2
  tail -25 /tmp/claude-test-gate.log >&2
  exit 2
fi
exit 0
