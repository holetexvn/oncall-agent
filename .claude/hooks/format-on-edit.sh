#!/usr/bin/env bash
# PostToolUse(Edit|Write) — format file vừa sửa. Dùng prettier CỤC BỘ để nhanh; không có thì bỏ qua.
# Hook chạy chậm = mọi tool call chậm theo, nên tuyệt đối không tải gói ở đây.
INPUT=$(cat)
FILE=$(printf '%s' "$INPUT" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(JSON.parse(s).tool_input?.file_path||"")}catch{}})')
[ -z "$FILE" ] && exit 0
BIN="$CLAUDE_PROJECT_DIR/node_modules/.bin/prettier"
[ -x "$BIN" ] || BIN="./node_modules/.bin/prettier"
[ -x "$BIN" ] || exit 0
case "$FILE" in *.js|*.mjs|*.ts|*.json|*.md) timeout 5 "$BIN" --write "$FILE" >/dev/null 2>&1 ;; esac
exit 0
