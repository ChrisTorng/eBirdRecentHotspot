import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { regionRows, observationDate } from '../model.js';
import { dailyMetrics } from '../heat.js';

export function summarize(snapshot, catalog) {
  const regions = snapshot.regions.filter(r => r.code !== 'TW');
  const memberships = new Map(), unique = new Map();
  const quality = {};
  const fetchedDay = Number.isFinite(Date.parse(snapshot.fetchedAt)) ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(snapshot.fetchedAt)) : '';
  for (const { code } of regions) {
    quality[code] = snapshot.feedKind !== 'daily' || !snapshot.coverage?.[code] ? 'legacy' : snapshot.coverage[code].possiblyTruncated ? 'capped' : !fetchedDay || fetchedDay <= snapshot.date ? 'open' : 'complete';
    for (const row of regionRows(snapshot, code, catalog)) {
      if (observationDate(row).slice(0, 10) !== snapshot.date) continue;
      if (!memberships.has(row.locId)) memberships.set(row.locId, new Set());
      memberships.get(row.locId).add(code);
      if (!unique.has(row.subId)) unique.set(row.subId, row);
    }
  }
  return { schemaVersion: 1, algorithm: 'companions-half-v1', date: snapshot.date, fetchedAt: snapshot.fetchedAt, regions: snapshot.regions, quality,
    locations: Object.fromEntries(dailyMetrics([...unique.values()]).map(({ id, ...metrics }) => [id, { ...metrics, regions: [...memberships.get(id)] }])) };
}

export async function buildSummaries(root) {
  const index = JSON.parse(await readFile(resolve(root, 'index.json'), 'utf8'));
  let catalog;
  await mkdir(resolve(root, 'summaries'), { recursive: true });
  for (const date of index.dates) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Invalid summary date');
    const snapshot = JSON.parse(await readFile(resolve(root, 'snapshots', `${date}.json`), 'utf8'));
    if (snapshot.date !== date) throw new Error('Snapshot date mismatch');
    if (snapshot.schemaVersion === 2 && !catalog) catalog = JSON.parse(await readFile(resolve(root, 'locations.json'), 'utf8'));
    const path = resolve(root, 'summaries', `${date}.json`);
    await writeFile(`${path}.tmp`, JSON.stringify(summarize(snapshot, catalog)) + '\n');
    await rename(`${path}.tmp`, path);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await buildSummaries(resolve(process.argv[2] || '.local-data'));
