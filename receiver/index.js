// Receiver: nhận webhook Sentry, verify chữ ký, ĐẾM số khách hàng gặp cùng lỗi,
// chỉ kích hoạt worker khi vượt ngưỡng (mặc định 3 khách khác nhau). Đây là bước triage như production thật.
import express from "express";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.RECEIVER_PORT || 8080;
const SECRET = process.env.SENTRY_CLIENT_SECRET || "";
const THRESHOLD_USERS = Number(process.env.TRIGGER_MIN_USERS || 3);     // ≥3 khách khác nhau
const THRESHOLD_EVENTS = Number(process.env.TRIGGER_MIN_EVENTS || 3);   // hoặc ≥3 lần (nếu không có user id)
const WINDOW_MIN = Number(process.env.TRIGGER_WINDOW_MIN || 30);         // trong 30 phút
const STATE_DIR = path.join(__dirname, "state");
const STATE_FILE = path.join(STATE_DIR, "issues.json");
fs.mkdirSync(STATE_DIR, { recursive: true });
const state = fs.existsSync(STATE_FILE) ? JSON.parse(fs.readFileSync(STATE_FILE, "utf8")) : {};
// mkdir mỗi lần ghi: thư mục state có thể bị xoá giữa chừng (reset-demo, git clean) trong khi tiến trình vẫn chạy
const save = () => { fs.mkdirSync(STATE_DIR, { recursive: true }); fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2)); };

const app = express();
app.use(express.raw({ type: "*/*", limit: "1mb" }));

app.get("/health", (_req, res) => res.json({ ok: true, issues: Object.keys(state).length, threshold: { users: THRESHOLD_USERS, events: THRESHOLD_EVENTS, windowMin: WINDOW_MIN } }));
app.get("/issues", (_req, res) => res.json(state));

app.post("/webhook/sentry", (req, res) => {
  if (SECRET) {
    const sig = req.get("sentry-hook-signature") || "";
    const digest = crypto.createHmac("sha256", SECRET).update(req.body).digest("hex");
    if (sig.length !== digest.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(digest))) return res.status(401).send("bad signature");
  }
  let payload; try { payload = JSON.parse(req.body.toString("utf8")); } catch { return res.status(400).send("bad json"); }

  const ev = payload.data?.event, issue = payload.data?.issue;
  const id = String(issue?.id || ev?.issue_id || ev?.event_id || "");
  if (!id) return res.status(204).end();
  const title = issue?.title || ev?.title || ev?.metadata?.type || "unknown";
  const user = ev?.user?.id || ev?.user?.email || ev?.user?.ip_address || ev?.tags?.find?.((t) => t[0] === "user")?.[1] || null;
  const now = Date.now();

  const local = (t) => new Date(t).toLocaleString("sv-SE").replace("T", " ");
  const s = state[id] ||= { title, firstSeen: new Date(now).toISOString(), firstSeenLocal: local(now), events: [], users: {}, triggered: false, sample: null };
  s.events = s.events.filter((t) => now - t < WINDOW_MIN * 60_000); s.events.push(now);
  if (user) s.users[user] = new Date(now).toISOString();
  if (!s.sample) s.sample = { culprit: issue?.culprit || ev?.culprit || null, url: issue?.web_url || ev?.web_url || null, stack: extractStack(payload), request: ev?.request ? { method: ev.request.method, url: ev.request.url, data: ev.request.data } : null };
  const nUsers = Object.keys(s.users).length, nEvents = s.events.length;
  save();

  if (s.triggered) return res.status(200).json({ id, status: "already-triggered" });
  const reached = nUsers >= THRESHOLD_USERS || nEvents >= THRESHOLD_EVENTS;
  console.log(`[receiver] ${id} "${title}" users=${nUsers}/${THRESHOLD_USERS} events=${nEvents}/${THRESHOLD_EVENTS} ${reached ? "→ TRIGGER" : "→ chờ"}`);
  if (!reached) return res.status(200).json({ id, status: "below-threshold", users: nUsers, events: nEvents });

  s.triggered = true; s.triggeredAt = new Date(now).toISOString(); s.triggeredAtLocal = local(now); save();
  const incident = { id, title, users: nUsers, events: nEvents, windowMin: WINDOW_MIN, firstSeen: s.firstSeen, firstSeenLocal: s.firstSeenLocal, triggeredAtLocal: s.triggeredAtLocal, ...s.sample, tags: issue?.tags || ev?.tags || [] };
  const file = path.join(STATE_DIR, `incident-${id}.json`);
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(incident, null, 2));
  const child = spawn(process.execPath, [path.join(__dirname, "..", "worker", "index.js"), file], { stdio: "inherit", env: process.env, detached: true });
  child.unref();
  res.status(202).json({ id, status: "triggered", users: nUsers, events: nEvents, workerPid: child.pid });
});

function extractStack(payload) {
  const ev = payload.data?.event;
  const frames = ev?.exception?.values?.[0]?.stacktrace?.frames || ev?.entries?.find((e) => e.type === "exception")?.data?.values?.[0]?.stacktrace?.frames;
  if (!frames) return null;
  return frames.slice(-8).map((f) => `${f.filename || f.abs_path}:${f.lineno} in ${f.function}`).join("\n");
}
app.listen(PORT, () => console.log(`[receiver] :${PORT} — trigger khi ≥${THRESHOLD_USERS} khách hoặc ≥${THRESHOLD_EVENTS} lần trong ${WINDOW_MIN} phút`));
