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
  return dateRange(end >= today ? dateRange(today, 2)[1] : end, 3);
}

export function pointForDay(summary, id, regions) {
  if (!summary) return { value: null, quality: 'missing' };
  const entry = summary.locations[id];
  const codes = entry?.regions || regions;
  const complete = codes.length > 0 && codes.every(code => summary.quality[code] === 'complete');
  if (!entry) return { value: complete ? 0 : null, quality: complete ? 'complete' : 'missing' };
  return { value: entry.heat, quality: complete && !entry.unknown ? 'complete' : 'partial', ...entry };
}

export function heatForLocation(summaries, id, end, today) {
  const regions = [...new Set(Object.values(summaries).flatMap(s => s.locations[id]?.regions || []))];
  const scoreDays = scoringDates(end, today);
  const points = scoreDays.map(date => pointForDay(summaries[date], id, regions));
  const complete = points.every(p => p.quality === 'complete');
  const score = complete ? points.reduce((sum, p, i) => sum + p.value * [0.5, 0.3, 0.2][i], 0) : null;
  return { score, scoreDays, points, series: dateRange(end, 14).reverse().map(date => ({ date, today: date >= today, ...pointForDay(summaries[date], id, regions) })) };
}

export function compareHeat(a, b) {
  return (b.heat.score !== null) - (a.heat.score !== null) || (b.heat.score ?? 0) - (a.heat.score ?? 0) || a.id.localeCompare(b.id);
}
