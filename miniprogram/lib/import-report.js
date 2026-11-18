const { uniqueFlightRows } = require('./flights');
const { identity: key } = require('./record-model.js');
function merge(current, incoming) {
  const original = new Map(
    current.map((r) => [
      key(r),
      JSON.stringify([String(r.aircraft || '').trim(), String(r.departureTime || '').trim()])
    ])
  );
  const rows = uniqueFlightRows([...current, ...incoming], true).rows;
  const added = rows.length - uniqueFlightRows(current).rows.length,
    updated = rows.filter(
      (r) =>
        original.has(key(r)) &&
        original.get(key(r)) !==
          JSON.stringify([String(r.aircraft || '').trim(), String(r.departureTime || '').trim()])
    ).length;
  return { rows, added, updated, skipped: Math.max(0, incoming.length - added - updated) };
}
function review(current, incoming) {
  const report = merge(current, incoming);
  const before = new Map(uniqueFlightRows(current).rows.map(row => [key(row), row]));
  const groups = { added: [], updated: [], duplicate: [] };
  const incomingKeys = new Set(incoming.map(key));
  for (const row of report.rows) {
    if (!incomingKeys.has(key(row))) continue;
    const old = before.get(key(row));
    const changes = old ? ['aircraft', 'departureTime'].filter(field =>
      String(old[field] || '').trim() !== String(row[field] || '').trim()
    ).map(field => ({ field, label: field === 'aircraft' ? '机型' : '起飞时间', before: old[field] || '未填写', after: row[field] || '未填写' })) : [];
    groups[!old ? 'added' : changes.length ? 'updated' : 'duplicate'].push({ ...row, changes });
  }
  return { ...report, groups };
}
module.exports = { merge, review };
