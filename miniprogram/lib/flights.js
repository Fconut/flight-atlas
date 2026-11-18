const d3 = require('./d3');
// Explicit ICAO -> IATA aliases. Never truncate an unknown three-character code.
const airlineDirectory = [
  ['CCA', 'CA', '中国国际航空'],
  ['CES', 'MU', '中国东方航空'],
  ['CSN', 'CZ', '中国南方航空'],
  ['DKH', 'HO', '吉祥航空'],
  ['CSH', 'FM', '上海航空'],
  ['CSZ', 'ZH', '深圳航空'],
  ['CQH', '9C', '春秋航空'],
  ['CHH', 'HU', '海南航空'],
  ['CXA', 'MF', '厦门航空'],
  ['CSC', '3U', '四川航空'],
  ['CDG', 'SC', '山东航空'],
  ['CBJ', 'JD', '首都航空'],
  ['GCR', 'GS', '天津航空'],
  ['CBG', 'GX', '北部湾航空'],
  ['CUA', 'KN', '中国联合航空'],
  ['UEA', 'EU', '成都航空'],
  ['CDC', 'GJ', '长龙航空'],
  ['CGZ', 'GY', '多彩贵州航空'], ['CGH', 'GT', '桂林航空'],
  ['QDA', 'QW', '青岛航空'],
  ['CCA', 'CA', '国航'],
  ['DLH', 'LH', '汉莎航空'],
  ['DAL', 'DL', '达美航空'],
  ['AFR', 'AF', '法国航空'],
  ['THY', 'TK', '土耳其航空'],
  ['SAS', 'SK', '北欧航空'],
  ['AAL', 'AA', '美国航空'],
  ['JTA', 'NU', '日本越洋航空'],
  ['MSC', 'SM', '开罗航空'],
  ['SVA', 'SV', '沙特航空'],
  ['CPA', 'CX', '国泰航空'],
  ['OAL', 'OA', '奥林匹克航空'],
  ['AAR', 'OZ', '韩亚航空'],
  ['ANA', 'NH', '全日空'],
  ['HKE', 'UO', '香港快运'],
  ['KAL', 'KE', '大韩航空'],
  ['AEE', 'A3', '爱琴海航空'],
  ['WIF', 'WF', '维德罗航空'],
  ['UAL', 'UA', '美国联合航空'],
  ['JAL', 'JL', '日本航空'],
  ['KLM', 'KL', '荷兰皇家航空'],
  ['BAW', 'BA', '英国航空'],
  ['FIN', 'AY', '芬兰航空'],
  ['SWR', 'LX', '瑞士国际航空'],
  ['AUA', 'OS', '奥地利航空'],
  ['IBE', 'IB', '西班牙国家航空'],
  ['TAP', 'TP', '葡萄牙航空'],
  ['LOT', 'LO', '波兰航空'],
  ['EIN', 'EI', '爱尔兰航空'],
  ['QFA', 'QF', '澳洲航空'],
  ['ANZ', 'NZ', '新西兰航空'],
  ['SIA', 'SQ', '新加坡航空'],
  ['THA', 'TG', '泰国国际航空'],
  ['MAS', 'MH', '马来西亚航空'],
  ['AXM', 'AK', '亚洲航空'],
  ['EVA', 'BR', '长荣航空'],
  ['CAL', 'CI', '中华航空'],
  ['HDA', 'KA', '港龙航空'],
  ['CRK', 'HX', '香港航空'],
  ['MDA', 'AE', '华信航空'],
  ['JSA', '3K', '捷星亚洲航空'],
  ['JJP', 'GK', '捷星日本航空'],
  ['APJ', 'MM', '乐桃航空'],
  ['JJA', '7C', '济州航空'],
  ['JNA', 'LJ', '真航空'],
  ['ESR', 'ZE', '易斯达航空'],
  ['TWB', 'TW', '德威航空'],
  ['CEB', '5J', '宿务太平洋航空'],
  ['PAL', 'PR', '菲律宾航空'],
  ['VNA', 'VN', '越南航空'],
  ['VJC', 'VJ', '越捷航空'],
  ['GIA', 'GA', '印尼鹰航'],
  ['ETD', 'EY', '阿提哈德航空'],
  ['UAE', 'EK', '阿联酋航空'],
  ['QTR', 'QR', '卡塔尔航空'],
  ['OMA', 'WY', '阿曼航空'],
  ['GFA', 'GF', '海湾航空'],
  ['FDB', 'FZ', '迪拜航空'],
  ['MSR', 'MS', '埃及航空'],
  ['ETH', 'ET', '埃塞俄比亚航空'],
  ['KQA', 'KQ', '肯尼亚航空'],
  ['RAM', 'AT', '摩洛哥皇家航空'],
  ['ACA', 'AC', '加拿大航空'],
  ['WJA', 'WS', '西捷航空'],
  ['ASA', 'AS', '阿拉斯加航空'],
  ['JBU', 'B6', '捷蓝航空'],
  ['SWA', 'WN', '西南航空'],
  ['LAN', 'LA', '南美航空'],
  ['TAM', 'JJ', '巴西天马航空']
];
const airlineAliases = new Map();
for (const [icao, iata, name] of airlineDirectory) {
  airlineAliases.set(icao, iata);
  airlineAliases.set(iata, iata);
  airlineAliases.set(name, iata);
}
function normalizeAirlineCode(value) {
  const code = String(value ?? '')
    .trim()
    .toUpperCase();
  return airlineAliases.get(code) || code;
}
function validAirlineCode(value) {
  return !value || /^[A-Z0-9]{2}$/.test(value);
}

const alias = {
  departureTime: [
    'departuretime',
    'scheduleddeparturetime',
    'scheduleddeparture',
    'gatedeparturescheduled',
    'takeoffscheduled',
    'gatedepartureactual',
    'takeoffactual',
    '起飞时间',
    '出发时间',
    '计划起飞时间'
  ],
  date: ['departuredate', 'date', '日期', '航班日期', '出发日期', '飞行日期'],
  from: ['from', 'origin', 'departureairport', '出发机场', '起飞机场', '出发地', '起点'],
  to: ['to', 'destination', 'arrivalairport', '到达机场', '抵达机场', '目的地', '终点'],
  airline: ['airline', 'airlinecode', '航空公司', '航司', '航司代码'],
  flight: ['flight', 'flightnumber', '航班号', '航班'],
  canceled: ['canceled', 'cancelled', '取消', '是否取消'],
  aircraft: ['aircrafttypename', 'aircraft', '机型', '飞机型号']
};
const cleanHeader = (s) =>
  String(s ?? '')
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_\-()（）]/g, '');
function headerMap(row) {
  const m = {};
  for (const [i, h] of row.entries())
    for (const [key, options] of Object.entries(alias))
      if (options.includes(cleanHeader(h)) && m[key] === undefined) m[key] = i;
  return m;
}
function parseSheet(matrix, name) {
  for (let index = 0; index < Math.min(matrix.length, 20); index++) {
    const mapping = headerMap(matrix[index]);
    if (['date', 'from', 'to'].every((k) => mapping[k] !== undefined)) {
      const timeColumns = alias.departureTime
        .map((h) => matrix[index].findIndex((v) => cleanHeader(v) === h))
        .filter((j) => j >= 0);
      const rows = matrix
        .slice(index + 1)
        .map((r, i) => {
          const row = { _line: index + i + 2 };
          for (const [key, j] of Object.entries(mapping)) row[key] = r[j] ?? '';
          row.departureTime =
            timeColumns.map((j) => departureTimeValue(r[j])).find(Boolean) ||
            departureTimeValue(row.date);
          return row;
        })
        .filter((r) => [r.date, r.from, r.to, r.airline, r.flight].some((v) => String(v).trim()));
      return { name, rows };
    }
  }
  return null;
}
function dateValue(v) {
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null;
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
  }
  if (typeof v === 'number') {
    if (!Number.isFinite(v) || v < 1 || v > 2958465) return null;
    const serial = Math.floor(v);
    if (serial === 60) return null;
    const d = new Date(Date.UTC(1899, 11, 30) + (serial + (serial < 60 ? 1 : 0)) * 86400000);
    return validDate(d.toISOString().slice(0, 10));
  }
  const s = String(v).trim();
  const m = s.match(/^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})(?:日|\b|T)/);
  if (m) return validDate(`${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`);
  return null;
}
function validDate(s) {
  const d = new Date(s + 'T12:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s ? s : null;
}

function departureTimeValue(value) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    return (
      String(value.getHours()).padStart(2, '0') + ':' + String(value.getMinutes()).padStart(2, '0')
    );
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0 || (Number.isInteger(value) && value !== 0)) return '';
    const minutes = Math.round((value % 1) * 1440) % 1440;
    return (
      String(Math.floor(minutes / 60)).padStart(2, '0') +
      ':' +
      String(minutes % 60).padStart(2, '0')
    );
  }
  const text = String(value ?? '').trim(),
    m = text.match(/(?:^|[T\s])(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?$/);
  return m && Number(m[1]) < 24 && Number(m[2]) < 60 ? m[1].padStart(2, '0') + ':' + m[2] : '';
}
function rowDepartureTime(row) {
  return departureTimeValue(row.departureTime) || departureTimeValue(row.date);
}
function compareFlightDeparture(a, b) {
  return (
    (dateValue(b.date) || '').localeCompare(dateValue(a.date) || '') ||
    (rowDepartureTime(b) || '').localeCompare(rowDepartureTime(a) || '')
  );
}

function airportCode(v) {
  return String(v ?? '')
    .trim()
    .toUpperCase();
}
function uniqueFlightRows(rows, latestAircraft = false) {
  const result = [],
    seen = new Map();
  let duplicates = 0;
  for (const original of rows) {
    const row = {
        ...original,
        airline: normalizeAirlineCode(original.airline),
        from: airportCode(original.from),
        to: airportCode(original.to),
        flight: String(original.flight ?? '').trim()
      },
      date = dateValue(row.date);
    const time = rowDepartureTime(original);
    if (time) row.departureTime = time;
    if (date) row.date = date;
    const key =
      date && row.from && row.to
        ? JSON.stringify([date, row.airline, row.flight, row.from, row.to])
        : null;
    if (key && seen.has(key)) {
      duplicates++;
      const earlier = seen.get(key);
      const aircraft = String(row.aircraft || '').trim();
      if (aircraft && (latestAircraft || !String(earlier.aircraft || '').trim()))
        earlier.aircraft = aircraft;
      if (time && (latestAircraft || !rowDepartureTime(earlier))) earlier.departureTime = time;
      continue;
    }
    result.push(row);
    if (key) seen.set(key, row);
  }
  return { rows: result, duplicates };
}
function calculate(rows, airports, cutoff, includeFuture) {
  const flights = [],
    seen = new Map(),
    unknown = new Set(),
    unknownAirlines = new Set(),
    invalid = [],
    meta = { duplicates: 0, future: 0, canceled: 0, missingAirline: 0, missingFlight: 0 };
  for (const row of rows) {
    const date = dateValue(row.date),
      from = airportCode(row.from),
      to = airportCode(row.to);
    if (!date || !from || !to) {
      invalid.push(row._line);
      continue;
    }
    const canceled = ['true', '1', '是', 'yes', '已取消'].includes(
      String(row.canceled).trim().toLowerCase()
    );
    if (canceled) {
      meta.canceled++;
      continue;
    }
    if (!includeFuture && date > cutoff) {
      meta.future++;
      continue;
    }
    const airline = normalizeAirlineCode(row.airline),
      flight = String(row.flight ?? '').trim();
    const key = [date, airline, flight, from, to].join('|');
    if (seen.has(key)) {
      const earlier = seen.get(key);
      if (earlier.aircraft && row.aircraft && earlier.aircraft !== String(row.aircraft).trim())
        throw Error(`第 ${row._line} 行与同航班记录机型冲突，请核对后重新上传。`);
      meta.duplicates++;
      continue;
    }
    if (!validAirlineCode(airline)) unknownAirlines.add(airline);
    const f = {
      Date: date,
      Airline: airline,
      Flight: flight,
      From: from,
      To: to,
      departureTime: rowDepartureTime(row) || '',
      aircraft: String(row.aircraft ?? '').trim()
    };
    seen.set(key, f);
    if (!airports[from]) unknown.add(from);
    if (!airports[to]) unknown.add(to);
    if (!airline) meta.missingAirline++;
    if (!flight) meta.missingFlight++;
    flights.push(f);
  }
  if (invalid.length)
    throw Error(
      `第 ${invalid.slice(0, 8).join('、')} 行缺少有效日期或机场代码。请修正后重新上传，避免漏算。日期建议为 YYYY-MM-DD。`
    );
  if (unknownAirlines.size)
    throw Error(
      `未识别航司的 IATA 两位代码：${[...unknownAirlines].join('、')}。请在航班记录中编辑航司，填写如 MU、CZ、CA 的两位代码。`
    );
  if (unknown.size)
    throw Error(
      `未识别机场：${[...unknown].slice(0, 12).join('、')}。请使用三字机场代码，如 SHA、NRT；当前地图没有生成，以免漏掉行程。`
    );
  if (!flights.length)
    throw Error(`没有符合日期范围的航班记录。可调整截止日期或勾选“同时计入未来行程”。`);
  const used = {},
    routes = new Map();
  for (const f of flights) {
    for (const code of [f.From, f.To]) {
      if (!used[code]) used[code] = { ...airports[code], xy: [...airports[code].xy], n: 0 };
      used[code].n++;
    }
    const pair = [f.From, f.To].sort(),
      key = pair.join('|');
    if (!routes.has(key)) routes.set(key, { a: pair[0], b: pair[1], flights: [] });
    routes.get(key).flights.push(f);
  }
  const rs = [...routes.values()];
  for (const r of rs) r.km = d3.geoDistance(used[r.a].xy, used[r.b].xy) * 6371.0088;
  const legs = rs
    .flatMap((r) =>
      r.flights.map((f) => ({
        a: f.From,
        b: f.To,
        km: r.km,
        date: f.Date,
        airline: f.Airline,
        flight: f.Flight
      }))
    )
    .sort((a, b) => {
      for (const key of ['date', 'airline', 'flight', 'a', 'b']) {
        if (a[key] < b[key]) return -1;
        if (a[key] > b[key]) return 1;
      }
      return 0;
    });
  const uniqueLegs = [
    ...new Map([...legs].reverse().map((r) => [[r.a, r.b].sort().join('|'), r])).values()
  ];
  const longestRoutes = [...uniqueLegs]
      .sort((a, b) => b.km - a.km || legs.indexOf(a) - legs.indexOf(b))
      .slice(0, 2),
    shortestRoutes = [...uniqueLegs]
      .sort((a, b) => a.km - b.km || legs.indexOf(a) - legs.indexOf(b))
      .slice(0, 2);
  const codes = Object.keys(used).sort(),
    north = codes.reduce((a, c) => (used[c].xy[1] > used[a].xy[1] ? c : a)),
    south = codes.reduce((a, c) => (used[c].xy[1] < used[a].xy[1] ? c : a)),
    east = codes.reduce((a, c) => (used[c].xy[0] > used[a].xy[0] ? c : a)),
    west = codes.reduce((a, c) => (used[c].xy[0] < used[a].xy[0] ? c : a));
  return {
    statCutoff: cutoff,
    longestRoutes,
    shortestRoutes,
    airports: used,
    routes: rs,
    total: flights.length,
    airlineCount: new Set(flights.map((f) => f.Airline).filter(Boolean)).size,
    busiest: codes.reduce((a, c) => (used[c].n > used[a].n ? c : a)),
    extremes: { north, south, east, west },
    totalKm: Math.round(rs.reduce((n, r) => n + r.km * r.flights.length, 0)),
    meta
  };
}

module.exports = {
  calculate,
  uniqueFlightRows,
  parseSheet,
  dateValue,
  compareFlightDeparture,
  normalizeAirlineCode,
  airlineDirectory
};
