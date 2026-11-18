'use strict';
function backupContentKey(snapshot) {
  const clean = (value) =>
    Array.isArray(value)
      ? value.map(clean)
      : value && typeof value === 'object'
        ? Object.fromEntries(
            Object.keys(value)
              .filter((k) => !['_id', '_line'].includes(k))
              .sort()
              .map((k) => [k, clean(value[k])])
          )
        : value;
  const rows = (
    snapshot.sheets?.length ? snapshot.sheets.flatMap((s) => s.rows) : snapshot.rows || []
  )
    .map(clean)
    .map((r) => JSON.stringify(r))
    .sort();
  return JSON.stringify(
    clean({
      rows,
      colors: snapshot.colors || null,
      posterContent: require("./poster-content").normalize(snapshot.posterContent),
      posterTitle: require("./poster-title").normalize(snapshot.posterTitle),
      posterStamp: require('./stamp-id').normalize(snapshot.posterStamp),
      labels: snapshot.labelSelection === null ? null : [...(snapshot.labelSelection || [])].sort(),
      includeFuture: !!snapshot.includeFuture
    })
  );
}
module.exports = { backupContentKey };
