# Vercel release — November 1, 2026

Public game: https://raincheck-raccoons.vercel.app

The native Next.js deployment replaces the incompatible Vinext build as the default Vercel target. Vercel successfully built and deployed application commit `2ae40e6`; production deployment `dpl_CgUnaheqVrFzYytWYPuM86Eqjtuv` was observed in `READY` state with the public game hostname assigned.

The multiplayer backend remains the existing dedicated Cloudflare Worker/D1 service. Worker version `645ab6ad-978f-4209-af81-92bb88786cfa` adds authenticated, bounded proxy requests and preserves direct Cloudflare play. The private shared key is stored only as a hosted Worker/Vercel secret. No database migration, room reset or game-rule change was required for Vercel.

## Unchanged game

Compared with the pre-migration source, the following files are unchanged: `app/page.tsx`, `app/globals.css`, `components/Art.tsx`, `lib/audio.ts`, `lib/engine.ts`, `lib/store.ts`, `lib/types.ts`, and the original `public/` assets. The migration changes hosting configuration, server transport, deployment metadata and verification/documentation. It does not change roles, scoring, timing, sounds, illustrations, interface copy or game controls.

The original Sites checkout and `.openai/hosting.json` are preserved. Both pre-existing public origins returned HTTP 200 after deployment. Vercel receives its own host-only session cookies; existing sessions on another hostname are not automatically transferred.

## Verification

| Check | Result |
|---|---|
| Native Next.js production build | Passed locally and on Vercel; `.next/routes-manifest.json` produced |
| Engine unit suite | 27 tests passed |
| New proxy/security suite | 16 tests passed |
| Local production Next.js journey | 49 API + 3 lifecycle + 24 browser + 7 targeted checks passed |
| Public Vercel API suite | 49 checks passed in 44.9 seconds |
| Public Vercel lifecycle suite | 3 checks passed in 56.9 seconds |
| Public Vercel browser journey | 24 checks passed in 47.3 seconds |
| Public Vercel browser regressions | 7 checks passed in 4.1 seconds |
| Public asset identity | Cover, favicon and both fonts matched local source bytes by SHA-256 |
| Sharing metadata | Open Graph image uses the Vercel origin |

Public browser verification used independent Chromium contexts on Windows, including 390px mobile and 320px narrow layouts. Run durations describe automation only, not player-game duration or latency guarantees. These checks establish automated behavior, not human enjoyment, physical-device coverage or sustained load capacity.

[Dual-platform CI run](https://github.com/rmaytr/Raincheck-Raccoons/actions/runs/41348992180) builds both Next.js and Cloudflare, runs both unit suites and exercises the existing integration suites on each runtime without production credentials. Reports remain available through the workflow's evidence artifacts. `.vercelignore` excludes local databases, generated builds, credentials, caches and QA outputs from future CLI uploads; Git-based deployments use the curated committed source.

[Vercel setup](vercel-deployment.md) · [Architecture](architecture.md) · [Testing](testing.md) · [Back to README](../README.md)
