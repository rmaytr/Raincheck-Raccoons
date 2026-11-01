# Testing and verification

## Layers

| Suite | Scope |
|---|---|
| `npm run test:proxy` | 16 authentication, tampering, cookie/origin, body-limit and gateway failure tests |
| `npm test` | 27 engine tests, including 400 seeded scoring configurations |
| `npm run test:api` | 49 HTTP checks with independent session cookies |
| API with `EXTENDED_ONLY=1` | 3 checks with real timeout, bot and host-absence deadlines |
| `npm run test:browser` | 24 UI journey checks with independent desktop/mobile browser contexts |
| Browser with `TARGETED_ONLY=1` | 7 recovery, layout and preference regressions |

The engine tests inject time/randomness. They cover finite payouts, capacity equality, weather, cover, all-lookout zero, hidden-data projections, stale rounds/matches, idempotence, membership, host transfer, bots, rematches and ties.

API tests use real D1-backed requests. They cover six-round completion and rematch, cross-match rejection, cache/privacy boundaries, non-host denial, invalid input, duplicate names, nine concurrent joins, the ten-player cap, and ten concurrent choices resolving once. Extended checks wait for actual deadlines rather than replacing them with mocked time.

Browser tests use actual controls rather than API shortcuts for gameplay. They create/join, refresh, verify private readiness, interrupt the guest connection, complete six raids, inspect the recap and rematch. They also test modal focus trapping/Escape, overflow, reduced motion, sound preference, startup Retry and a deliberately delayed successful response after leaving.

## Running and CI

Follow [development setup](development.md). `npm run verify:local` starts its own loopback previews after build/migration and runs all integration suites: Vinext’s development Worker for API/security/deadline checks, then Wrangler with the built Worker and assets for browser checks. This avoids a local Wrangler proxy restart after the foreign-Origin security case, while preserving every assertion. GitHub Actions executes lockfile installation, typecheck, engine tests, build, local migrations, browser installation and full local verification. Its permissions are read-only, and it never needs production credentials. Reports/logs upload even when a check fails; artifacts expire after seven days.

The README badge links to the actual workflow. A new workflow is pending/unverified until its run finishes; historical evidence must not be used to call a failing or unrun workflow green.

## Publication verification — October 26, 2026

The curated publication checkout passed TypeScript, the production build, local migration initialization and an idempotent migration rerun, all 27 engine tests, and all 83 integration checks (49 API, 3 real-deadline lifecycle, 24 browser journey and 7 targeted browser). The documentation checker validated 40 internal links/images across eight files. The repaired lockfile also passed an npm CI dry run; the GitHub workflow performs the actual clean install.

This local run used Windows, Node 25.2.0 and Playwright 1.62.1’s Chromium 151. The API suite took 22.6 seconds, lifecycle suite 55.8 seconds, browser journey 39.7 seconds and targeted browser suite 2.6 seconds. These durations describe this automation run only. Node 24 LTS is the documented clean-clone/CI runtime. The workflow badge and GitHub run record establish its separate status.

The [clean Linux GitHub Actions run](https://github.com/rmaytr/Raincheck-Raccoons/actions/runs/40431607441) passed on publication commit `ffce6ba`: reproducible lockfile install, documentation checks, TypeScript, all engine tests, production build, fresh local D1 migrations, and all API/lifecycle/browser checks. This run used GitHub’s Ubuntu runner and the Node 24 line. An earlier run exposed missing optional WebAssembly lock entries; the corrected lockfile retains exact npm-registry integrity hashes. The workflow requires no production credentials.

## Native Next.js verification

The live Vercel release also passed all 83 integration checks on November 1, 2026. See [Vercel release evidence](vercel-release.md) for the deployed version, unchanged-file comparison and observed test durations.

`npm run verify:vercel` runs the same 49 API, 3 lifecycle and 31 browser checks against a production Next.js server on loopback 4173. Its backend is a built Cloudflare Worker on loopback 4174 with a fresh local D1 database and an ephemeral test key. It requires no production credentials. CI builds both platforms and runs both runtime paths. This verifies that a successful Next.js build also produces a functioning multiplayer application.

## Historical release evidence

On **October 24, 2026**, the released game passed:

- 24 public browser journey checks in 51 seconds: [JSON report](evidence/multiplayer-2026-10-24.json).
- 7 public targeted checks in 5.7 seconds: [JSON report](evidence/regressions-2026-10-24.json).
- TypeScript verification and 27 engine tests.
- A separate 768px tablet and real solo-bot reveal smoke check.
- Cover/favicon/font HTTP availability; the 1600×900 hosted cover matched the local asset.

These historical runs used headless Edge and independent browser contexts on one Windows computer, with 1440px desktop, 390px mobile and 320px narrow viewports. The captures in `docs/images/` are authentic results from those runs. The intentional offline/503 console failures recorded in the reports are injected test conditions, not unexplained production failures. Run durations are not game-length, latency or throughput benchmarks.

Local initial-release evidence also recorded 49 API and 3 extended checks, including concurrent ten-client resolution. These are automated clients, not ten physical devices or ten people. Balance review used 18,000 initial random-policy simulated matches and 5,280 targeted composition cases; those counts describe analysis, not production traffic.

## Standalone Cloudflare release

On November 1, 2026, the dedicated `workers.dev` deployment passed all 49 API, 3 lifecycle and 31 browser checks against its public origin. See [standalone release evidence](cloudflare-release.md) for the exact Worker version, environment, durations and asset verification.

## Limits

No user-growth, retention, revenue, coverage-percentage, competition-win or sustained-load claim is supported. Phone viewport emulation does not establish physical-device/network coverage. There has been no full Safari/Firefox matrix, formal screen-reader audit, complete WCAG assessment, or field Core Web Vitals study. Human group playtesting remains necessary to assess enjoyment and onboarding. Historical results and new CI results should be labeled separately.

[Back to README](../README.md)
