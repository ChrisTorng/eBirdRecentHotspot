import test from 'node:test';
import assert from 'node:assert/strict';
import { dailyMetrics, scoringDates, heatForLocation, compareHeat } from '../heat.js';
import { summarize } from '../scripts/summaries.mjs';
const row = (id, name, time = '08:00') => ({ subId: id, locId: 'L1', loc: { name: '測試' }, userDisplayName: name, numSpecies: 10, isoObsDate: `2026-09-24T${time}` });
const approximately = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);

test('group discount, duplicate names and submissions, daily maximum per person', () => {
  for (const n of [1, 2, 5, 10]) {
    const rows = Array.from({ length: n }, (_, i) => row(`S${i}`, `鳥友${i}`));
    const metrics = dailyMetrics([...rows, ...rows.map(r => ({ ...r, subId: r.subId + 'later', isoObsDate: '2026-09-24T09:00' })), rows[0]])[0];
    approximately(metrics.heat, 1 + 0.5 * (n - 1));
    assert.equal(metrics.people, n); assert.equal(metrics.checklists, n * 2);
  }
  approximately(dailyMetrics([row('A','甲'),row('B','乙'),row('C','甲','09:00')])[0].heat, 1.75);
  assert.equal(dailyMetrics([row('A','甲'),row('B','甲')])[0].heat, 1);
  const unknown = dailyMetrics([row('A',''),row('B','')])[0];
  assert.equal(unknown.heat, 0); assert.equal(unknown.unknown, 2);
});

test('summary keeps only observation date, deduplicates counties, records quality and no names', () => {
  const snapshot = { schemaVersion:1, feedKind:'daily', date:'2026-09-24', fetchedAt:'2026-09-25T00:00:00Z', regions:[{code:'TW'},{code:'TW-TPE'},{code:'TW-TPQ'}], coverage:{'TW-TPE':{possiblyTruncated:true},'TW-TPQ':{possiblyTruncated:false}}, checklists:{'TW-TPE':[row('A','甲'),row('B','乙'),{...row('C','丙'),isoObsDate:'2026-09-23T08:00'}],'TW-TPQ':[row('A','甲')]} };
  const result = summarize(snapshot);
  assert.equal(result.locations.L1.heat, 1.5); assert.equal(result.locations.L1.checklists, 2);
  assert.equal(result.quality['TW-TPE'], 'capped');
  assert.deepEqual(result.locations.L1.regions, ['TW-TPE','TW-TPQ']);
  assert.ok(!JSON.stringify(result).includes('甲'));
  const early = summarize({ ...snapshot, fetchedAt: '2026-09-24T00:00:00Z' });
  assert.equal(early.quality['TW-TPQ'], 'open');
});

const summary = (date, heat, quality = 'complete', unknown = 0) => ({date,quality:{'TW-TPE':quality},locations:heat === null ? {} : {L1:{heat,people:heat,checklists:heat,regions:['TW-TPE'],unknown}}});
test('weighted score excludes today, crosses years and uses no extra penalty/bonus', () => {
  assert.deepEqual(scoringDates('2026-01-01','2026-01-01'),['2025-12-31','2025-12-30','2025-12-29']);
  const summaries = Object.fromEntries([['2026-09-21',2],['2026-09-22',4],['2026-09-23',6],['2026-09-24',100]].map(([d,h])=>[d,summary(d,h)]));
  const result = heatForLocation(summaries,'L1','2026-09-24','2026-09-24');
  approximately(result.score, 4.6);
  assert.equal(result.series.length,14); assert.equal(result.series.at(-1).today,true);
  approximately(heatForLocation(summaries,'L1','2026-09-23','2026-09-24').score,4.6);
  // Presentation-range filtering does not enter the score API.
  const extra = {...summaries,'2026-09-10':summary('2026-09-10',999)};
  assert.equal(heatForLocation(extra,'L1','2026-09-24','2026-09-24').score,result.score);
});

test('missing data is not zero, capped/unknown days cannot produce a confident score', () => {
  const summaries = Object.fromEntries(['2026-09-21','2026-09-22','2026-09-23'].map(d=>[d,summary(d,2)]));
  summaries['2026-09-23']=summary('2026-09-23',null);
  approximately(heatForLocation(summaries,'L1','2026-09-24','2026-09-24').score,1);
  summaries['2026-09-23']=summary('2026-09-23',null,'capped');
  let result=heatForLocation(summaries,'L1','2026-09-24','2026-09-24');
  assert.equal(result.score,null); assert.equal(result.points[0].value,null);
  summaries['2026-09-23']=summary('2026-09-23',2,'complete',1);
  assert.equal(heatForLocation(summaries,'L1','2026-09-24','2026-09-24').score,null);
  delete summaries['2026-09-23'];
  assert.equal(heatForLocation(summaries,'L1','2026-09-24','2026-09-24').score,null);
  const items=[{id:'B',heat:{score:null}},{id:'C',heat:{score:0}},{id:'A',heat:{score:3}}];
  assert.deepEqual(items.sort(compareHeat).map(x=>x.id),['A','C','B']);
});

test('overwriting a day rebuilds the summary instead of retaining removed observations', async () => {
  const { mkdtemp, writeFile, readFile, mkdir, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { buildSummaries } = await import('../scripts/summaries.mjs');
  const root = await mkdtemp(join(tmpdir(), 'ebird-heat-'));
  try {
    await mkdir(join(root, 'snapshots'));
    await writeFile(join(root, 'index.json'), JSON.stringify({dates:['2026-09-24']}));
    const snapshot = {schemaVersion:1,feedKind:'daily',date:'2026-09-24',fetchedAt:'2026-09-25T00:00:00Z',regions:[{code:'TW-TPE'}],coverage:{'TW-TPE':{possiblyTruncated:false}},checklists:{'TW-TPE':[row('A','甲')]}};
    const path = join(root, 'snapshots/2026-09-24.json');
    await writeFile(path, JSON.stringify(snapshot)); await buildSummaries(root);
    assert.equal(JSON.parse(await readFile(join(root,'summaries/2026-09-24.json'))).locations.L1.heat,1);
    snapshot.checklists['TW-TPE'] = [];
    await writeFile(path, JSON.stringify(snapshot)); await buildSummaries(root);
    assert.deepEqual(JSON.parse(await readFile(join(root,'summaries/2026-09-24.json'))).locations,{});
  } finally { await rm(root,{recursive:true,force:true}); }
});
