const test = require('node:test'), assert = require('node:assert/strict');
const { planSegments, ownedLines, joinLines } = require('../cloudfunctions/atlas-ocr/segments');
const { imageSize } = require('../miniprogram/airport-picker/lib/ocr-image-size');
const { parseFlightScreenshot } = require('../miniprogram/airport-picker/lib/screenshot-parser');
test('long screenshots retain readable width within cloud pixel and height budgets', () => {
  const size = imageSize(1080, 10000);
  assert(size.long); assert(size.height > 8000); assert(size.width >= 900);
  assert(size.width * size.height <= 9000000);
  assert.deepEqual(imageSize(900, 1200), { width: 900, height: 1200, long: false });
  assert.throws(() => imageSize(1080, 100000), /拆成多张/);
  assert.throws(() => imageSize(0, 100), /尺寸无效/);
});
test('segment ownership covers every row exactly once with overlap context', () => {
  const regions = planSegments(900, 5200);
  assert.equal(regions.length, 3); assert.equal(regions[0].start, 0); assert.equal(regions.at(-1).end, 5200);
  for (let i = 1; i < regions.length; i++) {
    assert.equal(regions[i].start, regions[i-1].end);
    assert(regions[i].top < regions[i].start);
  }
  const line = { text: 'MU5357', bbox: { x0: 1, y0: 1790, x1: 100, y1: 1810 } };
  assert.equal(regions.reduce((sum, region) => sum + ownedLines([line], region).length, 0), 1);
  assert.throws(() => ownedLines([{text:'bad'}],regions[0]), /位置无效/);
  assert.throws(() => planSegments(1,12001), /尺寸无效/);
});
test('merging segment lines preserves date inheritance and does not collapse repeated flight text at different positions', () => {
  const values = ['2026-10-25','MU5358','20:30 SZX','22:35 SHA','MU5357','20:30 SHA','23:00 SZX'];
  const lines = values.map((text,index)=>({text,bbox:{x0:0,x1:100,y0:index*600,y1:index*600+30}}));
  const regions = planSegments(900, 5200);
  const merged = joinLines(regions.flatMap(region => ownedLines(lines, region)).reverse());
  assert.equal(merged, values.join('\n'));
  const rows = parseFlightScreenshot(merged);
  assert.equal(rows.length, 2); assert.equal(rows[1].date, '2026-10-25'); assert.equal(rows[1].from, 'SHA');
  assert.equal(joinLines([lines[1],{...lines[1],bbox:{...lines[1].bbox,y0:4800,y1:4830}}]).split('\n').length,2);
});
