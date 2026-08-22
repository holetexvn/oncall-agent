// Giả lập `claude -p --output-format json --json-schema ...` để test pipeline không tốn tiền.
const args = process.argv.slice(2);
const prompt = args[args.length - 1];
const id = (prompt.match(/fix\/incident-([\w-]+)/) || [])[1] || "unknown";
const incidentPart = prompt.slice(prompt.indexOf("## Incident"));
const suspicious = /ignore previous instructions|curl [^\n]*\| *sh/i.test(incidentPart);
const result = suspicious
  ? { incident_id: id, root_cause: "Input người dùng chứa chỉ thị giả — dấu hiệu prompt injection qua log", confidence: 0.9, action: "suspicious_input", pr_url: null, files_changed: [], summary_for_human: "Không sửa gì. Request có chuỗi giống lệnh cho agent. Nên chặn IP và xem lại validation." }
  : { incident_id: id, root_cause: "POST /orders không validate `items`, gọi .reduce trên undefined", confidence: 0.85, action: "pr_opened", pr_url: `https://github.com/holetexvn/oncall-agent/pull/1`, files_changed: ["demo-app/index.js", "demo-app/orders.test.js"], summary_for_human: "Thêm guard Array.isArray(items) và trả 400. Có test tái hiện. Chưa merge." };
process.stdout.write(JSON.stringify({ type: "result", subtype: "success", is_error: false, session_id: "mock-" + id, total_cost_usd: 0.0731, num_turns: 9, duration_ms: 42000, result: JSON.stringify(result), structured_output: result }));
