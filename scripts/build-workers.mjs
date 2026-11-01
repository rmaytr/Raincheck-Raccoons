import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import './sites-env.mjs';

// IDs and the public URL are configuration, never API credentials. Keep the
// separate Sites manifest intact; only the generated standalone config changes.
const target = JSON.parse(readFileSync('deploy/cloudflare.json', 'utf8'));
const url = new URL(target.site_url);
if (url.protocol !== 'https:' || !url.hostname.endsWith('.workers.dev')) {
  throw new Error('Standalone deployment requires an HTTPS workers.dev site_url.');
}
if (!/^[a-z0-9-]+$/.test(target.worker_name) || !/^[a-f0-9]{32}$/.test(target.account_id)
  || !/^[a-f0-9-]{36}$/.test(target.database_id) || !target.database_name) {
  throw new Error('Invalid standalone Cloudflare deployment identifiers.');
}
const build = spawnSync(process.execPath, ['scripts/run-framework.mjs', 'build'], {
  stdio: 'inherit', env: { ...process.env, NEXT_PUBLIC_SITE_URL: url.origin },
});
if (build.error) throw build.error;
if (build.status !== 0) process.exit(build.status ?? 1);

const config = JSON.parse(readFileSync('dist/server/wrangler.json', 'utf8'));
config.name = target.worker_name;
config.account_id = target.account_id;
config.workers_dev = true;
config.preview_urls = false;
config.d1_databases = [{
  binding: 'DB', database_name: target.database_name,
  database_id: target.database_id, migrations_dir: '../../drizzle',
}];
// Keeping the derived config beside the build preserves main/module/asset paths.
writeFileSync('dist/server/wrangler.workers.json', JSON.stringify(config, null, 2) + '\n');
console.log('Standalone Worker configuration prepared for', url.origin);
