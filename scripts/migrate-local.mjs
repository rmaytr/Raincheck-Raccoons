import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import './sites-env.mjs';

// Derive an ignored, local-only Wrangler config from the production build.
// Keeping it beside the original preserves relative Worker and asset paths.
const configPath = 'dist/server/wrangler.local.json';
let config;
try { config = JSON.parse(readFileSync('dist/server/wrangler.json', 'utf8')); }
catch { throw new Error('Run npm run build before npm run db:migrate.'); }
config.d1_databases = config.d1_databases.map(database => ({
  ...database, migrations_dir: '../../drizzle',
}));
writeFileSync(configPath, JSON.stringify(config, null, 2));
const result = spawnSync(process.execPath, [
  '--import', './scripts/sites-env.mjs', './node_modules/wrangler/bin/wrangler.js',
  'd1', 'migrations', 'apply', 'DB', '--local', '--config', configPath,
  '--persist-to', '.wrangler/state',
], { stdio: 'inherit' });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
