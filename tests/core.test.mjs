import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { api, collect, saveSnapshot, taiwanDate } from '../scripts/collect.mjs';
import { dataRoot, loadJson, selectDate, groupChecklists } from '../model.js';
const fixture = async name => JSON.parse(await readFile(new URL(`../examples/fixtures/${name}.json`, import.meta.url)));
test('normal grouping, newest first, averages and observers', async () => {
 const groups = groupChecklists(await fixture('normal'));
 assert.equal(groups.length, 2); assert.equal(groups[0].count, 2); assert.equal(groups[0].average, 25); assert.equal(groups[0].observers, 2); assert.equal(groups[0].rows[0].subId, 'S2');
});
test('extremes: duplicate IDs, same names, missing fields, year boundary', async () => {
 const groups = groupChecklists(await fixture('extreme'));
 assert.equal(groups.length, 4); assert.equal(groups[0].count, 2); assert.equal(groups[0].latest, '2026-01-01'); assert.equal(groups[0].average, 1000); assert.match(groups[0].name, /<img/);
 assert.equal(groups.filter(g => g.name === '同名地點').length, 2); assert.equal(groups.find(g => g.id === 'L4').average, null);
 assert.deepEqual(groupChecklists(await fixture('empty')), []); assert.throws(() => groupChecklists({}), /格式/);
});
test('project paths, latest, invalid dates, HTTP failures', async () => {
 for (const prefix of ['/', '/eBirdRecentHotspot/']) {
  const root = dataRoot(`https://example.org${prefix}?location=TW`);
  assert.equal(root.pathname, `${prefix}data/`);
  await loadJson(new URL('index.json', root), async url => { assert.equal(url.pathname, `${prefix}data/index.json`); return {ok:true,json:async()=>({})}; });
 }
 assert.equal(dataRoot('https://example.org/eBirdRecentHotspot/?data=examples').pathname, '/eBirdRecentHotspot/examples/data/');
 assert.equal(dataRoot('https://example.org/eBirdRecentHotspot/?data=local').pathname, '/eBirdRecentHotspot/.local-data/');
 const index = {schemaVersion:1,latest:'2026-09-24',dates:['2026-09-24']};
 assert.equal(selectDate(index), index.latest); assert.equal(selectDate(index,'latest'),index.latest); assert.throws(()=>selectDate(index,'../x'), /找不到/);
 await assert.rejects(loadJson('x',async()=>({ok:false,status:404})),/404/);
});
test('Taiwan midnight rollover', () => {
 assert.equal(taiwanDate(new Date('2026-09-23T16:00:00Z')),'2026-09-24');
 assert.equal(taiwanDate(new Date('2026-09-23T15:59:59Z')),'2026-09-23');
});
test('all discovered regions, API authentication, malformed data', async () => {
 const paths=[],rows=await fixture('normal');
 const request=async path=>{paths.push(path);return path.startsWith('ref/')?[{code:'TW-TPE',name:'臺北市'},{code:'TW-LIE',name:'連江縣'}]:rows;};
 const snapshot=await collect({key:'test',request});
 assert.deepEqual(Object.keys(snapshot.checklists),['TW-TPE','TW-LIE']); assert.equal(paths.length,3); assert.ok(paths.slice(1).every(p=>p.endsWith('?maxResults=200&sortKey=obs_dt')));
 await assert.rejects(collect({key:''}),/EBIRD_API_KEY/);
 await assert.rejects(collect({key:'test',request:async p=>p.startsWith('ref/')?[{code:'TW-TPE',name:'臺北市'}]:{}}),/Invalid checklist/);
 await api('test','secret',{fetcher:async(url,options)=>{assert.equal(options.headers['X-eBirdApiToken'],'secret');assert.ok(!url.includes('secret'));return {ok:true,json:async()=>[]};}});
});
test('retry transient errors but stop on authorization failure', async () => {
 let attempts=0;
 await api('test','key',{sleep:async()=>{},fetcher:async()=>++attempts<3?{ok:false,status:429}:{ok:true,json:async()=>[]}}); assert.equal(attempts,3); attempts=0;
 await assert.rejects(api('test','key',{sleep:async()=>{},fetcher:async()=>{attempts++;return {ok:false,status:403};}}),/403/); assert.equal(attempts,1);
});
test('same-day replacement, history, latest and failed collection preservation', async () => {
 const root=await mkdtemp(join(tmpdir(),'ebird-test-'));
 try {
  await saveSnapshot(root,{date:'2026-09-24',value:1}); await saveSnapshot(root,{date:'2026-09-24',value:2}); await saveSnapshot(root,{date:'2026-09-23',value:3});
  assert.deepEqual((await readdir(join(root,'snapshots'))).sort(),['2026-09-23.json','2026-09-24.json']);
  assert.equal(JSON.parse(await readFile(join(root,'snapshots/2026-09-24.json'))).value,2);
  const before=await readFile(join(root,'index.json'),'utf8'); assert.equal(JSON.parse(before).latest,'2026-09-24');
  await assert.rejects(collect({key:'test',request:async()=>{throw Error('offline');}}).then(s=>saveSnapshot(root,s)),/offline/);
  assert.equal(await readFile(join(root,'index.json'),'utf8'),before);
 } finally { await rm(root,{recursive:true,force:true}); }
});
