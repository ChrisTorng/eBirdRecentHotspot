import { readFile } from 'node:fs/promises';
import { saveSnapshot } from './collect.mjs';
const fixture = async name => JSON.parse(await readFile(new URL(`../examples/fixtures/${name}.json`, import.meta.url), 'utf8'));
const normal = await fixture('normal'), extreme = await fixture('extreme'), empty = await fixture('empty');
const shared = await fixture('shared');
for (const date of ['2026-09-23', '2026-09-24']) await saveSnapshot('examples/data', {
  schemaVersion: 1, date, fetchedAt: `${date}T00:00:00.000Z`,
  regions: [{ code: 'TW', name: '台灣（示範）' }, { code: 'TW-TPE', name: '臺北市（極端案例）' }, { code: 'TW-LIE', name: '連江縣（空清單）' }],
  checklists: { TW: date === '2026-09-24' ? [...normal, ...shared] : normal.slice(2), 'TW-TPE': extreme, 'TW-LIE': empty }
});
console.log('Open /?data=examples using a static HTTP server.');
