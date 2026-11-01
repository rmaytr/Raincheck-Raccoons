# Vercel deployment

## What runs where

The default `npm run build` is a native Next.js 16 production build and produces `.next/routes-manifest.json`. `vercel.json` selects Next.js, `.next`, the reproducible installer and this build command. Node 24 is pinned in package metadata and the Vercel project settings.

Vercel serves the unchanged React game and four same-origin API operations. Those handlers call the existing Cloudflare game API over a signed server-to-server connection. The authoritative engine, private state, scoring, optimistic concurrency and D1 storage remain on the existing Worker. This preserves the game rules and persistence rather than replacing them with process memory or a static-only deployment.

The browser uses the Vercel origin for invitations, polling and session cookies. It does not call the Worker directly or receive the proxy secret. The old Cloudflare and Sites URLs remain independently usable.

## Owner configuration

Import this repository into Vercel using the root directory and Next.js preset. Use:

| Setting | Value |
|---|---|
| Node | `24.x` |
| Install command | `npm run install:ci` |
| Build command | `npm run build` |
| Output | `.next` |

Configure these **server-only** variables in production and preview:

- `RAINCHECK_BACKEND_URL`: the HTTPS origin of the Raincheck Worker, with no path or query.
- `RAINCHECK_PROXY_SECRET`: a cryptographically random private value of at least 32 characters, also stored as a Worker secret of the same name. Never put it in a `NEXT_PUBLIC_*` variable, source file, CLI argument, screenshot or log. Use stdin when configuring it with Wrangler or Vercel CLI.

The existing owner's project and Worker have these settings configured. Other accounts must configure their own backend and secret. A missing/invalid configuration returns a generic recoverable 503 rather than leaking infrastructure details.

No production secret is needed during `next build`; only runtime API calls need the backend settings. Sharing metadata automatically uses Vercel's production hostname when available, or an explicit public `NEXT_PUBLIC_SITE_URL` build setting.

## Authentication and cookies

The gateway rejects foreign-Origin/cross-site state changes and bounds JSON bodies to 4096 bytes before forwarding. It sends only the game's session cookie and constructs fresh signed headers, ignoring browser-supplied proxy signatures. HMAC-SHA256 binds method, backend URL, body digest, expiry and a hashed client identity. The Worker validates that signature before using the identity for quotas. Vercel's platform-supplied IP headers preserve per-client quotas instead of grouping all players under the gateway's outbound IP.

Private responses stay `no-store` and `Vary: Cookie`; host-only HttpOnly/SameSite/Secure session cookies are returned on the Vercel origin. Existing membership, host authorization, hidden-choice projections and stale-action rejection still run in the authoritative backend. Failed upstream redirects/non-JSON responses are not exposed to the browser.

## Local verification

```sh
npm run install:ci
npm run typecheck
npm test
npm run test:proxy
npm run build
npm run build:cloudflare
npx playwright install chromium
npm run verify:vercel
```

The verifier starts the actual production Next.js server and a local built Worker, with a fresh local D1 database. It runs all existing API, deadline, full-match and browser regressions through Next.js. It uses an ephemeral local-only test secret and no production service. Keep ports 4173 and 4174 free.

For interactive local play without any hosted account, follow the [Cloudflare development path](development.md#clean-checkout). `npm run dev` starts native Next.js and requires the server environment above; `npm run dev:cloudflare` retains the self-contained local Worker/D1 experience.

## Updates

Vercel can rebuild the connected GitHub branch automatically. Backend changes are separate: run `npm run build:workers`, then the appropriate remote migration and deployment commands described in [development](development.md#standalone-cloudflare-workers-deployment). Configure the shared Worker secret before publishing a new Vercel deployment. Existing sessions on other origins are not automatically transferred because cookies are origin-specific.

[Architecture](architecture.md) · [Testing](testing.md) · [Back to README](../README.md)
