// Shared rhythm: 8px between rows, 12px between sections; no padding inferred by the renderer.
const COLS = 4,
  UNIT = 52,
  ROW_GAP = 8,
  SECTION_GAP = 12,
  PANEL_TOP = 80,
  PANEL_BOTTOM = 22,
  GAP = 18,
  ROUTE_METRIC_WIDTH = 132,
  ROUTE_METRIC_GAP = 16,
  ROUTE_NAME_MIN = 14,
  INNER = 896,
  COLUMN = (INNER - GAP * 3) / 4;
const specs = {};
function define(ids, span, units, contents, note) {
  for (const id of ids) specs[id] = { span, units, contents, note };
}
define(
  ['distance', 'flights', 'airportCount', 'airlineCount', 'typeCount'],
  1,
  2,
  ['指标名称', '数值', '单位'],
  '数值与单位',
);
define(
  ['boeing', 'airbus', 'other'],
  2,
  3,
  ['指标名称', '该厂商乘坐次数最多的前三款机型', '各机型飞行次数'],
  '展示该厂商前三名及次数',
);
define(['routeCount'], 1, 2, ['指标名称', '航线数量'], '展示航线数量');
define(
  ['firstDate', 'lastDate'],
  2,
  2,
  ['指标名称', '出发机场 → 到达机场', '日期 YYYY-MM-DD'],
  '半行展示机场名称航线与日期',
);
define(
  ['peakYear', 'peakMonth'],
  1,
  2,
  ['指标名称', '年份或年月', '飞行次数'],
  '时间与飞行次数',
);
define(
  ['busiestAirport', 'departureAirport', 'arrivalAirport'],
  1,
  2,
  ['指标名称', '机场名称', '三字码', '起降或出发抵达次数'],
  '机场名称、代码与次数',
);
define(
  ['north', 'south', 'east', 'west'],
  1,
  2,
  ['指标名称', '机场名称', '三字码', '经纬度'],
  '机场名称、代码与坐标',
);
define(
  ['longestRoute', 'shortestRoute'],
  2,
  3,
  [
    '指标名称',
    '最多两条不同航线',
    '每条的机场名称、代码、距离',
    '有记录时展示航班号',
  ],
  '最多展示两条不同航线',
);
define(
  ['commonRoute'],
  2,
  3,
  [
    '指标名称',
    '乘坐次数最多的两条往返合并航线',
    '各航线的两端机场名称及代码',
    '各自的飞行次数',
  ],
  '往返合并计数，较常乘坐方向的出发机场在前，双向箭头',
);
define(
  ['topAirlines', 'topAircraft'],
  2,
  3,
  ['指标名称', '前三名名称', '各自的飞行次数'],
  '展示前三名及次数',
);
function measure(item) {
  const base = specs[item.id];
  if (!base) throw Error('Unknown poster item: ' + item.id);
  let span = base.span,
    units = base.units;
  if (item.kind === 'airport' && Array.from(item.value || '').length > 10)
    span = 2;
  if (item.kind === 'aircraft' && Array.from(item.value || '').length > 25)
    span = 2;
  if (item.kind === 'route') units = (item.entries?.length || 1) > 1 ? 3 : 2;
  if (item.kind === 'ranking') units = (item.rows?.length || 0) > 1 ? 3 : 2;
  return { ...base, span, units };
}
function canUseRouteColumns(item, width) {
  if (item.kind !== 'route' || item.entries?.length !== 2) return false;
  const columnWidth = (width - GAP) / 2;
  if (columnWidth < (INNER - GAP) / 2 - 0.01) return false;
  const names = require('./names');
  return item.entries.every((entry) => {
    const label =
      (names[entry.a] || entry.a) + ' → ' + (names[entry.b] || entry.b);
    const amount =
      String(entry.value).length * 14 + String(entry.unit).length * 12 + 5;
    const codes =
      (entry.a + (entry.bidirectional ? ' ↔ ' : ' → ') + entry.b).length * 9 +
      (!entry.flight ? 0 : String(entry.flight).length * 7 + 10);
    return (
      Array.from(label).length * ROUTE_NAME_MIN <=
        columnWidth - ROUTE_METRIC_WIDTH - ROUTE_METRIC_GAP &&
      amount <= ROUTE_METRIC_WIDTH &&
      codes <= columnWidth - ROUTE_METRIC_WIDTH - ROUTE_METRIC_GAP
    );
  });
}
function adaptRouteColumns(blocks) {
  for (const block of blocks) {
    const item = block.items[0];
    if (block.span !== COLS || !canUseRouteColumns(item, block.width)) continue;
    const oldBottom = block.y + block.height,
      units = 2,
      height = units * UNIT - ROW_GAP,
      delta = block.height - height;
    block.entryColumns = 2;
    block.units = units;
    block.height = height;
    if (delta > 0)
      for (const next of blocks)
        if (next !== block && next.y >= oldBottom) {
          next.y -= delta;
          next.gridY -= delta / UNIT;
        }
  }
  return blocks;
}
function packBand(items) {
  const order = new Map(items.map((v, i) => [v.id, i])),
    grid = [],
    placed = [];
  const free = (x, y, w, h) => {
    for (let row = y; row < y + h; row++)
      for (let col = x; col < x + w; col++) if (grid[row]?.[col]) return false;
    return true;
  };
  const occupy = (x, y, w, h) => {
    for (let row = y; row < y + h; row++) {
      grid[row] ||= Array(COLS).fill(false);
      for (let col = x; col < x + w; col++) grid[row][col] = true;
    }
  };
  const place = (item, shape) => {
    for (let y = 0; ; y++)
      for (let x = 0; x <= COLS - shape.span; x++)
        if (free(x, y, shape.span, shape.units)) {
          occupy(x, y, shape.span, shape.units);
          placed.push({
            kind: item.kind,
            items: [item],
            column: x,
            gridY: y,
            span: shape.span,
            units: shape.units,
          });
          return;
        }
  };
  // Pin a compact overview first; feature cards are then placed by area and gaps filled with small items.
  const compact = items.filter(
      (v) =>
        v.kind === 'metric' || v.kind === 'airport' || v.kind === 'aircraft',
    ),
    pinned = [];
  let width = 0;
  for (const item of compact) {
    const shape = measure(item);
    if (width + shape.span > COLS) break;
    pinned.push({ item, shape });
    width += shape.span;
    if (width === COLS) break;
  }
  let remaining = COLS - width;
  for (const entry of pinned) {
    if (!remaining) break;
    const extra = Math.min(
      remaining,
      Math.max(0, Math.floor(COLS / pinned.length) - entry.shape.span),
    );
    entry.shape = { ...entry.shape, span: entry.shape.span + extra };
    remaining -= extra;
  }
  if (remaining && pinned.length) {
    pinned[0].shape = {
      ...pinned[0].shape,
      span: pinned[0].shape.span + remaining,
    };
  }
  for (const entry of pinned) place(entry.item, entry.shape);
  const used = new Set(pinned.map((v) => v.item.id));
  const rest = items
    .filter((v) => !used.has(v.id))
    .map((item) => ({ item, shape: measure(item) }))
    .sort(
      (a, b) =>
        b.shape.span * b.shape.units - a.shape.span * a.shape.units ||
        b.shape.units - a.shape.units ||
        order.get(a.item.id) - order.get(b.item.id),
    );
  for (const entry of rest) place(entry.item, entry.shape);
  // A lone half-width feature may expand across free columns, without moving other content.
  for (const block of placed)
    if (
      block.span === 2 &&
      block.column === 0 &&
      free(2, block.gridY, 2, block.units)
    ) {
      occupy(2, block.gridY, 2, block.units);
      block.span = 4;
    }
  // Balance a trailing short row across the available width, rather than leaving orphan quarter-cells.
  if (placed.length) {
    const lastY = Math.max(...placed.map((b) => b.gridY)),
      tail = placed
        .filter((b) => b.gridY === lastY)
        .sort((a, b) => a.column - b.column);
    if (
      tail.every((b) => b.units === tail[0].units) &&
      placed
        .filter((b) => b.gridY !== lastY)
        .every((b) => b.gridY + b.units <= lastY)
    ) {
      let spare = COLS - tail.reduce((n, b) => n + b.span, 0);
      for (const block of tail) {
        const extra = Math.min(
          spare,
          Math.max(0, Math.floor(COLS / tail.length) - block.span),
        );
        block.span += extra;
        spare -= extra;
      }
      if (spare) tail[0].span += spare;
      let column = 0;
      for (const block of tail) {
        block.column = column;
        column += block.span;
      }
    }
  }
  return adaptRouteColumns(
    placed
      .sort((a, b) => a.gridY - b.gridY || a.column - b.column)
      .map((block) => ({
        ...block,
        x: block.column * (COLUMN + GAP),
        y: block.gridY * UNIT,
        width: block.span * COLUMN + (block.span - 1) * GAP,
        height: block.units * UNIT - ROW_GAP,
      })),
  );
}
const directionOrder = ['north', 'south', 'east', 'west'];
const sectionOrder = [
  [
    'overview',
    [
      'distance',
      'flights',
      'airportCount',
      'airlineCount',
      'busiestAirport',
      'routeCount',
      'typeCount',
    ],
  ],
  ['time', ['firstDate', 'lastDate', 'peakYear', 'peakMonth']],
  ['airports', ['departureAirport', 'arrivalAirport']],
  ['extremes', directionOrder],
  ['routes', ['longestRoute', 'shortestRoute', 'commonRoute']],
  ['aviation', ['topAirlines', 'topAircraft', 'boeing', 'airbus', 'other']],
];
function packDirections(items) {
  const columns =
    items.length === 4 &&
    !items.some(
      (item) =>
        measure(item).span > 1 || Array.from(item.value || '').length >= 10,
    )
      ? 4
      : items.length === 1
        ? 1
        : 2;
  const span = COLS / columns;
  return items.map((item, index) => {
    const column = (index % columns) * span,
      gridY = Math.floor(index / columns) * 2;
    return {
      kind: item.kind,
      items: [item],
      column,
      gridY,
      span,
      units: 2,
      x: column * (COLUMN + GAP),
      y: gridY * UNIT,
      width: span * COLUMN + (span - 1) * GAP,
      height: 2 * UNIT - ROW_GAP,
    };
  });
}
function captionDetail(item) {
  return item.id === 'busiestAirport' && item.detail
    ? String(item.detail).replace(/次起降$/, '次')
    : '';
}
function contentHeight(block) {
  const item = block.items[0];
  if (item.kind === 'metric')
    return item.detail && item.id !== 'routeCount' ? 88 : 80;
  if (item.kind === 'airport')
    return item.detail && !captionDetail(item) ? 88 : 80;
  if (item.kind === 'aircraft') return item.detail ? 88 : 80;
  if (item.kind === 'route')
    return Math.ceil(item.entries.length / (block.entryColumns || 1)) > 1
      ? 148
      : 80;
  if (item.kind === 'ranking')
    return item.rows.length === 1 ? 80 : item.rows.length === 2 ? 112 : 148;
  return block.height;
}
function fitContentHeights(blocks) {
  const rows = new Map();
  for (const block of blocks) {
    const key = block.gridY;
    if (!rows.has(key)) rows.set(key, []);
    rows.get(key).push(block);
  }
  const placed = [];
  for (const [, row] of [...rows].sort((a, b) => a[0] - b[0])) {
    let y = 0;
    for (const block of row)
      for (const previous of placed)
        if (
          block.x < previous.x + previous.width &&
          previous.x < block.x + block.width
        )
          y = Math.max(y, previous.y + previous.height + ROW_GAP);
    const compact = row.every((block) =>
      ['metric', 'airport', 'aircraft'].includes(block.kind),
    );
    const rowHeight = compact ? Math.max(...row.map(contentHeight)) : 0;
    for (const block of row)
      placed.push({
        ...block,
        y,
        height: compact ? rowHeight : contentHeight(block),
      });
  }
  return placed;
}
function pack(items) {
  const byId = new Map(items.map((item) => [item.id, item])),
    result = [];
  let offset = 0;
  // Semantic sections take precedence over area fitting; their rectangles may not interleave.
  for (const [section, ids] of sectionOrder) {
    const selected = ids.filter((id) => byId.has(id)).map((id) => byId.get(id));
    if (!selected.length) continue;
    const bands =
      section === 'aviation'
        ? [
            selected.filter((item) =>
              ['topAirlines', 'topAircraft'].includes(item.id),
            ),
            selected.filter((item) =>
              ['boeing', 'airbus', 'other'].includes(item.id),
            ),
          ]
        : [selected];
    for (const band of bands) {
      if (!band.length) continue;
      if (result.length) offset += SECTION_GAP;
      const blocks = fitContentHeights(
        section === 'extremes' ? packDirections(band) : packBand(band),
      );
      for (const block of blocks)
        result.push({
          ...block,
          section,
          sectionY: offset,
          gridY: block.gridY + offset / UNIT,
          y: block.y + offset,
        });
      offset += Math.max(...blocks.map((block) => block.y + block.height));
    }
  }
  return result;
}
function rowRules(blocks) {
  const rows = new Map();
  for (const block of blocks) {
    if (block.y === 0) continue;
    const y = block.y - 22;
    if (!rows.has(y)) rows.set(y, []);
    rows.get(y).push([block.x, block.x + block.width]);
  }
  const rules = [];
  for (const [y, intervals] of rows) {
    intervals.sort((a, b) => a[0] - b[0]);
    let current;
    for (const interval of intervals) {
      if (current && interval[0] - current[1] <= GAP + 0.001)
        current[1] = Math.max(current[1], interval[1]);
      else {
        current = [...interval];
        rules.push({ y, interval: current });
      }
    }
  }
  return rules.map(({ y, interval }) => ({
    y,
    x: interval[0],
    width: interval[1] - interval[0],
  }));
}
module.exports = {
  COLS,
  UNIT,
  ROW_GAP,
  SECTION_GAP,
  PANEL_TOP,
  PANEL_BOTTOM,
  GAP,
  INNER,
  COLUMN,
  specs,
  measure,
  pack,
  sectionOrder,
  rowRules,
  ROUTE_METRIC_WIDTH,
  ROUTE_METRIC_GAP,
  ROUTE_NAME_MIN,
  canUseRouteColumns,
  captionDetail,
};
