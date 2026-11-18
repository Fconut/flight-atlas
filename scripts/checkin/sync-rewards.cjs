const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const rewards = require(path.join(root, 'cloudfunctions/atlas-checkin/rewards.json')).rewards;
const catalog = require(path.join(root, 'miniprogram/lib/collection-catalog'));
assert.equal(rewards.length, 56, 'Expected 56 fixed rewards');
assert.equal(new Set(rewards.map(r => r.id)).size, rewards.length, 'Duplicate reward IDs');
assert.equal(new Set(rewards.map(r => r.itemId)).size, rewards.length, 'Duplicate palettes');
for (const reward of rewards) {
  assert.equal(reward.type, 'palette');
  assert.equal(reward.id, 'palette:' + reward.itemId);
  assert(catalog.items.some(item => item.id === reward.itemId && !item.free), 'Unknown or free palette: ' + reward.itemId);
}
const target = path.join(root, 'miniprogram/lib/checkin-rewards.js');
const expected = rewards.map((r, i) => ({ itemId: r.itemId, day: 1 + i * 7 }));
if (process.argv.includes('--check')) {
  assert.deepEqual(require(target), expected, 'Run sync-rewards.cjs to synchronize client rewards');
  console.log('Check-in reward manifests match');
} else {
  fs.writeFileSync(target, 'module.exports = ' + JSON.stringify(expected, null, 2) + ';\n');
  console.log('Client reward manifest synchronized');
}
