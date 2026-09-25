import { observationDate } from '../model.js';

// Raw API responses live only in memory; production persists this projection.
export function compactSnapshot(raw) {
  if (raw.schemaVersion !== 1 || !Array.isArray(raw.regions) || !raw.checklists) throw new Error('Invalid legacy snapshot');
  const checklists = Object.create(null), locations = Object.create(null), regionChecklists = Object.create(null);
  for (const region of raw.regions) {
    const rows = raw.checklists[region.code];
    if (!Array.isArray(rows)) throw new Error(`Missing region feed: ${region.code}`);
    const ids = new Set();
    for (const row of rows) {
      // Same invalid-record behavior as the legacy renderer (offline extremes).
      if (!row || typeof row.locId !== 'string' || !row.locId) continue;
      const id = row.subId || row.subID;
      if (typeof id !== 'string' || !id) throw new Error('Checklist has no ID');
      ids.add(id);
      if (Object.hasOwn(checklists, id)) continue; // First API occurrence wins.
      checklists[id] = {
        locId: row.locId,
        userDisplayName: row.userDisplayName || '',
        numSpecies: Number.isInteger(row.numSpecies) && row.numSpecies >= 0 ? row.numSpecies : null,
        observedAt: observationDate(row)
      };
      if (!Object.hasOwn(locations, row.locId)) locations[row.locId] = { name: String(row.loc?.name || '未命名地點'), isHotspot: row.loc?.isHotspot === true };
    }
    regionChecklists[region.code] = [...ids];
  }
  return {
    snapshot: { schemaVersion: 2, date: raw.date, fetchedAt: raw.fetchedAt, regions: raw.regions.map(({ code, name }) => ({ code, name })), regionChecklists, checklists },
    locations
  };
}
