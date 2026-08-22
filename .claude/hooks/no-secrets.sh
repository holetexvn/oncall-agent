#!/usr/bin/env bash
# PreToolUse(Write|Edit) — quét NỘI DUNG agent sắp ghi. Thấy secret thật thì chặn trước khi nó chạm đĩa.
# Vì sao cần: agent hay "tiện tay" hardcode key vào code hoặc test cho nhanh chạy.
INPUT=$(cat)
read -r FILE CONTENT <<< "$(printf '%s' "$INPUT" | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
 try{const t=JSON.parse(s).tool_input||{};
 const c=[t.content,t.new_string,t.replace_all_string].filter(Boolean).join("\n");
 process.stdout.write((t.file_path||"")+" "+JSON.stringify(c));}catch{}})')"
[ -z "$CONTENT" ] && exit 0
BODY=$(printf '%s' "$CONTENT" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(JSON.parse(s))}catch{process.stdout.write("")}})')
hit() { echo "BLOCKED by hook no-secrets: sắp ghi $1 vào $FILE. Dùng biến môi trường, đừng hardcode." >&2; exit 2; }
printf '%s' "$BODY" | grep -Eq 'sk-ant-[A-Za-z0-9_-]{20,}'            && hit "Anthropic API key"
printf '%s' "$BODY" | grep -Eq 'gh[pousr]_[A-Za-z0-9]{30,}'           && hit "GitHub token"
printf '%s' "$BODY" | grep -Eq 'AKIA[0-9A-Z]{16}'                     && hit "AWS access key"
printf '%s' "$BODY" | grep -Eq '[0-9]{8,10}:AA[A-Za-z0-9_-]{30,}'     && hit "Telegram bot token"
printf '%s' "$BODY" | grep -Eq '-----BEGIN [A-Z ]*PRIVATE KEY-----'   && hit "private key"
printf '%s' "$BODY" | grep -Eq 'postgres(ql)?://[^:]+:[^@]+@'         && hit "connection string có mật khẩu"
exit 0
