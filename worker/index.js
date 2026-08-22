// Worker: chạy `claude -p` với đầy đủ ranh giới, parse JSON, gọi reporter.
// Đây là "nhân viên". 4 việc: giao việc theo sự kiện / giới hạn quyền / ngân sách / báo cáo.
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { report } from "../reporter/telegram.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const incidentFile = process.argv[2];
if (!incidentFile) { console.error("usage: node worker/index.js <incident.json>"); process.exit(2); }
const incident = JSON.parse(fs.readFileSync(incidentFile, "utf8"));

const REPO_DIR = process.env.REPO_DIR || process.cwd();
const LOG_DIR = process.env.LOG_DIR || "/var/log/demo-app";
const MAX_BUDGET = process.env.MAX_BUDGET_USD || "1.50";
const MAX_TURNS = process.env.MAX_TURNS || "20";
const RUNS = path.join(__dirname, "runs");
fs.mkdirSync(RUNS, { recursive: true });

const prompt = fs.readFileSync(path.join(__dirname, "task.md"), "utf8")
  .replaceAll("{{USERS}}", String(incident.users ?? "?"))
  .replaceAll("{{EVENTS}}", String(incident.events ?? "?"))
  .replaceAll("{{ID}}", incident.id)
  .replaceAll("{{LOG_DIR}}", LOG_DIR)
  .replaceAll("{{INCIDENT}}", JSON.stringify(incident, null, 2));
const schema = fs.readFileSync(path.join(__dirname, "result-schema.json"), "utf8");

// ---- Bộ flag = 4 việc ----
const args = [
  "-p",                                                   // việc 1: chạy một lượt, không giao diện
  // KHÔNG dùng --bare ở đây: cần load skill `.claude/skills/incident-triage` (Level 2 → dùng ở Level 3).
  // Tắt MCP để không kéo tool thừa vào context:
  "--strict-mcp-config", "--mcp-config", '{"mcpServers":{}}',
  "--permission-mode", "dontAsk",                         //         không chặn để hỏi
  // stream-json: vừa có envelope cuối, vừa xem được agent đang làm gì theo thời gian thực
  "--output-format", "stream-json", "--verbose",          // việc 4: envelope có session_id + cost để log
  "--json-schema", schema,                                //         ép output đúng cấu trúc
  "--tools", "Skill,Bash,Read,Edit,Write,Grep,Glob",      // việc 2: giới hạn tool (Skill để nạp incident-triage)
  // dontAsk = KHÔNG hỏi và TỪ CHỐI mọi thứ chưa được allow rõ ràng → phải liệt kê việc agent được làm.
  // Đây chính là "ranh giới": được sửa file, chạy test, tái hiện lỗi, mở PR — không hơn.
  // Cho phép RỘNG ở tầng flag, chặn CHẮC ở tầng hook.
  // Lý do (học bằng tiền): liệt kê từng pattern rất dễ trượt — agent gõ `git -C <dir> status`
  // là không khớp `Bash(git status*)`, thế là đứng hình dù việc hoàn toàn vô hại.
  // Hook PreToolUse quét NGUYÊN chuỗi lệnh nên bắt được cả `-C`, cả `&&`, cả pipe.
  "--allowedTools", "Edit", "Write", "Bash",
  "--disallowedTools",
    "mcp__*",
    "Bash(rm *)", "Bash(sudo *)", "Bash(systemctl *)", "Bash(docker *)",
    "Bash(git push --force*)", "Bash(git push origin main*)", "Bash(gh pr merge*)",
    "Bash(curl * | sh)", "Bash(curl * | bash)", "Bash(cat *.env*)",
  "--max-budget-usd", MAX_BUDGET,                         // việc 3: trần tiền
  "--max-turns", MAX_TURNS,                               //         trần lượt
  prompt,
];

const bin = process.env.DRY_RUN ? path.join(__dirname, "..", "scripts", "mock-claude.js") : "claude";
const cmd = process.env.DRY_RUN ? process.execPath : bin;
const finalArgs = process.env.DRY_RUN ? [bin, ...args] : args;

console.log(`[worker] incident ${incident.id} — running claude in ${REPO_DIR} (budget $${MAX_BUDGET}, turns ${MAX_TURNS})`);
const t0 = Date.now();

// ---- chạy có hình: in ra từng bước agent làm, thay vì im lặng vài phút ----
const VIỆC = { Read: "đọc  ", Write: "ghi  ", Edit: "sửa  ", Bash: "chạy ", Grep: "tìm  ", Glob: "tìm  ", Skill: "skill", Task: "giao " };
const đồng_hồ = () => { const s = Math.round((Date.now() - t0) / 1000); return `${String(Math.floor(s / 60))}:${String(s % 60).padStart(2, "0")}`; };
const gọn = (o) => { const t = o?.command || o?.file_path || o?.pattern || o?.skill || JSON.stringify(o || {}); return String(t).replace(/\s+/g, " ").slice(0, 88); };

const child = spawn(cmd, finalArgs, { cwd: REPO_DIR, env: process.env, stdio: ["ignore", "pipe", "pipe"] });
let envelope = null, stderr = "";
child.stderr.on("data", (d) => { stderr += d; });
readline.createInterface({ input: child.stdout }).on("line", (line) => {
  if (!line.trim()) return;
  let j; try { j = JSON.parse(line); } catch { return; }
  if (j.type === "assistant" && j.message?.content) {
    for (const c of j.message.content) {
      if (c.type === "tool_use") console.log(`  [${đồng_hồ()}] ▸ ${VIỆC[c.name] || c.name} ${gọn(c.input)}`);
      else if (c.type === "text" && c.text.trim()) console.log(`  [${đồng_hồ()}]   ${c.text.trim().replace(/\s+/g, " ").slice(0, 100)}`);
    }
  } else if (j.type === "result") envelope = j;
});
const exitCode = await new Promise((res) => child.on("close", res));
const r = { status: exitCode, stderr };
const secs = ((Date.now() - t0) / 1000).toFixed(1);

const runFile = path.join(RUNS, `run-${incident.id}.json`);
let result = null;
try {
  result = envelope?.structured_output ?? (typeof envelope?.result === "string" ? JSON.parse(envelope.result) : envelope?.result ?? null);
} catch (e) {
  console.error("[worker] không đọc được kết quả:", e.message, "\nstderr:", r.stderr?.slice(0, 1500));
}
fs.writeFileSync(runFile, JSON.stringify({ incident, exit: r.status, secs, envelope, result, stderr: r.stderr }, null, 2));

const cost = envelope?.total_cost_usd ?? envelope?.cost_usd ?? null;
const text = result
  ? [
      `🚨 On-call: ${incident.title}`,
      `👥 ${incident.users ?? "?"} khách · ${incident.events ?? "?"} lần / ${incident.windowMin ?? "?"} phút${incident.culprit ? ` · ${incident.culprit}` : ""}`,
      `Kết luận: ${result.action} (tin cậy ${Math.round((result.confidence ?? 0) * 100)}%)`,
      `Root cause: ${result.root_cause}`,
      result.pr_url ? `PR: ${result.pr_url}` : null,
      result.summary_for_human,
      `🕐 ${incident.triggeredAtLocal ?? new Date().toLocaleString("sv-SE").replace("T"," ")} · ⏱ ${secs}s · 💸 $${cost ?? "?"} · session ${envelope?.session_id ?? "?"}`,
    ].filter(Boolean).join("\n")
  : `⚠️ On-call: ${incident.title}\nAgent không trả về kết quả hợp lệ (exit ${r.status})${envelope?.is_error ? ` — ${String(envelope.result).slice(0, 200)}` : ""}. Xem ${runFile}`;

console.log(text);
await report(text, result?.pr_url ? { prUrl: result.pr_url, incidentId: incident.id } : null);
process.exit(result ? 0 : 1);
