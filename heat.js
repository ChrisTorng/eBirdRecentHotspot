import { groupChecklists, dateRange } from './model.js';

export function dailyMetrics(rows) {
  return groupChecklists(rows).map(group => {
    const people = new Map();
    let unknown = 0;
    for (const row of group.rows) {
      const names = [...new Set(row.participants.map(p => p.name?.trim()).filter(n => n && n !== '未提供'))];
      unknown += row.participants.filter(p => !p.name?.trim() || p.name === '未提供').length;
      const contribution = names.length ? (1 + 0.5 * (names.length - 1)) / names.length : 0;
      for (const name of names) people.set(name, Math.max(people.get(name) || 0, contribution));
    }
    return { id: group.id, heat: [...people.values()].reduce((sum, value) => sum + value, 0), people: people.size, checklists: group.count, unknown };
  });
}

export function scoringDates(end, today) {
  return dateRange(end > today ? today : end, 3);
}

export function pointForDay(summary, id, regions) {
  if (!summary) return { value: null, quality: 'missing' };
  const entry = summary.locations[id];
  const codes = entry?.regions || regions;
  const complete = codes.length > 0 && codes.every(code => summary.quality[code] === 'complete');
  const usable = codes.length > 0 && codes.every(code => ['complete', 'open'].includes(summary.quality[code]));
  if (!entry) return { value: usable ? 0 : null, quality: complete ? 'complete' : usable ? 'open' : 'missing', fetchedAt: summary.fetchedAt };
  return { value: entry.heat, quality: !entry.unknown && usable ? (complete ? 'complete' : 'open') : 'partial', fetchedAt: summary.fetchedAt, ...entry };
}

export function heatForLocation(summaries, id, end, today) {
  const regions = [...new Set(Object.values(summaries).flatMap(s => s.locations[id]?.regions || []))];
  const scoreDays = scoringDates(end, today);
  const points = scoreDays.map(date => pointForDay(summaries[date], id, regions));
  const usable = points.every(p => ['complete', 'open'].includes(p.quality));
  const provisional = points.some(p => p.quality === 'open');
  const score = usable ? points.reduce((sum, p, i) => sum + p.value * [0.5, 0.3, 0.2][i], 0) : null;
  return { score, provisional, scoreDays, points, series: dateRange(end, 14).reverse().map(date => ({ date, today: date >= today, ...pointForDay(summaries[date], id, regions) })) };
}

export function compareHeat(a, b) {
  return (b.heat.score !== null) - (a.heat.score !== null) || (b.heat.score ?? 0) - (a.heat.score ?? 0) || a.id.localeCompare(b.id);
}

export function sharedCurveMax(groups) {
  return Math.max(1, ...groups.flatMap(g => g.heat.series.map(p => p.value || 0)));
}
export function scoreFormula(heat) {
  const number = value => value === null ? '?' : Number(value.toFixed(6)).toString();
  const formula = heat.points.map((p, i) => `${number(p.value)} × ${[50,30,20][i]}%`).join(' + ');
  const dates = heat.points.map((p, i) => `${heat.scoreDays[i]}：${number(p.value)}${p.quality !== 'complete' ? '（暫計／不完整）' : ''}${p.fetchedAt ? `，擷取 ${new Date(p.fetchedAt).toLocaleString('zh-TW', {timeZone:'Asia/Taipei',hour12:false})}` : ''}`).join('；');
  return `${formula} = ${heat.score === null ? '資料不足（不計正式分數）' : number(heat.score)}${heat.provisional && heat.score !== null ? '（暫計）' : ''}\n${dates}`;
}
