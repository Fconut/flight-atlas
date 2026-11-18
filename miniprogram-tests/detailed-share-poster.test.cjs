const test = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('fs'),
  path = require('path'),
  vm = require('vm');
test('badge poster includes all selected records, departure times and a compact code', async () => {
  const labels = [],
    draws = [],
    sources = [];
  let dimensions;
  const ctx = new Proxy(
    {
      scale() {},
      fillRect() {},
      fillText: (t) => labels.push(t),
      drawImage: (...args) => draws.push(args),
      measureText: () => ({ width: 100 }),
      createLinearGradient: () => ({ addColorStop() {} }),
    },
    { get: (o, k) => (k in o ? o[k] : () => {}) },
  );
  const canvas = {
    getContext: () => ctx,
    createImage: () => ({
      width: 640,
      height: 640,
      set src(v) {
        sources.push(v);
        this.onload();
      },
    }),
  };
  const page = {
    setData() {},
    createSelectorQuery() {
      return {
        select() {
          return this;
        },
        fields() {
          return this;
        },
        exec: (cb) => cb([{ node: canvas }]),
      };
    },
  };
  const sandbox = {
    module: { exports: {} },
    setTimeout,
    clearTimeout,
    require: (n) =>
      n === './badge-record-summary'
        ? require('../miniprogram/lib/badge-record-summary')
        : n === './airline-card-theme'
          ? require('../miniprogram/lib/airline-card-theme')
          : n === './airline-identity'
            ? require('../miniprogram/lib/airline-identity')
            : n === './names'
              ? { SHA: '上海虹桥', PEK: '北京首都' }
              : n.includes('canvas-memory')
                ? { releaseCanvas: () => {} }
                : { create: () => 'qr.png' },
    wx: {
      nextTick: (fn) => fn(),
      getFileSystemManager: () => ({ writeFileSync() {}, unlinkSync() {} }),
      canvasToTempFilePath: (o) => {
        dimensions = [o.destWidth, o.destHeight];
        o.success({ tempFilePath: 'poster.png' });
      },
    },
  };
  vm.runInNewContext(
    fs.readFileSync(
      path.join(__dirname, '../miniprogram/lib/collection-share-poster.js'),
      'utf8',
    ),
    sandbox,
  );
  const records = Array.from({ length: 13 }, (_, i) => ({
    date: '2026-01-' + String(i + 1).padStart(2, '0'),
    departureTime: '15:40',
    from: 'SHA',
    to: 'PEK',
    airline: 'CA',
    flight: 'CA' + i,
  }));
  await sandbox.module.exports.renderCollectionPoster(
    page,
    { kind: 'badge', badge: { name: 'B737', badge: 'badge.png' }, records },
    'qr',
  );
  assert(labels.includes('CA'));
  assert(labels.includes('12'));
  assert(!labels.includes('CA12'));
  assert(!sources.some((s) => s.includes('airline-art/logos')));
  assert(labels.includes('上海虹桥'));
  assert(labels.some((t) => String(t).includes('15:40')));
  assert.equal(dimensions[1], 3480);
  assert(draws.some((d) => d.at(-1) === 120 && d.at(-2) === 120));

  const badges = Array.from({ length: 22 }, (_, i) => ({
    id: 'badge-' + i,
    badge: 'badge.png',
    name: 'Model ' + i,
    count: i + 1,
    manufacturer: i < 10 ? 'Boeing' : i < 20 ? 'Airbus' : 'Other',
  }));
  const pages = await sandbox.module.exports.renderCollectionPoster(
    page,
    {
      kind: 'collection',
      badges,
      summary: {
        unlocked: 22,
        types: 22,
        flights: 253,
        makers: [
          { name: '波音', count: 55 },
          { name: '空客', count: 155 },
          { name: '其他', count: 43 },
        ],
      },
    },
    'qr',
  );
  assert.equal(pages, 'poster.png');
  assert(labels.includes('波音'));
  assert(labels.includes('空客'));
  assert(labels.includes('其他'));
  assert(labels.includes('22 次飞行'));
  assert(dimensions[1] < 8000);

  await sandbox.module.exports.renderCollectionPoster(page, {
    kind: 'badge',
    badge: { name: 'B737', badge: 'badge.png' },
    records: Array.from({ length: 100 }, () => records[0]),
  });
  assert(dimensions[0] * dimensions[1] <= 8000000);
  assert(dimensions[1] <= 12000);
});
