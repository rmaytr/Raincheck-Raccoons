# Development and deployment

## Clean checkout

Use Node 24 LTS and npm. `.nvmrc` records the CI runtime; the package minimum is Node 22.13. A network connection is needed for package/browser downloads. No production credentials are required.

```sh
npm run install:ci
npm run typecheck
npm test
npm run build
npm run db:migrate
npm run dev
```

Development normally uses port 5173. Open the URL printed by the server. For production-style local execution use `npm start -- --port 4173` after building/migrating. Both use ignored local D1 storage in `.wrangler/state`.

`install:ci` invokes npm's JavaScript entrypoint and uses the committed lockfile, including development/optional packages. Ordinary `npm ci` also follows the lockfile, but the wrapper sets the starter's native dependency defaults consistently. Do not run two installers in the same checkout.

## Local migrations

`npm run db:migrate` derives `dist/server/wrangler.local.json` from the build output, points migration discovery at `drizzle/`, and invokes Wrangler **with `--local`**. Applied migrations are tracked by local D1. Repeating the command does not recreate existing tables. It cannot migrate production.

After changing `db/schema.ts`, run `npm run db:generate`, inspect the SQL and metadata, build, then migrate locally. Preserve already-applied migration files; append new migrations. Local and production databases are separate.

## Environment

Local gameplay needs no `.env` or API key. `.env.example` documents optional, non-secret test configuration. The Node harnesses read exported environment variables; copying the example does not automatically apply them.

| Variable | Meaning |
|---|---|
| `BASE_URL` | Existing server for individual API/browser suites; defaults to loopback port 5173 |
| `TEST_OUTPUT_DIR` | Browser evidence destination; defaults to ignored `test-results/browser` |
| `BROWSER_EXECUTABLE` | Optional installed Chromium executable; normally use Playwright's downloaded browser |
| `PLAYWRIGHT_MODULE` | Advanced override for an existing package; unnecessary after lockfile install |
| `TARGETED_ONLY=1` | Run the targeted browser regressions |
| `EXTENDED_ONLY=1` | Run actual timeout/bot/host-absence API checks |

`ALLOW_REMOTE_TESTS=1` and `LOW_VOLUME_REMOTE=1` explicitly unlock remote-writing harnesses. Do not use them for normal CI or casual tests. Normal verification creates disposable rooms only on loopback. `verify:local` sets its own fixed loopback URL and owns the preview process.

## Tests

```sh
npm run typecheck
npm test
npm run build
npm run db:migrate
npx playwright install chromium
npm run verify:local
```

The full runner uses port 4173 sequentially for two local previews. API and real-deadline suites run against Vinext’s development Worker; browser suites run against the production build through Wrangler, without HMR. Both use local D1. It writes `test-results/api-preview.log`, `test-results/browser-preview.log` and browser reports/screenshots, then stops each server. This separation avoids a Wrangler development-proxy restart after the intentionally foreign-Origin security request and keeps browser verification on built assets. Linux hosts missing browser libraries can use `npx playwright install --with-deps chromium`.

With a manually running development server on 5173:

```sh
npm run test:api
npm run test:browser
```

PowerShell exports use `$env:BASE_URL='http://127.0.0.1:4173'`; POSIX shells use `BASE_URL=http://127.0.0.1:4173 npm run test:api`. See [testing](testing.md) for expected evidence and limits.

## Troubleshooting

- **Missing tables:** build, run `npm run db:migrate`, and verify that the server uses this checkout's `.wrangler/state`. Never solve local failures by pointing at production D1.
- **Missing Worker config:** `npm run build` must precede migration/production-style preview.
- **Port 4173 occupied:** stop your own preview before `verify:local`; the runner refuses to reuse an unrelated server.
- **Browser executable missing:** run `npx playwright install chromium`; install Linux system dependencies when needed.
- **429 after repeated runs:** create/join quotas deliberately persist in local D1. Wait for their window instead of weakening production controls.
- **Windows shell shim problems:** use the installed Node/npm JavaScript entrypoint to run npm, for example `node "<node-install>/node_modules/npm/bin/npm-cli.js" run build`. Choose the path from your installation; no developer-specific path is required.
- **Windows sandbox `spawn EPERM`:** Vite, workerd and browsers require ordinary child-process access. Run in a normal developer terminal; do not change game logic to bypass a restricted execution host.

## Existing production hosting

The live game is hosted through Sites on Cloudflare Workers and D1. GitHub hosts source and runs checks; this repository does **not** automatically deploy on push. CI has no production tokens.

`.openai/hosting.json` retains the existing public project ID and logical `DB` binding. An ID is configuration, not a repository-write token. Preserve it when updating the existing site. Fork owners should create their own hosting identity before deploying a separate instance.

The owner's established Sites workflow validates source, pushes its deployment repository, packages the matching build, saves a version, applies hosted migrations and deploys that version. Keep short-lived repository credentials in memory, never in arguments, committed files or logs. Do not replace an existing hosting remote with this GitHub remote.

This public checkout is intentionally separate from the original deployment checkout. No live hosting audience, database or deployment was changed for source publication.

[Back to README](../README.md)
