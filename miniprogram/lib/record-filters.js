const {resolveAircraft,aircraftIdentity}=require('./aircraft');
const { normalizeAirlineCode, airlineDirectory } = require('./flights.js');
const names = require('./names.js');
const airportCode = (v) =>
  String(v ?? '')
    .trim()
    .toUpperCase();
function routeKey(row) {
  const a = airportCode(row.from),
    b = airportCode(row.to);
  return /^[A-Z]{3}$/.test(a) && /^[A-Z]{3}$/.test(b) && a !== b ? a + '|' + b : '';
}
function airlineKey(row) {
  return normalizeAirlineCode(row.airline) || '__unknown__';
}
function ranked(rows, key) {
  const counts = new Map();
  for (const row of rows) {
    const value = key(row);
    if (value) counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}
function routeOptions(rows) {
  return [
    { value: '', label: '全部航线' },
    ...ranked(rows, routeKey).map(([value, count]) => {
      const [a, b] = value.split('|');
      return {
        value,
        label:
          (names[a] || a) + ' ' + a + ' → ' + (names[b] || b) + ' ' + b + ' · ' + count + ' 次',
        count
      };
    })
  ];
}
function airlineOptions(rows) {
  return [
    { value: '', label: '全部航司' },
    ...ranked(rows, airlineKey).map(([value, count]) => {
      const name =
        value === '__unknown__'
          ? '未填写航司'
          : airlineDirectory.find((a) => a[1] === value)?.[2] || '';
      return {
        value,
        label:
          (name ? name + ' ' : '') + (value === '__unknown__' ? '' : value) + ' · ' + count + ' 次',
        count
      };
    })
  ];
}
function aircraftKey(row){return String(row.aircraft||'').trim()?aircraftIdentity(row.aircraft):'__missing_model__'}
function aircraftOptions(rows){
 const labels=new Map();for(const row of rows){const key=aircraftKey(row);if(!labels.has(key))labels.set(key,resolveAircraft(row.aircraft)?.name||String(row.aircraft||'').trim()||'未填写机型')}
 return [{value:'',label:'全部机型'},...ranked(rows,aircraftKey).map(([value,count])=>({value,label:labels.get(value)+' · '+count+' 次',count}))];
}
function yearOptions(rows){
 const years=[...new Set(rows.map(r=>String(r.date).slice(0,4)))].sort((a,b)=>{
  const validA=/^\d{4}$/.test(a),validB=/^\d{4}$/.test(b);
  return Number(validB)-Number(validA)||(validA?Number(b)-Number(a):a.localeCompare(b));
 });
 return [{value:'',label:'全部年份'},...years.map(value=>({value,label:value}))];
}
module.exports = { routeKey, airlineKey, aircraftKey, routeOptions, airlineOptions, aircraftOptions, yearOptions };
