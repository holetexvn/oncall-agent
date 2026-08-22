// Tái hiện incident local-c7c1d029ac: POST /orders thiếu `items` -> TypeError ... 'reduce' -> 500.
// Chạy app thật ở port tạm để test đúng đường đi của request thật (index.js không export app).
import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const APP = fileURLToPath(new URL("./index.js", import.meta.url));
const PORT = 3998;
const BASE = `http://127.0.0.1:${PORT}`;

async function startApp() {
  const logDir = fs.mkdtempSync(path.join(os.tmpdir(), "orders-test-"));
  const child = spawn(process.execPath, [APP], {
    env: {
      ...process.env,
      PORT: String(PORT),
      LOG_DIR: logDir,
      SENTRY_DSN: "",
      RECEIVER_URL: "",
    },
    stdio: "ignore",
  });
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(`${BASE}/health`);
      if (r.ok) return child;
    } catch {
      /* chưa listen, thử lại */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  child.kill();
  throw new Error("app tạm không lên được trong 5s");
}

const postOrder = (body) =>
  fetch(`${BASE}/orders`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

test("POST /orders", async (t) => {
  const child = await startApp();
  t.after(() => child.kill());

  // Request y hệt incident local-c7c1d029ac (thiếu `items`). Trước fix: 500.
  await t.test("thiếu items -> 400, không 500", async () => {
    const res = await postOrder({
      customer: { id: "user-1", name: "Khách 1" },
    });
    assert.equal(res.status, 400);
    assert.deepEqual(await res.json(), { error: "items phải là mảng" });
  });

  await t.test("items không phải mảng -> 400", async () => {
    const res = await postOrder({
      customer: { id: "user-2" },
      items: "2 cái áo",
    });
    assert.equal(res.status, 400);
  });

  // Đường đi bình thường không được đổi.
  await t.test("items hợp lệ -> 200 và total đúng", async () => {
    const res = await postOrder({
      customer: { id: "user-3" },
      items: [
        { price: 100, qty: 2 },
        { price: 50, qty: 1 },
      ],
    });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), {
      ok: true,
      customer: { id: "user-3" },
      total: 250,
    });
  });
});
