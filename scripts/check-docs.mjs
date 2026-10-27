import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const files = ['README.md', 'COPYRIGHT.md', 'THIRD_PARTY_NOTICES.md',
  ...readdirSync(path.join(root, 'docs')).filter(name => name.endsWith('.md')).map(name => `docs/${name}`)];
let checked = 0;
for (const file of files) {
  const content = readFileSync(path.join(root, file), 'utf8');
  assert.ok(!/[A-Z]:[\\/]Users[\\/]/i.test(content), `Machine-specific path in ${file}`);
  for (const match of content.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
    const href = match[1];
    if (/^[a-z]+:\/\//i.test(href) || href.startsWith('mailto:')) continue;
    const [relative, anchor] = href.split('#');
    const target = path.resolve(root, path.dirname(file), relative || path.basename(file));
    assert.ok(target.startsWith(root), `Link escapes checkout: ${file} -> ${href}`);
    assert.ok(existsSync(target), `Missing link/image: ${file} -> ${href}`);
    if (anchor && target.endsWith('.md')) {
      const headings = [...readFileSync(target, 'utf8').matchAll(/^#+ (.+)$/gm)]
        .map(m => m[1].toLowerCase().replace(/[^\p{L}\p{N}_\- ]/gu, '').replaceAll(' ', '-'));
      assert.ok(headings.includes(anchor), `Missing anchor: ${file} -> ${href}`);
    }
    checked++;
  }
}
console.log(`${checked} internal documentation links/images checked across ${files.length} files.`);
