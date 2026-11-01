// Native Next.js/Vercel entrypoint selected by next.config.ts. The Cloudflare
// build keeps lib/server.ts and the authoritative engine and D1 storage.
import { sha256, signProxyRequest } from "./proxy-auth.ts";

function error(message: string, status: number, code: string) {
  return Response.json({ error: message, code }, { status, headers: {
    "Cache-Control": "no-store, private", Vary: "Cookie", "X-Content-Type-Options": "nosniff",
  } });
}
function backendOrigin(): URL {
  const url = new URL(process.env.RAINCHECK_BACKEND_URL || "");
  const local = process.env.RAINCHECK_ALLOW_LOCAL_BACKEND === "1" && process.env.VERCEL !== "1"
    && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
  if ((!local && url.protocol !== "https:") || url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error("Invalid backend configuration");
  }
  return url;
}
async function forward(req: Request, pathname: string): Promise<Response> {
  const incoming = new URL(req.url);
  // Next's internal request URL can use localhost even when the browser used a
  // different hostname. Host is supplied by HTTP routing; browsers cannot forge it.
  let requestOrigin: string;
  try {
    requestOrigin = new URL(`${process.env.VERCEL === "1" ? "https:" : incoming.protocol}//${req.headers.get("host") || incoming.host}`).origin;
  } catch { return error("Open this game directly before sending a request.", 403, "ORIGIN_REJECTED"); }
  if (req.method !== "GET" && ((req.headers.has("origin") && req.headers.get("origin") !== requestOrigin)
    || req.headers.get("sec-fetch-site") === "cross-site")) {
    return error("Open this game directly before sending a request.", 403, "ORIGIN_REJECTED");
  }
  try {
    const secret = process.env.RAINCHECK_PROXY_SECRET;
    if (!secret || secret.length < 32) throw new Error("Missing backend configuration");
    const target = new URL(pathname, backendOrigin());
    const headers = new Headers({ accept: "application/json", origin: target.origin });
    const cookie = (req.headers.get("cookie") || "").split(";")
      .map(part => part.trim()).filter(part => part.startsWith("raincheck_session=")).join("; ");
    if (cookie) headers.set("cookie", cookie);
    let body: ArrayBuffer | undefined;
    if (req.method !== "GET") {
      if (!req.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
        return error("Send the action as JSON.", 415, "INVALID_CONTENT_TYPE");
      }
      if (Number(req.headers.get("content-length") || 0) > 4096) return error("That request is too large.", 413, "BODY_TOO_LARGE");
      if (!req.body) return error("This request needs a small JSON body.", 400, "INVALID_INPUT");
      const reader = req.body.getReader(); const chunks: Uint8Array[] = []; let length = 0;
      while (true) {
        const { value, done } = await reader.read(); if (done) break;
        length += value.byteLength;
        if (length > 4096) { await reader.cancel(); return error("That request is too large.", 413, "BODY_TOO_LARGE"); }
        chunks.push(value);
      }
      const bytes = new Uint8Array(length); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      body = bytes.buffer;
      headers.set("content-type", "application/json");
    }
    // Vercel overwrites these incoming IP headers. Forward only a signed hash,
    // never arbitrary browser-supplied proxy headers or unrelated cookies.
    const ip = process.env.VERCEL === "1"
      ? req.headers.get("x-vercel-forwarded-for") || req.headers.get("x-forwarded-for") || "unknown"
      : "local";
    const upstream = new Request(target, { method: req.method, headers, body });
    await signProxyRequest(upstream, secret, await sha256(`raincheck-client:${ip}`));
    const response = await fetch(upstream, { cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(20_000) });
    if (!response.headers.get("content-type")?.includes("application/json") || (response.status >= 300 && response.status < 400)) {
      throw new Error("Unexpected backend response");
    }
    const outgoing = new Headers({ "Cache-Control": "no-store, private", Vary: "Cookie", "X-Content-Type-Options": "nosniff" });
    for (const name of ["content-type", "retry-after"]) {
      const value = response.headers.get(name); if (value) outgoing.set(name, value);
    }
    for (const value of response.headers.getSetCookie()) outgoing.append("set-cookie", value);
    return new Response(response.body, { status: response.status, headers: outgoing });
  } catch {
    return error("The rooftop service is warming up. Please try again soon.", 503, "SERVICE_UNAVAILABLE");
  }
}
function roomRequest(req: Request, code: string, suffix = "") {
  if (!/^[A-HJ-NP-Z2-9]{6}$/i.test(code)) return Promise.resolve(error("Room codes have 6 letters or numbers. Check your invite.", 400, "INVALID_CODE"));
  return forward(req, `/api/rooms/${code.toUpperCase()}${suffix}`);
}
export const handleCreate = (req: Request) => forward(req, "/api/rooms");
export const handleGet = (req: Request, code: string) => roomRequest(req, code);
export const handleJoin = (req: Request, code: string) => roomRequest(req, code, "/join");
export const handleAction = (req: Request, code: string) => roomRequest(req, code, "/actions");
