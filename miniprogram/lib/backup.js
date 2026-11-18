const { localDay } = require('./day.js');
const { resolveColors } = require('./theme.js');
const { dateValue } = require('./flights');
function snapshot(state) {
  const d = new Date(),
    date = localDay(d);
  return {
    version: 1,
    savedAt: d.toISOString(),
    sheets: [{ name: '航班记录', rows: JSON.parse(JSON.stringify(state.rows)) }],
    activeSheet: 0,
    rows: null,
    fileName: state.fileName || '',
    demo: false,
    layout: 'portrait',
    colors: resolveColors(state.colors, state.theme),
    posterContent: require('./poster-content').normalize(state.posterContent),
    posterTitle: require('./poster-title').normalize(state.posterTitle),
    posterStamp: require('./stamp-id').normalize(state.posterStamp),
    labelSelection:
      state.labels === false
        ? []
        : Array.isArray(state.labelSelection)
          ? [...state.labelSelection]
          : null,
    cutoff: date,
    includeFuture: !!state.future
  };
}
function parseBackup(text) {
  const b = JSON.parse(text),
    d = b && b.draft;
  const row = (r) =>
    r &&
    typeof r === 'object' &&
    !Array.isArray(r) &&
    ['date', 'departureTime', 'from', 'to', 'airline', 'flight', 'aircraft', '_id'].every(
      (k) => r[k] == null || ['string', 'number'].includes(typeof r[k])
    );
  if (
    b.format !== 'flight-atlas-backup' ||
    b.version !== 1 ||
    !d ||
    d.version !== 1 ||
    !Array.isArray(d.sheets) ||
    !d.sheets.every(
      (s) => s && typeof s.name === 'string' && Array.isArray(s.rows) && s.rows.every(row)
    ) ||
    !(d.rows === null || (Array.isArray(d.rows) && d.rows.every(row))) ||
    !Number.isInteger(d.activeSheet) ||
    d.activeSheet < -1 ||
    d.activeSheet >= d.sheets.length ||
    !['portrait', 'landscape'].includes(d.layout) ||
    typeof d.cutoff !== 'string' ||
    dateValue(d.cutoff) !== d.cutoff ||
    typeof d.includeFuture !== 'boolean' ||
    !(
      d.labelSelection === null ||
      (Array.isArray(d.labelSelection) &&
        d.labelSelection.every((c) => typeof c === 'string' && /^[A-Z]{3}$/.test(c)))
    )
  )
    throw Error('备份格式无效，本机记录未改动。');
  if (d.colors && !['background', 'route'].every((k) => /^#[0-9a-f]{6}$/i.test(d.colors[k])))
    throw Error('备份配色格式无效');
  return d;
}
function rows(d) {
  return d.sheets.length ? d.sheets.flatMap((s) => s.rows) : d.rows || [];
}
module.exports = { snapshot, parseBackup, rows };
