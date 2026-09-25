import { heatForLocation, compareHeat, scoringDates } from './heat.js';
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
function shortDate(date) { return date ? `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}` : '—'; }
const heatNumber = value => value === null ? '—' : value.toLocaleString('zh-TW', { maximumFractionDigits: 2 });
function svgNode(tag, attributes, text) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  if (text != null) node.textContent = text;
  return node;
}
function pointLabel(p) {
  return `${p.date}：${p.value === null ? '資料不足' : heatNumber(p.value)}${p.quality === 'partial' ? '（不完整）' : ''}${p.today ? '（今日未完整，不計分）' : ''}`;
}
function curve(series) {
  const figure = element('figure', null, 'heat-curve');
  const svg = svgNode('svg', { viewBox: '0 0 280 64', role: 'img', 'aria-label': '每日熱度：' + series.map(pointLabel).join('；') });
  const max = Math.max(1, ...series.map(p => p.value || 0));
  const x = i => 8 + i * 264 / 13, y = v => 48 - v / max * 36;
  svg.append(svgNode('path', { d: 'M8 48H272', stroke: '#cddbcc', fill: 'none' }));
  series.forEach((p, i) => {
    if (p.value === null) return;
    const previous = series[i - 1];
    if (previous?.value !== null && previous !== undefined) svg.append(svgNode('path', {
      d: `M${x(i-1)} ${y(previous.value)}L${x(i)} ${y(p.value)}`, fill: 'none', stroke: '#398669', 'stroke-width': 2,
      'stroke-dasharray': p.today || p.quality !== 'complete' || previous.quality !== 'complete' ? '3 3' : 'none'
    }));
    const circle = svgNode('circle', { cx: x(i), cy: y(p.value), r: 3, fill: p.today || p.quality !== 'complete' ? '#fff' : '#245e48', stroke: '#245e48' });
    circle.append(svgNode('title', {}, pointLabel(p))); svg.append(circle);
  });
  svg.append(svgNode('text', { x: 8, y: 62 }, shortDate(series[0].date)), svgNode('text', { x: 272, y: 62, 'text-anchor': 'end' }, shortDate(series.at(-1).date)), svgNode('text', { x: 272, y: 9, 'text-anchor': 'end' }, `最高 ${heatNumber(max)}`));
  figure.append(svg); return figure;
}
function render(groups) {
  toggles = [];
  if (!groups.length) { $('results').replaceChildren(element('p', '所選範圍沒有已取得的紀錄，可切換地區或日期。', 'empty-state')); return; }
  const table = element('table', null, 'hotspot-table');
  table.append(element('caption', '依近期熱度排序；資料不足的鳥點列於其後。展開可看統計與清單。', 'sr-only'));
  const header = element('tr');
  for (const text of ['鳥點名稱', '近期熱度', '每日熱度 · 14 天', '鳥點', '地圖']) { const th = element('th', text); th.scope = 'col'; header.append(th); }
  const head = element('thead'); head.append(header); table.append(head);
  groups.forEach((group, index) => {
    const body = element('tbody', null, 'location-group'), row = element('tr', null, 'group-row');
    const name = element('th', null, 'location-cell'); name.scope = 'row';
    const button = element('button', null, 'toggle-group'); button.type = 'button'; button.title = group.name;
    const arrow = element('span', '▸', 'toggle-icon'); arrow.setAttribute('aria-hidden', 'true');
    button.append(arrow, element('span', displayLocationName(group.name), 'location-name')); name.append(button);
    const score = element('td', null, 'heat-cell');
    score.append(element('strong', heatNumber(group.heat.score)), element('small', group.heat.score === null ? '資料不足' : '近期熱度'));
    score.title = `評分日期：${group.heat.scoreDays.join('、')}；權重 50%、30%、20%。缺日、上限或缺鳥友名稱時不計分。`;
    const graph = element('td', null, 'curve-cell'); graph.append(curve(group.heat.series));
    const bird = element('td', null, 'bird-cell'), map = element('td', null, 'map-cell');
    if (group.hotspot) bird.append(link('鳥點', `https://ebird.org/hotspot/${encodeURIComponent(group.id)}/bird-list?yr=curM`));
    else { const person = group.rows.find(r => r.subId); bird.append(person ? link('個人鳥點', `https://ebird.org/checklist/${encodeURIComponent(person.subId)}`) : element('span', '個人鳥點')); bird.title = '透過最新清單查看個人鳥點'; }
    const mapUrl = googleMapsUrl(group.coordinates);
    if (mapUrl) map.append(link('地圖', mapUrl));
    else { map.append(element('span', '地圖', 'unavailable')); map.title = '尚無座標，待重新擷取補齊'; }
    row.append(name, score, graph, bird, map); body.append(row);
    const detail = element('tr', null, 'expanded-row'); detail.id = `details-${index}`; detail.hidden = true;
    const cell = element('td'); cell.colSpan = 5;
    cell.append(element('p', `所選範圍 ${group.count} 筆紀錄／${group.observers} 位鳥友名稱 · 合併顯示 ${group.displayCount} 列 · 最近 ${shortDate(group.latest)} · 最近一天平均 ${group.average ?? '—'} 種／${group.dayCount} 筆清單`, 'detail-stats'));
    const daily = element('details', null, 'daily-values'); daily.append(element('summary', '每日熱度數值與資料狀態'));
    const values = element('ul');
    for (const point of group.heat.series) values.append(element('li', `${pointLabel(point)}${point.checklists !== undefined ? ` · ${point.people} 人／${point.checklists} 清單` : ''}`));
    daily.append(values); cell.append(daily);
    const records = element('table', null, 'records');
    records.append(element('caption', `${displayLocationName(group.name)} 的紀錄`, 'sr-only'));
    const recordHead = element('thead'), headings = element('tr');
    for (const text of ['鳥種', '日期時間', '鳥友']) { const th = element('th', text); th.scope = 'col'; headings.append(th); } recordHead.append(headings); records.append(recordHead);
    const recordBody = element('tbody');
    for (const record of group.rows) {
      const tr = element('tr');
      const species = element('td', Number.isInteger(record.numSpecies) && record.numSpecies >= 0 ? record.numSpecies : '—', 'species-cell');
      const date = element('td', null, 'date-cell');
      const text = record.date ? `${shortDate(record.date)}${record.date.includes('T') ? ' ' + record.date.slice(11,16) : ''}` : '日期不明';
      date.append(record.subId ? link(text, `https://ebird.org/checklist/${encodeURIComponent(record.subId)}`) : element('span', text));
      const people = element('td', null, 'observer-cell');
      record.participants.forEach((p, i) => { if (i) people.append(document.createTextNode('、')); people.append(record.participants.length > 1 && p.subId ? link(p.name, `https://ebird.org/checklist/${encodeURIComponent(p.subId)}`) : element('span', p.name)); });
      tr.append(species, date, people); recordBody.append(tr);
    }
    records.append(recordBody); cell.append(records); detail.append(cell); body.append(detail);
    button.setAttribute('aria-controls', detail.id);
    const toggle = open => { detail.hidden = !open; button.setAttribute('aria-expanded', String(open)); arrow.textContent = open ? '▾' : '▸'; button.setAttribute('aria-label', `${open ? '收合' : '展開'} ${group.name} 的 ${group.count} 筆紀錄`); body.classList.toggle('is-open', open); };
    toggle(false); button.addEventListener('click', () => toggle(detail.hidden)); toggles.push(toggle); table.append(body);
  });
  $('results').replaceChildren(table);
}
async function load() {
  $('retry').hidden = true; $('score-info').textContent = ''; $('coverage').hidden = true; $('status').className = ''; $('status').textContent = '載入中…'; $('results').replaceChildren();
  $('summary').textContent = ''; toggles = [];
  try {
    const index = await loadJson(new URL('index.json', root));
    selectDate(index, 'latest'); // Validate index before constructing any snapshot URL.
    let today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    if (page.searchParams.get('data') === 'examples') today = index.latest;
    const requested = page.searchParams.get('date') || 'today';
    const date = requested === 'today' ? (page.searchParams.get('data') === 'examples' ? index.latest : today) : selectDate(index, requested);
    const days = Number(page.searchParams.get('days') || 4);
    const dates = dateRange(date, days);
    options($('date'), [['today', '今天'], ['latest', `最新（${index.latest}）`], ...index.dates.map(d => [d, d])], requested);
    $('days').value = days;
    const available = dates.filter(d => index.dates.includes(d));
    // Legacy snapshots contain several observation days; include the latest one
    // for a useful transition, but never claim it has complete daily coverage.
    const files = available.length ? available : [index.latest];
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
    const summaryDates = dateRange(date, 14).filter(d => index.dates.includes(d));
    const summaries = Object.fromEntries(await Promise.all(summaryDates.map(async d => {
      const summary = await loadJson(new URL(`summaries/${d}.json`, root));
      if (summary.schemaVersion !== 1 || summary.algorithm !== 'companions-half-v1' || summary.date !== d || !summary.locations || !summary.quality) throw new Error('每日熱度摘要格式錯誤，請重新建置資料');
      return [d, summary];
    })));
    const groups = groupChecklists(rangeRows(snapshots, code, catalog, dates)).map(group => ({ ...group, heat: heatForLocation(summaries, group.id, date, today) })).sort(compareHeat); render(groups);
    $('score-info').textContent = `評分截至 ${scoringDates(date, today)[0]} · 三日加權 50%／30%／20%，不含今天；曲線固定 14 天，空心點為今日或不完整資料，缺日斷線。`;
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
