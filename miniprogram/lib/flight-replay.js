const airports = require('./airports');
const { status, identity } = require('./record-model');
const { uniqueFlightRows, dateValue } = require('./flights');
function replayData(rows, today) {
  const flights = uniqueFlightRows(rows)
    .rows.filter((row) => status(row, today) === 'included')
    .map((row, index) => ({ ...row, date: dateValue(row.date), order: index }))
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        String(a.departureTime || '').localeCompare(String(b.departureTime || '')) ||
        a.order - b.order,
    );
  const used = {},
    routes = [];
  for (const row of flights) {
    for (const code of [row.from, row.to]) {
      used[code] ||= { ...airports[code], n: 0 };
      used[code].n++;
    }
    routes.push({ a: row.from, b: row.to, flights: [row], id: identity(row) });
  }
  return { flights, airports: used, routes, excluded: rows.length - flights.length };
}
function replayTouchPoint(event, rect, width, height) {
  const point = event.changedTouches?.[0] || event.touches?.[0] || event.detail;
  if (!point || !rect?.width || !rect?.height) return null;
  const x = Number.isFinite(point.clientX) ? point.clientX - (rect.left || 0) : point.x;
  const y = Number.isFinite(point.clientY) ? point.clientY - (rect.top || 0) : point.y;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x: (x * width) / rect.width, y: (y * height) / rect.height };
}
function replayLabelCodes(airports, prefs = {}) {
  if (prefs.labels === false) return new Set();
  if (Array.isArray(prefs.labelSelection))
    return new Set(prefs.labelSelection.filter((c) => airports[c]));
  const codes = Object.keys(airports);
  if (!codes.length) return new Set();
  const extreme = (axis, sign) =>
    codes.reduce((a, b) => (sign * airports[b].xy[axis] > sign * airports[a].xy[axis] ? b : a));
  return new Set(
    [
      extreme(1, 1),
      extreme(1, -1),
      extreme(0, 1),
      extreme(0, -1),
      'CDG',
      'DXB',
      'IST',
      'CAI',
      'LAX',
      'RDU',
    ].filter((c) => airports[c]),
  );
}
module.exports = { replayData, replayTouchPoint, replayLabelCodes };
