import { cp, mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { regionRows } from '../model.js';
const source = resolve(process.argv[2] || '.local-data');
const target = resolve('_site');
const index = JSON.parse(await readFile(resolve(source, 'index.json'), 'utf8'));
if (!index.dates?.includes(index.latest)) throw new Error('Invalid data index');
let catalog;
for (const date of index.dates) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Invalid snapshot date');
  const snapshot = JSON.parse(await readFile(resolve(source, 'snapshots', `${date}.json`), 'utf8'));
  if (snapshot.date !== date || !Array.isArray(snapshot.regions)) throw new Error('Invalid snapshot');
  if (snapshot.schemaVersion === 2 && !catalog) catalog = JSON.parse(await readFile(resolve(source, 'locations.json'), 'utf8'));
  for (const { code } of snapshot.regions) regionRows(snapshot, code, catalog);
}
await mkdir(target, { recursive: true });
for (const file of ['index.html', 'index.css', 'app.js', 'model.js']) await cp(file, resolve(target, file));
await cp(source, resolve(target, 'data'), { recursive: true, filter: path => !path.includes('.git') && !path.endsWith('.tmp') });
console.log('Built _site (serve its parent to test /_site/ project paths).');
