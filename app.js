import { dataRoot, loadJson, selectDate, groupChecklists, displayRegions, displayLocationName, dateRange, rangeRows, googleMapsUrl } from './model.js';
const $ = id => document.getElementById(id);
const page = new URL(window.location.href), root = dataRoot(page);
let toggles = [];
function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text != null) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function externalLink(a) {
  a.target = '_blank'; a.rel = 'noopener noreferrer';
  a.classList.add('external-link');
  const icon = element('span', '↗', 'external-icon'); icon.setAttribute('aria-hidden', 'true');
  a.append(icon, element('span', '（另開新視窗）', 'sr-only'));
  return a;
}
function link(text, url) {
  const a = element('a', text); a.href = url;
  return new URL(a.href).origin !== page.origin ? externalLink(a) : a;
}
function options(select, values, selected) {
  if (!values.some(([value]) => value === selected)) values.unshift([selected, `不存在：${selected}`]);
  select.replaceChildren(...values.map(([value, label]) => {
    const option = element('option', label); option.value = value; option.selected = value === selected; return option;
  }));
}
function renderRegions(regions, current) {
  $('regions').replaceChildren(...regions.map(region => {
    const url = new URL(page); url.searchParams.set('location', region.code);
    const a = link(region.name, url); a.className = 'region-link';
    if (region.code === current) a.setAttribute('aria-current', 'page');
    return a;
  }));
}
function pair(first, second) {
  const span = element('span', null, 'metric-pair');
  span.append(element('strong', first), element('span', '/', 'separator'), element('span', second, 'secondary-number'));
  return span;
}
function shortDate(date) { return date ? `${Number(date.slice(5, 7))}/${date.slice(8, 10)}` : '—'; }
function render(groups) {
  toggles = [];
  if (!groups.length) {
    $('results').replaceChildren(element('p', '此地區目前沒有最近紀錄。可切換其他地區或資料日期。', 'empty-state'));
    return;
  }
  const table = element('table', null, 'hotspot-table');
  table.append(element('caption', '依紀錄數排序的最近熱門地點；展開地點可查看各筆清單。', 'sr-only'));
  const columns = element('colgroup');
  for (const name of ['count-col', 'latest-col', 'average-col', 'species-col', 'date-col', 'observer-col', 'ebird-col', 'map-col']) columns.append(element('col', null, name));
  table.append(columns);
  const head = element('thead'), header = element('tr');
  for (const [title, hint, className] of [
    ['紀錄 / 人', '清單數 / 不同鳥友名稱', 'numeric'],
    ['最近日期', '此地點最新觀察日', 'date-cell'],
    ['平均鳥種 / 紀錄', '最近日平均 / 清單數', 'numeric'],
    ['鳥種', '單筆', 'numeric'], ['日期', '觀察時間', 'date-cell'], ['鳥友名', '各人清單', ''], ['鳥點', '另開新視窗', 'ebird-cell'], ['地圖', 'Google Maps', 'map-cell']
  ]) {
    const th = element('th', null, className); th.scope = 'col';
    th.append(element('span', title), element('small', hint)); header.append(th);
  }
  head.append(header); table.append(head);
  groups.forEach((group, index) => {
    const body = element('tbody', null, 'location-group');
    const tr = element('tr', null, 'group-row');
    const count = element('td', null, 'count-cell numeric');
    count.append(pair(group.count, group.observers));
    const latest = element('td', shortDate(group.latest), 'date-cell latest-cell'); latest.title = group.latest || '日期不明';
    const average = element('td', null, 'numeric average-cell'); average.append(pair(group.average ?? '—', group.dayCount));
    const location = element('th', null, 'location-cell'); location.colSpan = 3; location.scope = 'row';
    const displayName = displayLocationName(group.name);
    const button = element('button', null, 'toggle-group'); button.type = 'button';
    button.title = group.name;
    const arrow = element('span', '▸', 'toggle-icon'); arrow.setAttribute('aria-hidden', 'true');
    const action = element('span', '展開', 'toggle-label');
    button.append(arrow, element('span', displayName, 'location-name'), action);
    location.append(button);
    const ebird = element('td', null, 'ebird-cell');
    if (group.hotspot) ebird.append(link('鳥點', `https://ebird.org/hotspot/${encodeURIComponent(group.id)}/bird-list?yr=curM`));
    else {
      const representative = group.rows.find(row => row.subId);
      if (representative) ebird.append(link('個人鳥點', `https://ebird.org/checklist/${encodeURIComponent(representative.subId)}`));
      else ebird.textContent = '個人鳥點';
      ebird.title = '個人鳥點：透過最新清單查看地點資訊';
    }
    const map = element('td', null, 'map-cell');
    const mapUrl = googleMapsUrl(group.coordinates);
    if (mapUrl) map.append(link('地圖', mapUrl));
    else { map.append(element('span', '地圖', 'unavailable')); map.title = '尚無座標，待此地點重新擷取後提供地圖'; }
    tr.append(count, latest, average, location, ebird, map); body.append(tr);
    const detailRows = group.rows.map((row, rowIndex) => {
      const detail = element('tr', null, 'detail-row'); detail.id = `detail-${index}-${rowIndex}`; detail.hidden = true;
      const blank = element('td', null, 'detail-indent'); blank.colSpan = 3;
      const speciesCell = element('td', null, 'numeric');
      const species = Number.isInteger(row.numSpecies) && row.numSpecies >= 0 ? row.numSpecies : '—';
      speciesCell.textContent = species;
      const date = element('td', null, 'date-cell'); date.title = row.date;
      const dateText = row.date ? `${shortDate(row.date)}${row.date.includes('T') ? ' ' + row.date.slice(11, 16) : ''}` : '日期不明';
      date.append(row.subId ? link(dateText, `https://ebird.org/checklist/${encodeURIComponent(row.subId)}`) : element('span', dateText));
      const observers = element('td', null, 'observer-cell');
      row.participants.forEach((person, personIndex) => {
        if (personIndex) observers.append(document.createTextNode('、'));
        observers.append(row.participants.length > 1 && person.subId ? link(person.name, `https://ebird.org/checklist/${encodeURIComponent(person.subId)}`) : element('span', person.name));
      });
      detail.append(blank, speciesCell, date, observers, element('td', null, 'detail-link-spacer'), element('td', null, 'detail-link-spacer'));
      body.append(detail); return detail;
    });
    button.setAttribute('aria-controls', detailRows.map(row => row.id).join(' '));
    const toggle = open => {
      button.setAttribute('aria-expanded', String(open)); arrow.textContent = open ? '▾' : '▸'; action.textContent = open ? '收合' : '展開';
      button.setAttribute('aria-label', `${open ? '收合' : '展開'} ${group.name} 的 ${group.count} 筆紀錄`);
      body.classList.toggle('is-open', open); detailRows.forEach(row => { row.hidden = !open; });
    };
    toggle(false);
    button.addEventListener('click', () => toggle(button.getAttribute('aria-expanded') !== 'true'));
    toggles.push(toggle); table.append(body);
  });
  const wrap = element('div', null, 'table-wrap'); wrap.tabIndex = 0;
  wrap.setAttribute('role', 'region'); wrap.setAttribute('aria-label', '熱門地點比較表');
  wrap.append(table); $('results').replaceChildren(wrap);
}
async function load() {
  $('retry').hidden = true; $('coverage').hidden = true; $('status').className = ''; $('status').textContent = '載入中…'; $('results').replaceChildren();
  $('summary').textContent = ''; toggles = [];
  try {
    const index = await loadJson(new URL('index.json', root));
    selectDate(index, 'latest'); // Validate index before constructing any snapshot URL.
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const requested = page.searchParams.get('date') || 'today';
    const date = requested === 'today' ? (page.searchParams.get('data') === 'examples' ? index.latest : today) : selectDate(index, requested);
    const days = Number(page.searchParams.get('days') || 4);
    const dates = dateRange(date, days);
    options($('date'), [['today', '今天'], ['latest', `最新（${index.latest}）`], ...index.dates.map(d => [d, d])], requested);
    $('days').value = days;
    const available = dates.filter(d => index.dates.includes(d));
    // Legacy snapshots contain several observation days; include the latest one
    // for a useful transition, but never claim it has complete daily coverage.
    const files = [...new Set([...available, index.latest])];
    const loaded = await Promise.all(files.map(async d => {
      const snapshot = await loadJson(new URL(`snapshots/${d}.json`, root));
      if (![1, 2].includes(snapshot.schemaVersion) || snapshot.date !== d || !Array.isArray(snapshot.regions) || !snapshot.regions.length) throw new Error('Snapshot 格式錯誤');
      return snapshot;
    }));
    const snapshots = loaded.filter(s => dates.includes(s.date) || s.feedKind !== 'daily');
    const code = page.searchParams.get('location') || 'TW';
    const regions = displayRegions([...new Map(loaded.flatMap(s => s.regions).map(r => [r.code, r])).values()]);
    options($('region'), regions.map(r => [r.code, r.name]), code); renderRegions(regions, code);
    const region = regions.find(r => r.code === code);
    if (!region) throw new Error('找不到指定地區');
    const catalog = snapshots.some(s => s.schemaVersion === 2) ? await loadJson(new URL('locations.json', root)) : null;
    const groups = groupChecklists(rangeRows(snapshots, code, catalog, dates)); render(groups);
    const warnings = [];
    const missing = dates.filter(d => !snapshots.some(s => s.date === d && s.feedKind === 'daily'));
    if (missing.length) warnings.push(`缺少逐日資料：${missing.join('、')}（不代表當日沒有紀錄）`);
    const capped = snapshots.flatMap(s => Object.entries(s.coverage || {}).filter(([r, c]) => (code === 'TW' || r === code) && c.possiblyTruncated).map(([r]) => `${s.date} ${regions.find(region => region.code === r)?.name || r}`));
    if (capped.length) warnings.push(`達 API 200 筆上限，可能不完整：${capped.join('、')}`);
    if (snapshots.some(s => s.feedKind !== 'daily')) warnings.push('含舊版最近清單快照，僅顯示範圍內已取得的紀錄');
    $('coverage').textContent = warnings.join('。'); $('coverage').hidden = !warnings.length;
    document.title = `${region.name} · ${date} · eBird 最近熱門地點`;
    $('region-title').textContent = region.name;
    $('summary').textContent = `${groups.length} 個地點 · ${groups.reduce((sum, g) => sum + g.count, 0)} 筆紀錄（合併顯示 ${groups.reduce((sum, g) => sum + g.displayCount, 0)} 列）`;
    $('source').href = `https://ebird.org/region/${encodeURIComponent(code)}/recent-checklists`;
    const fetched = new Date(snapshots.map(s => s.fetchedAt).sort().at(-1) || '');
    const time = Number.isNaN(fetched.getTime()) ? '未知' : new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(fetched);
    $('status').textContent = `${root.pathname.includes('examples') ? '示範資料 · ' : ''}觀察日期 ${dates.at(-1)} ～ ${date} · 更新 ${time}（台灣時間）`;
  } catch (error) { $('status').textContent = error.message; $('status').className = 'error'; $('retry').hidden = false; }
}
for (const [id, param] of [['date', 'date'], ['region', 'location'], ['days', 'days']]) $(id).addEventListener('change', () => { page.searchParams.set(param, $(id).value); window.location.assign(page); });
$('filters').addEventListener('submit', event => event.preventDefault());
$('retry').addEventListener('click', load);
for (const [id, open] of [['expand', true], ['collapse', false]]) $(id).addEventListener('click', () => toggles.forEach(toggle => toggle(open)));
document.querySelectorAll('footer a').forEach(externalLink);
load();
