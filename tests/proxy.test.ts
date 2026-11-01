import test from "node:test";
import assert from "node:assert/strict";
import { proxyHeaders, sha256, signProxyRequest, verifyProxyRequest } from "../lib/proxy-auth.ts";
import { handleCreate, handleGet } from "../lib/server-vercel.ts";

const secret = "local-test-only-key-".repeat(3);
const now = 1_790_000_000_000;
const client = await sha256("local-test-client");
const origin = "https://game.example";
const make = (body = '{"name":"QA","avatar":0}') => new Request(`${origin}/api/rooms`, {
  method: "POST", headers: { "content-type": "application/json", origin }, body,
});

test("signed request verifies across Node/Workers Web Crypto and permits small clock skew", async () => {
  const req = make(); await signProxyRequest(req, secret, client, now);
  assert.equal(await verifyProxyRequest(req, secret, now + 100), client);
  assert.equal(await verifyProxyRequest(req, secret, now - 100), client);
});
test("native Worker traffic needs no proxy signature; partial authentication fails closed", async () => {
  assert.equal(await verifyProxyRequest(make()), null);
  const req = make(); req.headers.set(proxyHeaders.client, client);
  await assert.rejects(verifyProxyRequest(req, secret, now));
});
for (const change of ["body", "path", "method", "client", "expiry", "signature", "key"]) {
  test(`proxy authentication rejects altered ${change}`, async () => {
    const req = make(); await signProxyRequest(req, secret, client, now);
    const headers = new Headers(req.headers);
    if (change === "client") headers.set(proxyHeaders.client, "a".repeat(64));
    if (change === "expiry") headers.set(proxyHeaders.expires, String(now + 20_000));
    if (change === "signature") headers.set(proxyHeaders.signature, "0".repeat(64));
    const mutated = new Request(change === "path" ? `${origin}/api/rooms/ABCDEF/actions` : req.url, {
      method: change === "method" ? "PUT" : "POST", headers,
      body: change === "body" ? '{"name":"Different"}' : await req.text(),
    });
    await assert.rejects(verifyProxyRequest(mutated, change === "key" ? "wrong-key-".repeat(5) : secret, now));
  });
}
test("expired, missing-key and far-future signatures are rejected", async () => {
  const req = make(); await signProxyRequest(req, secret, client, now);
  await assert.rejects(verifyProxyRequest(req, secret, now + 30_001));
  await assert.rejects(verifyProxyRequest(req, undefined, now));
  await assert.rejects(verifyProxyRequest(req, secret, now - 6000));
});
test("authentication hashing rejects oversized bodies", async () => {
  await assert.rejects(signProxyRequest(make("x".repeat(4097)), secret, client, now));
});

async function withProxy(run: () => Promise<void>) {
  const previous = { ...process.env }; const originalFetch = globalThis.fetch;
  process.env.RAINCHECK_BACKEND_URL = "https://backend.example";
  process.env.RAINCHECK_PROXY_SECRET = secret;
  try { await run(); } finally { process.env = previous; globalThis.fetch = originalFetch; }
}
test("Vercel forwards only the game cookie, signs trusted client hash and preserves response semantics", () => withProxy(async () => {
  process.env.VERCEL = "1";
  globalThis.fetch = async input => {
    const req = input as Request;
    assert.equal(req.url, "https://backend.example/api/rooms");
    assert.equal(req.headers.get("origin"), "https://backend.example");
    assert.equal(req.headers.get("cookie"), "raincheck_session=abc");
    assert.equal(req.headers.get("authorization"), null);
    assert.equal(await verifyProxyRequest(req, secret), await sha256("raincheck-client:192.0.2.10"));
    assert.equal((await req.json() as { name: string }).name, "QA");
    return Response.json({ phase: "lobby" }, { status: 201, headers: {
      "set-cookie": "raincheck_session=updated; HttpOnly; Secure; SameSite=Lax; Path=/", "x-internal": "private",
    } });
  };
  const req = make(); req.headers.set("cookie", "unrelated=private; raincheck_session=abc");
  req.headers.set("authorization", "not-forwarded"); req.headers.set("x-vercel-forwarded-for", "192.0.2.10");
  req.headers.set(proxyHeaders.signature, "attacker-supplied");
  const res = await handleCreate(req);
  assert.equal(res.status, 201); assert.equal(res.headers.get("cache-control"), "no-store, private");
  assert.match(res.headers.get("set-cookie")!, /HttpOnly; Secure/); assert.equal(res.headers.get("x-internal"), null);
}));
test("foreign Origin and cross-site mutations never reach the backend", () => withProxy(async () => {
  globalThis.fetch = async () => { throw new Error("Must not fetch"); };
  for (const header of ["origin", "sec-fetch-site"]) {
    const req = make(); req.headers.set(header, header === "origin" ? "https://attacker.example" : "cross-site");
    assert.equal((await handleCreate(req)).status, 403);
  }
}));
test("Next internal hostname does not reject a browser using the routed public Host", () => withProxy(async () => {
  process.env.VERCEL = "1";
  globalThis.fetch = async () => Response.json({ phase: "lobby" }, { status: 201 });
  const req = new Request("http://localhost:4173/api/rooms", { method: "POST", headers: {
    origin, host: "game.example", "content-type": "application/json",
  }, body: '{"name":"QA","avatar":0}' });
  assert.equal((await handleCreate(req)).status, 201);
}));
test("gateway bounds untrusted request bodies and rejects invalid room paths", () => withProxy(async () => {
  globalThis.fetch = async () => { throw new Error("Must not fetch"); };
  assert.equal((await handleCreate(make("x".repeat(4097)))).status, 413);
  assert.equal((await handleGet(new Request(`${origin}/api/rooms/x`), "../admin")).status, 400);
}));
test("missing secrets, unsafe backend config and upstream redirects fail without disclosing internal URLs", () => withProxy(async () => {
  delete process.env.RAINCHECK_PROXY_SECRET;
  assert.equal((await handleCreate(make())).status, 503);
  process.env.RAINCHECK_PROXY_SECRET = secret;
  process.env.RAINCHECK_BACKEND_URL = "http://backend.example";
  assert.equal((await handleCreate(make())).status, 503);
  process.env.RAINCHECK_BACKEND_URL = "https://backend.example";
  globalThis.fetch = async () => new Response(null, { status: 302, headers: { location: "https://internal.example" } });
  const res = await handleCreate(make()); assert.equal(res.status, 503); assert.equal(res.headers.has("location"), false);
  assert.ok(!(await res.text()).includes("internal"));
}));
