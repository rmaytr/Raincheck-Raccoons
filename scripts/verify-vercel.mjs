import { spawn } from 'node:child_process';
import { createWriteStream, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import './sites-env.mjs';

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const base = 'http://127.0.0.1:4173';
const backend = 'http://127.0.0.1:4174';
const previews = [];
const secret = randomBytes(32).toString('hex');
const configPath = 'dist/server/wrangler.vercel-test.json';
const state = `.wrangler/vercel-test-${Date.now()}`;
async function run(args, extraEnv = {}) {
  const child = spawn(process.execPath, args, { stdio: 'inherit', env: { ...process.env, ...extraEnv } });
  await new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('exit', (code, signal) => code === 0 ? resolve() : reject(new Error(`Verification failed (${code ?? signal}): ${args.join(' ')}`)));
  });
}
async function start(name, url, args, env = {}) {
  if (await fetch(url, { signal: AbortSignal.timeout(1000) }).catch(() => null)) throw new Error(`Stop the existing server at ${url} first.`);
  const log = createWriteStream(`test-results/${name}.log`);
  const child = spawn(process.execPath, args, { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.pipe(log); child.stderr.pipe(log);
  const exited = new Promise(resolve => child.once('exit', resolve));
  previews.push({ child, exited, log });
  let startupError; child.on('error', error => { startupError = error; });
  for (let attempt = 0; attempt < 120; attempt++) {
    if (startupError) throw startupError;
    if (child.exitCode !== null) throw new Error(`${name} exited early; inspect its test-results log.`);
    const response = await fetch(url, { signal: AbortSignal.timeout(2000) }).catch(() => null);
    if (response?.ok) return;
    await pause(500);
  }
  throw new Error(`${name} did not become ready.`);
}
try {
  mkdirSync('test-results', { recursive: true });
  if (!readFileSync('.next/routes-manifest.json', 'utf8')) throw new Error('Build Next.js first.');
  const config = JSON.parse(readFileSync('dist/server/wrangler.json', 'utf8'));
  // Only loopback services and a fresh local D1 database are used. The ephemeral
  // test key is never a production credential and the derived config is ignored.
  delete config.account_id;
  config.vars = { ...config.vars, RAINCHECK_PROXY_SECRET: secret };
  config.d1_databases = config.d1_databases.map(database => ({ ...database, migrations_dir: '../../drizzle' }));
  writeFileSync(configPath, JSON.stringify(config, null, 2));
  const wrangler = ['--import', './scripts/sites-env.mjs', './node_modules/wrangler/bin/wrangler.js'];
  await run([...wrangler, 'd1', 'migrations', 'apply', 'DB', '--local', '--config', configPath, '--persist-to', state]);
  await start('vercel-backend', backend, [...wrangler, 'dev', '--config', configPath, '--local', '--persist-to', state,
    '--ip', '127.0.0.1', '--port', '4174', '--inspector-port', '0']);
  await start('vercel-frontend', base, ['./node_modules/next/dist/bin/next', 'start', '--port', '4173', '--hostname', '127.0.0.1'], {
    RAINCHECK_BACKEND_URL: backend, RAINCHECK_PROXY_SECRET: secret, RAINCHECK_ALLOW_LOCAL_BACKEND: '1',
  });
  const env = { BASE_URL: base };
  await run(['tests/api-integration.mjs'], env);
  await run(['tests/api-integration.mjs'], { ...env, EXTENDED_ONLY: '1' });
  await run(['tests/browser-integration.mjs'], { ...env, TEST_OUTPUT_DIR: 'test-results/vercel-multiplayer' });
  await run(['tests/browser-integration.mjs'], { ...env, TARGETED_ONLY: '1', TEST_OUTPUT_DIR: 'test-results/vercel-regressions' });
  console.log('Native Next.js API, lifecycle and browser verification passed.');
} catch (error) {
  console.error(error instanceof Error ? error.message : error); process.exitCode = 1;
} finally {
  for (const { child, exited, log } of previews.reverse()) {
    child.kill('SIGTERM'); await Promise.race([exited, pause(5000)]); log.end();
  }
}
