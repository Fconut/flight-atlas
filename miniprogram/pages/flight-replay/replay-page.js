const d3 = require('../../lib/d3'),
  world = require('../../lib/world'),
  names = require('../../lib/names');
const account = require('../../lib/account-state'),
  local = require('../../lib/local-state');
const { localDay } = require('../../lib/day'),
  {
    replayData,
    replayTouchPoint,
    replayLabelCodes,
  } = require('../../lib/flight-replay'),
  { mapProjection } = require('../../lib/poster-projection');
const { atlasColors, atlasMix, atlasLuminance } = require('../../lib/theme');
let returnedState = null;
module.exports = (landscape = false) => ({
  data: {
    ready: false,
    playing: false,
    index: 0,
    total: 0,
    speed: 1,
    progress: 0,
    ended: false,
    message: '',
    landscape,
  },
  onLoad(options = {}) {
    this.startIndex = Math.max(0, Number(options.index) || 0);
    this.startFraction = Math.max(
      0,
      Math.min(0.999, Number(options.fraction) || 0),
    );
    this.setData({
      speed: [1, 2, 4].includes(Number(options.speed))
        ? Number(options.speed)
        : 1,
    });
    try {
      this.scope = account.activeScope();
      const stored = local.read(this.scope);
      this.timeline = replayData(stored.rows, localDay());
      this.colors = atlasColors(stored.prefs.colors);
      this.labelCodes = replayLabelCodes(this.timeline.airports, stored.prefs);
      this.setData({
        total: this.timeline.flights.length,
        message: this.timeline.flights.length ? '' : '暂无可回放的已飞行程',
      });
    } catch (e) {
      this.setData({ message: '暂时无法读取记录：' + e.message });
    }
  },
  onReady() {
    if (!this.timeline?.flights.length) return;
    this.createSelectorQuery()
      .select('#replay')
      .fields({ node: true, size: true, rect: true })
      .select('#replay-base')
      .fields({ node: true })
      .exec((items) => {
        if (this.disposed || !items[0]?.node || !items[1]?.node) return;
        try {
          this.canvasRect = items[0];
          this.canvas = items[0].node;
          this.base = items[1].node;
          this.layout = mapProjection(this.timeline);
          this.displayWidth = items[0].width || 340;
          this.resizeViewport(
            landscape
              ? { windowWidth: items[0].width, windowHeight: items[0].height }
              : undefined,
          );
          this.setData({ ready: true });
          this.paintBase();
          this.seekIndex(this.startIndex, this.startFraction);
        } catch (e) {
          this.setData({ message: '回放未能生成：' + e.message });
        }
      });
  },
  resizeViewport(size) {
    if (!this.canvas || !this.base || !this.layout) return;
    const window = size || wx.getWindowInfo(),
      mapRatio = this.layout.mapHeight / 1600;
    const viewportWidth = landscape
      ? Math.max(window.windowWidth, window.windowHeight)
      : window.windowWidth;
    const viewportHeight = landscape
      ? Math.min(window.windowWidth, window.windowHeight)
      : window.windowHeight;
    const cssWidth = landscape ? viewportWidth : this.displayWidth,
      cssHeight = landscape ? viewportHeight : cssWidth * mapRatio;
    if (
      !Number.isFinite(cssWidth) ||
      !Number.isFinite(cssHeight) ||
      cssWidth <= 0 ||
      cssHeight <= 0
    )
      return false;
    // Match physical display pixels; both canvases share a 32 MB RGBA budget.
    const device = wx.getWindowInfo(),
      pixelRatio = Math.max(1, Math.min(4, Number(device.pixelRatio) || 1)),
      ratio = cssHeight / cssWidth,
      width = Math.min(
        Math.ceil(cssWidth * pixelRatio),
        Math.floor(Math.sqrt(4000000 / ratio)),
      );
    for (const canvas of [this.canvas, this.base]) {
      canvas.width = width;
      canvas.height = Math.ceil(width * ratio);
    }
    this.mapScale = Math.min(
      width / 1600,
      this.canvas.height / this.layout.mapHeight,
    );
    this.mapOffset = [
      (width - 1600 * this.mapScale) / 2,
      (this.canvas.height - this.layout.mapHeight * this.mapScale) / 2,
    ];
    this.setData({ mapWidth: cssWidth, mapHeight: Math.round(cssHeight) });
    return true;
  },
  onResize() {
    this.dragCancel();
    if (!this.canvas) return;
    wx.nextTick(() =>
      this.createSelectorQuery()
        .select('#replay')
        .fields({ size: true, rect: true })
        .exec((items) => {
          if (this.disposed || !items[0]) return;
          this.canvasRect = items[0];
          this.displayWidth = items[0].width;
          this.resizeViewport({
            windowWidth: items[0].width,
            windowHeight: items[0].height,
          });
          this.paintBase();
          this.paint(this.fraction || 0);
        }),
    );
  },
  paintBase() {
    this.trailIndex = 0;
    const ctx = this.base.getContext('2d'),
      s = this.mapScale;
    ctx.fillStyle = this.colors.background;
    ctx.fillRect(0, 0, this.base.width, this.base.height);
    ctx.save();
    ctx.translate(...this.mapOffset);
    ctx.scale(s, s);
    const light = atlasLuminance(this.colors.background) > 0.4;
    ctx.beginPath();
    d3.geoPath(this.layout.projection, ctx)(world);
    ctx.fillStyle = atlasMix(
      this.colors.background,
      light ? '#172b3a' : '#eef3f5',
      0.14,
    );
    ctx.fill();
    ctx.strokeStyle = atlasMix(
      this.colors.background,
      light ? '#172b3a' : '#eef3f5',
      0.2,
    );
    ctx.lineWidth = 0.6;
    ctx.stroke();
    ctx.restore();
  },
  prepareGeometry() {
    if (this.routeGeometry) return this.routeGeometry;
    this.routeGeometry = this.timeline.flights.map((f) => {
      const interpolate = d3.geoInterpolate(
        this.timeline.airports[f.from].xy,
        this.timeline.airports[f.to].xy,
      );
      return {
        interpolate,
        line: {
          type: 'LineString',
          coordinates: Array.from({ length: 49 }, (_, i) =>
            interpolate(i / 48),
          ),
        },
      };
    });
    return this.routeGeometry;
  },
  prepareTrails() {
    const end = Math.min(this.data.index, this.timeline.flights.length);
    if (this.trailIndex === undefined || end < this.trailIndex)
      this.paintBase();
    if (end === this.trailIndex) return;
    const ctx = this.base.getContext('2d'),
      geometry = this.prepareGeometry();
    ctx.save();
    ctx.translate(...this.mapOffset);
    ctx.scale(this.mapScale, this.mapScale);
    ctx.strokeStyle = this.colors.route;
    ctx.lineWidth = 1.7;
    ctx.globalAlpha = 0.45;
    const path = d3.geoPath(this.layout.projection, ctx);
    for (let i = this.trailIndex; i < end; i++) {
      ctx.beginPath();
      path(geometry[i].line);
      ctx.stroke();
    }
    ctx.restore();
    this.trailIndex = end;
  },
  paint(fraction = 0) {
    if (!this.canvas || this.disposed) return;
    this.prepareTrails();
    const ctx = this.canvas.getContext('2d');
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.drawImage(this.base, 0, 0);
    ctx.save();
    ctx.translate(...this.mapOffset);
    ctx.scale(this.mapScale, this.mapScale);
    const projection = this.layout.projection,
      path = d3.geoPath(projection, ctx),
      flights = this.timeline.flights,
      geometry = this.prepareGeometry(),
      seen = new Set();
    ctx.strokeStyle = this.colors.route;
    ctx.lineWidth = 1.7;
    for (let i = 0; i < Math.min(this.data.index + 1, flights.length); i++) {
      const f = flights[i],
        completed = i < this.data.index;
      seen.add(f.from);
      if (completed) {
        seen.add(f.to);
        continue;
      }
      ctx.globalAlpha = 1;
      ctx.beginPath();
      const { interpolate } = geometry[i];
      path({
        type: 'LineString',
        coordinates: Array.from({ length: 49 }, (_, j) =>
          interpolate((fraction * j) / 48),
        ),
      });
      ctx.stroke();
      const p = projection(interpolate(fraction));
      ctx.beginPath();
      ctx.arc(p[0], p[1], 5, 0, Math.PI * 2);
      ctx.fillStyle = this.colors.route;
      ctx.fill();
    }
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = this.colors.route;
    for (const code of seen) {
      const p = projection(this.timeline.airports[code].xy);
      ctx.beginPath();
      ctx.arc(p[0], p[1], 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
    this.paintLabels(ctx, seen);
    ctx.restore();
    if (landscape) this.paintControls();
  },
  paintLabels(ctx, seen) {
    if (!this.labelCodes?.size) return;
    const size = 21;
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.font = size + 'px sans-serif';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    const codes = [...seen].filter((code) => this.labelCodes.has(code)),
      key = codes.join('|');
    if (this.labelLayout?.key !== key) {
      const boxes = [];
      for (const code of codes) {
        const point = this.layout.projection(this.timeline.airports[code].xy),
          label = (names[code] || code) + (names[code] ? ' ' + code : ''),
          width = ctx.measureText(label).width,
          height = size * 1.3,
          gap = size * 0.45;
        const candidates = [
          [point[0] + gap, point[1] - height / 2],
          [point[0] - gap - width, point[1] - height / 2],
          [point[0] - width / 2, point[1] + gap],
          [point[0] - width / 2, point[1] - gap - height],
        ];
        let best;
        for (let [x, y] of candidates) {
          x = Math.max(4, Math.min(1596 - width, x));
          y = Math.max(4, Math.min(this.layout.mapHeight - height - 4, y));
          const overlap = boxes.filter(
            (b) =>
              x < b.x + b.width + 4 &&
              x + width + 4 > b.x &&
              y < b.y + b.height + 4 &&
              y + height + 4 > b.y,
          ).length;
          if (!best || overlap < best.overlap)
            best = { x, y, width, height, overlap, label };
        }
        boxes.push(best);
      }
      this.labelLayout = { key, boxes };
    }
    ctx.strokeStyle = this.colors.background;
    ctx.lineWidth = 3;
    ctx.fillStyle =
      atlasLuminance(this.colors.background) > 0.4 ? '#29454d' : '#edf3ee';
    for (const box of this.labelLayout.boxes) {
      ctx.strokeText(box.label, box.x, box.y);
      ctx.fillText(box.label, box.x, box.y);
    }
    ctx.restore();
  },
  paintControls() {
    this.hitTargets = [];
    if (this.data.playing && Date.now() > this.hudUntil) return;
    const ctx = this.canvas.getContext('2d'),
      w = this.data.mapWidth,
      h = this.data.mapHeight,
      scale = this.canvas.width / w;
    ctx.save();
    ctx.scale(scale, scale);
    ctx.textBaseline = 'middle';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const round = (x, y, width, height, r, fill) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + width - r, y);
      ctx.quadraticCurveTo(x + width, y, x + width, y + r);
      ctx.lineTo(x + width, y + height - r);
      ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
      ctx.lineTo(x + r, y + height);
      ctx.quadraticCurveTo(x, y + height, x, y + height - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.fillStyle = fill;
      ctx.fill();
    };
    const panel = (x, y, width, height, r) => {
      ctx.shadowColor = 'rgba(12,35,40,.14)';
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 3;
      round(x, y, width, height, r, 'rgba(248,251,248,.94)');
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
    };
    const text = (v, x, y, size, color = '#31545a', align = 'center') => {
      ctx.font = size + 'px sans-serif';
      ctx.fillStyle = color;
      ctx.textAlign = align;
      ctx.fillText(v, x, y);
    };
    const hit = (x, y, width, height, action) =>
      this.hitTargets.push({ x, y, width, height, action });
    panel(16, 14, 76, 36, 18);
    ctx.beginPath();
    ctx.moveTo(37, 25);
    ctx.lineTo(31, 32);
    ctx.lineTo(37, 39);
    ctx.strokeStyle = '#31545a';
    ctx.lineWidth = 1.7;
    ctx.stroke();
    text('退出', 61, 32, 12);
    hit(12, 10, 84, 44, 'orientation');
    const captionWidth = Math.min(320, w - 290),
      captionX = (w - captionWidth) / 2;
    panel(captionX, 14, captionWidth, 42, 21);
    text(
      this.data.ended
        ? '回放已结束'
        : this.data.date + ' · ' + this.data.flight,
      w / 2,
      27,
      10,
      '#7c918b',
    );
    let caption = this.data.ended
      ? '我的飞行足迹'
      : this.data.fromName + ' → ' + this.data.toName;
    ctx.font = '12px sans-serif';
    let shortened = false;
    while (
      caption.length &&
      ctx.measureText(caption + (shortened ? '…' : '')).width >
        captionWidth - 30
    ) {
      caption = caption.slice(0, -1);
      shortened = true;
    }
    if (shortened) caption += '…';
    text(caption, w / 2, 43, 12);
    const width = Math.min(288, w * 0.65),
      left = (w - width) / 2,
      top = h - 84;
    panel(left, top, width, 64, 22);
    round(left + 18, top + 12, width - 36, 2, 1, '#d9e3dc');
    const progress = Math.max(
      0,
      Math.min(1, (this.data.index + (this.fraction || 0)) / this.data.total),
    );
    round(
      left + 18,
      top + 12,
      Math.max(2, (width - 36) * progress),
      2,
      1,
      '#52786d',
    );
    round(left + 14 + (width - 36) * progress, top + 9, 8, 8, 4, '#315c61');
    hit(left + 18, top - 16, width - 36, 32, 'progress');
    const cy = top + 40;
    ctx.beginPath();
    ctx.arc(left + 37, cy, 8, 0.3, Math.PI * 1.85);
    ctx.strokeStyle = '#53766d';
    ctx.lineWidth = 1.7;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(left + 42, cy - 9);
    ctx.lineTo(left + 45, cy - 3);
    ctx.lineTo(left + 38, cy - 3);
    ctx.stroke();
    hit(left + 14, top + 20, 46, 44, 'restart');
    const playX = left + 99;
    round(playX - 20, cy - 20, 40, 40, 20, '#315c61');
    ctx.fillStyle = 'white';
    if (this.data.playing) {
      ctx.fillRect(playX - 6, cy - 7, 4, 14);
      ctx.fillRect(playX + 2, cy - 7, 4, 14);
    } else {
      ctx.beginPath();
      ctx.moveTo(playX - 4, cy - 8);
      ctx.lineTo(playX + 8, cy);
      ctx.lineTo(playX - 4, cy + 8);
      ctx.closePath();
      ctx.fill();
    }
    hit(playX - 24, top + 16, 48, 48, 'toggle');
    text(this.data.speed + '×', left + 167, cy, 13);
    hit(left + 142, top + 20, 50, 44, 'speed');
    ctx.strokeStyle = '#dce5df';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(left + 201, cy - 9);
    ctx.lineTo(left + 201, cy + 9);
    ctx.stroke();
    text(
      this.data.index + ' / ' + this.data.total,
      left + width - 43,
      cy,
      11,
      '#7c918b',
    );
    ctx.restore();
  },
  dragStart(e) {
    if (!landscape || this.disposed) return;
    const gesture = (this.replayGesture = { latest: e, pending: true });
    this.createSelectorQuery()
      .select('#replay')
      .boundingClientRect((rect) => {
        if (this.disposed || this.replayGesture !== gesture) return;
        gesture.pending = false;
        gesture.rect = rect;
        const point = replayTouchPoint(
          e,
          rect,
          this.data.mapWidth,
          this.data.mapHeight,
        );
        gesture.hit =
          point &&
          this.hitTargets?.find(
            (b) =>
              b.action === 'progress' &&
              point.x >= b.x &&
              point.x <= b.x + b.width &&
              point.y >= b.y &&
              point.y <= b.y + b.height,
          );
        if (gesture.hit) this.dragMove(gesture.latest);
        if (gesture.ended) {
          this.replayGesture = null;
          if (!gesture.hit) this.touchCanvas(gesture.latest);
        }
      })
      .exec();
  },
  dragMove(e) {
    const gesture = this.replayGesture;
    if (!gesture || this.disposed) return;
    gesture.latest = e;
    if (gesture.pending || !gesture.hit) return;
    const point = replayTouchPoint(
      e,
      gesture.rect,
      this.data.mapWidth,
      this.data.mapHeight,
    );
    if (!point) return;
    this.hudUntil = Date.now() + 2800;
    this.seek({
      detail: {
        value: Math.max(
          0,
          Math.min(100, ((point.x - gesture.hit.x) / gesture.hit.width) * 100),
        ),
      },
    });
  },
  dragEnd(e) {
    const gesture = this.replayGesture;
    if (!gesture) return this.touchCanvas(e);
    if (gesture.pending) {
      gesture.latest = e;
      gesture.ended = true;
      return;
    }
    if (gesture.hit) this.dragMove(e);
    this.replayGesture = null;
    if (!gesture.hit) this.touchCanvas(e);
  },
  dragCancel() {
    this.replayGesture = null;
  },
  touchCanvas(e) {
    if (!landscape || this.disposed) return;
    const apply = (rect) => {
      if (this.disposed) return;
      const point = replayTouchPoint(
        e,
        rect,
        this.data.mapWidth,
        this.data.mapHeight,
      );
      if (!point) return;
      const { x, y } = point,
        hit = this.hitTargets?.find(
          (b) =>
            x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height,
        );
      this.hudUntil = Date.now() + 2800;
      if (!hit) {
        this.paint(this.fraction || 0);
        return;
      }
      if (hit.action === 'progress') {
        this.seek({
          detail: {
            value: Math.max(0, Math.min(100, ((x - hit.x) / hit.width) * 100)),
          },
        });
        return;
      }
      this[hit.action]();
    };
    this.createSelectorQuery()
      .select('#replay')
      .boundingClientRect((rect) => {
        if (rect) {
          this.canvasRect = rect;
          apply(rect);
        }
      })
      .exec();
  },
  seekIndex(index, fraction = 0, render = true) {
    this.index = Math.max(0, Math.min(index, this.timeline.flights.length));
    const f =
      this.timeline.flights[
        Math.min(this.index, this.timeline.flights.length - 1)
      ];
    this.fraction =
      this.index === this.timeline.flights.length
        ? 0
        : Math.max(0, Math.min(0.999, fraction));
    this.setData({
      index: this.index,
      ended: this.index === this.timeline.flights.length,
      progress:
        ((this.index + this.fraction) / this.timeline.flights.length) * 100,
      date: f.date,
      time: f.departureTime || '',
      flight: (f.airline || '') + (f.flight || ''),
      fromName: names[f.from] || f.from,
      toName: names[f.to] || f.to,
      from: f.from,
      to: f.to,
    });
    if (render) this.paint(this.fraction);
  },
  toggle() {
    if (!this.data.ready) return;
    if (this.data.playing) {
      this.pause();
      return;
    }
    if (account.activeScope() !== this.scope) {
      this.setData({ message: '微信账号已切换，请重新打开此页面' });
      return;
    }
    if (this.data.ended) this.seekIndex(0);
    this.hudUntil = Date.now() + 2800;
    this.setData({ playing: true });
    this.lastTime = Date.now();
    this.tick();
  },
  tick() {
    if (this.disposed || !this.data.playing) return;
    const now = Date.now();
    this.fraction +=
      (Math.min(100, now - this.lastTime) / 1200) * this.data.speed;
    this.lastTime = now;
    if (this.fraction >= 1) {
      this.seekIndex(this.data.index + 1, this.fraction - 1);
      if (this.data.ended) {
        this.pause();
        return;
      }
    }
    const progress =
      Math.floor(((this.data.index + this.fraction) / this.data.total) * 1000) /
      10;
    if (Math.abs(progress - this.data.progress) >= 0.1)
      this.setData({ progress });
    this.paint(this.fraction);
    this.frame = this.canvas.requestAnimationFrame(() => this.tick());
  },
  pause(render = true) {
    if (this.frame != null && this.canvas)
      this.canvas.cancelAnimationFrame(this.frame);
    this.frame = null;
    if (this.data.playing) this.setData({ playing: false });
    if (render && landscape && !this.disposed && this.canvas)
      this.paint(this.fraction || 0);
  },
  restart() {
    this.pause(false);
    this.seekIndex(0);
  },
  speed() {
    const next = { 1: 2, 2: 4, 4: 1 };
    this.setData({ speed: next[this.data.speed] || 1 });
    if (landscape && this.canvas) this.paint(this.fraction || 0);
  },
  seek(e) {
    if (!this.data.ready) return;
    const position = Math.max(
      0,
      Math.min(
        this.data.total,
        (Number(e.detail.value) / 100) * this.data.total,
      ),
    );
    if (!Number.isFinite(position)) return;
    this.pause(false);
    this.seekIndex(Math.floor(position), position % 1);
  },
  orientation() {
    if (landscape) {
      wx.navigateBack();
      return;
    }
    if (this.openingLandscape || !this.data.ready) return;
    this.openingLandscape = true;
    this.pause();
    wx.navigateTo({
      url:
        '/pages/flight-replay/landscape?index=' +
        this.data.index +
        '&fraction=' +
        this.fraction +
        '&speed=' +
        this.data.speed,
      fail: () => wx.showToast({ title: '横屏页面未打开，请重试', icon: 'none' }),
      complete: () => {
        this.openingLandscape = false;
      },
    });
  },
  onShow() {
    const state = returnedState;
    if (!landscape) returnedState = null;
    if (!landscape && state && state.scope === this.scope && this.canvas) {
      this.seekIndex(state.index, state.fraction, false);
      this.fraction = this.data.ended ? 0 : state.fraction;
      this.setData({ speed: state.speed });
      this.paint(this.fraction);
    }
  },
  onHide() {
    this.dragCancel();
    this.pause();
  },
  onUnload() {
    this.dragCancel();
    if (landscape && this.data.ready)
      returnedState = {
        scope: this.scope,
        index: this.data.index,
        fraction: this.fraction || 0,
        speed: this.data.speed,
      };
    this.disposed = true;
    this.pause();
    this.routeGeometry = null;
    this.labelLayout = null;
    for (const c of [this.canvas, this.base])
      if (c) {
        c.width = 1;
        c.height = 1;
      }
  },
});
