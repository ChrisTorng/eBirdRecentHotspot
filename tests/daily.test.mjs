import test from 'node:test';
import assert from 'node:assert/strict';
import { collectDays } from '../scripts/collect.mjs';
import { compactSnapshot } from '../scripts/compact.mjs';
import { dateRange, rangeRows, regionRows } from '../model.js';

test('four Taiwan dates, counties only, one discovery and explicit cap', async () => {
  const paths = [];
  const snapshots = await collectDays({ key: 'test', now: new Date('2026-01-01T16:01:00Z'), request: async path => {
    paths.push(path);
    if (path.startsWith('ref/')) return [{ code: 'TW-TPE', name: 'Taipei' }, { code: 'TW-LIE', name: 'Lienchiang' }];
    return path.includes('TW-LIE') ? [] : Array.from({ length: 200 }, (_, i) => ({ subId: `S${i}`, locId: 'L1', loc: { name: '測試', isHotspot: true }, numSpecies: 2, isoObsDate: '2026-01-02 08:00' }));
  }});
  assert.deepEqual(snapshots.map(s => s.date), ['2026-01-02', '2026-01-01', '2025-12-31', '2025-12-30']);
  assert.equal(paths.length, 9);
  assert.ok(paths.includes('product/lists/TW-TPE/2025/12/31?maxResults=200&sortKey=obs_dt'));
  assert.ok(!paths.some(p => p.startsWith('product/lists/TW/')));
  const { snapshot, locations } = compactSnapshot(snapshots[0]);
  assert.equal(snapshot.coverage['TW-TPE'].possiblyTruncated, true);
  assert.equal(snapshot.coverage['TW-LIE'].possiblyTruncated, false);
  assert.equal(snapshot.regionChecklists.TW, undefined);
  assert.equal(regionRows(snapshot, 'TW', { schemaVersion: 1, locations }).length, 200);
});

test('range calendar validation and newest fetched revision wins before filtering', () => {
  assert.deepEqual(dateRange('2024-03-01', 2), ['2024-03-01', '2024-02-29']);
  for (const [date, days] of [['2026-02-30', 4], ['invalid', 4], ['2026-01-01', 0], ['2026-01-01', 32], ['2026-01-01', 1.5]]) assert.throws(() => dateRange(date, days));
  const raw = (fetchedAt, date, numSpecies) => ({ schemaVersion: 1, fetchedAt, regions: [{ code: 'TW' }], checklists: { TW: [{ subId: 'S1', locId: 'L1', isoObsDate: date, numSpecies }] } });
  const old = raw('2026-09-24T00:00:00Z', '2026-09-23', 2);
  const updated = raw('2026-09-25T00:00:00Z', '2026-09-23', 10);
  assert.equal(rangeRows([old, updated], 'TW', null, dateRange('2026-09-24', 4))[0].numSpecies, 10);
  assert.equal(rangeRows([old, raw(updated.fetchedAt, '2026-09-20', 10)], 'TW', null, dateRange('2026-09-24', 4)).length, 0);
  const refreshed = { schemaVersion: 2, feedKind: 'daily', date: '2026-09-23', fetchedAt: updated.fetchedAt, regions: [{ code: 'TW' }, { code: 'TW-TPE' }], checklists: {}, regionChecklists: { 'TW-TPE': [] } };
  assert.equal(rangeRows([old, refreshed], 'TW', { schemaVersion: 1, locations: {} }, dateRange('2026-09-24', 4)).length, 0);
});

test('a failed county aborts the rolling collection without returning partial days', async () => {
  await assert.rejects(collectDays({ key: 'test', request: async path => {
    if (path.startsWith('ref/')) return [{ code: 'TW-TPE', name: 'Taipei' }];
    throw new Error('offline');
  }}), /offline/);
});
