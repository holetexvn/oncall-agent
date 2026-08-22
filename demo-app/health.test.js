import test from "node:test";
import assert from "node:assert/strict";
test("validate: items phải là mảng", () => {
  const ok = (items) => Array.isArray(items) && items.length > 0;
  assert.equal(ok([{ price: 1, qty: 1 }]), true);
  assert.equal(ok(undefined), false);
});
