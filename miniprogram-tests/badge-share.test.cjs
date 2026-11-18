const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildBadgeSnapshot } = require('../miniprogram/lib/badge-share');
test('badge card failures release the canvas and allow retry instead of publishing a substitute badge', async () => {
  const fs = require('fs'),
    vm = require('vm');
  const code = fs.readFileSync(
    require('path').join(__dirname, '../miniprogram/lib/badge-share-media.js'),
    'utf8',
  );
  let fail = true,
    exportsCount = 0;
  const ctx = { fillRect() {}, fillText() {}, drawImage() {} };
  const canvas = {
    getContext: () => ctx,
    createImage() {
      return {
        width: 100,
        height: 100,
        set src(value) {
          if (fail) this.onerror();
          else this.onload();
        },
      };
    },
  };
  const page = {
    data: {},
    setData(data) {
      Object.assign(this.data, data);
    },
    createSelectorQuery() {
      return {
        select() {
          return this;
        },
        fields() {
          return this;
        },
        exec(cb) {
          cb([{ node: canvas }]);
        },
      };
    },
  };
  const sandbox = {
    module: { exports: {} },
    require: (n) =>
      n.includes('badge-record-summary')
        ? require('../miniprogram/lib/badge-record-summary')
        : {
            releaseCanvas(node) {
              if (node) {
                node.width = 1;
                node.height = 1;
              }
            },
          },
    setTimeout,
    clearTimeout,
    wx: {
      nextTick: (fn) => fn(),
      canvasToTempFilePath(o) {
        exportsCount++;
        o.success({ tempFilePath: 'card.png' });
      },
    },
  };
  vm.runInNewContext(code, sandbox);
  const render = sandbox.module.exports.renderBadgeCard;
  await assert.rejects(
    render(page, { name: 'B737', badge: 'badge.png' }, []),
    /加载失败/,
  );
  assert.equal(page.data.rendering, false);
  assert.equal(canvas.width, 1);
  assert.equal(exportsCount, 0);
  fail = false;
  assert.equal(
    await render(page, { name: 'B737', badge: 'badge.png' }, []),
    'card.png',
  );
  assert.equal(exportsCount, 1);
  assert.equal(canvas.width, 1);
  assert.equal(page.data.rendering, false);
});
test('changing badge selection clears a prepared share and counts selected records', () => {
  const fs = require('fs'),
    vm = require('vm');
  let page;
  vm.runInNewContext(
    fs.readFileSync(
      require('path').join(
        __dirname,
        '../miniprogram/pages/badge-share/index.js',
      ),
      'utf8',
    ),
    {
      require: (n) =>
        n.includes('badge-record-summary')
          ? require('../miniprogram/lib/badge-record-summary')
          : n.includes('airline-card-theme')
            ? require('../miniprogram/lib/airline-card-theme')
            : {},
      Page: (value) => (page = value),
    },
  );
  page.data = {
    records: [
      { index: 0, selected: true, date: '2025-01-01', airline: 'MU' },
      { index: 1, selected: true, date: '2025-02-01', airline: 'LH' },
    ],
    selectedCount: 2,
    ready: true,
    cardPath: 'old',
    message: 'old',
  };
  page.setData = function (data) {
    Object.assign(this.data, data);
  };
  page.shareId = 'old';
  page.selectAll();
  assert.equal(page.data.selectedCount, 0);
  assert.equal(page.data.ready, false);
  assert.equal(page.shareId, null);
  assert.equal(page.data.cardPath, '');
  page.selectAll();
  assert.equal(page.data.selectedCount, 2);
  assert.equal(page.data.firstDate, '2025-01-01');
  assert.deepEqual(
    page.data.records[0].cardTheme,
    require('../miniprogram/lib/airline-card-theme').airlineCardTheme('MU'),
  );
  page.toggle({ currentTarget: { dataset: { index: 0 } } });
  assert.equal(page.data.selectedCount, 1);
  assert.equal(page.data.firstDate, '2025-02-01');
  page.data.busy = true;
  page.selectAll();
  assert.equal(page.data.selectedCount, 1);
  page.public = true;
  page.data.busy = false;
  page.toggle({ currentTarget: { dataset: { index: 1 } } });
  assert.equal(page.data.selectedCount, 1);
});
test('badge sharing publishes only selected historical records and explicit public fields', () => {
  const rows = [
    {
      date: '2024-01-02',
      from: 'PEK',
      to: 'SHA',
      aircraft: 'BOEING 737-800',
      airline: 'CA',
      flight: '123',
      secret: 'private',
    },
    {
      date: '2024-01-01',
      from: 'SHA',
      to: 'PEK',
      aircraft: 'BOEING 737-800',
      flight: '456',
    },
    { date: '2099-01-01', from: 'PEK', to: 'SHA', aircraft: 'BOEING 737-800' },
  ];
  const s = buildBadgeSnapshot({ rows }, '2026-11-07', 'b737-800', [0]);
  assert.equal(s.kind, 'badge');
  assert.equal(s.records.length, 1);
  assert.equal(s.records[0].date, '2024-01-02');
  assert.equal(s.records[0].flight, '123');
  assert.equal(s.records[0].secret, undefined);
  assert.throws(() =>
    buildBadgeSnapshot({ rows }, '2026-11-07', 'b737-800', []),
  );
  assert.throws(() =>
    buildBadgeSnapshot({ rows }, '2026-11-07', 'b737-800', [2]),
  );
  assert.throws(() =>
    buildBadgeSnapshot({ rows }, '2026-11-07', 'a380-800', [0]),
  );
});
