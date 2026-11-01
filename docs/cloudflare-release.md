# Standalone Cloudflare release — November 1, 2026

- Public game: https://raincheck-raccoons.pigeon-problems.workers.dev
- Worker: `raincheck-raccoons`
- Worker version: `71f2b077-7aaa-4601-8318-5d18a8e72886`
- Dedicated D1 database: `raincheck-raccoons-db`, bound as `DB`
- Original Sites deployment: https://raincheck-raccoons.smoky-harp-3438.chatgpt.site

The standalone Worker serves the complete game, API and static assets. It uses the existing Cloudflare account's Workers subdomain and a new database; it does not share rooms or session identities with the Sites release. No existing account subdomain, other game or original Sites resource was changed. Credentials remain in Wrangler's existing local OAuth configuration, outside this repository.

## Verification

TypeScript, the standalone production build and all 27 engine tests passed. The existing integration harnesses then ran against the actual public `workers.dev` origin using disposable QA rooms:

| Suite | Result | Observed run duration |
|---|---|---|
| API integration | 49 checks passed, including ten-player concurrent resolution | 36.2 seconds |
| Real lifecycle deadlines | 3 checks passed: bots, missing choices and host transfer | 56.4 seconds |
| Desktop/mobile browser journey | 24 checks passed: match, recap, rematch and recovery | 44.8 seconds |
| Targeted browser regressions | 7 checks passed | 3.6 seconds |

The browser harness used independent headless Chromium contexts on Windows. The checks include 390px mobile layouts and 320px narrow regressions. Deliberately injected offline/startup-failure conditions are part of the recovery tests. This establishes automated behavior, not physical-device coverage, sustained load capacity or human enjoyment.

Both public origins returned HTTP 200. The new origin's Open Graph image points to its own `/cover.png`; the cover, favicon and both fonts returned HTTP 200 and matched local source bytes by SHA-256. The standalone upload was reported as 809.87 KiB of Worker modules (238.57 KiB compressed), plus static assets; these are deployment sizes, not browser transfer or performance benchmarks.

See [development and deployment commands](development.md#standalone-cloudflare-workers-deployment) and [testing methodology](testing.md). The original Sites checkout and `.openai/hosting.json` were preserved. No GitHub push automatically deploys either production site.
