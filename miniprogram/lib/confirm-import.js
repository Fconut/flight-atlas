const { review } = require('./import-report');
const names = require('./names');
const { identity } = require('./record-model');
const pending = new Map();
let sequence = 0;
function readReview(token) { return pending.get(token)?.data; }
function decideReview(token, value) {
  const entry = pending.get(token);
  if (!entry) return;
  pending.delete(token);
  entry.finish(value);
}
function confirmImport(current, incoming, name) {
  const result = review(current, incoming);
  const selectable = [...result.groups.added, ...result.groups.updated];
  const ids = new Map(selectable.map((row, index) => [identity(row), index]));
  const groups = Object.fromEntries(Object.entries(result.groups).map(([key, rows]) => [key, rows.map(row => ({
    reviewId: key === 'duplicate' ? -1 : ids.get(identity(row)),
    date: row.date, from: row.from, to: row.to,
    fromName: names[row.from] || row.from, toName: names[row.to] || row.to,
    flight: [row.airline, row.flight].filter(Boolean).join(' '),
    aircraft: row.aircraft || '未填写机型', departureTime: row.departureTime || '', changes: row.changes
  }))]));
  return new Promise((resolve, reject) => {
    const token = Date.now().toString(36) + '-' + (++sequence);
    pending.set(token, {
      data: {
        name, groups, added: result.added, updated: result.updated, skipped: result.skipped,
        withinFile: Math.max(0, incoming.length - Object.values(groups).reduce((n, rows) => n + rows.length, 0))
      },
      finish(value) {
        if (!Array.isArray(value)) { resolve(false); return; }
        const chosen = new Set(value.filter(id => Number.isInteger(id) && id >= 0 && id < selectable.length));
        resolve({ rows: selectable.filter((row, index) => chosen.has(index)).map(({changes, ...row}) => row), returnOnError: () => wx.navigateBack() });
      }
    });
    wx.navigateTo({
      url: '/pages/import-review/index?token=' + token,
      fail: () => { pending.delete(token); reject(Error('核对页面未打开，请重试')); }
    });
  });
}
module.exports = { confirmImport, readReview, decideReview };
