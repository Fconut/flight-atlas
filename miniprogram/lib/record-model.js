const { dateValue, normalizeAirlineCode } = require('./flights.js');
const airports = require('./airports.js');
const { localDay } = require('./day.js');
const code = (v) =>
  String(v ?? '')
    .trim()
    .toUpperCase();
function identity(row) {
  return JSON.stringify([
    dateValue(row.date),
    normalizeAirlineCode(row.airline),
    String(row.flight || '').trim(),
    code(row.from),
    code(row.to)
  ]);
}
function status(row, cutoff = localDay()) {
  const date = dateValue(row.date),
    airline = normalizeAirlineCode(row.airline);
  if (
    !date ||
    !airports[code(row.from)] ||
    !airports[code(row.to)] ||
    (airline && !/^[A-Z0-9]{2}$/.test(airline))
  )
    return 'invalid';
  if (['true', '1', '是', 'yes', '已取消'].includes(String(row.canceled).trim().toLowerCase()))
    return 'canceled';
  return date > cutoff ? 'future' : 'included';
}
const statusLabels = {
  included: '历史行程',
  future: '未来行程',
  invalid: '需要修正',
  canceled: '已取消'
};
module.exports = { identity, status, statusLabels };
