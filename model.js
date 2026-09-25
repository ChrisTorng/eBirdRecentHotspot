// Keep the original site's Traditional Chinese labels and region order.
export const TAIWAN_REGIONS = [
  ['TW', '台灣'], ['TW-TPE', '臺北市'], ['TW-TPQ', '新北市'],
  ['TW-TAO', '桃園市'], ['TW-TXG', '臺中市'], ['TW-TNN', '臺南市'],
  ['TW-KHH', '高雄市'], ['TW-KEE', '基隆市'], ['TW-HSZ', '新竹市'],
  ['TW-HSQ', '新竹縣'], ['TW-MIA', '苗栗縣'], ['TW-CHA', '彰化縣'],
  ['TW-NAN', '南投縣'], ['TW-YUN', '雲林縣'], ['TW-CYI', '嘉義市'],
  ['TW-CYQ', '嘉義縣'], ['TW-PIF', '屏東縣'], ['TW-ILA', '宜蘭縣'],
  ['TW-HUA', '花蓮縣'], ['TW-TTT', '臺東縣'], ['TW-PEN', '澎湖縣'],
  ['TW-KIN', '金門縣'], ['TW-LIE', '連江縣']
].map(([code, name]) => ({ code, name }));
export function displayRegions(regions) {
  const available = new Map(regions.map(region => [region.code, region]));
  const known = new Set(TAIWAN_REGIONS.map(region => region.code));
  return [
    ...TAIWAN_REGIONS.filter(region => available.has(region.code)),
    ...regions.filter(region => !known.has(region.code))
  ];
}
export function displayLocationName(value) {
  const name = String(value || '未命名地點');
  if (!/\p{Script=Han}/u.test(name)) return name;
  // Remove English translations in parentheses, retaining Chinese qualifiers,
  // numeric coordinates, and the complete API name in the link's tooltip.
  let result = '', start = -1, depth = 0;
  for (let i = 0; i < name.length; i++) {
    const char = name[i];
    if (char === '(' || char === '（') {
      if (depth === 0) start = i;
      depth++;
    } else if ((char === ')' || char === '）') && depth > 0) {
      depth--;
      if (depth === 0) {
        const content = name.slice(start, i + 1);
        if (/\p{Script=Han}/u.test(content) || !/[a-z]/i.test(content)) result += content;
      }
    } else if (depth === 0) result += char;
  }
  if (depth) result += name.slice(start);
  return result.trim() || name;
}
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
export function regionRows(snapshot, code, catalog) {
  if (snapshot.feedKind === 'daily' && code === 'TW') {
    return snapshot.regions.filter(r => r.code !== 'TW').flatMap(r => regionRows(snapshot, r.code, catalog));
  }
  if (snapshot.schemaVersion === 1) {
    if (!Array.isArray(snapshot.checklists?.[code])) throw new Error('地區清單格式錯誤');
    return snapshot.checklists[code];
  }
  if (snapshot.schemaVersion !== 2 || catalog?.schemaVersion !== 1 || !catalog.locations || !snapshot.checklists || !Array.isArray(snapshot.regionChecklists?.[code])) throw new Error('快照或地點字典格式錯誤');
  return snapshot.regionChecklists[code].map(subId => {
    const row = Object.hasOwn(snapshot.checklists, subId) && snapshot.checklists[subId];
    const loc = row && Object.hasOwn(catalog.locations, row.locId) && catalog.locations[row.locId];
    if (!row || !loc) throw new Error(`清單或地點資料缺漏：${subId}`);
    return { ...row, subId, isoObsDate: row.observedAt, loc };
  });
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
    const timestamp = row => row.date.length === 16 ? `${row.date}:00` : row.date;
    group.rows.sort((a, b) => timestamp(b).localeCompare(timestamp(a)));
    const originalRows = group.rows;
    const merged = new Map();
    for (const row of originalRows) {
      // A date without a valid time/species count cannot establish a match.
      const canMerge = row.date.includes('T') && Number.isInteger(row.numSpecies) && row.numSpecies >= 0;
      const time = timestamp(row);
      const key = canMerge ? `${time}|${row.numSpecies}` : Symbol();
      if (!merged.has(key)) merged.set(key, { ...row, participants: [] });
      merged.get(key).participants.push({ name: row.userDisplayName || '未提供', subId: row.subId });
    }
    group.rows = [...merged.values()];
    const latest = group.rows[0].date.slice(0, 10);
    const day = latest ? group.rows.filter(r => r.date.slice(0, 10) === latest) : [];
    const species = day.map(r => r.numSpecies).filter(n => Number.isInteger(n) && n >= 0);
    return { ...group, count: group.rows.length, checklistCount: originalRows.length, observers: new Set(originalRows.map(r => r.userDisplayName).filter(Boolean)).size, latest, dayCount: day.length, average: species.length ? Math.round(species.reduce((a, b) => a + b, 0) / species.length) : null };
  }).sort((a, b) => b.count - a.count || b.rows[0].date.localeCompare(a.rows[0].date) || a.id.localeCompare(b.id));
}

export function dateRange(end, days = 4) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(end) || !Number.isInteger(days) || days < 1 || days > 31) throw new Error('日期或天數不正確（1–31 天）');
  const time = Date.parse(`${end}T00:00:00Z`);
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== end) throw new Error('日期不正確');
  return Array.from({ length: days }, (_, i) => new Date(time - i * 86400000).toISOString().slice(0, 10));
}
export function rangeRows(snapshots, code, catalog, dates) {
  const rows = new Map();
  const dailyDates = new Set(snapshots.filter(s => s.feedKind === 'daily' && s.regions.some(r => r.code === code)).map(s => s.date));
  // Newest fetch wins when a legacy snapshot also contains the same checklist.
  for (const snapshot of [...snapshots].sort((a, b) => b.fetchedAt.localeCompare(a.fetchedAt))) {
    if (!snapshot.regions.some(r => r.code === code)) continue;
    for (const row of regionRows(snapshot, code, catalog)) {
      // A refreshed daily feed replaces that date, including removals. Do not
      // resurrect deleted entries from overlapping legacy recent-list files.
      if (snapshot.feedKind !== 'daily' && dailyDates.has(observationDate(row).slice(0, 10))) continue;
      if (!rows.has(row.subId)) rows.set(row.subId, row);
    }
  }
  return [...rows.values()].filter(row => dates.includes(observationDate(row).slice(0, 10)));
}
