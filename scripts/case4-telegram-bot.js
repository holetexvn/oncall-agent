// Case 4 — sự kiện là tin nhắn. Long-polling Telegram, mỗi tin nhắn = một `claude -p`, trả link PR.
// Chạy: node scripts/case4-telegram-bot.js   (cần TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, REPO_DIR)
import { spawnSync } from "node:child_process";
const T = process.env.TELEGRAM_BOT_TOKEN, CHAT = String(process.env.TELEGRAM_CHAT_ID), REPO = process.env.REPO_DIR || process.cwd();
const api = (m, b) => fetch(`https://api.telegram.org/bot${T}/${m}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }).then((r) => r.json());
let offset = 0;
console.log("[tg] polling…");
for (;;) {
  const { result = [] } = await api("getUpdates", { offset, timeout: 30 });
  for (const u of result) {
    offset = u.update_id + 1;
    const msg = u.message; if (!msg?.text || String(msg.chat.id) !== CHAT) continue; // chỉ nghe đúng 1 chat
    await api("sendMessage", { chat_id: CHAT, text: "⏳ Nhận việc: " + msg.text });
    const r = spawnSync("claude", ["-p", "--bare", "--permission-mode", "dontAsk", "--output-format", "json",
      "--tools", "Bash,Read,Edit,Write,Grep,Glob", "--disallowedTools", "mcp__*", "Bash(rm *)", "Bash(git push --force*)", "Bash(gh pr merge*)",
      "--max-budget-usd", "2.00", "--max-turns", "30",
      `Làm việc sau trong repo này, trên branch mới, mở PR bằng gh, KHÔNG merge. Trả lời ngắn kèm link PR. Việc: ${msg.text}`],
      { cwd: REPO, encoding: "utf8", env: process.env });
    let out; try { out = JSON.parse(r.stdout); } catch { out = { result: r.stderr?.slice(0, 500) || "lỗi" }; }
    await api("sendMessage", { chat_id: CHAT, text: `${out.result}\n\n💸 $${out.total_cost_usd ?? "?"}` });
  }
}
