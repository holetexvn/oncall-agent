# 5 hook trong repo này — mỗi cái giải quyết một rủi ro có thật

| Hook | Sự kiện | Chặn/làm gì | Vì sao đáng có |
|---|---|---|---|
| `block-dangerous.sh` | PreToolUse · Bash | `rm -rf` · `sudo` · `systemctl/docker` · force push · **push thẳng `main`** · `curl \| sh` · `cat .env` · `gh pr merge` | Cho phép **việc**, chặn **đường tắt**. Cùng lệnh `git push`: nhánh `fix/*` đi qua, `main` bị chặn. |
| `no-secrets.sh` | PreToolUse · Write/Edit | Quét **nội dung sắp ghi**: Anthropic key, GitHub token, AWS key, Telegram token, private key, connection string có mật khẩu | Agent hay "tiện tay" hardcode key cho nhanh chạy. Chặn trước khi chạm đĩa, không phải sau khi đã commit. |
| `protect-self.sh` | PreToolUse · Write/Edit | Không cho sửa `.claude/hooks/*`, `.claude/settings.json`, `worker/index.js`, `.env` | **Agent không được tự sửa còng tay của mình.** Chống tự nới quyền, và chống sửa code đang chạy chính phiên đó. |
| `test-gate.sh` | Stop | Test fail → `exit 2` → agent **không được** kết thúc, phải sửa tiếp | "Xong" không còn do agent tự tuyên bố. Có chốt `stop_hook_active` để không lặp vô hạn. |
| `notify-telegram.sh` | Notification | Bắn Telegram khi agent cần người quyết | Agent chạy nền trên VPS — điện thoại kêu, khỏi ngồi canh terminal. |

## Thử không cần Claude (mỗi hook nhận JSON qua stdin, `exit 2` = chặn)
```bash
echo '{"tool_input":{"command":"git push origin main"}}'   | .claude/hooks/block-dangerous.sh; echo $?   # 2
echo '{"tool_input":{"command":"git push origin fix/x"}}'  | .claude/hooks/block-dangerous.sh; echo $?   # 0
echo '{"tool_input":{"file_path":"src/a.js","content":"const k=\"ghp_AbCdEfGhIjKlMnOpQrStUvWxYz0123456789\""}}' | .claude/hooks/no-secrets.sh; echo $?  # 2
echo '{"tool_input":{"file_path":".claude/settings.json"}}' | .claude/hooks/protect-self.sh; echo $?    # 2
echo '{}' | .claude/hooks/test-gate.sh; echo $?            # 0 nếu test xanh, 2 nếu đỏ
```

## Hook khác `--disallowedTools` ở chỗ nào
`--disallowedTools` là luật của Claude Code, viết trong câu lệnh. Hook là **script của bạn, chạy trên máy bạn**:
đọc được nội dung sắp ghi, gọi được API, ghi log, và không phụ thuộc việc Claude có "nhớ" hay không.
Dùng cả hai: flag là lớp ngoài, hook là lớp trong.
