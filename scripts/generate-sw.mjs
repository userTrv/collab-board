// Post-build step: fills the service worker's precache list and version from dist/.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const dist = new URL('../dist/', import.meta.url).pathname;
const skip = new Set(['sw.js', '3rdpartylicenses.txt', 'prerendered-routes.json']);

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const files = walk(dist)
  .map((p) => relative(dist, p).split('\\').join('/'))
  .filter((f) => !skip.has(f) && !f.endsWith('.map'))
  .sort();
const hash = createHash('sha256');
for (const f of files) hash.update(f).update(readFileSync(join(dist, f)));
const version = hash.digest('hex').slice(0, 12);

const swPath = join(dist, 'sw.js');
const sw = readFileSync(swPath, 'utf8').replace('__VERSION__', version).replace('__FILES__', JSON.stringify(['./', ...files]));
writeFileSync(swPath, sw);
console.log(`sw.js: version ${version}, ${files.length} files precached`);
