import { readFile } from 'node:fs/promises';
import { saveSnapshot } from './collect.mjs';
import { dateRange, observationDate } from '../model.js';
const fixture = async name => JSON.parse(await readFile(new URL(`../examples/fixtures/${name}.json`, import.meta.url), 'utf8'));
const normal = await fixture('normal'), extreme = await fixture('extreme'), shared = await fixture('shared');
const regions = [{ code: 'TW', name: '台灣' }, { code: 'TW-TXG', name: '臺中市' }, { code: 'TW-TPE', name: '臺北市' }, { code: 'TW-LIE', name: '連江縣' }];
for (const date of [...dateRange('2026-09-24', 4), '2026-01-01', '2025-12-31']) {
  const checklists = {
    'TW-TXG': [...normal, ...shared].filter(row => observationDate(row).startsWith(date)),
    'TW-TPE': extreme.filter(row => row && observationDate(row).startsWith(date)),
    'TW-LIE': []
  };
  // Exactly 200 synthetic submissions demonstrate the API cap warning.
  if (date === '2026-09-22') checklists['TW-TXG'] = Array.from({ length: 200 }, (_, i) => ({
    subId: `SCAP${i}`, locId: 'LCAP', userDisplayName: `示範鳥友 ${i + 1}`, numSpecies: 20,
    isoObsDate: `${date} 08:00`, loc: { name: '達上限示範地點', isHotspot: true }
  }));
  const coverage = Object.fromEntries(Object.entries(checklists).map(([code, rows]) => [code, { count: rows.length, possiblyTruncated: rows.length >= 200 }]));
  await saveSnapshot('examples/data', { schemaVersion: 1, feedKind: 'daily', coverage, date, fetchedAt: '2026-09-24T00:00:00.000Z', regions, checklists });
}
console.log('Open /?data=examples using a static HTTP server.');
