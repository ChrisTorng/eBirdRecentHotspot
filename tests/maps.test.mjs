import test from 'node:test';
import assert from 'node:assert/strict';
import { locationCoordinates, googleMapsUrl, groupChecklists } from '../model.js';

test('map coordinates accept API aliases, zero and valid bounds; reject missing/invalid values', () => {
  assert.deepEqual(locationCoordinates({ latitude: 25.03, longitude: 121.5 }), { lat: 25.03, lng: 121.5 });
  assert.equal(googleMapsUrl({ lat: 0, lng: 0 }), 'https://www.google.com/maps/search/?api=1&query=0%2C0');
  for (const loc of [undefined, {}, { lat: null, lng: 121 }, { lat: 91, lng: 121 }, { lat: 25, lng: 181 }, { lat: '25', lng: 121 }]) assert.equal(googleMapsUrl(loc), null);
  const [group] = groupChecklists([{ subId: 'S1', locId: 'L1', loc: { latitude: 25.03, longitude: 121.5 } }]);
  assert.equal(googleMapsUrl(group.coordinates), 'https://www.google.com/maps/search/?api=1&query=25.03%2C121.5');
});
