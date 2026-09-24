import { dataRoot, loadJson, selectDate, groupChecklists } from './model.js';
const $ = id => document.getElementById(id);
const page = new URL(window.location.href), root = dataRoot(page);
function element(tag, text) { const node = document.createElement(tag); if (text != null) node.textContent = text; return node; }
function link(text, url) { const a = element('a', text); a.href = url; return a; }
function options(select, values, selected) {
  if (!values.some(([value]) => value === selected)) values.unshift([selected, `不存在：${selected}`]);
  select.replaceChildren(...values.map(([value, label]) => { const option = element('option', label); option.value = value; option.selected = value === selected; return option; }));
}
function render(groups) {
  $('results').replaceChildren(...groups.map(group => {
    const details = element('details'), summary = element('summary');
    summary.append(element('strong', group.name), element('span', `${group.count} 筆 / ${group.observers} 個鳥友名稱 · 最近 ${group.latest || '日期不明'} · 當日平均鳥種 ${group.average ?? '—'} / ${group.dayCount} 筆`));
    details.append(summary);
    if (group.hotspot) details.append(link('熱門地點鳥種清單', `https://ebird.org/hotspot/${encodeURIComponent(group.id)}/bird-list?yr=curM`));
    const wrap = element('div'); wrap.className = 'table-wrap';
    const table = element('table'), head = element('thead'), header = element('tr');
    for (const title of ['鳥種', '觀察日期', '鳥友']) { const th = element('th', title); th.scope = 'col'; header.append(th); }
    head.append(header); table.append(head);
    const body = element('tbody');
    for (const row of group.rows) {
      const tr = element('tr'), count = element('td');
      const species = Number.isInteger(row.numSpecies) && row.numSpecies >= 0 ? row.numSpecies : '—';
      count.append(row.subId ? link(species, `https://ebird.org/checklist/${encodeURIComponent(row.subId)}`) : element('span', species));
      tr.append(count, element('td', row.date.replace('T', ' ') || '日期不明'), element('td', row.userDisplayName || '未提供')); body.append(tr);
    }
    table.append(body); wrap.append(table); details.append(wrap); return details;
  }));
}
async function load() {
  $('retry').hidden = true; $('status').className = ''; $('status').textContent = '載入中…'; $('results').replaceChildren();
  try {
    const index = await loadJson(new URL('index.json', root));
    const requested = page.searchParams.get('date') || 'latest';
    options($('date'), [['latest', `最新（${index.latest}）`], ...(Array.isArray(index.dates) ? index.dates : []).map(d => [d, d])], requested);
    const date = selectDate(index, requested);
    const snapshot = await loadJson(new URL(`snapshots/${date}.json`, root));
    if (snapshot.schemaVersion !== 1 || snapshot.date !== date || !Array.isArray(snapshot.regions) || !snapshot.regions.length) throw new Error('Snapshot 格式錯誤');
    const code = page.searchParams.get('location') || 'TW';
    options($('region'), snapshot.regions.map(r => [r.code, r.name]), code);
    const region = snapshot.regions.find(r => r.code === code);
    if (!region) throw new Error('找不到指定地區');
    const groups = groupChecklists(snapshot.checklists[code]); render(groups);
    document.title = `${region.name} · ${date} · eBird 最近熱門地點`;
    $('source').href = `https://ebird.org/region/${encodeURIComponent(code)}/recent-checklists`;
    $('status').textContent = `${root.pathname.includes('examples') ? '示範資料 · ' : ''}${date} · ${region.name} · ${groups.length ? `${groups.length} 個地點` : '此地區目前沒有最近紀錄'} · 擷取時間 ${snapshot.fetchedAt}`;
  } catch (error) { $('status').textContent = error.message; $('status').className = 'error'; $('retry').hidden = false; }
}
for (const [id, param] of [['date', 'date'], ['region', 'location']]) $(id).addEventListener('change', () => { page.searchParams.set(param, $(id).value); window.location.assign(page); });
$('filters').addEventListener('submit', event => event.preventDefault());
$('retry').addEventListener('click', load);
for (const [id, open] of [['expand', true], ['collapse', false]]) $(id).addEventListener('click', () => document.querySelectorAll('details').forEach(d => { d.open = open; }));
load();
