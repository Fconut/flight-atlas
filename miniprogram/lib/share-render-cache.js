// Session-only and account-scoped; never persists user content to shared storage.
const version = 'approved-stamp-art-v2';
const entries = new Map();
function key(scope, snapshot) {
  return JSON.stringify([version, scope, snapshot]);
}
function get(scope, snapshot) {
  const id = key(scope, snapshot),
    entry = entries.get(id);
  if (!entry) return {};
  const valid = {};
  for (const [stage, path] of Object.entries(entry))
    try {
      wx.getFileSystemManager().accessSync(path);
      valid[stage] = path;
    } catch (_) {}
  entries.delete(id);
  entries.set(id, valid);
  return valid;
}
function put(scope, snapshot, values) {
  const id = key(scope, snapshot);
  const entry = { ...entries.get(id), ...values };
  entries.delete(id);
  entries.set(id, entry);
  while (entries.size > 4) entries.delete(entries.keys().next().value);
}
module.exports = { get, put, version };
