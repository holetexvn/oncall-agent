#!/usr/bin/env bash
# Notification — agent chạy nền trên VPS mà cần bạn quyết? Điện thoại kêu, không phải ngồi canh terminal.
INPUT=$(cat)
MSG=$(printf '%s' "$INPUT" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);process.stdout.write(j.message||j.notification||"Claude cần bạn")}catch{process.stdout.write("Claude cần bạn")}})')
[ -z "$TELEGRAM_BOT_TOKEN" ] && exit 0
curl -s -m 5 -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
  -H 'content-type: application/json' \
  -d "$(node -e 'console.log(JSON.stringify({chat_id:process.env.TELEGRAM_CHAT_ID,text:"🔔 "+process.argv[1]}))' "$MSG")" >/dev/null
exit 0
