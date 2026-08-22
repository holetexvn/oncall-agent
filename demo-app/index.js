// Demo app: API Node nhỏ, có Sentry, có 1 bug cài sẵn để quay demo.
// Bug: POST /orders không validate `items` -> TypeError khi thiếu field.
import * as Sentry from "@sentry/node";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

if (process.env.SENTRY_DSN) Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0 });

const app = express();
app.use(express.json());
const LOG_DIR = process.env.LOG_DIR || "./logs";
fs.mkdirSync(LOG_DIR, { recursive: true });
const ts = () => new Date().toLocaleString("sv-SE").replace("T", " ");   // giờ máy (VPS đặt Asia/Ho_Chi_Minh) — khớp đồng hồ khi quay
const log = (line) => fs.appendFileSync(path.join(LOG_DIR, "app.log"), `${ts()} ${line}\n`);

app.get("/health", (_req, res) => res.json({ ok: true }));

app.post("/orders", (req, res) => {
  const { customer, items } = req.body;
  const userId = req.get("x-user-id") || customer?.id || "anon";
  Sentry.setUser?.({ id: userId });                       // để Sentry đếm được "bao nhiêu khách bị"
  log(`POST /orders user=${userId} customer=${JSON.stringify(customer)} items=${JSON.stringify(items)}`);
  if (!Array.isArray(items)) {
    return res.status(400).json({ error: "items phải là mảng" });
  }
  const total = items.reduce((s, it) => s + it.price * it.qty, 0);
  res.json({ ok: true, customer, total });
});

Sentry.setupExpressErrorHandler?.(app);
app.use((err, req, res, _next) => {
  log(`ERROR ${req.method} ${req.url} ${err.stack?.split("\n")[0]}`);
  selfReport(err, req).catch(() => {});
  res.status(500).json({ error: "internal" });
});

// Fallback khi chưa có Sentry: tự gửi event vào receiver theo format giống Sentry webhook.
// Cùng lỗi (message + frame đầu) → cùng issue_id → receiver đếm được số khách.
async function selfReport(err, req) {
  const url = process.env.RECEIVER_URL; if (!url) return;
  const top = (err.stack || "").split("\n")[1]?.trim() || "";
  const issue_id = "local-" + crypto.createHash("sha1").update(err.message + "|" + top).digest("hex").slice(0, 10);
  const frames = (err.stack || "").split("\n").slice(1, 9).map((l) => { const m = l.match(/at (.+?) \((.+):(\d+):\d+\)/) || l.match(/at (.+):(\d+):\d+/); return m ? { function: m[1], filename: m[2] || m[1], lineno: Number(m[3] || m[2]) } : { function: l.trim() }; }).reverse();
  await fetch(url, { method: "POST", headers: { "content-type": "application/json", "sentry-hook-resource": "event_alert" }, body: JSON.stringify({
    action: "triggered", data: { event: { issue_id, event_id: crypto.randomUUID(), title: `${err.name}: ${err.message}`, culprit: `${req.method} ${req.path}`, user: { id: req.get("x-user-id") || req.body?.customer?.id || "anon" }, request: { method: req.method, url: req.originalUrl, data: req.body }, exception: { values: [{ stacktrace: { frames } }] } } },
  }) });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[demo-app] listening on :${PORT} (sentry: ${process.env.SENTRY_DSN ? "on" : "off"})`));
