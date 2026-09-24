import test from 'node:test';
import assert from 'node:assert/strict';
import { displayRegions, displayLocationName } from '../model.js';

test('API English alphabetic order becomes original Chinese region order', () => {
  const input = [
    { code: 'TW-CHA', name: 'Changhua County' },
    { code: 'TW-KHH', name: 'Kaohsiung City' },
    { code: 'TW-LIE', name: 'Lienchiang County' },
    { code: 'TW-TPQ', name: 'New Taipei City' },
    { code: 'TW-TPE', name: 'Taipei City' },
    { code: 'TW', name: 'Taiwan' }
  ];
  assert.deepEqual(displayRegions(input).map(r => r.name), ['台灣', '臺北市', '新北市', '高雄市', '彰化縣', '連江縣']);
  assert.equal(input[0].name, 'Changhua County');
  assert.deepEqual(displayRegions([{code:'TW-NEW',name:'新地區'}]), [{code:'TW-NEW',name:'新地區'}]);
});
test('Chinese place labels keep qualifiers and coordinates without English translations', () => {
  assert.equal(displayLocationName('台北--大安森林公園(Taipei--Da’an Forest Park)'), '台北--大安森林公園');
  assert.equal(displayLocationName('墾丁--社頂(賞鷹平台)(Kenting (Raptors Observation Spot))'), '墾丁--社頂(賞鷹平台)');
  assert.equal(displayLocationName('地點 (25.01, 121.5)'), '地點 (25.01, 121.5)');
  assert.equal(displayLocationName('WR-B8'), 'WR-B8');
  assert.equal(displayLocationName('地點(未閉合'), '地點(未閉合');
});
