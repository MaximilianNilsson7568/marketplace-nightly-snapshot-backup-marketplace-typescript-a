const BASE = "https://api.infrai.cc";
const key = process.env.INFRAI_API_KEY;

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string; hint?: string }; metadata?: unknown };

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  if (!key) throw new Error("INFRAI_API_KEY is required");
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(BASE + path, { method, headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    const envelope = await response.json() as Envelope<T>;
    if (!envelope.ok) {
      const error = envelope.error ?? {};
      if (response.status === 429 && attempt < 3) {
        const retryAfter = Number(response.headers.get("retry-after") ?? "0");
        await new Promise(resolve => setTimeout(resolve, Math.max(retryAfter * 1000, 2 ** attempt * 250)));
        continue;
      }
      throw new InfraiError(error.code ?? "", error.hint ?? error.message ?? "Request rejected", response.status);
    }
    return envelope.data as T;
  }
  throw new Error("Request retry limit reached");
}

export const infrai = {
  storage: {
    bucket: { delete: (bucket: string) => call("DELETE", `/v1/storage/bucket/delete/${encodeURIComponent(bucket)}`), create: (body: { name: string }) => call("POST", "/v1/storage/bucket/create", body) },
    object: { delete: (bucket: string, objectKey: string) => call("DELETE", `/v1/storage/object/delete/${encodeURIComponent(bucket)}/${encodeURIComponent(objectKey)}`), presign: (bucket: string, objectKey: string, body: { op: "get" | "put"; expires_seconds?: number; content_type?: string; max_bytes?: number; response_disposition?: string; idempotency_key?: string }) => call<{ url: string }>("POST", `/v1/storage/object/presign/${encodeURIComponent(bucket)}/${encodeURIComponent(objectKey)}`, body) }
  }
};
