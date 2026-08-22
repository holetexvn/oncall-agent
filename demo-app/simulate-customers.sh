#!/usr/bin/env bash
# Kịch bản demo: N khách hàng khác nhau gặp cùng lỗi (mặc định 3) → vượt ngưỡng → agent kích hoạt.
# Dùng: ./demo-app/simulate-customers.sh http://<VPS>:3000 3
HOST="${1:-http://localhost:3000}"; N="${2:-3}"
for i in $(seq 1 "$N"); do
  echo "→ khách #$i (user-$i) gửi đơn thiếu items…"
  curl -s -X POST "$HOST/orders" -H 'content-type: application/json' -H "x-user-id: user-$i" \
    -d "{\"customer\":{\"id\":\"user-$i\",\"name\":\"Khách $i\"}}"; echo
  sleep 1
done
echo "Xong. Xem receiver: curl $HOST/issues (nếu cùng host) hoặc journalctl -u oncall-receiver -f"
