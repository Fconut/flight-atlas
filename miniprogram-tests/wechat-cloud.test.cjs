const test = require("node:test"),
  assert = require("node:assert/strict");
const config = require("../miniprogram/lib/cloud-config");
const state = require("../miniprogram/lib/account-state");
const backup = require("../miniprogram/lib/backup");
const { createHandler } = require("../cloudfunctions/atlas-account/service");
const row = {
  date: "2025-01-01",
  from: "SHA",
  to: "NRT",
  airline: "MU",
  flight: "1",
};
const clone = (value) => JSON.parse(JSON.stringify(value));
function storageContext(storage = {}) {
  global.wx = {
    getStorageSync: (k) => storage[k],
    setStorageSync: (k, v) => (storage[k] = clone(v)),
    removeStorageSync: (k) => delete storage[k],
    getStorageInfoSync: () => ({ keys: Object.keys(storage) }),
    nextTick() {},
  };
  return storage;
}
function client(callFunction) {
  const storage = storageContext();
  wx.cloud = { init() {}, callFunction };
  delete require.cache[require.resolve("../miniprogram/lib/cloud")];
  return { cloud: require("../miniprogram/lib/cloud"), storage };
}
test("legacy local partition and records survive while old credentials are retired", () => {
  const old = { version: 1, rows: [row], prefs: { fileName: "old.csv" } },
    storage = storageContext({
      "atlas-mini-session": {
        user: { id: "legacy-A" },
        access_token: "old-token",
      },
      "atlas-mini-user:legacy-A-state": clone(old),
      "atlas-mini-user:legacy-A-cloud-recovery": { version: 1 },
      "atlas-mini-guest-state": {
        version: 1,
        rows: [{ ...row, flight: "2" }],
        prefs: {},
      },
    });
  assert.equal(state.scopeFor(null), "atlas-mini-user:legacy-A");
  assert.equal(storage["atlas-mini-session"], undefined);
  assert.deepEqual(storage["atlas-mini-user:legacy-A-state"], old);
  assert.equal(storage['atlas-mini-guest-state'].rows.length,1);
  const session = {
    provider: "wechat-cloudbase",
    env: config.env,
    user: { id: "a".repeat(64) },
  };
  storage[state.SESSION_KEY] = session;
  assert(state.activeScope().includes(config.env));
  delete storage[state.SESSION_KEY];
  assert.equal(state.activeScope(), "atlas-mini-user:legacy-A");
});
test("client uses only cloud functions and cannot revive a canceled connection", async () => {
  let resolve;
  const { cloud, storage } = client(() => new Promise((r) => (resolve = r)));
  const pending = cloud.login();
  await cloud.signout();
  resolve({ result: { ok: true, userId: "a".repeat(64) } });
  await assert.rejects(pending, /失效/);
  assert.equal(storage[state.SESSION_KEY], undefined);
  assert.equal(await cloud.current(), null);
});
test("client verifies returned ownership and exposes conflict without retrying", async () => {
  const calls = [];
  let conflict = false,
    other = false;
  const { cloud } = client(async (options) => {
    calls.push(options);
    return {
      result:
        options.data.action === "identity"
          ? { ok: true, userId: "a".repeat(64) }
          : conflict
            ? { ok: false, code: "40001", message: "conflict" }
            : {
                ok: true,
                userId: (other ? "b" : "a").repeat(64),
                record: null,
              },
    };
  });
  await cloud.login();
  assert.equal(await cloud.fetchDraft(), null);
  conflict = true;
  await assert.rejects(cloud.saveDraft({}, 0), (e) => e.code === "40001");
  assert.equal(calls.filter((c) => c.data.action === "save").length, 1);
  assert(calls.every((c) => c.config.env === config.env));
  conflict = false;
  other = true;
  await assert.rejects(cloud.fetchDraft(), /微信账号已切换/);
});
test("backend derives identity from trusted context, isolates users and enforces compare-and-swap", async () => {
  let context = { APPID: config.appId, OPENID: "openid-A" },
    tail = Promise.resolve();
  const docs = new Map();
  const db = {
    collection: () => ({
      doc: (id) => ({
        get: async () => ({ data: docs.has(id) ? clone(docs.get(id)) : null }),
        set: async ({ data }) => docs.set(id, clone(data)),
      }),
    }),
  };
  db.runTransaction = (fn) => {
    const task = tail.then(() => fn(db));
    tail = task.catch(() => {});
    return task;
  };
  const handler = createHandler({
    getIdentity: () => context,
    database: () => db,
    backupEnabled: () => true,
  });
  const draft = backup.snapshot({ rows: [row], theme: "navy", labels: true });
  const alice = (await handler({ action: "identity" })).userId;
  assert.equal(alice.length, 64);
  assert.equal(
    (await handler({ action: "save", draft, expectedRevision: 0 })).revision,
    1,
  );
  const results = await Promise.all([
    handler({ action: "save", draft, expectedRevision: 1 }),
    handler({ action: "save", draft, expectedRevision: 1 }),
  ]);
  assert.equal(results.filter((r) => r.ok).length, 1);
  assert.equal(results.find((r) => !r.ok).code, "40001");
  context = { APPID: config.appId, OPENID: "openid-B" };
  assert.equal(
    (await handler({ action: "fetch", userId: alice, OPENID: "openid-A" }))
      .record,
    null,
  );
  await handler({ action: "save", draft, expectedRevision: 0, userId: alice });
  assert.equal(docs.size, 2);
  context = { APPID: "other-app", OPENID: "openid-A" };
  assert.equal((await handler({ action: "fetch" })).code, "UNAUTHORIZED");
});
test("backup remains disabled until server-only database permissions are configured", async () => {
  let accessed = false;
  const handler = createHandler({
    getIdentity: () => ({ APPID: config.appId, OPENID: "openid-A" }),
    database: () => {
      accessed = true;
    },
    backupEnabled: () => false,
  });
  assert((await handler({ action: "identity" })).ok);
  assert.equal(
    (await handler({ action: "save", draft: {}, expectedRevision: 0 })).code,
    "SETUP_REQUIRED",
  );
  assert.equal(accessed, false);
});

test('cached-session checks reuse an in-flight login identity request',async()=>{let release,calls=0;const {cloud,storage}=client(()=>{calls++;return new Promise(r=>release=r)});storage[state.SESSION_KEY]={provider:'wechat-cloudbase',env:config.env,user:{id:'a'.repeat(64)}};const login=cloud.login(),current=cloud.current();assert.equal(calls,1);release({result:{ok:true,userId:'a'.repeat(64)}});assert.equal((await login).user.id,'a'.repeat(64));assert.equal((await current).user.id,'a'.repeat(64));assert.equal(calls,1)});
