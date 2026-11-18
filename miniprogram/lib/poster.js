const { mapProjection } = require('./poster-projection');
const content = require('./poster-content');
const rhythm = require('./poster-layout');
const typography = require('./poster-type.js');
const d3 = require('./d3'),
  world = require('./world'),
  names = require('./names');
const {
  atlasMix: mix,
  atlasReadable: readable,
  atlasLuminance: luminance,
  resolveColors,
} = require('./theme.js');
// Coordinates and typography follow dist/templates/portrait.html (1080 x 1150).
const layoutOwners = new WeakMap();
function posterDimensions(data, width = 2160, options = {}) {
  const layout =
    data?.airports && data?.routes
      ? mapProjection(data)
      : { mapHeight: 850, extraHeight: 0 };
  const contentHeight = content.height(data, options.posterContent);
  const baseHeight = contentHeight === null ? 1150 : 760 + contentHeight;
  const dimensions = {
    width,
    height: Math.ceil(((baseHeight + layout.extraHeight) * width) / 1080),
    ...layout,
    baseHeight,
    contentKey: JSON.stringify(options.posterContent ?? null),
  };
  if (data && typeof data === 'object') layoutOwners.set(dimensions, data);
  return dimensions;
}
function renderPoster(canvas, data, options = {}, preparedLayout) {
  const layout =
    preparedLayout &&
    layoutOwners.get(preparedLayout) === data &&
    preparedLayout.contentKey === JSON.stringify(options.posterContent ?? null)
      ? {
          ...preparedLayout,
          width: canvas.width,
          height: Math.ceil(
            ((preparedLayout.baseHeight + preparedLayout.extraHeight) *
              canvas.width) /
              1080,
          ),
        }
      : posterDimensions(data, canvas.width, options);
  if (canvas.height < layout.height) canvas.height = layout.height;
  const ctx = canvas.getContext('2d'),
    s = canvas.width / 1080;
  ctx.save();
  ctx.scale(s, s);
  const colors = resolveColors(options.colors, options.theme),
    bg = colors.background,
    route = colors.route,
    light = luminance(bg) > 0.4,
    text = readable(light ? '#172b3a' : '#eef3f5', bg, 7),
    muted = readable(mix(bg, text, 0.6), bg),
    land = mix(bg, text, light ? 0.1 : 0.14),
    panel = mix(bg, text, 0.035),
    accent = readable(route, panel),
    line = mix(panel, text, 0.22);
  const name = (c) => names[c] || c;
  const write = (v, x, y, size, color = text, spacing = 0, weight = 'normal') =>
    typography.text(ctx, v, x, y, size, color, spacing, weight);
  const rule = (x, y, w, color = line) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.stroke();
  };
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1080, layout.baseHeight + layout.extraHeight);
  const gradient = ctx.createRadialGradient(605, 276, 0, 605, 276, 920);
  gradient.addColorStop(0, mix(bg, text, 0.065));
  gradient.addColorStop(1, bg);
  ctx.fillStyle = gradient;
  ctx.fillRect(
    0,
    0,
    1080,
    Math.min(1150, layout.baseHeight + layout.extraHeight),
  );
  write('A PERSONAL ATLAS OF JOURNEYS', 64, 64, 17, muted, 3);
  ctx.save();
  ctx.translate(0, 115);
  ctx.scale(1080 / 1600, 1080 / 1600);
  const { projection, mapHeight } = layout,
    path = d3.geoPath(projection, ctx);
  ctx.beginPath();
  path(d3.geoGraticule10());
  ctx.strokeStyle = muted;
  ctx.lineWidth = 0.5;
  ctx.globalAlpha = 0.17;
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.beginPath();
  path(world);
  ctx.fillStyle = land;
  ctx.fill();
  ctx.strokeStyle = mix(land, text, 0.13);
  ctx.lineWidth = 0.5;
  ctx.stroke();
  ctx.globalAlpha = 0.28;
  ctx.textAlign = 'center';
  for (const [n, xy] of [
    ['欧洲', [20, 51]],
    ['非洲', [20, 0]],
    ['亚洲', [79, 40]],
    ['北美洲', [-105, 48]],
    ['南美洲', [-60, -16]],
    ['印度洋', [76, -18]],
    ['太平洋', [167, 0]],
  ]) {
    const p = projection(xy);
    write(n, p[0], p[1], 19, muted, 7);
  }
  ctx.textAlign = 'left';
  ctx.globalAlpha = 1;
  for (const r of data.routes) {
    const geo = {
      type: 'LineString',
      coordinates: [data.airports[r.a].xy, data.airports[r.b].xy],
    };
    for (const [alpha, width] of [
      [0.08, 5 + Math.sqrt(r.flights.length) * 1.9],
      [0.78, 0.9 + Math.sqrt(r.flights.length) * 0.8],
    ]) {
      ctx.beginPath();
      path(geo);
      ctx.strokeStyle = route;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.globalAlpha = alpha;
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  const extremes = new Set(Object.values(data.extremes));
  for (const [code, a] of Object.entries(data.airports).sort(
    (a, b) => a[1].n - b[1].n,
  )) {
    const [x, y] = projection(a.xy);
    ctx.beginPath();
    ctx.arc(x, y, 2 + Math.sqrt(a.n) * 0.55, 0, Math.PI * 2);
    ctx.fillStyle = readable(route, land, 3);
    ctx.fill();
    ctx.strokeStyle = bg;
    ctx.lineWidth = 1.4;
    ctx.stroke();
    if (extremes.has(code)) {
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.strokeStyle = readable(route, land, 3);
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.7;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
  const routeSamples = [];
  for (const routeData of data.routes) {
    const points = [];
    let last = null;
    const sampleCtx = {
      moveTo(x, y) {
        last = [x, y];
        points.push(last);
      },
      lineTo(x, y) {
        if (last) {
          const length = Math.hypot(x - last[0], y - last[1]);
          for (let t = 0; t < length; t += 5)
            points.push([
              last[0] + ((x - last[0]) * t) / length,
              last[1] + ((y - last[1]) * t) / length,
            ]);
        }
        last = [x, y];
      },
      closePath() {},
    };
    d3.geoPath(
      projection,
      sampleCtx,
    )({
      type: 'LineString',
      coordinates: [
        data.airports[routeData.a].xy,
        data.airports[routeData.b].xy,
      ],
    });
    routeSamples.push(...points);
  }
  const airportPoints = Object.entries(data.airports).map(([code, a]) => ({
      code,
      p: projection(a.xy),
    })),
    boxes = [];
  if (options.labels !== false)
    for (const code of Array.isArray(options.labelSelection)
      ? options.labelSelection
      : [
          ...new Set([
            ...Object.values(data.extremes),
            'CDG',
            'DXB',
            'IST',
            'CAI',
            'LAX',
            'RDU',
          ]),
        ]) {
      if (!data.airports[code]) continue;
      const [px, py] = projection(data.airports[code].xy),
        label = name(code) === code ? code : name(code) + ' ' + code;
      ctx.font = '21px ' + typography.FONT_FAMILY;
      const width = ctx.measureText(label).width,
        height = 26,
        radius = extremes.has(code)
          ? 11
          : 2 + Math.sqrt(data.airports[code].n) * 0.55,
        candidates = [];
      for (const gap of [5, 10, 16]) {
        const r = radius + gap;
        candidates.push(
          [px + r, py - height / 2],
          [px - r - width, py - height / 2],
          [px - width / 2, py - r - height],
          [px - width / 2, py + r],
          [px + r * 0.7, py - r - height],
          [px - r * 0.7 - width, py - r - height],
          [px + r * 0.7, py + r],
          [px - r * 0.7 - width, py + r],
        );
      }
      let best = null;
      for (const [x, y] of candidates) {
        if (x < 10 || x + width > 1590 || y < 5 || y + height > mapHeight - 5)
          continue;
        const b = [x - 2, y - 2, width + 4, height + 4],
          overlaps = boxes.filter(
            (o) =>
              b[0] < o[0] + o[2] + 6 &&
              b[0] + b[2] + 6 > o[0] &&
              b[1] < o[1] + o[3] + 4 &&
              b[1] + b[3] + 4 > o[1],
          ).length,
          crossings = routeSamples.filter(
            (p) =>
              p[0] > b[0] &&
              p[0] < b[0] + b[2] &&
              p[1] > b[1] &&
              p[1] < b[1] + b[3],
          ).length,
          points = airportPoints.filter(
            (a) =>
              a.code !== code &&
              a.p[0] > b[0] - 3 &&
              a.p[0] < b[0] + b[2] + 3 &&
              a.p[1] > b[1] - 3 &&
              a.p[1] < b[1] + b[3] + 3,
          ).length,
          ax = Math.max(x, Math.min(x + width, px)),
          ay = Math.max(y, Math.min(y + height, py)),
          distance = Math.hypot(ax - px, ay - py),
          score =
            overlaps * 10000 + points * 120 + crossings * 4 + distance * 0.6;
        if (!best || score < best.score)
          best = { x, y, b, ax, ay, distance, score };
      }
      if (code === 'RDU') {
        const x = Math.min(px + 12, 1588 - width),
          y = py - 7,
          ax = Math.max(x, Math.min(x + width, px));
        best = {
          x,
          y,
          b: [x - 2, y - 2, width + 4, height + 4],
          ax,
          ay: y,
          distance: Math.hypot(ax - px, y - py),
        };
      }
      if (!best) continue;
      boxes.push(best.b);
      if (best.distance > radius + 9) {
        const dx = best.ax - px,
          dy = best.ay - py,
          l = Math.hypot(dx, dy);
        ctx.beginPath();
        ctx.moveTo(px + (dx / l) * (radius + 2), py + (dy / l) * (radius + 2));
        ctx.lineTo(best.ax, best.ay);
        ctx.strokeStyle = muted;
        ctx.lineWidth = 0.65;
        ctx.globalAlpha = 0.55;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.strokeStyle = bg;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.strokeText(label, best.x, best.y + 20);
      write(label, best.x, best.y + 20, 21);
    }
  ctx.restore();
  ctx.translate(0, layout.extraHeight);
  const legacy = content.legacyBlocks(data, options.posterContent);
  const blocks = legacy || content.blocks(data, options.posterContent);
  const stampId = require('./stamp-id').normalize(options.posterStamp);
  const stamp = stampId ? require('./stamp-catalog').items.find(x=>x.id===stampId) : null;
  const drawStamp = (top=false) => {
    if(!stamp)return;
    const image=options.stampImage;
    if(!image?.width||!image?.height)throw Error('印章素材尚未就绪，请重试');
    ctx.save();if(top)ctx.translate(0,-layout.extraHeight);
    const scale=Math.min(76/image.width,70/image.height);
    ctx.drawImage(image,954-image.width*scale/2,(top?56:766)-image.height*scale/2,image.width*scale,image.height*scale);
    ctx.restore();
  };
  if(blocks!==null&&(!blocks.length||legacy))drawStamp(true);
  if (blocks !== null) {
    if (legacy) {
      let y = 730;
      for (let i = 0; i < legacy.length; i += 2) {
        const pair = legacy.slice(i, i + 2);
        rule(64, y, 952, accent);
        pair.forEach((block, col) => {
          const x = 92 + col * 468,
            width = pair.length === 1 ? 896 : 428;
          write(block.title, x, y + 38, 22, accent, 2, '500');
          block.lines.forEach((value, row) =>
            typography.runs(
              ctx,
              [{ text: value, size: 21, color: text }],
              x,
              y + 76 + row * 31,
              width,
              'left',
              0.65,
            ),
          );
        });
        y += 70 + Math.max(...pair.map((b) => b.lines.length)) * 31;
      }
    } else if (blocks.length) {
      const bottom = 730 + content.height(data, options.posterContent);
      const gradient = ctx.createLinearGradient(64, 730, 1016, bottom);
      gradient.addColorStop(0, panel);
      gradient.addColorStop(1, bg);
      ctx.fillStyle = gradient;
      ctx.fillRect(64, 730, 952, bottom - 730);
      drawStamp();
      rule(64, 730, 952, accent);
      typography.runs(
        ctx,
        [
          {
            text: require('./poster-title').normalize(options.posterTitle),
            size: 22,
            color: accent,
            spacing: 5,
            weight: '500',
          },
        ],
        92,
        778,
        stamp ? 810 : 896,
      );
      const fit = (runs, x, y, width, align = 'left', minScale = 0.65) =>
        typography.runs(ctx, runs, x, y, width, align, minScale);
      for (const divider of rhythm.rowRules(blocks))
        rule(
          92 + divider.x,
          730 + rhythm.PANEL_TOP + divider.y,
          divider.width,
          line,
        );
      for (const block of blocks) {
        const item = block.items[0],
          x = 92 + block.x,
          y = 730 + rhythm.PANEL_TOP + block.y,
          width = block.width;
        const caption = fit(
          [
            {
              text:
                item.label +
                (rhythm.captionDetail(item)
                  ? ' · ' + rhythm.captionDetail(item)
                  : ''),
              size: 14,
              spacing: 1,
              color: muted,
            },
          ],
          x,
          y + 5,
          width,
        );
        if (item.kind === 'metric') {
          fit(
            [
              {
                text: item.value,
                size: item.id.endsWith('Date')
                  ? 19
                  : item.id === 'peakMonth'
                    ? 20
                    : 27,
                spacing: 1,
                color: text,
              },
              { text: item.unit, size: 14, gap: 5, color: muted },
            ],
            x,
            y + 46,
            width,
          );
          if (item.detail && item.id !== 'routeCount')
            fit(
              [{ text: item.detail, size: 13, color: muted }],
              x,
              y + 68,
              width,
            );
        } else if (item.kind === 'aircraft') {
          fit([{ text: item.value, size: 19, color: text }], x, y + 42, width);
          fit(
            [{ text: item.detail, size: 13, color: muted }],
            x,
            y + 68,
            width,
          );
        } else if (item.kind === 'airport') {
          fit(
            [
              {
                text: item.value,
                size: item.id === 'busiestAirport' ? 21 : 19,
                color: text,
              },
              {
                text: item.code,
                size: item.id === 'busiestAirport' ? 17 : 14,
                gap: 6,
                color: accent,
              },
            ],
            x,
            y + (item.id === 'busiestAirport' ? 40 : 36),
            width,
          );
          if (item.detail && !rhythm.captionDetail(item))
            fit(
              [{ text: item.detail, size: 13, spacing: 0.6, color: muted }],
              x,
              y + 60,
              width,
            );
        } else if (item.kind === 'route') {
          const columns = block.entryColumns || 1,
            entryWidth = (width - rhythm.GAP * (columns - 1)) / columns,
            nameWidth =
              entryWidth - rhythm.ROUTE_METRIC_WIDTH - rhythm.ROUTE_METRIC_GAP;
          item.entries.forEach((entry, index) => {
            const entryX = x + (index % columns) * (entryWidth + rhythm.GAP),
              baseline = y + 36 + Math.floor(index / columns) * 66;
            const routeName = fit(
              [
                {
                  text:
                    name(entry.a) +
                    (entry.bidirectional ? ' ↔ ' : ' → ') +
                    name(entry.b),
                  size: 18,
                  color: text,
                },
              ],
              entryX,
              baseline,
              nameWidth,
              'left',
              rhythm.ROUTE_NAME_MIN / 18,
            );
            if (index && columns === 1) {
              const captionGap = 27 - typography.ascent(ctx, caption.runs[0]);
              const nameAscent = typography.ascent(ctx, routeName.runs[0]);
              rule(
                entryX,
                baseline - nameAscent - captionGap,
                entryWidth,
                mix(panel, text, 0.13),
              );
            }
            fit(
              [
                { text: entry.value, size: 21, color: accent },
                { text: entry.unit, size: 12, gap: 5, color: muted },
              ],
              entryX + entryWidth,
              baseline + 1,
              rhythm.ROUTE_METRIC_WIDTH,
              'right',
            );
            fit(
              [
                {
                  text:
                    entry.a + (entry.bidirectional ? ' ↔ ' : ' → ') + entry.b,
                  size: 13,
                  spacing: 0.6,
                  color: muted,
                },
                ...(!options.publicMode && entry.flight
                  ? [{ text: entry.flight, size: 11, gap: 10, color: muted }]
                  : []),
              ],
              entryX,
              baseline + 23,
              nameWidth,
            );
          });
        } else {
          const countColumn = 76,
            unitColumn = 18,
            rankColumn = 30,
            columnGap = 14;
          item.rows.forEach((entry, index) => {
            const baseline = y + 44 + index * 36;
            fit(
              [
                {
                  text: String(index + 1).padStart(2, '0'),
                  size: 12,
                  color: muted,
                },
              ],
              x,
              baseline,
              rankColumn,
            );
            fit(
              [{ text: String(entry.count), size: 19, color: accent }],
              x + width - unitColumn - 5,
              baseline,
              countColumn,
              'right',
            );
            fit(
              [{ text: '次', size: 12, color: muted }],
              x + width - unitColumn,
              baseline,
              unitColumn,
            );
            fit(
              [
                {
                  text: entry.name,
                  size: 18,
                  weight: index === 0 ? '500' : 'normal',
                  color: text,
                },
              ],
              x + rankColumn,
              baseline,
              width - rankColumn - countColumn - unitColumn - columnGap,
              'left',
              0.8,
            );
          });
        }
      }
      rule(64, bottom, 952);
    }
    ctx.restore();
    return;
  }
  // Web grid: 896px inner width, 18px overview gaps and 16px extreme gaps.
  // Baselines follow the web template; fitting only changes text inside its cell.
  const overviewColumns = [92, 320.5, 549, 777.5],
    extremeColumns = [92, 320, 548, 776],
    rowCount = Math.max(
      1,
      data.longestRoutes.length,
      data.shortestRoutes.length,
    ),
    panelBottom = 1084 + (rowCount - 1) * 45,
    panelGradient = ctx.createLinearGradient(64, 730, 1016, panelBottom);
  panelGradient.addColorStop(0, panel);
  panelGradient.addColorStop(1, bg);
  ctx.fillStyle = panelGradient;
  ctx.fillRect(64, 730, 952, panelBottom - 730);
  drawStamp();
  rule(64, 730, 952, accent);
  rule(64, panelBottom, 952);
  typography.runs(
    ctx,
    [
      {
        text: require('./poster-title').normalize(options.posterTitle),
        size: 22,
        color: accent,
        spacing: 5,
        weight: '500',
      },
    ],
    92,
    778,
    stamp ? 810 : 896,
  );
  const caption = (value, x, y, width = 212) =>
    typography.runs(
      ctx,
      [{ text: value, size: 14, spacing: 1, color: muted }],
      x,
      y,
      width,
      'left',
      12 / 14,
    );
  const airportText = (code, x, y, size, codeSize, gap, width) => {
    const airportName = name(code),
      runs = [{ text: airportName, size, spacing: 1, color: text }];
    if (airportName.toUpperCase() !== code.toUpperCase())
      runs.push({ text: code, size: codeSize, spacing: 1, gap, color: accent });
    return typography.runs(ctx, runs, x, y, width, 'left', 13 / size);
  };
  const busiest = data.busiest;
  const overview = [
    ['累计飞行里程', data.totalKm.toLocaleString('en-US'), 'km'],
    ['飞行次数', String(data.total), '次'],
    [
      '乘坐航司数',
      data.airlineCount ? String(data.airlineCount) : '未填写',
      data.airlineCount ? '家' : '',
    ],
  ];
  overview.forEach(([label, value, unit], i) => {
    caption(label, overviewColumns[i], 815, 210.5);
    typography.runs(
      ctx,
      [
        { text: value, size: 27, spacing: 1, color: text },
        { text: unit, size: 14, spacing: 1, gap: 5, color: muted },
      ],
      overviewColumns[i],
      856,
      210.5,
      'left',
      16 / 27,
    );
  });
  caption(
    '起降最多的机场 · ' + data.airports[busiest].n + ' 次',
    overviewColumns[3],
    815,
    210.5,
  );
  airportText(busiest, overviewColumns[3], 850, 21, 17, 7, 210.5);
  rule(92, 877, 896);
  ['north', 'south', 'east', 'west'].forEach((key, i) => {
    const code = data.extremes[key],
      [lon, lat] = data.airports[code].xy,
      x = extremeColumns[i],
      latitude = i < 2,
      value = latitude ? lat : lon;
    caption(['最北机场', '最南机场', '最东机场', '最西机场'][i], x, 907);
    airportText(code, x, 938, 18, 14, 5, 212);
    write(
      Math.abs(value).toFixed(2) +
        '° ' +
        (latitude ? (value >= 0 ? 'N' : 'S') : value >= 0 ? 'E' : 'W'),
      x,
      962,
      13,
      muted,
      0.6,
    );
  });
  rule(92, 979, 896);
  [
    ['longestRoutes', '最长航线'],
    ['shortestRoutes', '最短航线'],
  ].forEach(([key, title], col) => {
    const x = 92 + col * 468;
    caption(title, x, 1007, 428);
    data[key].forEach((routeData, i) => {
      const y = 1044.4 + i * 45;
      if (i) rule(x, 1060 + (i - 1) * 45, 428, mix(panel, text, 0.13));
      const distance = typography.runs(
        ctx,
        [
          {
            text: Math.round(routeData.km).toLocaleString('en-US'),
            size: 21,
            color: accent,
          },
          { text: 'km', size: 12, gap: 5, color: muted },
        ],
        x + 428,
        y + 2.6,
        132,
        'right',
        14 / 21,
      );
      const number = options.publicMode
        ? ''
        : routeData.flight
          ? routeData.airline &&
            !String(routeData.flight)
              .toUpperCase()
              .startsWith(String(routeData.airline).toUpperCase())
            ? routeData.airline + routeData.flight
            : routeData.flight
          : '未填写航班号';
      typography.runs(
        ctx,
        [
          {
            text: name(routeData.a) + ' → ' + name(routeData.b),
            size: 16,
            color: text,
          },
          { text: number, size: 11, gap: 8, color: mix(panel, text, 0.72) },
        ],
        x,
        y,
        428 - distance.width - 12,
        'left',
        13 / 16,
      );
    });
  });
  ctx.restore();
}
module.exports = { renderPoster, posterDimensions };
