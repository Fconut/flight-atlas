const { aircraftIdentity, aircraftCatalog, aircraftManufacturer } = require('./aircraft'),
  catalog = require('./badge-assets'),
  { dateValue, calculate, compareFlightDeparture } = require('./flights'),
  airports = require('./airports');
function collection(rows, today) {
  const art=new Map(catalog.map(a=>[a.id,a]));
  const groups = new Map(aircraftCatalog.map(a=>[a.id,{...a,...art.get(a.id),rows:[],count:0}]));
  let missing = 0;
  for (const row of rows) {
    const date = dateValue(row.date);
    if (!date || date > today) continue;
    try {
      calculate([row], airports, today, false);
    } catch (_) {
      continue;
    }
    const raw = String(row.aircraft || '').trim();
    if (!raw) {
      missing++;
      continue;
    }
    const key = aircraftIdentity(raw);
    if (!groups.has(key))
      groups.set(key, {
        id: key,
        name: raw,
        manufacturer: aircraftManufacturer(raw),
        rows: [],
        count: 0
      });
    groups.get(key).rows.push(row);
  }
  const items = [...groups.values()].map((g) => ({
    ...g,
    rows: g.rows.sort(compareFlightDeparture),
    count: g.rows.length,
    first: g.rows.length ? g.rows[g.rows.length - 1].date : ''
  }));
  return {
    items: items.sort(
      (a, b) =>
        a.manufacturer.localeCompare(b.manufacturer) ||
        b.count - a.count ||
        a.name.localeCompare(b.name)
    ),
    missing,
    recordedTypes: items.filter((a) => a.count).length,
    recordedFlights: items.reduce((n, a) => n + a.count, 0),
    unlocked: items.filter((a) => a.count && a.badge).length
  };
}
module.exports = { collection };
