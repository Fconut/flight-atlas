const test = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('fs'),
  path = require('path'),
  vm = require('vm');
test('collection drawing waits for every required badge package', async () => {
  let page;
  vm.runInNewContext(
    fs.readFileSync(
      path.join(__dirname, '../miniprogram/pages/share-result/index.js'),
      'utf8',
    ),
    {
      Page: (p) => (page = p),
      require: () => ({}),
      setTimeout,
      clearTimeout,
      wx: { nextTick: (fn) => fn() },
    },
  );
  page.setData = function (d) {
    Object.assign(this.data, d);
  };
  let complete = false;
  const pending = page
    .ensureAssets({
      kind: 'collection',
      badges: [
        { package: 'badges0', badge: 'a' },
        { package: 'badges1', badge: 'b' },
        { package: 'badges0', badge: 'c' },
      ],
    })
    .then(() => (complete = true));
  assert.equal(page.data.assetLoaders.length, 2);
  page.assetLoaded({ currentTarget: { dataset: { package: 'badges0' } } });
  await Promise.resolve();
  assert.equal(complete, false);
  page.assetLoaded({ currentTarget: { dataset: { package: 'badges1' } } });
  await pending;
  assert.equal(complete, true);
  assert.equal(page.assetsReady, true);
});
test('image posters require a code for the exact snapshot and never fall back to a code-free card', async () => {
  let page,
    fail = false,
    request;
  vm.runInNewContext(
    fs.readFileSync(
      path.join(__dirname, '../miniprogram/pages/share-result/index.js'),
      'utf8',
    ),
    {
      Page: (p) => (page = p),
      wx: {},
      require: (n) =>
        n.includes('share-render-cache')
          ? { get: () => ({}), put() {} }
          : n.includes('account-state')
            ? { activeScope: () => 'owner' }
            : n.includes('share-api')
              ? {
                  callShare: async (action, data) => {
                    request = { action, ...data };
                    if (fail) throw Error('code unavailable');
                    return { image: 'qr-base64' };
                  },
                }
              : n.includes('collection-share-poster')
                ? {
                    renderCollectionPoster: async (p, s, code) => {
                      assert.equal(code, 'qr-base64');
                      return 'poster-with-code.png';
                    },
                  }
                : {},
    },
  );
  page.setData = function (d) {
    Object.assign(this.data, d);
  };
  page.data = { cardPath: 'card.png' };
  page.payload = {
    scope: 'owner',
    id: 'fixed-id',
    snapshot: { kind: 'badge' },
  };
  await page.prepareImage();
  assert.equal(request.action, 'code');
  assert.equal(request.id, 'fixed-id');
  assert.equal(page.data.posterPath, 'poster-with-code.png');
  page.data.posterPath = '';
  page.code = null;
  fail = true;
  await page.prepareImage();
  assert.equal(page.data.posterPath, '');
  assert.equal(page.data.imageLoading, false);
  assert.match(page.data.message, /code unavailable/);
});
for (const kind of ['badge', 'collection'])
  test(
    kind +
      ' preview reuses its fixed snapshot and exposes both sharing formats',
    async () => {
      let page,
        receive,
        renderCount = 0,
        sent;
      const media = async () => {
          renderCount++;
          return 'card.png';
        },
        wx = { showShareImageMenu: (o) => (sent = o.path) };
      vm.runInNewContext(
        fs.readFileSync(
          path.join(__dirname, '../miniprogram/pages/share-result/index.js'),
          'utf8',
        ),
        {
          Page: (p) => (page = p),
          wx,
          require: (n) =>
            n.includes('share-render-cache')
              ? { get: () => ({}), put() {} }
              : n.includes('account-state')
                ? { activeScope: () => 'owner' }
                : {
                    renderBadgeCard: media,
                    renderCollectionCard: media,
                    renderCollectionPoster: media,
                  },
        },
      );
      page.setData = function (d) {
        Object.assign(this.data, d);
      };
      page.ensureAssets = async () => {};
      page.getOpenerEventChannel = () => ({ on: (name, fn) => (receive = fn) });
      page.onLoad();
      receive({
        scope: 'owner',
        id: 'fixed-id',
        snapshot: {
          kind,
          badge: { name: 'B737' },
          records: [],
          summary: { unlocked: 4 },
        },
      });
      await new Promise((resolve) => setImmediate(resolve));
      assert.equal(page.data.cardPath, 'card.png');
      assert.equal(renderCount, 2);
      page.data.ready = true;
      assert.equal(
        page.onShareAppMessage().path,
        '/pages/' +
          (kind === 'badge' ? 'badge-share' : 'collection-share') +
          '/index?id=fixed-id',
      );
      page.data.posterPath = 'poster.png';
      page.shareImage();
      assert.equal(sent, 'poster.png');
      page.data.plainPath = 'private-preview.png';
      page.payload.scope = 'other';
      page.onShow();
      assert.equal(page.data.plainPath, '');
      assert.equal(page.data.ready, false);
      assert.equal(page.data.cardPath, '');
      assert.equal(page.payload, null);
    },
  );
