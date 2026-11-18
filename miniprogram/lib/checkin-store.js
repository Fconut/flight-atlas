const account = require('./account-state');
const cache = new Map();
function scope() {
  return account.activeScope();
}
function read(key = scope()) {
  if (cache.has(key)) return cache.get(key);
  const value = wx.getStorageSync(key + '-checkin');
  const entry =
    value?.version === 1 && Array.isArray(value.state?.grants) ? value : null;
  cache.set(key, entry);
  while (cache.size > 2) cache.delete(cache.keys().next().value);
  return entry;
}
function save(key, state) {
  const current = read(key);
  if (current && (current.state.revision || 0) > (state.revision || 0))
    return current.state;
  const entry = { version: 1, fetchedAt: Date.now(), state };
  wx.setStorageSync(key + '-checkin', entry);
  cache.set(key, entry);
  return state;
}
function paletteIds(key = scope()) {
  return new Set(
    (read(key)?.state.grants || [])
      .filter((g) => g.type === 'palette')
      .map((g) => g.itemId),
  );
}
function stampIds(key = scope()) {
 return new Set((read(key)?.state.grants || []).filter(g=>g.type==='stamp').map(g=>g.itemId));
}
module.exports = { read, save, paletteIds, stampIds, scope };
