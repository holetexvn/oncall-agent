// Reporter: gửi báo cáo về Telegram, kèm nút duyệt nếu có PR. Người bấm — không phải agent.
export async function report(text, approve = null) {
  const token = process.env.TELEGRAM_BOT_TOKEN, chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) { console.log("[reporter] (no telegram configured)"); return; }
  const body = { chat_id: chat, text, disable_web_page_preview: true };
  if (approve?.prUrl) {
    const n = approve.prUrl.match(/\/pull\/(\d+)/)?.[1];
    body.reply_markup = { inline_keyboard: [[
      { text: "🔗 Xem PR", url: approve.prUrl },
      ...(n ? [{ text: "✅ Merge", callback_data: `merge:${n}` }, { text: "❌ Đóng", callback_data: `close:${n}` }] : []),
    ]] };
  }
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) console.error("[reporter] telegram error", res.status, await res.text());
}
