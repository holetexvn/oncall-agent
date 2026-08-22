#!/usr/bin/env bash
# Gây lỗi thật cho cảnh demo. Request thiếu `items` -> 500 -> Sentry -> webhook -> agent.
HOST="${1:-http://localhost:3000}"
curl -s -X POST "$HOST/orders" -H 'content-type: application/json' \
  -d '{"customer":{"name":"demo"}}'
echo
