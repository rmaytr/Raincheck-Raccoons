import { spawn } from 'node:child_process';
import { createWriteStream, mkdirSync } from 'node:fs';
import './sites-env.mjs';

const base = 'http://127.0.0.1:4173';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function run(args, extraEnv = {}) {
  const child = spawn(process.execPath, args, {
    stdio: 'inherit', env: { ...process.env, ...extraEnv },
  });
  await new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('exit', (code, signal) => code === 0 ? resolve() : reject(new Error(`Verification failed (${code ?? signal}): ${args.join(' ')}`)));
  });
}

async function withPreview(name, args, verify) {
  const active = await fetch(base, { signal: AbortSignal.timeout(1000) }).catch(() => null);
  if (active) throw new Error('Port 4173 is already in use. Stop that server before verification.');
  const logPath = `test-results/${name}.log`;
  const log = createWriteStream(logPath);
  const preview = spawn(process.execPath, ['--import', './scripts/sites-env.mjs', ...args], {
    stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, RAINCHECK_RUNTIME: 'cloudflare' },
  });
  preview.stdout.pipe(log); preview.stderr.pipe(log);
  let previewError;
  preview.on('error', error => { previewError = error; });
  const exited = new Promise(resolve => preview.once('exit', resolve));
  try {
    let healthy = 0;
    for (let attempt = 0; attempt < 120 && healthy < 3; attempt++) {
      if (previewError) throw previewError;
      if (preview.exitCode !== null) throw new Error(`Preview exited early. Inspect ${logPath}.`);
      const response = await fetch(base, { signal: AbortSignal.timeout(2000) }).catch(() => null);
      healthy = response?.ok ? healthy + 1 : 0;
      if (healthy < 3) await pause(500);
    }
    if (healthy < 3) throw new Error(`Preview did not become ready. Inspect ${logPath}.`);
    await verify({ BASE_URL: base });
  } finally {
    preview.kill('SIGTERM');
    await Promise.race([exited, pause(5000)]);
    log.end();
  }
}

// Use Vinext's Worker for API security tests: Wrangler's development proxy can
// restart its downstream connection after an intentionally foreign Origin.
// Exercise built assets separately, without development HMR, in browser tests.
// Both previews use this checkout's local D1; no production traffic is sent.
try {
  mkdirSync('test-results', { recursive: true });
  await withPreview('api-preview', [
    './node_modules/vinext/dist/cli.js', 'dev', '--port', '4173', '--host', '127.0.0.1',
  ], async env => {
    await run(['tests/api-integration.mjs'], env);
    await run(['tests/api-integration.mjs'], { ...env, EXTENDED_ONLY: '1' });
  });
  await withPreview('browser-preview', [
    './node_modules/wrangler/bin/wrangler.js', 'dev', '--config', 'dist/server/wrangler.json',
    '--local', '--persist-to', '.wrangler/state', '--ip', '127.0.0.1',
    '--port', '4173', '--inspector-port', '0',
  ], async env => {
    await run(['tests/browser-integration.mjs'], { ...env, TEST_OUTPUT_DIR: 'test-results/multiplayer' });
    await run(['tests/browser-integration.mjs'], { ...env, TARGETED_ONLY: '1', TEST_OUTPUT_DIR: 'test-results/regressions' });
  });
  console.log('Local API, lifecycle and built-browser verification passed.');
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
