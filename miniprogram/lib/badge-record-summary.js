const { normalizeAirlineCode } = require('./flights');

// Read only the supplied records: a share selection must not reveal omitted data.
function badgeRecordSummary(records) {
  const airlines = new Set(),
    routes = new Set();
  let firstDate = '';
  for (const row of records) {
    const airline = normalizeAirlineCode(row.airline);
    if (airline) airlines.add(airline);
    if (row.from && row.to) routes.add(row.from + '|' + row.to);
    const date = String(row.date || '').trim();
    if (date && (!firstDate || date < firstDate)) firstDate = date;
  }
  return {
    total: records.length,
    airlines: airlines.size,
    routes: routes.size,
    firstDate,
  };
}
module.exports = { badgeRecordSummary };
