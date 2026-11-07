import { z } from "zod";
import { infrai } from "./infrai.js";

export const snapshotRequest = z.object({
  sellerAssets: z.array(z.object({ sellerId: z.string().min(1), assetId: z.string().min(1), quantity: z.number().int().nonnegative() })),
  buyerUpdates: z.array(z.object({ buyerId: z.string().min(1), version: z.number().int().nonnegative(), note: z.string().min(1) })),
  orderHandoff: z.array(z.object({ orderId: z.string().min(1), sellerId: z.string().min(1), buyerId: z.string().min(1), status: z.enum(["ready", "held", "complete"]) }))
});
export type SnapshotRequest = z.infer<typeof snapshotRequest>;

export function buildSnapshot(input: SnapshotRequest, capturedAt = new Date().toISOString().slice(0, 10) + "T00:00:00.000Z") {
  return { capturedAt, sellerAssets: input.sellerAssets, buyerUpdates: input.buyerUpdates, orderHandoff: input.orderHandoff, counts: { assets: input.sellerAssets.length, buyers: input.buyerUpdates.length, orders: input.orderHandoff.length } };
}

export async function saveNightlySnapshot(input: SnapshotRequest, bucket = process.env.SNAPSHOT_BUCKET ?? "marketplace-nightly") {
  await infrai.storage.bucket.create({ name: bucket });
  const snapshot = buildSnapshot(input);
  const objectKey = `snapshots/${snapshot.capturedAt.slice(0, 10)}.json`;
  const { url } = await infrai.storage.object.presign(bucket, objectKey, { op: "put", expires_seconds: 900, content_type: "application/json", idempotency_key: objectKey });
  const upload = await fetch(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(snapshot) });
  if (!upload.ok) throw new Error(`Snapshot upload failed with HTTP ${upload.status}`);
  return { bucket, objectKey, counts: snapshot.counts };
}

// Only delete a bucket dedicated to this snapshot. Nonempty buckets cannot be deleted.
export async function cleanupNightlySnapshot(bucket: string, objectKey: string) {
  await infrai.storage.object.delete(bucket, objectKey);
  await infrai.storage.bucket.delete(bucket);
}
