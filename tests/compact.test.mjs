import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compactSnapshot } from '../scripts/compact.mjs';
import { saveSnapshot } from '../scripts/collect.mjs';
import { migrateData } from '../scripts/migrate.mjs';
import { regionRows, groupChecklists } from '../model.js';

const row = {subId:'S1', subID:'S1',locId:'L1', userDisplayName:'鳥友甲',numSpecies:12,obsDt:'25 Sep 2026',obsTime:'06:58',isoObsDate:'2026-09-25 06:58',loc:{locID:'L1',name:'公園',locName:'公園',isHotspot:true,lat:24,lng:120,countryName:'Taiwan'}};
const raw = (date='2026-09-25', name='公園') => ({schemaVersion:1,date,fetchedAt:`${date}T00:00:00.000Z`,regions:[{code:'TW',name:'台灣'},{code:'TW-TPE',name:'Taipei City'}],checklists:{TW:[{...row,loc:{...row.loc,name}}], 'TW-TPE':[{...row,loc:{...row.loc,name}}]}});
const read = async path => JSON.parse(await readFile(path, 'utf8'));
test('one checklist and one location across region memberships; only needed fields survive', () => {
  const input = raw();
  input.checklists.TW.push({...row,subId:'S2',userDisplayName:'鳥友乙'});
  const {snapshot,locations} = compactSnapshot(input);
  assert.equal(snapshot.schemaVersion,2);
  assert.deepEqual(Object.keys(snapshot.checklists),['S1','S2']);
  assert.deepEqual({...snapshot.regionChecklists}, {TW:['S1','S2'],'TW-TPE':['S1']});
  assert.deepEqual({...locations},{L1:{name:'公園',isHotspot:true}});
  assert.deepEqual(snapshot.checklists.S1, {locId:'L1',userDisplayName:'鳥友甲',numSpecies:12,observedAt:'2026-09-25T06:58'});
  const catalog={schemaVersion:1,locations};
  for (const region of input.regions) {
    const summarize = rows => groupChecklists(rows).map(g => ({id:g.id,name:g.name,count:g.count,observers:g.observers,average:g.average,latest:g.latest,participants:g.rows.map(r=>r.participants)}));
    assert.deepEqual(summarize(regionRows(snapshot,region.code,catalog)),summarize(input.checklists[region.code]));
  }
  assert.equal(input.checklists.TW[0].obsDt,'25 Sep 2026');
});
test('legacy remains readable and compact missing references fail explicitly', () => {
  const input=raw(); assert.equal(regionRows(input,'TW'),input.checklists.TW);
  const {snapshot,locations}=compactSnapshot(input);
  assert.throws(()=>regionRows(snapshot,'TW',{schemaVersion:1,locations:{}}),/缺漏/);
  delete snapshot.checklists.S1;
  assert.throws(()=>regionRows(snapshot,'TW',{schemaVersion:1,locations}),/缺漏/);
});
test('location updates preserve older IDs and backfills cannot revert new names', async () => {
  const root=await mkdtemp(join(tmpdir(),'ebird-compact-'));
  try {
    await saveSnapshot(root,raw('2026-09-24','原名'));
    await saveSnapshot(root,raw('2026-09-25','新名'));
    const older=raw('2026-09-23','過時名稱');
    older.checklists.TW.push({...row,subId:'S3',locId:'L2',loc:{name:'歷史地點',isHotspot:false}});
    await saveSnapshot(root,older);
    const catalog=await read(join(root,'locations.json'));
    assert.equal(catalog.locations.L1.name,'新名'); assert.equal(catalog.locations.L2.name,'歷史地點');
    assert.equal(catalog.updatedAt,'2026-09-25T00:00:00.000Z');
    const snapshot=await read(join(root,'snapshots/2026-09-24.json'));
    assert.equal(snapshot.schemaVersion,2);
    assert.equal(regionRows(snapshot,'TW',catalog)[0].loc.name,'新名');
    await saveSnapshot(root,raw('2026-09-25','同日更名'));
    assert.equal((await read(join(root,'locations.json'))).locations.L1.name,'同日更名');
  } finally { await rm(root,{recursive:true,force:true}); }
});
test('historical migration is chronological, idempotent and validates references', async () => {
  const root=await mkdtemp(join(tmpdir(),'ebird-migrate-'));
  try {
    await mkdir(join(root,'snapshots'));
    await writeFile(join(root,'index.json'),JSON.stringify({schemaVersion:1,latest:'2026-09-25',dates:['2026-09-25','2026-09-24']}));
    for (const date of ['2026-09-24','2026-09-25']) await writeFile(join(root,`snapshots/${date}.json`),JSON.stringify(raw(date,date)));
    assert.equal(await migrateData(root),2);
    const first=await readFile(join(root,'locations.json'),'utf8');
    assert.equal((await read(join(root,'locations.json'))).locations.L1.name,'2026-09-25');
    assert.equal(await migrateData(root),0);
    assert.equal(await readFile(join(root,'locations.json'),'utf8'),first);
    await writeFile(join(root,'locations.json'),JSON.stringify({schemaVersion:1,locations:{}}));
    await assert.rejects(migrateData(root),/缺漏/);
  } finally { await rm(root,{recursive:true,force:true}); }
});
