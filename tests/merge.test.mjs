import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { groupChecklists } from '../model.js';

test('shared observations keep submission counts, preserve everyone and first representative link', async () => {
  const rows = JSON.parse(await readFile(new URL('../examples/fixtures/shared.json', import.meta.url)));
  const [group] = groupChecklists([...rows, rows[0]]);
  assert.equal(group.count, 4);
  assert.equal(group.displayCount, 2);
  assert.equal(group.checklistCount, 4);
  assert.equal(group.observers, 3);
  assert.equal(group.dayCount, 4);
  assert.equal(group.average, 21);
  assert.equal(group.rows[1].subId, 'S901');
  assert.deepEqual(group.rows[1].participants.map(p => p.subId), ['S901', 'S902', 'S903']);
});

test('different sites, times and species never merge; unknown time/species stay separate', () => {
  const base = { locId: 'L1', loc: { name: '地點' }, obsDt: '2026-09-24', obsTime: '06:30', numSpecies: 10, userDisplayName: '同名鳥友' };
  const changes = [{}, {}, {numSpecies:11}, {obsTime:'06:31'}, {obsTime:undefined}, {obsTime:undefined}, {numSpecies:null}, {numSpecies:null}, {locId:'L2'}];
  const groups = groupChecklists(changes.map((change, i) => ({...base, ...change, subId:`S${i}`})));
  assert.equal(groups.length, 2);
  const group = groups.find(g => g.id === 'L1');
  assert.equal(group.count, 8);
  assert.equal(group.displayCount, 7);
  assert.equal(group.checklistCount, 8);
  assert.equal(group.rows.find(r => r.participants.length === 2).participants.length, 2);
});

test('equivalent minute and zero-second timestamps merge, nonzero seconds do not', () => {
  const rows = ['06:30', '06:30:00', '06:30:01'].map((obsTime, i) => ({locId:'L1',loc:{name:'地點'},subId:`S${i}`,obsDt:'2026-09-24',obsTime,numSpecies:0}));
  const [group] = groupChecklists(rows);
  assert.equal(group.count, 3);
  assert.equal(group.displayCount, 2);
  assert.equal(group.average, 0);
  const shared = group.rows.find(row => row.participants.length === 2);
  assert.equal(shared.subId, 'S0');
  assert.deepEqual(shared.participants.map(person => person.subId), ['S0', 'S1']);
});
