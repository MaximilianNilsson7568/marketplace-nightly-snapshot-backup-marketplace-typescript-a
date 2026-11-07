import { createServer } from "node:http";
import { snapshotRequest, saveNightlySnapshot } from "./snapshot.js";

createServer(async (req, res) => {
  if (req.method !== "POST" || req.url !== "/snapshots/nightly") { res.writeHead(404).end(); return; }
  try {
    const raw = await new Promise<string>((resolve, reject) => { let data = ""; req.on("data", c => data += c); req.on("end", () => resolve(data)); req.on("error", reject); });
    const parsed = snapshotRequest.safeParse(JSON.parse(raw));
    if (!parsed.success) { res.writeHead(400, { "Content-Type": "application/json" }).end(JSON.stringify({ error: "invalid_request", details: parsed.error.flatten() })); return; }
    const result = await saveNightlySnapshot(parsed.data);
    res.writeHead(201, { "Content-Type": "application/json" }).end(JSON.stringify(result));
  } catch (error) { res.writeHead(502, { "Content-Type": "application/json" }).end(JSON.stringify({ error: error instanceof Error ? error.message : "snapshot_failed" })); }
}).listen(Number(process.env.PORT ?? 3000));
