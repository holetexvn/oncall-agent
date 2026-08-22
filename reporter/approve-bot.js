// Approve bot: long-polling Telegram, xử lý nút ✅ Merge / ❌ Đóng.
// Đây là "human in the loop": agent chỉ mở PR, NGƯỜI bấm merge. Chỉ nghe đúng 1 chat, chỉ merge PR có label on-call.
import { spawnSync } from "node:child_process";
const T = process.env.TELEGRAM_BOT_TOKEN, CHAT = String(process.env.TELEGRAM_CHAT_ID), REPO = process.env.REPO_DIR || process.cwd();
if (!T || !CHAT) { console.error("cần TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID"); process.exit(2); }
const api = (m, b) => fetch(`https://api.telegram.org/bot${T}/${m}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }).then((r) => r.json());
const gh = (...a) => spawnSync("gh", a, { cwd: REPO, encoding: "utf8", env: process.env });
let offset = 0;
console.log("[approve-bot] polling…");
for (;;) {
  const { result = [] } = await api("getUpdates", { offset, timeout: 30, allowed_updates: ["callback_query"] });
  for (const u of result) {
    offset = u.update_id + 1;
    const cq = u.callback_query; if (!cq) continue;
    if (String(cq.message?.chat?.id) !== CHAT) { await api("answerCallbackQuery", { callback_query_id: cq.id, text: "Không có quyền" }); continue; }
    const [action, n] = String(cq.data || "").split(":");
    if (!/^\d+$/.test(n || "")) continue;
    // chỉ cho phép PR do agent mở (label on-call)
    const lv = gh("pr", "view", n, "--json", "labels", "-q", ".labels[].name");
    if (lv.status !== 0) {                                  // gh lỗi (thiếu GH_TOKEN, mạng...) — đừng đổ tại nhãn
      const why = (lv.stderr || "gh không chạy được").trim().split("\n")[0].slice(0, 120);
      console.error("[approve-bot] gh pr view lỗi:", why);
      await api("answerCallbackQuery", { callback_query_id: cq.id, text: `Không đọc được PR #${n}: ${why}` });
      await api("sendMessage", { chat_id: CHAT, text: `⚠️ Không kiểm tra được PR #${n}.\n${why}\n\nThường là do service chưa nạp GH_TOKEN — chạy: sudo systemctl restart oncall-approve-bot` });
      continue;
    }
    if (!(lv.stdout || "").includes("on-call")) { await api("answerCallbackQuery", { callback_query_id: cq.id, text: `PR #${n} không có nhãn on-call` }); continue; }

    // PR đã đóng/đã merge rồi thì nói thẳng, đừng để GitHub trả lỗi khó hiểu
    const st = (gh("pr", "view", n, "--json", "state", "-q", ".state").stdout || "").trim();
    if (st && st !== "OPEN") {
      await api("answerCallbackQuery", { callback_query_id: cq.id, text: `PR #${n} đã ${st === "MERGED" ? "được merge" : "đóng"} rồi` });
      continue;
    }

    let out;
    if (action === "merge") {
      out = gh("pr", "merge", n, "--squash", "--delete-branch");
      // "Base branch was modified" = main vừa đổi giữa chừng. Thử lại một lần là thường xong.
      if (out.status !== 0 && /Base branch was modified/i.test(out.stderr || "")) {
        console.error("[approve-bot] base đổi giữa chừng, thử lại…");
        await new Promise((r) => setTimeout(r, 2000));
        out = gh("pr", "merge", n, "--squash", "--delete-branch");
      }
    }
    else if (action === "close") out = gh("pr", "close", n, "--delete-branch");
    else continue;
    const ok = out.status === 0;
    await api("answerCallbackQuery", { callback_query_id: cq.id, text: ok ? "Đã " + (action === "merge" ? "merge" : "đóng") : "Lỗi: " + (out.stderr || "").slice(0, 150) });
    await api("editMessageReplyMarkup", { chat_id: CHAT, message_id: cq.message.message_id, reply_markup: { inline_keyboard: [[{ text: "🔗 Xem PR", url: `https://github.com/${process.env.GH_REPO || "holetexvn/oncall-agent"}/pull/${n}` }]] } });
    await api("sendMessage", { chat_id: CHAT, text: ok ? `${action === "merge" ? "✅ Đã merge" : "❌ Đã đóng"} PR #${n} bởi ${cq.from.first_name}.` : `⚠️ ${action} PR #${n} thất bại:\n${(out.stderr || out.stdout || "").slice(0, 500)}` });
    console.log(`[approve-bot] ${action} #${n} → ${ok ? "ok" : "fail"}`);
  }
}
