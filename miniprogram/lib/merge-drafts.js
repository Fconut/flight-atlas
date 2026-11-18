const backup = require('./backup');
const { identity } = require('./record-model');
const { normalizeRows } = require('./normalize-rows');
const stable = (value) =>
  JSON.stringify(
    value && typeof value === 'object' && !Array.isArray(value)
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, value[key]]),
        )
      : value,
  );
const same = (a, b) => stable(a) === stable(b);
const business = (row) =>
  row
    ? Object.fromEntries(
        Object.entries(row).filter(([key]) => !['_id', '_line'].includes(key)),
      )
    : undefined;
const sameRow = (a, b) => same(business(a), business(b));
function choose(base, local, remote) {
  if (same(local, base)) return remote;
  if (same(remote, base) || same(local, remote)) return local;
  return local === undefined || local === '' ? remote : local;
}
// Three-way merge preserves independent edits, including deletions. An edit
// concurrent with a deletion retains the edited record rather than losing it.
function mergeDrafts(base, local, remote) {
  const baseRows = base ? backup.rows(base) : [],
    byId = new Map(),
    byIdentity = new Map();
  baseRows.forEach((row) => {
    const key = row._id ? 'id:' + row._id : 'flight:' + identity(row);
    if (row._id) byId.set(row._id, key);
    byIdentity.set(identity(row), key);
  });
  const index = (draft) =>
    new Map(
      (draft ? backup.rows(draft) : []).map((row) => [
        byId.get(row._id) ||
          byIdentity.get(identity(row)) ||
          'flight:' + identity(row),
        row,
      ]),
    );
  const bases = index(base),
    locals = index(local),
    remotes = index(remote),
    rows = [];
  for (const key of new Set([
    ...bases.keys(),
    ...locals.keys(),
    ...remotes.keys(),
  ])) {
    const b = bases.get(key),
      l = locals.get(key),
      r = remotes.get(key);
    let row;
    if (sameRow(l, b)) row = r;
    else if (sameRow(r, b) || sameRow(l, r)) row = l;
    else if (!l || !r) row = l || r;
    else
      row = Object.fromEntries(
        [
          ...new Set([
            ...Object.keys(b || {}),
            ...Object.keys(l),
            ...Object.keys(r),
          ]),
        ]
          .filter((field) => !['_id', '_line'].includes(field))
          .map((field) => [field, choose(b?.[field], l[field], r[field])])
          .filter(([, value]) => value !== undefined),
      );
    if (row) rows.push({ ...row, _id: r?._id || l?._id || b?._id });
  }
  const result = backup.snapshot({ rows: normalizeRows(rows), labels: true });
  for (const field of [
    'colors',
    'labelSelection',
    'includeFuture',
    'fileName',
    'posterContent',
    'posterTitle',
    'posterStamp',
  ])
    result[field] =
      choose(base?.[field], local?.[field], remote?.[field]) ?? result[field];
  return result;
}
module.exports = { mergeDrafts };
