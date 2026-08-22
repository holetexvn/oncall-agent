// E2E không cần Sentry, không tốn tiền: 3 khách khác nhau report cùng lỗi → chỉ khi đủ 3 mới kích hoạt worker (mock claude).
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import fs from "node:fs";
process.env.RECEIVER_PORT ||= "18080"; process.env.DRY_RUN = "1"; process.env.REPO_DIR ||= process.cwd();
process.env.TRIGGER_MIN_USERS ||= "3"; process.env.TRIGGER_MIN_EVENTS ||= "3";
fs.rmSync("receiver/state", { recursive: true, force: true });
const recv = spawn(process.execPath, ["receiver/index.js"], { stdio: "inherit", env: process.env });
await sleep(800);
const issueId = "e2e-" + Date.now();
const send = (user) => fetch(`http://localhost:${process.env.RECEIVER_PORT}/webhook/sentry`, {
  method: "POST", headers: { "content-type": "application/json", "sentry-hook-resource": "event_alert" },
  body: JSON.stringify({ action: "triggered", data: { event: { issue_id: issueId, title: "TypeError: Cannot read properties of undefined (reading 'reduce')", culprit: "POST /orders", user: { id: user }, request: { method: "POST", url: "/orders", data: { customer: { id: user } } } } } }),
}).then(async (r) => ({ status: r.status, body: await r.json() }));
for (const u of ["user-1", "user-2"]) console.log("[e2e]", u, "→", JSON.stringify(await send(u)));
console.log("[e2e] (2 khách: phải là below-threshold, chưa có worker)");
console.log("[e2e] user-3 →", JSON.stringify(await send("user-3")), "← phải là triggered");
console.log("[e2e] user-3 lại →", JSON.stringify(await send("user-3")), "← already-triggered");
await sleep(1500);
recv.kill();
const runs = fs.readdirSync("worker/runs").filter((f) => f.startsWith("run-" + issueId));
console.log(runs.length === 1 ? "[e2e] ✅ worker chạy đúng 1 lần" : "[e2e] ❌ worker chạy " + runs.length + " lần");
process.exit(runs.length === 1 ? 0 : 1);
