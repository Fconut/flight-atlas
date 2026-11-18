const test = require('node:test'),
  assert = require('node:assert/strict');
const content = require('../miniprogram/lib/poster-content'),
  { calculate } = require('../miniprogram/lib/flights'),
  airports = require('../miniprogram/lib/airports');
const rows = [
  {
    date: '2025-01-01',
    departureTime: '08:00',
    from: 'SHA',
    to: 'PEK',
    airline: 'CA',
    flight: '1',
    aircraft: 'B738',
  },
  {
    date: '2025-01-02',
    from: 'PEK',
    to: 'SHA',
    airline: 'CA',
    flight: '2',
    aircraft: 'BOEING 737-800',
  },
  {
    date: '2024-05-01',
    from: 'SHA',
    to: 'NRT',
    airline: 'MU',
    flight: '3',
    aircraft: 'A321',
  },
];
const data = () => calculate(rows, airports, '2026-11-14', false);
test('25 individual fields migrate old groups and preserve null default versus empty map-only mode', () => {
  assert.equal(content.fields.length, 25);
  assert.equal(new Set(content.fields.map((f) => f.id)).size, 25);
  assert.equal(content.normalize(undefined), null);
  assert.equal(content.height(data(), null), null);
  assert.equal(content.height(data(), []), 0);
  assert.deepEqual(
    content.normalize(['bad', 'flights', 'flights', 'distance']),
    ['distance', 'flights'],
  );
  assert.deepEqual(content.normalize(['time']), ['firstDate', 'lastDate']);
  assert(content.normalize(['overview', 'aviation']).includes('boeing'));
});
test('structured statistics keep dates, models and airport visits while route frequencies combine both directions', () => {
  const v = content.build(data());
  assert.equal(v.flights.value, '3');
  assert.equal(v.routeCount.value, '2');
  assert.equal(v.commonRoute.entries[0].value, '2');
  assert.equal(v.commonRoute.entries[0].bidirectional, true);
  assert.equal(v.firstAirport, undefined);
  assert.equal(v.lastAirport, undefined);
  assert.match(v.peakMonth.value, /^\d{4} 年 \d{1,2} 月$/);
  assert(v.topAirlines.rows[0].name.includes('国航'));
  assert.equal(v.badgeCount, undefined);
  assert.equal(v.typeCount.value, '2');
  assert.equal(v.firstDate.detail, '2024-05-01');
  assert.equal(v.firstDate.value, '上海虹桥 → 东京成田');
  assert.equal(v.lastDate.detail, '2025-01-02');
  assert.equal(v.busiestAirport.detail, '3 次起降');
  assert.equal(v.boeing.rows[0].name, 'BOEING 737-800');
  assert.equal(v.boeing.rows[0].count, 2);
  assert.equal(v.airbus.rows[0].name, 'AIRBUS A321');
  assert.equal(v.airbus.rows[0].count, 1);
});
test('first and latest flight records follow departure time on the same day', () => {
  const d = calculate(
      [
        {
          date: '2025-01-01',
          departureTime: '22:00',
          from: 'PEK',
          to: 'NRT',
          airline: 'CA',
          flight: '1',
        },
        {
          date: '2025-01-01',
          departureTime: '08:00',
          from: 'SHA',
          to: 'PEK',
          airline: 'CA',
          flight: '2',
        },
      ],
      airports,
      '2026-11-14',
      false,
    ),
    v = content.build(d);
  assert.equal(v.firstDate.value, '上海虹桥 → 北京首都');
  assert.equal(v.lastDate.value, '北京首都 → 东京成田');
});
test('missing optional data omits cells, zero counts remain visible and removed badge count is ignored', () => {
  const d = calculate(
      [
        {
          date: '2099-01-01',
          from: 'SHA',
          to: 'PEK',
          airline: 'CA',
          flight: '1',
          aircraft: 'B738',
        },
      ],
      airports,
      '2026-11-14',
      true,
    ),
    v = content.build(d);
  assert.equal(v.badgeCount, undefined);
  assert.equal(v.airbus, undefined);
  const missing = calculate(
    [{ date: '2025-01-01', from: 'SHA', to: 'PEK' }],
    airports,
    '2026-11-14',
    false,
  );
  assert.equal(
    content.blocks(missing, ['badgeCount', 'topAircraft']).length,
    0,
  );
  assert.equal(content.blocks(missing, ['airbus']).length, 0);
});
test('each option has an explicit content contract and measured area, including two longest and shortest routes', () => {
  const d = data(),
    values = content.build(d),
    layout = require('../miniprogram/lib/poster-layout');
  assert.equal(Object.keys(layout.specs).length, 25);
  for (const field of content.fields) {
    assert(field.rule.contents.length);
    assert.equal(field.rule, layout.specs[field.id]);
  }
  for (const [id, key] of [
    ['longestRoute', 'longestRoutes'],
    ['shortestRoute', 'shortestRoutes'],
  ]) {
    assert.equal(values[id].entries.length, d[key].length);
    assert.equal(values[id].entries.length, 2);
    assert.deepEqual(
      values[id].entries.map((v) => [v.a, v.b]),
      d[key].map((v) => [v.a, v.b]),
    );
    const single = content.blocks(d, [id])[0],
      mixed = content
        .blocks(d, ['distance', 'flights', 'topAircraft', id])
        .find((b) => b.items[0].id === id);
    assert.equal(single.units, 2);
    assert.equal(single.entryColumns, 2);
    assert.equal(mixed.units, 2);
    assert.equal(mixed.items[0].entries.length, 2);
  }
  const one = calculate([rows[0]], airports, '2026-11-14', false);
  assert.equal(content.build(one).longestRoute.entries.length, 1);
  assert.equal(content.blocks(one, ['longestRoute'])[0].units, 2);
});
test('individual, sparse, dense and seeded combinations keep map geometry and fit calculated canvas height', () => {
  const {
      posterDimensions,
      renderPoster,
    } = require('../miniprogram/lib/poster'),
    d = data(),
    baseline = posterDimensions(d);
  const ctx = new Proxy(
    {
      measureText: (s) => ({ width: String(s).length * 12 }),
      createRadialGradient: () => ({ addColorStop() {} }),
      createLinearGradient: () => ({ addColorStop() {} }),
    },
    { get: (o, k) => (k in o ? o[k] : () => {}) },
  );
  const selections = [
    [],
    content.defaultSelection,
    content.fields.map((f) => f.id),
    ...content.fields.map((f) => [f.id]),
  ];
  let seed = 42;
  for (let i = 0; i < 64; i++)
    selections.push(
      content.fields
        .filter(() => {
          seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
          return seed % 3 === 0;
        })
        .map((f) => f.id),
    );
  for (const selection of selections) {
    const options = { posterContent: selection },
      layout = posterDimensions(d, 2160, options),
      canvas = { width: 2160, height: layout.height, getContext: () => ctx };
    assert.equal(layout.mapHeight, baseline.mapHeight);
    assert.deepEqual(
      layout.projection([121, 31]),
      baseline.projection([121, 31]),
    );
    const cells = content.blocks(d, selection);
    assert(
      cells.every(
        (b) =>
          b.column >= 0 &&
          b.column + b.span <= 4 &&
          b.x >= 0 &&
          b.x + b.width <= 896.001,
      ),
    );
    for (let i = 0; i < cells.length; i++)
      for (let j = i + 1; j < cells.length; j++) {
        const a = cells[i],
          b = cells[j];
        assert(
          a.x + a.width <= b.x ||
            b.x + b.width <= a.x ||
            a.y + a.height <= b.y ||
            b.y + b.height <= a.y,
          'option areas must not overlap',
        );
      }
    if (cells.length)
      assert.equal(
        content.height(d, selection),
        require('../miniprogram/lib/poster-layout').PANEL_TOP +
          Math.max(...cells.map((b) => b.y + b.height)) +
          require('../miniprogram/lib/poster-layout').PANEL_BOTTOM,
      );
    assert.equal(
      cells.flatMap((r) => r.items).length,
      new Set(cells.flatMap((r) => r.items).map((v) => v.id)).size,
    );
    renderPoster(canvas, d, options, layout);
    assert.equal(canvas.height, layout.height);
  }
});
test('selection survives account restore, semantic keys and independent cloud merge', () => {
  const draft = require('../miniprogram/lib/draft-state'),
    { mergeDrafts } = require('../miniprogram/lib/merge-drafts');
  const base = draft.snapshot({ rows, prefs: { posterContent: null } }),
    local = draft.snapshot({
      rows,
      prefs: { posterContent: ['distance', 'firstDate', 'topAircraft'] },
    });
  assert.notEqual(draft.key(base), draft.key(local));
  assert.deepEqual(draft.localState(local).prefs.posterContent, [
    'distance',
    'firstDate',
    'topAircraft',
  ]);
  assert.deepEqual(
    mergeDrafts(base, local, base).posterContent,
    local.posterContent,
  );
  assert.deepEqual(
    draft.localState(draft.validate(local)).prefs.posterContent,
    local.posterContent,
  );
  const reset = draft.snapshot({ rows, prefs: { posterContent: null } });
  assert.equal(mergeDrafts(local, reset, local).posterContent, null);
});
test('client/server share snapshots expose only chosen fine-grained statistics including explicitly chosen dates', () => {
  const draft = require('../miniprogram/lib/draft-state'),
    client = require('../miniprogram/lib/share-snapshot'),
    server = require('../cloudfunctions/atlas-share/domain/share-snapshot');
  for (const selection of [
    null,
    [],
    ['flights'],
    ['firstDate', 'lastDate', 'topAircraft'],
    ['longestRoute', 'shortestRoute'],
  ]) {
    const d = draft.snapshot({ rows, prefs: { posterContent: selection } }),
      a = client.buildSnapshot(d, '2026-11-14'),
      b = server.buildSnapshot(d, '2026-11-14');
    assert.deepEqual(a, b);
    for (const id of ['longestRoute', 'shortestRoute'])
      if (selection?.includes(id)) {
        assert.equal(a.map.posterStats.items[id].entries.length, 2);
        assert(
          a.map.posterStats.items[id].entries.every(
            (entry) => !('flight' in entry),
          ),
        );
      }
    if (selection === null) {
      assert.equal(a.map.posterStats, undefined);
      continue;
    }
    assert.deepEqual(
      Object.keys(a.map.posterStats.items),
      content.normalize(selection),
    );
    assert.equal(
      JSON.stringify(a).includes('2025-01-02'),
      selection.includes('lastDate'),
    );
    assert(!JSON.stringify(a).includes('"departureTime"'));
    assert(!JSON.stringify(a).includes('"Flight"'));
    assert.equal(
      content.blocks(client.posterData(a), selection).flatMap((r) => r.items)
        .length,
      selection.length,
    );
  }
});
test('previous shared snapshots retain their old block data and dimensions', () => {
  const d = {
    ...data(),
    posterStats: {
      overview: ['飞行 3 次', '到访 3 座机场'],
      time: ['首次飞行 2024 年', '最近飞行 2025 年'],
    },
  };
  assert.deepEqual(
    content.legacyBlocks(d, ['overview', 'time']).map((v) => v.id),
    ['overview', 'time'],
  );
  assert.equal(content.height(d, ['overview', 'time']), 70 + 2 * 31 + 55);
  assert.equal(content.height({ ...d, posterStats: {} }, []), 0);
});
test('settings expose every field with a data preview and preserve saved choices after write failure', () => {
  const create = require('../miniprogram/pages/index/logic/create-page'),
    p = create('map');
  p.result = data();
  p.setData = function (v) {
    Object.assign(this.data, v);
  };
  p.updatePosterContent();
  assert.equal(p.data.posterContentCount, 10);
  assert.equal(p.data.posterContentGroups.flatMap((g) => g.items).length, 25);
  assert(
    p.data.posterContentGroups
      .flatMap((g) => g.items)
      .find((v) => v.id === 'firstDate')
      .preview.includes('2024-05-01'),
  );
  p.savePreferences = () => {
    p.setData({ posterContent: null });
    return false;
  };
  p.choosePosterContent({ detail: { value: ['firstDate'] } });
  assert.equal(p.data.posterContentCustom, false);
});

test('600 sparse and dense area selections remain collision-free without trimming route records', () => {
  const d = data(),
    fields = content.fields;
  let seed = 2026;
  for (let sample = 0; sample < 600; sample++) {
    const ids = fields
      .filter(() => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed % 5 < (sample % 5) + 1;
      })
      .map((f) => f.id);
    const layout = content.blocks(d, ids);
    for (let i = 0; i < layout.length; i++) {
      const a = layout[i];
      assert(a.width > 0 && a.height > 0);
      assert(a.column + a.span <= 4);
      if (a.items[0].id === 'longestRoute' || a.items[0].id === 'shortestRoute')
        assert.equal(a.items[0].entries.length, 2);
      for (let j = i + 1; j < layout.length; j++) {
        const b = layout[j];
        assert(
          a.x + a.width <= b.x ||
            b.x + b.width <= a.x ||
            a.y + a.height <= b.y ||
            b.y + b.height <= a.y,
        );
      }
    }
  }
});

test('direction footprints form one four-column row or a coherent two-by-two group', () => {
  const d = data(),
    all = content.fields.map((f) => f.id);
  const short = content.blocks(d, all),
    directions = short.filter((b) => b.section === 'extremes');
  assert.deepEqual(
    directions.map((b) => b.items[0].id),
    ['north', 'south', 'east', 'west'],
  );
  assert.equal(new Set(directions.map((b) => b.y)).size, 1);
  assert.deepEqual(
    directions.map((b) => b.column),
    [0, 1, 2, 3],
  );
  const values = content.build(d);
  values.north = {
    ...values.north,
    value: '这是一个非常长的机场名称用于验证成组排版',
  };
  const long = content.blocks(
      { ...d, posterStats: { version: 3, items: values } },
      all,
    ),
    group = long.filter((b) => b.section === 'extremes');
  assert.deepEqual(
    group.map((b) => b.column),
    [0, 2, 0, 2],
  );
  assert.deepEqual(
    group.map((b) => b.span),
    [2, 2, 2, 2],
  );
  assert.equal(group[2].y - group[0].y, 96);
  assert.equal(group[0].y, group[1].y);
  assert.equal(group[2].y, group[3].y);
  const start = Math.min(...group.map((b) => b.y)),
    end = Math.max(...group.map((b) => b.y + b.height));
  assert(
    long
      .filter((b) => b.section !== 'extremes')
      .every((b) => b.y + b.height <= start || b.y >= end),
  );
});
test('semantic sections remain ordered and old badge-count preferences are dropped', () => {
  assert.deepEqual(content.normalize(['badgeCount', 'flights']), ['flights']);
  assert.deepEqual(content.normalize(['badges']), ['typeCount']);
  assert.equal(
    content.fields.some((f) => f.id === 'badgeCount'),
    false,
  );
  const d = data(),
    selection = content.fields.map((f) => f.id).reverse(),
    layout = content.blocks(d, selection),
    order = ['overview', 'time', 'airports', 'extremes', 'routes', 'aviation'];
  let previous = -1;
  for (const block of layout) {
    const index = order.indexOf(block.section);
    assert(index >= previous);
    previous = index;
  }
  for (const selected of [
    ['north'],
    ['north', 'south'],
    ['north', 'south', 'east'],
  ]) {
    const group = content
      .blocks(d, [...selected, 'longestRoute', 'flights'])
      .filter((b) => b.section === 'extremes');
    assert.equal(group.length, selected.length);
    assert.deepEqual(
      group.map((b) => b.items[0].id),
      selected,
    );
  }
});

test('poster rhythm keeps row breathing room and a stronger gap between semantic sections', () => {
  const d = data(),
    layout = content.blocks(
      d,
      content.fields.map((f) => f.id),
    );
  for (let i = 0; i < layout.length; i++)
    for (let j = i + 1; j < layout.length; j++) {
      const a = layout[i],
        b = layout[j];
      if (a.x < b.x + b.width && b.x < a.x + a.width) {
        const gap =
          a.y + a.height <= b.y ? b.y - a.y - a.height : a.y - b.y - b.height;
        assert(gap >= 8, 'vertically adjacent cells need breathing room');
      }
    }
  let bottom = 0,
    previous;
  for (const section of require('../miniprogram/lib/poster-layout').sectionOrder.map(
    (v) => v[0],
  )) {
    const blocks = layout.filter((b) => b.section === section);
    if (!blocks.length) continue;
    const start = Math.min(...blocks.map((b) => b.y));
    if (previous) assert(start - bottom >= 12);
    bottom = Math.max(...blocks.map((b) => b.y + b.height));
    previous = section;
  }
});

test('row dividers merge across peers but do not cut through a neighboring tall item', () => {
  const { rowRules } = require('../miniprogram/lib/poster-layout');
  const rules = rowRules([
    { x: 0, y: 0, width: 439 },
    { x: 457, y: 0, width: 439 },
    { x: 457, y: 104, width: 439 },
  ]);
  assert.deepEqual(rules, [{ x: 457, y: 82, width: 439 }]);
  const full = rowRules([
    { x: 0, y: 104, width: 210.5 },
    { x: 228.5, y: 104, width: 210.5 },
    { x: 457, y: 104, width: 210.5 },
    { x: 685.5, y: 104, width: 210.5 },
  ]);
  assert.deepEqual(full, [{ x: 0, y: 82, width: 896 }]);
});

test('manufacturer favourites aggregate model aliases, count only matching flights and mark ties', () => {
  const extended = [
    ...rows,
    { ...rows[0], flight: '4', aircraft: 'E190' },
    { ...rows[0], flight: '5', aircraft: 'BOEING 787-9' },
    { ...rows[0], flight: '6', aircraft: 'B789' },
  ];
  const d = calculate(extended, airports, '2026-11-14', false),
    v = content.build(d);
  assert.equal(v.boeing.kind, 'ranking');
  assert.equal(v.boeing.rows[0].count, 2);
  assert.deepEqual(
    v.boeing.rows.map((row) => row.count),
    [2, 2],
  );
  assert.equal(v.airbus.rows[0].name, 'AIRBUS A321');
  assert.equal(v.other.rows[0].name, 'EMBRAER E190');
  assert.equal(v.other.rows[0].count, 1);
  assert.equal(
    content.build(
      calculate(extended.slice().reverse(), airports, '2026-11-14', false),
    ).boeing.rows[0].name,
    v.boeing.rows[0].name,
  );
  const snap = require('../miniprogram/lib/share-snapshot').buildSnapshot(
    require('../miniprogram/lib/draft-state').snapshot({
      rows: extended,
      prefs: { posterContent: ['boeing', 'airbus', 'other'] },
    }),
    '2026-11-14',
  );
  assert.equal(snap.map.posterStats.items.boeing.rows[0].count, 2);
  assert.equal(snap.map.posterStats.items.other.rows[0].name, 'EMBRAER E190');
});
test('old share manufacturer totals keep their original meaning instead of being relabeled as aircraft', () => {
  const d = {
    ...data(),
    posterStats: {
      version: 3,
      items: {
        boeing: {
          id: 'boeing',
          kind: 'metric',
          value: '12',
          unit: '次',
          detail: '',
        },
      },
    },
  };
  const block = content.blocks(d, ['boeing'])[0];
  assert.equal(block.items[0].label, '波音飞行次数');
  assert.equal(block.items[0].value, '12');
});

test('manufacturer ranking uses the same top-three shape as overall aircraft ranking', () => {
  const records = [];
  let n = 0;
  for (const [aircraft, count] of [
    ['B738', 4],
    ['B789', 3],
    ['B77W', 2],
    ['B739', 1],
    ['A321', 2],
    ['E190', 1],
  ])
    for (let i = 0; i < count; i++)
      records.push({
        ...rows[0],
        _id: String(++n),
        flight: String(n),
        aircraft,
      });
  const d = calculate(records, airports, '2026-11-14', false),
    v = content.build(d);
  assert.equal(v.boeing.kind, v.topAircraft.kind);
  assert.equal(v.boeing.rows.length, 3);
  assert.deepEqual(
    v.boeing.rows.map((r) => r.count),
    [4, 3, 2],
  );
  assert(v.boeing.rows.every((r) => r.name.startsWith('BOEING')));
  assert.equal(v.airbus.rows.length, 1);
  assert.equal(v.other.rows.length, 1);
  const blocks = content.blocks(d, ['boeing', 'airbus', 'other']);
  assert.equal(blocks.length, 3);
  assert(blocks.every((b) => b.span >= 2));
  assert.equal(blocks.find((b) => b.items[0].id === 'boeing').units, 3);
});

test('most-travelled routes show two bidirectional routes and preserve their counts in shares', () => {
  const d = data(),
    v = content.build(d);
  assert.equal(v.commonRoute.entries.length, 2);
  assert.deepEqual(
    v.commonRoute.entries.map((r) => r.value),
    ['2', '1'],
  );
  assert.equal(content.blocks(d, ['commonRoute'])[0].units, 2);
  assert.equal(content.blocks(d, ['commonRoute'])[0].entryColumns, 2);
  const one = calculate([rows[0]], airports, '2026-11-14', false);
  assert.equal(content.build(one).commonRoute.entries.length, 1);
  assert.equal(content.blocks(one, ['commonRoute'])[0].units, 2);
  const draft = require('../miniprogram/lib/draft-state').snapshot({
      rows,
      prefs: { posterContent: ['commonRoute'] },
    }),
    snapshot = require('../miniprogram/lib/share-snapshot').buildSnapshot(
      draft,
      '2026-11-14',
    );
  assert.equal(snapshot.map.posterStats.items.commonRoute.entries.length, 2);
  assert.deepEqual(
    snapshot,
    require('../cloudfunctions/atlas-share/domain/share-snapshot').buildSnapshot(
      draft,
      '2026-11-14',
    ),
  );
});

test('two-route details use columns only when full width and readable, retaining vertical layout otherwise', () => {
  const d = data(),
    pair = content.blocks(d, ['longestRoute', 'shortestRoute']);
  assert(pair.every((b) => b.span === 2 && b.units === 3 && !b.entryColumns));
  const horizontal = content.blocks(d, ['commonRoute'])[0];
  assert.equal(horizontal.entryColumns, 2);
  assert.equal(horizontal.items[0].entries.length, 2);
  const values = content.build(d);
  values.commonRoute = {
    ...values.commonRoute,
    entries: values.commonRoute.entries.map((e) => ({
      ...e,
      a: '很长的机场名称'.repeat(12),
    })),
  };
  const vertical = content.blocks(
    { ...d, posterStats: { version: 3, items: values } },
    ['commonRoute'],
  )[0];
  assert.equal(vertical.entryColumns, undefined);
  assert.equal(vertical.units, 3);
  assert.equal(vertical.items[0].entries.length, 2);
});

test('route distances align with primary names and secondary metadata stays on its own line', () => {
  const d = data(),
    draws = [],
    ctx = new Proxy(
      {
        fillText: (value, x, y) => draws.push({ value: String(value), x, y }),
        measureText: (value) => ({ width: String(value).length * 10 }),
        createRadialGradient: () => ({ addColorStop() {} }),
        createLinearGradient: () => ({ addColorStop() {} }),
      },
      { get: (o, k) => (k in o ? o[k] : () => {}) },
    ),
    poster = require('../miniprogram/lib/poster'),
    options = { posterContent: ['longestRoute', 'shortestRoute'] },
    dimensions = poster.posterDimensions(d, 1080, options);
  poster.renderPoster(
    { width: 1080, height: dimensions.height, getContext: () => ctx },
    d,
    options,
    dimensions,
  );
  const primary = draws.filter(
    (v) => v.value.includes(' → ') && /[\u4e00-\u9fff]/.test(v.value),
  );
  assert.equal(primary.length, 4);
  for (const name of primary) {
    assert(
      draws.some(
        (v) => /^[0-9,]+$/.test(v.value) && v.x > name.x && v.y === name.y + 1,
      ),
    );
    const secondary = draws
      .filter((v) => v.y === name.y + 23 && v.x >= name.x && v.x < name.x + 439)
      .sort((a, b) => a.x - b.x)
      .map((v) => v.value)
      .join('');
    assert(/^[A-Z]{3} → [A-Z]{3}/.test(secondary));
  }
});

test('busiest airport keeps its count in the caption and summary uses two lines', () => {
  const rhythm = require('../miniprogram/lib/poster-layout');
  const blocks = content.blocks(data(), content.defaultSelection);
  const summary = blocks.filter((b) => b.section === 'overview');
  assert(summary.length >= 4);
  assert(summary.every((b) => b.y === 0 && b.height === 80));
  const busy = summary.find((b) => b.items[0].id === 'busiestAirport').items[0];
  assert.match(rhythm.captionDetail(busy), /^\d+ 次$/);
  assert(
    blocks
      .filter((b) => b.section === 'extremes')
      .every((b) => b.height === 88),
  );
  assert.equal(
    Math.min(...blocks.filter((b) => b.section === 'extremes').map((b) => b.y)),
    92,
  );
});

test('separator spacing follows visible text size and has a safe metrics fallback', () => {
  const type = require('../miniprogram/lib/poster-type');
  const ctx = {
    save() {},
    restore() {},
    measureText() {
      return {
        actualBoundingBoxAscent: parseFloat(this.font.split(' ')[1]) * 0.75,
      };
    },
  };
  const caption = type.ascent(ctx, { text: '最长航线', size: 14 });
  const gap = 27 - caption;
  for (const size of [14, 18]) {
    const ascent = type.ascent(ctx, { text: '圣地亚哥 → 奥克兰', size });
    const baseline = 102;
    const line = baseline - ascent - gap;
    assert.equal(baseline - ascent - line, gap);
  }
  ctx.measureText = () => ({ width: 10 });
  assert.equal(type.ascent(ctx, { text: '机场', size: 18 }), 14.4);
});

test('most-travelled ranking combines opposite directions before selecting the top two', () => {
  const rows = [];
  let day = 1;
  const add = (from, to, count) => {
    for (let i = 0; i < count; i++)
      rows.push({
        date: '2025-01-' + String(day++).padStart(2, '0'),
        from,
        to,
        airline: 'CA',
        flight: String(day),
      });
  };
  add('SHA', 'PEK', 3);
  add('PEK', 'SHA', 2);
  add('SHA', 'NRT', 4);
  const d = calculate(rows, airports, '2026-11-14', false),
    item = content.build(d).commonRoute;
  assert.deepEqual(
    item.entries.map((e) => [e.a, e.b, e.value]),
    [
      ['SHA', 'PEK', '5'],
      ['SHA', 'NRT', '4'],
    ],
  );
  assert.equal(d.routes.length, 2);
  assert.equal(content.build(d).routeCount.value, '2');
  const draft = require('../miniprogram/lib/draft-state').snapshot({
    rows,
    prefs: { posterContent: ['commonRoute'] },
  });
  const client = require('../miniprogram/lib/share-snapshot').buildSnapshot(
    draft,
    '2026-11-14',
  );
  const server =
    require('../cloudfunctions/atlas-share/domain/share-snapshot').buildSnapshot(
      draft,
      '2026-11-14',
    );
  assert.deepEqual(client, server);
  assert.deepEqual(
    client.map.posterStats.items.commonRoute.entries.map((e) => [
      e.a,
      e.b,
      e.value,
    ]),
    [
      ['SHA', 'PEK', '5'],
      ['SHA', 'NRT', '4'],
    ],
  );
  const reverse = calculate(rows.slice(0, 5), airports, '2026-11-14', false);
  assert.deepEqual(
    content.build(reverse).commonRoute.entries.map((e) => [e.a, e.b, e.value]),
    [['SHA', 'PEK', '5']],
  );
});
