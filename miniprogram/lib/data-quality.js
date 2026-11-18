const {resolveAircraft}=require('./aircraft');
const { dateValue, normalizeAirlineCode } = require('./flights');
const airports = require('./airports');
const names = require('./names');
const clean = value => String(value == null ? '' : value).trim();
const code = value => clean(value).toUpperCase();
function flightNumber(row) {
  let value = code(row.flight), airline = normalizeAirlineCode(row.airline);
  if (airline && value.startsWith(airline)) value = value.slice(airline.length).trim();
  return /^\d{1,4}$/.test(value) ? String(Number(value)) : value;
}
function scan(rows) {
  const entries = [], flightGroups = new Map(), routeGroups = new Map();
  const add = (map, key, entry) => { if (!map.has(key)) map.set(key, []); map.get(key).push(entry); };
  for (const [index, row] of rows.entries()) {
    if (['true','1','是','yes','已取消'].includes(clean(row.canceled).toLowerCase())) continue;
    const date = dateValue(row.date), from = code(row.from), to = code(row.to), airline = normalizeAirlineCode(row.airline), flight = flightNumber(row);
    const errors = [];
    if (!date) errors.push('日期缺失或无效，请核对原始记录');
    if (!airports[from]) errors.push(from ? '出发机场未匹配：' + from : '未填写出发机场');
    if (!airports[to]) errors.push(to ? '到达机场未匹配：' + to : '未填写到达机场');
    if (from && from === to) errors.push('出发和到达机场相同，请核对航线');
    if (airline && !/^[A-Z0-9]{2}$/.test(airline)) errors.push('航空公司代码格式不正确：' + airline);
    if (clean(row.departureTime) && !/^([01]\d|2[0-3]):[0-5]\d$/.test(clean(row.departureTime))) errors.push('起飞时间无效，请使用 HH:mm 格式');
    const entry = {
      id: row._id || 'quality-' + index, rowIndex: index,
      fromName: names[from] || from || '出发机场未填写', toName: names[to] || to || '到达机场未填写',
      from: from || '—', to: to || '—', date: clean(row.date) || '日期未填写', time: clean(row.departureTime),
      flight: clean(row.flight) ? (airline && !code(row.flight).startsWith(airline) ? airline : '') + clean(row.flight) : airline || '未填写航班号',
      aircraft: clean(row.aircraft), unmatched: !!clean(row.aircraft)&&!resolveAircraft(row.aircraft), errors, missing: !clean(row.aircraft), duplicate: false, duplicateNotes: []
    };
    entries.push(entry);
    if (date && airline && flight && airports[from] && airports[to] && from !== to) add(flightGroups, JSON.stringify([date,airline,flight,from,to]), entry);
    if (date && airports[from] && airports[to] && from !== to) add(routeGroups, JSON.stringify([date,from,to]), { entry, incomplete: !airline || !flight });
  }
  for (const group of flightGroups.values()) if (group.length > 1) {
    for (const entry of group) {
      entry.duplicate = true;
      entry.duplicateNotes.push('同日同航班号、同一起降方向共有 ' + group.length + ' 条记录，请核对是否重复录入');
    }
  }
  for (const group of routeGroups.values()) if (group.length > 1 && group.some(value => value.incomplete)) {
    for (const {entry} of group) {
      entry.duplicate = true;
      entry.duplicateNotes.push('同日同方向有 ' + group.length + ' 条记录，部分航班信息缺失，请对照原始记录');
    }
  }
  const items = entries.filter(entry => entry.errors.length || entry.missing || entry.unmatched || entry.duplicate)
    .sort((a,b) => Number(b.errors.length > 0) - Number(a.errors.length > 0) || Number(b.duplicate) - Number(a.duplicate) || a.rowIndex - b.rowIndex);
  return {
    total: items.length, checked: entries.length,
    errors: items.filter(entry => entry.errors.length).length,
    missing: items.filter(entry => entry.missing).length,
    models: items.filter(entry => entry.missing || entry.unmatched).length,
    duplicates: items.filter(entry => entry.duplicate).length,
    items
  };
}
module.exports = { scan };
