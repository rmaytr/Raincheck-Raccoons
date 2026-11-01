const encoder = new TextEncoder();
export const proxyHeaders = {
  client: "x-raincheck-client", expires: "x-raincheck-expires", signature: "x-raincheck-signature",
} as const;

export async function sha256(value: string | ArrayBuffer): Promise<string> {
  const bytes = typeof value === "string" ? encoder.encode(value) : value;
  return hex(await crypto.subtle.digest("SHA-256", bytes));
}
function hex(value: ArrayBuffer): string {
  return Array.from(new Uint8Array(value), byte => byte.toString(16).padStart(2, "0")).join("");
}
async function key(secret: string, usage: KeyUsage[]) {
  if (secret.length < 32) throw new Error("Proxy key is unavailable");
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, usage);
}
async function message(req: Request, client: string, expires: string): Promise<Uint8Array<ArrayBuffer>> {
  const reader = req.clone().body?.getReader();
  const chunks: Uint8Array[] = []; let length = 0;
  if (reader) while (true) {
    const { value, done } = await reader.read(); if (done) break;
    length += value.byteLength;
    if (length > 4096) {
      void reader.cancel().catch(() => {});
      void req.body?.cancel().catch(() => {});
      throw new Error("Proxy body is too large");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return encoder.encode(["raincheck-proxy-v1", req.method, req.url, client, expires, await sha256(bytes.buffer)].join("\n"));
}
export async function signProxyRequest(req: Request, secret: string, client: string, now = Date.now()): Promise<void> {
  if (!/^[a-f0-9]{64}$/.test(client)) throw new Error("Invalid proxy client");
  const expires = String(now + 30_000);
  const signature = await crypto.subtle.sign("HMAC", await key(secret, ["sign"]), await message(req, client, expires));
  req.headers.set(proxyHeaders.client, client);
  req.headers.set(proxyHeaders.expires, expires);
  req.headers.set(proxyHeaders.signature, hex(signature));
}
export async function verifyProxyRequest(req: Request, secret?: string, now = Date.now()): Promise<string | null> {
  if (!Object.values(proxyHeaders).some(name => req.headers.has(name))) return null;
  const client = req.headers.get(proxyHeaders.client) || "";
  const expires = req.headers.get(proxyHeaders.expires) || "";
  const signature = req.headers.get(proxyHeaders.signature) || "";
  if (!secret || !/^[a-f0-9]{64}$/.test(client) || !/^\d{13}$/.test(expires)
    || !/^[a-f0-9]{64}$/.test(signature) || Number(expires) < now || Number(expires) > now + 35_000) {
    throw new Error("Invalid proxy authentication");
  }
  const bytes = Uint8Array.from(signature.match(/../g)!, pair => parseInt(pair, 16));
  if (!await crypto.subtle.verify("HMAC", await key(secret, ["verify"]), bytes, await message(req, client, expires))) {
    throw new Error("Invalid proxy authentication");
  }
  return client;
}
