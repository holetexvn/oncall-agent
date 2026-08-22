#!/usr/bin/env bash
# PreToolUse(Write|Edit) — chặn agent sửa chính hệ thống đang điều khiển nó.
# Đây là lớp chống "tự nới quyền": không cho nó sửa hook, sửa permission, hay sửa code đang chạy nó.
INPUT=$(cat)
FILE=$(printf '%s' "$INPUT" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(JSON.parse(s).tool_input?.file_path||"")}catch{}})')
[ -z "$FILE" ] && exit 0
case "$FILE" in
  */.claude/hooks/*|*/.claude/settings.json|*/.claude/settings.local.json)
    echo "BLOCKED by hook protect-self: '$FILE' là luật ràng buộc chính bạn. Agent không tự sửa luật của mình. Báo cho người." >&2; exit 2 ;;
  */worker/index.js|*/worker/task.md)
    echo "BLOCKED by hook protect-self: '$FILE' là code đang chạy phiên này. Sửa nó giữa chừng sẽ hỏng incident đang xử lý." >&2; exit 2 ;;
  *.env|*/.env|*.env.*)
    echo "BLOCKED by hook protect-self: không chạm file môi trường." >&2; exit 2 ;;
esac
exit 0
