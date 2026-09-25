import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { saveSnapshot } from './collect.mjs';
import { regionRows } from '../model.js';

export async function migrateData(root) {
  const index = JSON.parse(await readFile(resolve(root, 'index.json'), 'utf8'));
  if (!Array.isArray(index.dates) || index.dates.some(date => !/^\d{4}-\d{2}-\d{2}$/.test(date))) throw new Error('Invalid dates');
  let count = 0;
  // Oldest first: latest location metadata wins, including on a first migration.
  for (const date of [...index.dates].sort()) {
    const snapshot = JSON.parse(await readFile(resolve(root, 'snapshots', `${date}.json`), 'utf8'));
    if (snapshot.date !== date) throw new Error('Snapshot date mismatch');
    if (snapshot.schemaVersion === 1) { await saveSnapshot(root, snapshot); count++; }
    else if (snapshot.schemaVersion !== 2) throw new Error('Unsupported snapshot version');
  }
  const catalog = JSON.parse(await readFile(resolve(root, 'locations.json'), 'utf8'));
  for (const date of index.dates) {
    const snapshot = JSON.parse(await readFile(resolve(root, 'snapshots', `${date}.json`), 'utf8'));
    for (const { code } of snapshot.regions) regionRows(snapshot, code, catalog);
  }
  return count;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  console.log(`Migrated ${await migrateData(resolve(process.argv[2] || '.local-data'))} snapshots`);
}
