const catalog = require('./collection-catalog');
const account = require('./account-state');
const local = require('./local-state');
const checkinStore = require('./checkin-store');
const checkinRewards = require('./checkin-rewards');
function rewardSources(scope) {
  const grants = (checkinStore.read(scope)?.state.grants || []).filter(g=>g.type==='palette');
  const used = new Set(grants.map((g) => g.itemId));
  const byDay = new Map(grants.map((g) => [g.day, g]));
  const remaining = checkinRewards.filter((r) => !used.has(r.itemId));
  return new Map(
    checkinRewards.map((r) => {
      const grant = byDay.get(r.day);
      return [(grant || remaining.shift()).itemId, r.day];
    }),
  );
}
const CAPACITY = 6;
const byId = new Map(catalog.items.map((item) => [item.id, item]));
const bySeries = new Map(
  catalog.series.map((series) => [
    series.id,
    catalog.items.filter((item) => item.seriesId === series.id),
  ]),
);
function owned(item) {
  return !!item && (item.free || checkinStore.paletteIds().has(item.id));
}
function snapshot() {
  const scope = account.activeScope();
  const unlocked = checkinStore.paletteIds(scope);
  const rewardDays = rewardSources(scope);
  const isOwned = (item) => !!item && (item.free || unlocked.has(item.id));
  const colors = local.read(scope).prefs.colors || {
    background: '#101c2a',
    route: '#e8bf79',
  };
  const saved = wx.getStorageSync(scope + '-poster-palettes');
  const values = Array.isArray(saved)
    ? saved
    : catalog.items.filter((item) => item.free).map((item) => item.id);
  const current = catalog.items.find(
    (item) =>
      isOwned(item) &&
      item.colors.background === colors.background &&
      item.colors.route === colors.route,
  );
  const selected = new Set(values.filter((id) => isOwned(byId.get(id))));
  if (current) selected.add(current.id);
  if (selected.size > CAPACITY) {
    const keep = [...selected].filter((id) => id !== current?.id)
      .slice(0, CAPACITY - (current ? 1 : 0));
    selected.clear();
    keep.forEach((id) => selected.add(id));
    if (current) selected.add(current.id);
    // Only the poster shortlist changes; ownership and active colors are retained.
    wx.setStorageSync(scope + '-poster-palettes', [...selected]);
  }
  const decorate = (item) => ({
    ...item,
    previewPackage: item.previewAsset.package,
    previewPath: item.previewAsset.path,
    source: item.free
      ? '来源：免费配色'
      : rewardDays.has(item.id)
        ? '来源：累计签到 ' + rewardDays.get(item.id) + ' 天奖励'
        : '获取方式待开放',
    owned: isOwned(item),
    included: selected.has(item.id),
    active: current?.id === item.id,
    full: selected.size >= CAPACITY,
  });
  return { scope, selected, activeId: current?.id, decorate, isOwned };
}
function active(item) {
  return !!item && snapshot().activeId === item.id;
}
function candidates() {
  const state = snapshot();
  return catalog.items.filter((item) => state.selected.has(item.id));
}
function includes(id) {
  return snapshot().selected.has(id);
}
function setIncluded(id, included) {
  const item = byId.get(id);
  const state = snapshot();
  if (!state.isOwned(item)) throw Error('这款配色尚未解锁');
  const selected = state.selected;
  if (!included && state.activeId === id)
    throw Error('请先在首页切换配色，再移除这款配色');
  if (included && !selected.has(id) && selected.size >= CAPACITY)
    throw Error('海报配色最多添加' + CAPACITY + '款，请先移除一款');
  if (selected.has(id) === !!included) return item;
  if (included) selected.add(id);
  else selected.delete(id);
  wx.setStorageSync(state.scope + '-poster-palettes', [...selected]);
  return item;
}
function series(filter = 'all') {
  const unlocked = checkinStore.paletteIds(),
    has = (item) => item.free || unlocked.has(item.id);
  return catalog.series
    .map((series) => {
      const members = bySeries.get(series.id),
        count = members.filter(has).length;
      return {
        ...series,
        ownedCount: count,
        total: members.length,
        cover: members[0],
        locked: count === 0,
      };
    })
    .filter((series) => filter !== 'owned' || series.ownedCount > 0);
}
function members(id, filter = 'all') {
  const unlocked = filter === 'owned' ? checkinStore.paletteIds() : null;
  return (bySeries.get(id) || []).filter(
    (item) => filter !== 'owned' || item.free || unlocked.has(item.id),
  );
}
function item(id) {
  return byId.get(id);
}
module.exports = {
  catalog,
  rewardPlan: () =>
    [...rewardSources(account.activeScope())].map(([itemId, day]) => ({
      itemId,
      day,
    })),
  owned,
  candidates,
  includes,
  setIncluded,
  active,
  CAPACITY,
  snapshot,
  series,
  members,
  item,
  ownedItems() {
    const unlocked = checkinStore.paletteIds();
    return catalog.items.filter((item) => item.free || unlocked.has(item.id));
  },
};
