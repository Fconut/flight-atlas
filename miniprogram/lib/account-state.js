const config = require("./cloud-config");
const SESSION_KEY = "atlas-mini-wechat-session";
const LOCAL_KEY = "atlas-mini-local-scope";
const guest = "atlas-mini-guest";
const legacyScope = (value) =>
  typeof value === "string" && /^atlas-mini-user:[A-Za-z0-9_-]+$/.test(value);
function initialize() {
  let scope = wx.getStorageSync(LOCAL_KEY);
  const old = wx.getStorageSync("atlas-mini-session");
  if (scope !== guest && !legacyScope(scope)) {
    scope =
      old?.user?.id && /^[A-Za-z0-9_-]+$/.test(old.user.id)
        ? "atlas-mini-user:" + old.user.id
        : guest;
    wx.setStorageSync(LOCAL_KEY, scope);
  }
  // Preserve records/settings; remove obsolete credentials only after recording their partition.
  if (old) wx.removeStorageSync?.("atlas-mini-session");
  return scope;
}
function cached() {
  const value = wx.getStorageSync(SESSION_KEY);
  return value?.provider === "wechat-cloudbase" &&
    value.env === config.env &&
    typeof value.user?.id === "string" &&
    /^[a-f0-9]{64}$/.test(value.user.id)
    ? value
    : null;
}
function scopeFor(session) {
  return session
    ? "atlas-mini-wechat:" + config.env + ":" + session.user.id
    : initialize();
}
function activeScope() {
  return scopeFor(cached());
}
module.exports = {
  SESSION_KEY,
  cached,
  initialize,
  scopeFor,
  activeScope,
};
