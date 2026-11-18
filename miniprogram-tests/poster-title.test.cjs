const test = require('node:test'),
  assert = require('node:assert/strict');
const title = require('../miniprogram/lib/poster-title');
const rows = [
  {
    _id: 'one',
    date: '2025-01-01',
    from: 'SHA',
    to: 'PEK',
    airline: 'CA',
    flight: '1',
  },
];
test('poster title preserves Unicode, limits length and restores blank or old settings to the default', () => {
  assert.equal(title.normalize(undefined), '我的足迹');
  assert.equal(title.normalize({}), '我的足迹');
  assert.equal(title.normalize(' \n '), '我的足迹');
  assert.equal(title.normalize(' 山海\n 之间 '), '山海 之间');
  assert.equal(Array.from(title.normalize('✈'.repeat(30))).length, 20);
  assert.equal(title.normalize('旅行 🚀'), '旅行 🚀');
});
test('title changes participate in backup identity, account restore and independent field merges', () => {
  const draft = require('../miniprogram/lib/draft-state'),
    { mergeDrafts } = require('../miniprogram/lib/merge-drafts');
  const base = draft.snapshot({ rows, prefs: {} }),
    local = draft.snapshot({ rows, prefs: { posterTitle: '山海之间' } }),
    remote = draft.snapshot({
      rows: [
        ...rows,
        { ...rows[0], _id: 'two', date: '2025-02-01', flight: '2' },
      ],
      prefs: {},
    });
  assert.notEqual(draft.key(base), draft.key(local));
  assert.equal(draft.localState(local).prefs.posterTitle, '山海之间');
  const merged = mergeDrafts(base, local, remote);
  assert.equal(merged.posterTitle, '山海之间');
  assert.equal(draft.localState(merged).rows.length, 2);
  const old = { ...base };
  delete old.posterTitle;
  assert.equal(draft.key(old), draft.key(base));
  assert.equal(draft.localState(old).prefs.posterTitle, title.DEFAULT);
  assert.equal(mergeDrafts(local, base, local).posterTitle, title.DEFAULT);
});
test('both default and custom statistic layouts render the chosen title; map-only mode hides it', () => {
  const { calculate } = require('../miniprogram/lib/flights'),
    d = calculate(
      rows,
      require('../miniprogram/lib/airports'),
      '2026-11-14',
      false,
    ),
    { posterDimensions, renderPoster } = require('../miniprogram/lib/poster');
  for (const selection of [null, ['flights'], []]) {
    const text = [];
    const ctx = new Proxy(
      {
        fillText: (value) => text.push(value),
        measureText: (value) => ({ width: String(value).length * 14 }),
        createRadialGradient: () => ({ addColorStop() {} }),
        createLinearGradient: () => ({ addColorStop() {} }),
      },
      { get: (o, k) => (k in o ? o[k] : () => {}) },
    );
    const options = { posterContent: selection, posterTitle: '山海之间' },
      dimensions = posterDimensions(d, 1080, options),
      canvas = {
        width: 1080,
        height: dimensions.height,
        getContext: () => ctx,
      };
    renderPoster(canvas, d, options, dimensions);
    assert.equal(
      text.join('').includes('山海之间'),
      selection === null || selection.length > 0,
    );
    assert.equal(canvas.height, dimensions.height);
  }
});
test('title settings save immediately, recover from write failure and reset with default content', () => {
  const previous = global.wx,
    store = new Map();
  global.wx = {
    getStorageSync: (key) => store.get(key),
    setStorageSync: (key, value) => store.set(key, value),
  };
  try {
    const p = require('../miniprogram/pages/index/logic/create-page')('map');
    p.localKey = 'title-user';
    p.setData = function (data) {
      Object.assign(this.data, data);
    };
    p.updateCloudStatus = () => {};
    p.updateAppearance = () => {};
    p.posterTitleInput({ detail: { value: '山海之间' } });
    assert.equal(
      require('../miniprogram/lib/local-state').read(p.localKey).prefs
        .posterTitle,
      '山海之间',
    );
    assert.equal(p.data.posterTitleLength, 4);
    wx.setStorageSync = () => {
      throw Error('full');
    };
    p.posterTitleInput({ detail: { value: '不能保存' } });
    assert.equal(p.data.posterTitle, '山海之间');
    assert.equal(p.data.posterTitleDraft, '山海之间');
    assert(p.data.posterTitleError);
    wx.setStorageSync = (key, value) => store.set(key, value);
    p.resetPosterContent();
    assert.equal(p.data.posterTitle, title.DEFAULT);
    assert.equal(p.data.posterTitleDraft, title.DEFAULT);
    assert.equal(p.data.posterContent, null);
  } finally {
    global.wx = previous;
  }
});
test('new shares freeze the custom title and old shares default safely', () => {
  const draft = require('../miniprogram/lib/draft-state').snapshot({
      rows,
      prefs: { posterTitle: '去看世界' },
    }),
    client = require('../miniprogram/lib/share-snapshot'),
    server = require('../cloudfunctions/atlas-share/domain/share-snapshot');
  const a = client.buildSnapshot(draft, '2026-11-14');
  assert.deepEqual(a, server.buildSnapshot(draft, '2026-11-14'));
  assert.equal(a.options.posterTitle, '去看世界');
  draft.posterTitle = '新的标题';
  assert.equal(a.options.posterTitle, '去看世界');
  assert.equal(
    client.buildSnapshot({ ...draft, posterTitle: undefined }, '2026-11-14')
      .options.posterTitle,
    title.DEFAULT,
  );
});
