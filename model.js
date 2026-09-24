export function dataRoot(page) {
  const url = new URL(page);
  const mode = url.searchParams.get('data');
  return new URL(mode === 'examples' ? './examples/data/' : mode === 'local' ? './.local-data/' : './data/', url);
}
export async function loadJson(url, fetcher = fetch) {
  const response = await fetcher(url, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`資料載入失敗（HTTP ${response.status}）`);
  return response.json();
}
export function selectDate(index, requested) {
  if (index.schemaVersion !== 1 || !Array.isArray(index.dates) || !index.dates.includes(index.latest) || index.dates.some(d => !/^\d{4}-\d{2}-\d{2}$/.test(d))) throw new Error('日期索引格式錯誤');
  const date = !requested || requested === 'latest' ? index.latest : requested;
  if (!index.dates.includes(date)) throw new Error('找不到指定日期的資料');
  return date;
}
export function observationDate(row) {
  const value = String(row.isoObsDate || row.obsDt || '');
  const combined = value.length === 10 && row.obsTime ? `${value}T${row.obsTime}` : value.replace(' ', 'T');
  return /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2})?)?$/.test(combined) && Number.isFinite(Date.parse(combined)) ? combined : '';
}
export function groupChecklists(rows) {
  if (!Array.isArray(rows)) throw new Error('清單格式錯誤');
  const groups = new Map(), seen = new Set();
  for (const row of rows) {
    if (!row || typeof row.locId !== 'string' || !row.locId) continue;
    if (row.subId && seen.has(row.subId)) continue;
    if (row.subId) seen.add(row.subId);
    const record = { ...row, date: observationDate(row) };
    if (!groups.has(row.locId)) groups.set(row.locId, { id: row.locId, name: String(row.loc?.name || '未命名地點'), hotspot: row.loc?.isHotspot === true, rows: [] });
    groups.get(row.locId).rows.push(record);
  }
  return [...groups.values()].map(group => {
    group.rows.sort((a, b) => b.date.localeCompare(a.date));
    const latest = group.rows[0].date.slice(0, 10);
    const day = latest ? group.rows.filter(r => r.date.slice(0, 10) === latest) : [];
    const species = day.map(r => r.numSpecies).filter(n => Number.isInteger(n) && n >= 0);
    return { ...group, count: group.rows.length, observers: new Set(group.rows.map(r => r.userDisplayName).filter(Boolean)).size, latest, dayCount: day.length, average: species.length ? Math.round(species.reduce((a, b) => a + b, 0) / species.length) : null };
  }).sort((a, b) => b.count - a.count || b.rows[0].date.localeCompare(a.rows[0].date) || a.id.localeCompare(b.id));
}
