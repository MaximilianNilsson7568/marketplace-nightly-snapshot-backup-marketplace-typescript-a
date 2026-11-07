import assert from "node:assert/strict";
process.env.INFRAI_API_KEY ||= "local-test-key";
const { buildSnapshot, snapshotRequest, saveNightlySnapshot, cleanupNightlySnapshot } = await import("../src/snapshot.js");

const input = snapshotRequest.parse({ sellerAssets: [{ sellerId: "s-1", assetId: "sku-9", quantity: 4 }], buyerUpdates: [{ buyerId: "b-2", version: 3, note: "address confirmed" }], orderHandoff: [{ orderId: "o-7", sellerId: "s-1", buyerId: "b-2", status: "ready" }] });
const snapshot = buildSnapshot(input, "2026-02-03T00:00:00.000Z");
assert.deepEqual(snapshot.counts, { assets: 1, buyers: 1, orders: 1 });
assert.equal(snapshot.orderHandoff[0].status, "ready");
console.log("snapshot decision test passed");

const today = new Date().toISOString().slice(0, 10);
assert.equal(buildSnapshot(input).capturedAt, `${today}T00:00:00.000Z`);

// Exercise the full storage lifecycle without requiring live credentials.
const originalFetch = globalThis.fetch;
const calls: { url: string; method: string; body: unknown }[] = [];
globalThis.fetch = async (url, options) => {
  calls.push({ url: String(url), method: options?.method ?? "GET", body: options?.body });
  return new Response(JSON.stringify({ ok: true, data: { url: "https://upload.example/snapshot" } }), { status: 200 });
};
try {
  const result = await saveNightlySnapshot(input, "test-snapshot");
  assert.equal(result.objectKey, `snapshots/${today}.json`);
  assert.equal(JSON.parse(String(calls[2].body)).capturedAt, `${today}T00:00:00.000Z`);
  await cleanupNightlySnapshot(result.bucket, result.objectKey);
  assert.deepEqual(calls.map(call => call.method), ["POST", "POST", "PUT", "DELETE", "DELETE"]);
  assert.ok(calls[3].url.endsWith(`/object/delete/test-snapshot/${encodeURIComponent(result.objectKey)}`));
  assert.ok(calls[4].url.endsWith("/bucket/delete/test-snapshot"));
} finally {
  globalThis.fetch = originalFetch;
}
