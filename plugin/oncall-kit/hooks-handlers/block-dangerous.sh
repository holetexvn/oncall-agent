#!/usr/bin/env bash
# PreToolUse(Bash) — LỚP LUẬT, không phụ thuộc vào việc Claude có "nhớ" hay không.
# Khác --disallowedTools ở chỗ: cái này là shell script của bạn, chạy trên máy bạn, log được, sửa được.
# Chặn: xoá đệ quy · sudo · systemctl · docker · force push · push thẳng main · pipe internet vào shell · đọc .env · tự merge PR
# KHÔNG chặn: git push branch thường (agent cần đẩy branch fix để mở PR)
INPUT=$(cat)
CMD=$(printf '%s' "$INPUT" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(JSON.parse(s).tool_input?.command||"")}catch{}})')
deny() { echo "BLOCKED by hook: $1 — lệnh: $CMD" >&2; exit 2; }
printf '%s' "$CMD" | grep -Eq '(^|[;&|[:space:]])rm[[:space:]]+-[a-zA-Z]*r'      && deny "xoá đệ quy"
printf '%s' "$CMD" | grep -Eq '(^|[;&|[:space:]])sudo[[:space:]]'                && deny "sudo"
printf '%s' "$CMD" | grep -Eq 'systemctl|docker[[:space:]]'                      && deny "đụng service/container"
printf '%s' "$CMD" | grep -Eq 'git[[:space:]]+push[[:space:]]+.*--force'         && deny "force push"
printf '%s' "$CMD" | grep -Eq 'git[[:space:]]+push[[:space:]]+\S+[[:space:]]+main|git[[:space:]]+push[[:space:]]+origin[[:space:]]+HEAD:main' && deny "push thẳng lên main"
printf '%s' "$CMD" | grep -Eq 'curl[^|]*\|[[:space:]]*(ba)?sh'                   && deny "pipe internet vào shell"
printf '%s' "$CMD" | grep -Eq 'cat[[:space:]]+[^|]*\.env'                        && deny "đọc file .env"
printf '%s' "$CMD" | grep -Eq 'gh[[:space:]]+pr[[:space:]]+merge'                && deny "agent không được tự merge"
exit 0
