import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

export function taiwanDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
export async function api(path, key, { fetcher = fetch, sleep = ms => new Promise(r => setTimeout(r, ms)) } = {}) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetcher(`https://api.ebird.org/v2/${path}`, {
        headers: { 'X-eBirdApiToken': key }, signal: AbortSignal.timeout(30000)
      });
      if (!response.ok) {
        const error = new Error(`eBird API HTTP ${response.status} (${path})`);
        error.permanent = response.status < 500 && response.status !== 429;
        throw error;
      }
      return await response.json();
    } catch (error) {
      if (error.permanent || attempt === 2) throw error;
      await sleep(1000 * 2 ** attempt);
    }
  }
}
export async function collect({ key, request = path => api(path, key), now = new Date() } = {}) {
  if (!key) throw new Error('請設定 EBIRD_API_KEY；離線開發請執行 npm run examples。');
  const subdivisions = await request('ref/region/list/subnational1/TW?fmt=json');
  if (!Array.isArray(subdivisions) || !subdivisions.length || subdivisions.some(r => !/^TW-[A-Z0-9]+$/.test(r.code) || typeof r.name !== 'string')) throw new Error('Invalid Taiwan regions');
  const regions = [{ code: 'TW', name: '台灣' }, ...subdivisions];
  if (new Set(regions.map(r => r.code)).size !== regions.length) throw new Error('Duplicate regions');
  const checklists = {};
  for (const { code } of regions) {
    const rows = await request(`product/lists/${code}?maxResults=200`);
    if (!Array.isArray(rows) || rows.some(r => !r || typeof r !== 'object' || !r.subId || !r.locId || !r.loc)) throw new Error(`Invalid checklist feed: ${code}`);
    checklists[code] = rows;
  }
  return { schemaVersion: 1, date: taiwanDate(now), fetchedAt: now.toISOString(), regions, checklists };
}
async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(`${path}.tmp`, JSON.stringify(value, null, 2) + '\n');
  await rename(`${path}.tmp`, path);
}
export async function saveSnapshot(root, snapshot) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(snapshot.date)) throw new Error('Invalid snapshot date');
  let dates = [];
  try { dates = JSON.parse(await readFile(resolve(root, 'index.json'), 'utf8')).dates; }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  dates = [...new Set([...dates, snapshot.date])].sort().reverse();
  await writeJson(resolve(root, 'snapshots', `${snapshot.date}.json`), snapshot);
  await writeJson(resolve(root, 'index.json'), { schemaVersion: 1, latest: dates[0], dates });
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const snapshot = await collect({ key: process.env.EBIRD_API_KEY });
  await saveSnapshot(resolve(process.argv[2] || '.local-data'), snapshot);
  console.log(`Saved ${snapshot.date}: ${snapshot.regions.length} regions`);
}
