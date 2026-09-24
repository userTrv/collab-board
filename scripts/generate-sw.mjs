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
// Replace the assignments, not the bare tokens: the header comment mentions the placeholders too,
// and a plain string replace would patch the comment and leave `const FILES = __FILES__;` (a
// ReferenceError that makes registration fail and `navigator.serviceWorker.ready` never resolve).
// './' is not precached: the navigation fallback serves index.html, and a directory URL can
// redirect or 404 on some static hosts, which would reject cache.addAll() and the whole install.
const template = readFileSync(swPath, 'utf8');
const sw = template
  .replace(/const VERSION = '__VERSION__';/, `const VERSION = '${version}';`)
  .replace(/const FILES = __FILES__;/, `const FILES = ${JSON.stringify(files)};`);
if (sw === template || /const (VERSION|FILES) = .*__(VERSION|FILES)__/.test(sw)) {
  throw new Error('generate-sw: placeholders not found in dist/sw.js');
}
writeFileSync(swPath, sw);
console.log(`sw.js: version ${version}, ${files.length} files precached`);
