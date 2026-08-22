#!/usr/bin/env node
// MCP server tối giản — KHÔNG dùng thư viện nào. Mục đích: cho thấy MCP chỉ là JSON-RPC 2.0 qua stdin/stdout.
// Nó mở kho incident của receiver ra cho Claude Code đọc: liệt kê, xem chi tiết, thống kê.
// Đăng ký:  claude mcp add incidents -- node mcp/incident-store.js
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

const STATE = process.env.RECEIVER_STATE || path.join(process.cwd(), "receiver", "state");
const readIssues = () => { try { return JSON.parse(fs.readFileSync(path.join(STATE, "issues.json"), "utf8")); } catch { return {}; } };

const TOOLS = [
  { name: "list_incidents", description: "Liệt kê các incident receiver đã ghi nhận, kèm số khách bị ảnh hưởng và đã kích hoạt agent chưa.",
    inputSchema: { type: "object", properties: { only_triggered: { type: "boolean", description: "Chỉ lấy incident đã vượt ngưỡng" } } } },
  { name: "get_incident", description: "Xem chi tiết một incident: stack trace, request mẫu, danh sách khách bị ảnh hưởng.",
    inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  { name: "incident_stats", description: "Thống kê nhanh: tổng số incident, bao nhiêu cái đã kích hoạt agent, lỗi nào nhiều khách nhất.",
    inputSchema: { type: "object", properties: {} } },
];

function call(name, args = {}) {
  const issues = readIssues();
  if (name === "list_incidents") {
    const rows = Object.entries(issues)
      .filter(([, v]) => (args.only_triggered ? v.triggered : true))
      .map(([id, v]) => `${id} · ${Object.keys(v.users || {}).length} khách · ${v.triggered ? "ĐÃ kích hoạt" : "chờ"} · ${v.title}`);
    return rows.length ? rows.join("\n") : "Chưa có incident nào.";
  }
  if (name === "get_incident") {
    const v = issues[args.id];
    if (!v) return `Không có incident ${args.id}`;
    return JSON.stringify({ id: args.id, title: v.title, users: Object.keys(v.users || {}), triggered: v.triggered, firstSeen: v.firstSeen, ...v.sample }, null, 2);
  }
  if (name === "incident_stats") {
    const all = Object.entries(issues);
    const worst = all.sort((a, b) => Object.keys(b[1].users || {}).length - Object.keys(a[1].users || {}).length)[0];
    return JSON.stringify({ tong: all.length, da_kich_hoat: all.filter(([, v]) => v.triggered).length,
      nhieu_khach_nhat: worst ? { id: worst[0], khach: Object.keys(worst[1].users || {}).length, title: worst[1].title } : null }, null, 2);
  }
  throw new Error("unknown tool: " + name);
}

const send = (msg) => process.stdout.write(JSON.stringify(msg) + "\n");
readline.createInterface({ input: process.stdin }).on("line", (line) => {
  if (!line.trim()) return;
  let req; try { req = JSON.parse(line); } catch { return; }
  const reply = (result) => req.id !== undefined && send({ jsonrpc: "2.0", id: req.id, result });
  try {
    if (req.method === "initialize")
      return reply({ protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "incident-store", version: "1.0.0" } });
    if (req.method === "tools/list") return reply({ tools: TOOLS });
    if (req.method === "tools/call")
      return reply({ content: [{ type: "text", text: String(call(req.params?.name, req.params?.arguments || {})) }] });
    if (req.method?.startsWith("notifications/")) return;            // không cần trả lời
    if (req.id !== undefined) send({ jsonrpc: "2.0", id: req.id, error: { code: -32601, message: "Method not found: " + req.method } });
  } catch (e) {
    if (req.id !== undefined) send({ jsonrpc: "2.0", id: req.id, error: { code: -32603, message: e.message } });
  }
});
