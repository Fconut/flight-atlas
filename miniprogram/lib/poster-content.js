const names = require('./names');
const { resolveAircraft, aircraftManufacturer } = require('./aircraft');
const airlineNames = new Map(
  require('./flights').airlineDirectory.map(([, code, name]) => [code, name]),
);
const groups = [
  [
    'overview',
    '飞行总览',
    [
      'distance',
      'flights',
      'airportCount',
      'airlineCount',
      'routeCount',
      'typeCount',
    ],
  ],
  ['time', '飞行时光', ['firstDate', 'lastDate', 'peakYear', 'peakMonth']],
  [
    'airports',
    '机场足迹',
    ['busiestAirport', 'departureAirport', 'arrivalAirport'],
  ],
  ['extremes', '方向足迹', ['north', 'south', 'east', 'west']],
  ['routes', '航线纪录', ['longestRoute', 'shortestRoute', 'commonRoute']],
  [
    'aviation',
    '航空偏好',
    ['topAirlines', 'topAircraft', 'boeing', 'airbus', 'other'],
  ],
].map(([id, title, items]) => ({ id, title, items }));
const labels = {
  distance: '累计飞行里程',
  flights: '飞行次数',
  airportCount: '起降机场数',
  airlineCount: '乘坐航司数',
  routeCount: '航线数量',
  typeCount: '记录机型数',
  firstDate: '首次飞行记录',
  lastDate: '最近飞行记录',
  peakYear: '飞行最多的年份',
  peakMonth: '飞行最多的月份',
  busiestAirport: '起降最多的机场',
  departureAirport: '最常出发机场',
  arrivalAirport: '最常到达机场',
  north: '最北机场',
  south: '最南机场',
  east: '最东机场',
  west: '最西机场',
  longestRoute: '最长航线',
  shortestRoute: '最短航线',
  commonRoute: '最常乘坐航线',
  topAirlines: '常乘航司排行',
  topAircraft: '常乘机型排行',
  boeing: '波音常乘机型排行',
  airbus: '空客常乘机型排行',
  other: '其他常乘机型排行',
};
const fields = groups.flatMap((g) =>
  g.items.map((id) => ({
    id,
    label: labels[id],
    group: g.id,
    rule: require('./poster-layout').specs[id],
  })),
);
const legacyGroups = {
  overview: ['distance', 'flights', 'airportCount', 'airlineCount'],
  time: ['firstDate', 'lastDate'],
  peak: ['peakYear', 'peakMonth'],
  airports: ['busiestAirport', 'departureAirport', 'arrivalAirport'],
  routes: ['routeCount', 'longestRoute', 'shortestRoute', 'commonRoute'],
  extremes: ['north', 'south', 'east', 'west'],
  aviation: ['topAirlines', 'topAircraft', 'boeing', 'airbus', 'other'],
  badges: ['typeCount'],
};
const defaultSelection = [
  'distance',
  'flights',
  'airlineCount',
  'busiestAirport',
  'north',
  'south',
  'east',
  'west',
  'longestRoute',
  'shortestRoute',
];
function normalize(value) {
  if (!Array.isArray(value)) return null;
  const expanded = new Set(value.flatMap((id) => legacyGroups[id] || [id]));
  return fields.filter((f) => expanded.has(f.id)).map((f) => f.id);
}
const add = (map, key) => {
  if (key) map.set(key, (map.get(key) || 0) + 1);
};
const rank = (map) =>
  [...map].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
const airport = (code) => names[code] || code;
const number = (value) => Number(value).toLocaleString('en-US');
function build(data) {
  const flights = data.routes
    .flatMap((r) => (Array.isArray(r.flights) ? r.flights : []))
    .sort(
      (a, b) =>
        String(a.Date).localeCompare(String(b.Date)) ||
        String(a.departureTime || '').localeCompare(
          String(b.departureTime || ''),
        ) ||
        String(a.From).localeCompare(String(b.From)) ||
        String(a.To).localeCompare(String(b.To)) ||
        String(a.Flight || '').localeCompare(String(b.Flight || '')),
    );
  const years = new Map(),
    months = new Map(),
    departures = new Map(),
    arrivals = new Map(),
    airlines = new Map(),
    models = new Map(),
    makes = new Map([
      ['Boeing', new Map()],
      ['Airbus', new Map()],
      ['Other', new Map()],
    ]);
  for (const f of flights) {
    const date = String(f.Date || '');
    if (date) {
      add(years, date.slice(0, 4));
      add(months, date.slice(0, 7));
    }
    add(departures, f.From);
    add(arrivals, f.To);
    add(airlines, f.Airline);
    if (f.aircraft) {
      const model = resolveAircraft(f.aircraft);
      add(models, model?.name || f.aircraft);
      const maker = aircraftManufacturer(f.aircraft);
      const category =
        maker === 'Boeing' ? 'Boeing' : maker === 'Airbus' ? 'Airbus' : 'Other';
      add(makes.get(category), model?.name || f.aircraft);
    }
  }
  const values = {};
  const metric = (id, value, unit = '', detail = '') => {
    values[id] = { id, kind: 'metric', value: String(value), unit, detail };
  };
  const place = (id, code, detail = '') => {
    if (code)
      values[id] = { id, kind: 'airport', code, value: airport(code), detail };
  };
  metric('distance', number(data.totalKm), 'km');
  metric('flights', number(data.total), '次');
  metric('airportCount', Object.keys(data.airports).length, '座');
  metric('airlineCount', data.airlineCount, '家');
  metric('routeCount', data.routes.length, '条');
  if (models.size) {
    metric('typeCount', models.size, '种');
  }
  if (flights.length) {
    for (const [id, flight] of [
      ['firstDate', flights[0]],
      ['lastDate', flights[flights.length - 1]],
    ]) {
      metric(
        id,
        airport(flight.From) + ' → ' + airport(flight.To),
        '',
        flight.Date,
      );
    }
  }
  for (const [id, map, unit] of [
    ['peakYear', years, '年'],
    ['peakMonth', months, ''],
  ]) {
    const top = rank(map)[0];
    if (top)
      metric(
        id,
        id === 'peakMonth'
          ? top[0].slice(0, 4) + ' 年 ' + Number(top[0].slice(5, 7)) + ' 月'
          : top[0],
        unit,
        top[1] + ' 次飞行',
      );
  }
  place(
    'busiestAirport',
    data.busiest,
    data.airports[data.busiest]?.n + ' 次起降',
  );
  for (const [id, map] of [
    ['departureAirport', departures],
    ['arrivalAirport', arrivals],
  ]) {
    const top = rank(map)[0];
    if (top) place(id, top[0], top[1] + ' 次');
  }
  for (const key of ['north', 'south', 'east', 'west']) {
    const code = data.extremes[key];
    if (code) {
      const [lon, lat] = data.airports[code].xy,
        isLat = key === 'north' || key === 'south',
        v = isLat ? lat : lon;
      place(
        key,
        code,
        Math.abs(v).toFixed(2) +
          '° ' +
          (isLat ? (v >= 0 ? 'N' : 'S') : v >= 0 ? 'E' : 'W'),
      );
    }
  }
  const pairs = new Map();
  for (const flight of flights) {
    if (!flight.From || !flight.To) continue;
    const [a, b] = [flight.From, flight.To].sort();
    const key = a + '|' + b;
    if (!pairs.has(key))
      pairs.set(key, { a, b, count: 0, forward: 0, reverse: 0 });
    const pair = pairs.get(key);
    pair.count++;
    if (flight.From === a) pair.forward++;
    else pair.reverse++;
  }
  const common = [...pairs.values()]
    .map((pair) =>
      pair.reverse > pair.forward ? { ...pair, a: pair.b, b: pair.a } : pair,
    )
    .sort(
      (a, b) =>
        b.count - a.count || a.a.localeCompare(b.a) || a.b.localeCompare(b.b),
    )
    .slice(0, 2);
  const entry = (route, unit = 'km', count) => ({
    a: route.a,
    b: route.b,
    value: unit === 'km' ? number(Math.round(route.km)) : String(count),
    unit,
    ...(route.flight
      ? {
          flight:
            (route.airline && !String(route.flight).startsWith(route.airline)
              ? route.airline
              : '') + route.flight,
        }
      : {}),
  });
  for (const [id, list] of [
    ['longestRoute', data.longestRoutes],
    ['shortestRoute', data.shortestRoutes],
  ]) {
    const entries = list.slice(0, 2).map((route) => entry(route));
    if (entries.length) values[id] = { id, kind: 'route', entries };
  }
  if (common.length)
    values.commonRoute = {
      id: 'commonRoute',
      kind: 'route',
      entries: common.map((route) => ({
        ...entry(route, '次', route.count),
        bidirectional: true,
      })),
    };
  for (const [id, map, format] of [
    ['topAirlines', airlines, (key) => airlineNames.get(key) || key],
    ['topAircraft', models, (key) => key],
  ]) {
    const rows = rank(map)
      .slice(0, 3)
      .map(([key, count]) => ({ name: format(key), count }));
    if (rows.length) values[id] = { id, kind: 'ranking', rows };
  }
  for (const [id, key] of [
    ['boeing', 'Boeing'],
    ['airbus', 'Airbus'],
    ['other', 'Other'],
  ]) {
    const rows = rank(makes.get(key))
      .slice(0, 3)
      .map(([name, count]) => ({ name, count }));
    if (rows.length) values[id] = { id, kind: 'ranking', rows };
  }
  return values;
}
const cache = new WeakMap();
function valuesFor(data) {
  if (data.posterStats?.version === 3) return data.posterStats.items;
  if (data.posterStats?.version === 2)
    return Object.fromEntries(
      Object.entries(data.posterStats.items).map(([id, item]) => [
        id,
        item.kind === 'route' && !item.entries
          ? {
              ...item,
              entries: [
                { a: item.a, b: item.b, value: item.value, unit: item.unit },
              ],
            }
          : item,
      ]),
    );
  let values = cache.get(data);
  if (!values) {
    values = build(data);
    cache.set(data, values);
  }
  return values;
}
function selectedStats(data, selection) {
  const chosen = normalize(selection) || [];
  const values = valuesFor(data);
  return {
    version: 3,
    items: Object.fromEntries(
      chosen
        .filter((id) => values[id])
        .map((id) => [
          id,
          values[id].kind === 'route'
            ? {
                ...values[id],
                entries: values[id].entries.map(
                  ({ flight, ...entry }) => entry,
                ),
              }
            : values[id],
        ]),
    ),
  };
}
function legacyBlocks(data, selection) {
  if (
    !data.posterStats ||
    [2, 3].includes(data.posterStats.version) ||
    !Array.isArray(selection)
  )
    return null;
  return Object.keys(legacyGroups)
    .filter(
      (id) => selection.includes(id) && Array.isArray(data.posterStats[id]),
    )
    .map((id) => ({
      id,
      title: {
        peak: '飞行高峰',
        badges: '徽章收藏',
        ...Object.fromEntries(groups.map((g) => [g.id, g.title])),
      }[id],
      lines: data.posterStats[id],
    }));
}
function blocks(data, selection) {
  const chosen = normalize(selection);
  if (chosen === null) return null;
  const values = valuesFor(data);
  const items = fields
    .filter((f) => chosen.includes(f.id) && values[f.id])
    .map((f) => ({
      ...values[f.id],
      label:
        values[f.id].kind === 'metric' &&
        ['boeing', 'airbus', 'other'].includes(f.id)
          ? {
              boeing: '波音飞行次数',
              airbus: '空客飞行次数',
              other: '其他厂商飞行次数',
            }[f.id]
          : values[f.id].kind === 'aircraft' &&
              ['boeing', 'airbus', 'other'].includes(f.id)
            ? {
                boeing: '波音常乘机型',
                airbus: '空客常乘机型',
                other: '其他常乘机型',
              }[f.id]
            : f.label,
      group: f.group,
    }));
  return require('./poster-layout').pack(items);
}
function height(data, selection) {
  const old = legacyBlocks(data, selection);
  if (old) {
    let total = 0;
    for (let i = 0; i < old.length; i += 2)
      total +=
        70 + Math.max(old[i].lines.length, old[i + 1]?.lines.length || 0) * 31;
    return old.length ? total + 55 : 0;
  }
  const rows = blocks(data, selection);
  return rows === null
    ? null
    : rows.length
      ? require('./poster-layout').PANEL_TOP +
        Math.max(...rows.map((block) => block.y + block.height)) +
        require('./poster-layout').PANEL_BOTTOM
      : 0;
}
module.exports = {
  groups,
  fields,
  modules: groups,
  defaultSelection,
  normalize,
  build,
  blocks,
  height,
  legacyBlocks,
  selectedStats,
};
