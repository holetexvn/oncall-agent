// Tái hiện incident local-c7c1d029ac: POST /orders thiếu `items` -> 500 TypeError.
import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appPath = fileURLToPath(new URL("./index.js", import.meta.url));

async function withApp(fn) {
  const port = 3900 + Math.floor(Math.random() * 90);
  const child = spawn(process.execPath, [appPath], {
    env: {
      ...process.env,
      PORT: String(port),
      LOG_DIR: mkdtempSync(path.join(tmpdir(), "orders-test-")),
      SENTRY_DSN: "",
      RECEIVER_URL: "",
    },
    stdio: "ignore",
  });
  try {
    for (let i = 0; i < 50; i++) {
      try {
        await fetch(`http://localhost:${port}/health`);
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    await fn((body) =>
      fetch(`http://localhost:${port}/orders`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
  } finally {
    child.kill();
  }
}

test("POST /orders thiếu items -> 400 chứ không phải 500", async () => {
  await withApp(async (post) => {
    // đúng request trong incident local-c7c1d029ac
    const res = await post({ customer: { id: "khach-1", name: "Khách 1" } });
    assert.equal(res.status, 400);
  });
});

test("POST /orders items rỗng -> 400", async () => {
  await withApp(async (post) => {
    const res = await post({ customer: { id: "khach-1" }, items: [] });
    assert.equal(res.status, 400);
  });
});

test("POST /orders items hợp lệ -> 200 và total đúng", async () => {
  await withApp(async (post) => {
    const res = await post({
      customer: { id: "khach-1" },
      items: [{ price: 10, qty: 2 }],
    });
    assert.equal(res.status, 200);
    assert.equal((await res.json()).total, 20);
  });
});
