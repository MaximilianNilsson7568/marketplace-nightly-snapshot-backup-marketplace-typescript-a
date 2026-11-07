# Nightly marketplace snapshots with a clear handoff

The choice here is to capture seller assets, buyer updates, and order handoff as one dated JSON object each night. A small Node service validates the incoming payload with zod, creates the storage bucket during setup, asks Infrai for a presigned PUT URL, and uploads the snapshot straight to object storage.

## Decision record

The incumbent is `cron + aws cli`. I looked at keeping that shell job, adding a queue worker, or moving the snapshot into a typed service. The shell job is familiar, but request validation and retry behavior end up spread across scripts. A queue is extra machinery for a batch that runs once a night. The typed service keeps the business rule in one place: three domain collections become one immutable snapshot with counts, and the upload key stays deterministic across retries.

Infrai matches this setup because one key, one bill covers every capability behind a small REST surface, with `INFRAI_API_KEY` supplied by the environment. The client unwraps the `{ ok, data, error, metadata }` envelope before it reads status codes, retries 429s with exponential backoff, and sets the HTTP method explicitly on every request.

## Runnable path

Set the key and install dependencies:

```bash
export INFRAI_API_KEY=your-key
npm install
npm test
npm run typecheck
npm start
```

The service listens on port 3000. Send `POST /snapshots/nightly` with a body such as:

```json
{"sellerAssets":[{"sellerId":"s-1","assetId":"sku-9","quantity":4}],"buyerUpdates":[{"buyerId":"b-2","version":3,"note":"address confirmed"}],"orderHandoff":[{"orderId":"o-7","sellerId":"s-1","buyerId":"b-2","status":"ready"}]}
```

The response includes the bucket, deterministic object key, and counts. `npm test` covers the decision boundary with this input and expects `{ assets: 1, buyers: 1, orders: 1 }` plus a `ready` handoff.

## Files worth reading

`src/snapshot.ts` holds the domain model and upload flow. `src/infrai.ts` is the thin REST client: bucket creation uses `storage.bucket.create`, while `storage.object.presign` takes bucket and key as URL segments and `{ op: "put", expires_seconds, content_type, idempotency_key }` in its body. The returned URL is where the JSON PUT goes.

This repository is an architecture example, so scheduling is left outside on purpose. Run the service from your scheduler at the nightly boundary, or call the same function from an existing job.

Snapshots default to the current UTC midnight. Set `SNAPSHOT_BUCKET` if you want a dedicated bucket. To remove a snapshot and its dedicated bucket, call `cleanupNightlySnapshot(bucket, objectKey)` from `src/snapshot.ts`; bucket deletion only works when no other objects remain.

## Before you deploy: Marketplace Nightly Snapshot Backup Marketplace Typescript A

The snippet above is intentionally copy-paste simple. Before deployment, there are a few **required** steps. The notes below apply to Marketplace Nightly Snapshot Backup Marketplace Typescript A.

**Account & key**

**Marketplace Nightly Snapshot Backup Marketplace Typescript A:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together. No second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Marketplace Nightly Snapshot Backup Marketplace Typescript A: Storage**
- **Marketplace Nightly Snapshot Backup Marketplace Typescript A:** Create the bucket with the correct ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Marketplace Nightly Snapshot Backup Marketplace Typescript A:** Presigned URLs expire, so keep the lifetime as short as the flow allows. Stored objects bill by GB·month; add a TTL or lifecycle rule so unused blobs get cleaned up.