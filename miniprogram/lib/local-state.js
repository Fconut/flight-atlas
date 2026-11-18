"use strict";
const revisions = new Map();
const listeners = new Set();
const revision = (scope) => revisions.get(scope) || 0;
const missing = (value) =>
  value === undefined || value === null || value === "";
const object = (value) =>
  value && typeof value === "object" && !Array.isArray(value);
const validRows = (rows) =>
  Array.isArray(rows) && rows.every((row) => object(row));
function read(scope) {
  const value = wx.getStorageSync(scope + "-state");
  if (!missing(value)) {
    if (value.version !== 1 || !validRows(value.rows) || !object(value.prefs))
      throw Error("本机记录格式异常，已停止读取；原数据未改动，请勿清除缓存。");
    return value;
  }
  const rows = wx.getStorageSync(scope),
    prefs = wx.getStorageSync(scope + "-prefs");
  if (!missing(rows) && !validRows(rows))
    throw Error("旧版本本机记录格式异常，原数据未改动。");
  if (!missing(prefs) && !object(prefs))
    throw Error("本机设置格式异常，原设置未改动。");
  return {
    version: 1,
    rows: missing(rows) ? [] : rows,
    prefs: missing(prefs) ? {} : prefs,
  };
}
function write(scope, rows, prefs, origin = "user") {
  if (!validRows(rows) || !object(prefs)) throw Error("无法保存无效记录或设置");
  const value = { version: 1, rows, prefs };
  wx.setStorageSync(scope + "-state", value);
  revisions.set(scope, revision(scope) + 1);
  for (const listener of listeners)
    Promise.resolve()
      .then(() => listener({ scope, origin }))
      .catch(() => {});
  return value;
}
function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
module.exports = { read, write, revision, subscribe };
