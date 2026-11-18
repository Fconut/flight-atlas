const { calculate } = require('./flights');
const airports = require('./airports');
function buildSnapshot(draft, today) {
  const rows = draft.sheets?.length
    ? draft.sheets.flatMap((sheet) => sheet.rows)
    : draft.rows || [];
  const data = calculate(rows, airports, today, false);
  const leg = (value) => ({ a: value.a, b: value.b, km: value.km });
  const colors = draft.colors;
  const content = require('./poster-content');
  const options = {
    publicMode: true,
    posterContent: content.normalize(draft.posterContent),
    posterTitle: require("./poster-title").normalize(draft.posterTitle),
    posterStamp: require('./stamp-id').normalize(draft.posterStamp),
  };
  if (
    colors &&
    ['background', 'route'].every((key) =>
      /^#[a-f\d]{6}$/i.test(colors[key] || ''),
    )
  )
    options.colors = { background: colors.background, route: colors.route };
  if (Array.isArray(draft.labelSelection))
    options.labelSelection = draft.labelSelection.filter(
      (code) => !!data.airports[code],
    );
  const snapshot = {
    version: 1,
    summary: {
      total: data.total,
      airportCount: Object.keys(data.airports).length,
      km: data.totalKm,
    },
    map: {
      airports: Object.fromEntries(
        Object.entries(data.airports).map(([code, value]) => [
          code,
          { xy: [...value.xy], n: value.n },
        ]),
      ),
      routes: data.routes.map((route) => ({
        a: route.a,
        b: route.b,
        count: route.flights.length,
        km: route.km,
      })),
      total: data.total,
      totalKm: data.totalKm,
      airlineCount: data.airlineCount,
      ...(options.posterContent === null
        ? {}
        : { posterStats: content.selectedStats(data, options.posterContent) }),
      busiest: data.busiest,
      extremes: { ...data.extremes },
      longestRoutes: data.longestRoutes.map(leg),
      shortestRoutes: data.shortestRoutes.map(leg),
    },
    options,
  };
  return snapshot;
}
function posterData(snapshot) {
  return {
    ...snapshot.map,
    routes: snapshot.map.routes.map((route) => ({
      ...route,
      flights: { length: route.count },
    })),
  };
}
module.exports = { buildSnapshot, posterData };
