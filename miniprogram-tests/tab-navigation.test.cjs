const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const root = "../miniprogram/";
const create = require(root + "pages/index/logic/create-page");
function setup() {
  const storage = {};
  global.wx = {
    getStorageSync: (k) => storage[k],
    setStorageSync: (k, v) => (storage[k] = JSON.parse(JSON.stringify(v))),
    nextTick() {},
  };
  const page = (view) => {
    const p = create(view);
    p.setData = (values) =>
      Object.assign(p.data, JSON.parse(JSON.stringify(values)));
    p.localKey = "atlas-mini-guest";
    return p;
  };
  return { storage, page };
}
const row = {
  date: "2025-01-01",
  from: "SHA",
  to: "NRT",
  airline: "MU",
  flight: "1",
  aircraft: "Airbus A320",
};
test("native tab destinations have independent state and valid local icons", () => {
  const app = require(root + "app.json");
  assert.equal(app.tabBar.list.length, 4);
  for (const item of app.tabBar.list) {
    assert(app.pages.includes(item.pagePath));
    for (const key of ["iconPath", "selectedIconPath"])
      assert(fs.existsSync(require("path").join(__dirname, root, item[key])));
  }
  const { page } = setup(),
    map = page("map"),
    records = page("records");
  map.data.setting = "colors";
  records.data.search = "MU";
  assert.equal(map.data.search, "");
  assert.equal(records.data.setting, "data");
  let url;
  wx.switchTab = (o) => (url = o.url);
  map.nav({ currentTarget: { dataset: { key: "records" } } });
  assert.equal(url, "/pages/records/index");
  assert.equal(map.data.view, "map");
});
test("cross-tab edits and preferences refresh without resetting filters or unchanged map", () => {
  const { page } = setup(),
    map = page("map"),
    records = page("records"),
    fleet = page("fleet");
  map.load([]);
  records.load([]);
  fleet.load([]);
  records.data.search = "MU";
  records.data.filters = { airline: "MU" };
  map.load([row]);
  records.syncTabState();
  fleet.syncTabState();
  assert.equal(records.data.rows.length, 1);
  assert.equal(records.data.search, "MU");
  assert.deepEqual(records.data.filters, { airline: "MU" });
  assert.equal(fleet.data.fleetRecordedFlights, 1);
  records.data.future = true;
  records.savePreferences();
  map.syncTabState();
  assert.equal(map.data.future, true);
  let loads = 0;
  map.load = () => loads++;
  map.syncTabState();
  assert.equal(loads, 0);
  records.load([]);
  fleet.syncTabState();
  assert.equal(fleet.data.rows.length, 0);
});
test("account changes cannot expose previous account rows or filters on another tab", async () => {
  const { page, storage } = setup(),
    map = page("map"),
    records = page("records");
  map.load([row]);
  records.load([row]);
  records.data.search = "MU";
  storage["atlas-mini-wechat-session"] = { provider:"wechat-cloudbase",env:"cloud1-d5g931htr9ee8f18c",user:{id:"a".repeat(64)} };
  await map.switchAccount(storage["atlas-mini-wechat-session"]);
  records.syncTabState();
  assert.equal(records.localKey, "atlas-mini-wechat:cloud1-d5g931htr9ee8f18c:"+"a".repeat(64));
  assert.equal(records.data.rows.length, 0);
  assert.equal(records.data.search, "");
  storage["atlas-mini-wechat-session"] = null;
  records.syncTabState();
  assert.equal(records.localKey, "atlas-mini-guest");
  assert.equal(records.data.rows.length, 1);
});
