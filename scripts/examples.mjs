import { readFile } from 'node:fs/promises';
import { buildSummaries } from './summaries.mjs';
import { saveSnapshot } from './collect.mjs';
import { dateRange, observationDate } from '../model.js';
const fixture = async name => JSON.parse(await readFile(new URL(`../examples/fixtures/${name}.json`, import.meta.url), 'utf8'));
const normal = await fixture('normal'), extreme = await fixture('extreme'), shared = await fixture('shared');
const regions = [{ code: 'TW', name: '台灣' }, { code: 'TW-TXG', name: '臺中市' }, { code: 'TW-TPE', name: '臺北市' }, { code: 'TW-LIE', name: '連江縣' }];
for (const date of [...dateRange('2026-09-24', 14), '2026-01-01', '2025-12-31']) {
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
  if (date >= '2026-09-11') {
    const age = Math.round((Date.parse('2026-09-24') - Date.parse(date)) / 86400000);
    const scenarios = [
      ['steady', '持續到訪示範鳥點', age === 0 ? 1 : 6],
      ['burst', '同行鳥聚示範鳥點', age === 1 ? 10 : 0],
      ['cooling', '人潮減少示範鳥點', age === 1 ? 2 : age <= 3 && age > 0 ? 10 : 0],
      ['solo', '單人多份示範鳥點', 5]
    ];
    for (const [id, name, count] of scenarios) for (let i = 0; i < count; i++) checklists['TW-TPE'].push({
      subId: `S${id}${date}${i}`, locId: `L${id}`, userDisplayName: id === 'solo' ? '固定鳥友' : `鳥友${i}`,
      numSpecies: 12, isoObsDate: `${date} ${id === 'burst' ? '08:00' : String(6+i).padStart(2,'0') + ':00'}`,
      loc: { name, isHotspot: true, lat: 25.03, lng: 121.5 }
    });
  }
  const coverage = Object.fromEntries(Object.entries(checklists).map(([code, rows]) => [code, { count: rows.length, possiblyTruncated: rows.length >= 200 }]));
  await saveSnapshot('examples/data', { schemaVersion: 1, feedKind: 'daily', coverage, date, fetchedAt: '2026-09-24T00:00:00.000Z', regions, checklists });
}
await buildSummaries('examples/data');
console.log('Open /?data=examples using a static HTTP server.');
