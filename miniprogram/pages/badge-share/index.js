const { openShareResult } = require('../../lib/open-share-result');
const names = require('../../lib/names');
const { airlineCardTheme } = require('../../lib/airline-card-theme');
const { badgeRecordSummary } = require('../../lib/badge-record-summary');
function recordView(records, publicView) {
  const shown = publicView ? records : records.filter((r) => r.selected);
  const summary = badgeRecordSummary(shown);
  return {
    records: records.map((r) => ({
      ...r,
      fromName: names[r.from] || r.from,
      toName: names[r.to] || r.to,
      cardTheme: airlineCardTheme(r.airline),
    })),
    firstDate: summary.firstDate,
    stats: {
      total: summary.total,
      airlines: summary.airlines,
      routes: summary.routes,
    },
  };
}
const account = require('../../lib/account-state'),
  local = require('../../lib/local-state'),
  drafts = require('../../lib/draft-state'),
  auto = require('../../lib/auto-save'),
  { localDay } = require('../../lib/day'),
  { collection } = require('../../lib/fleet'),
  { callShare } = require('../../lib/share-api');
Page({
  data: {
    loading: true,
    ready: false,
    records: [],
    selectedCount: 0,
    message: '',
  },
  onLoad(o) {
    this.shareId = o.id || o.scene;
    this.badgeId = o.badge;
  },
  onShow() {
    if (this.scope && this.scope !== account.activeScope()) {
      this.shareId = null;
      this.setData({
        ready: false,
        cardPath: '',
        badge: null,
        stats: null,
        records: [],
        selectedCount: 0,
        message: '微信账号已切换，请重新打开分享页面',
      });
    }
  },
  onUnload() {
    this.disposed = true;
  },
  onReady() {
    return this.load();
  },
  async load() {
    if (this.loadingRequest || this.disposed) return;
    this.loadingRequest = true;
    this.setData({ loading: true, loadError: false, message: '' });
    try {
      if (this.shareId) {
        const r = await callShare('get', { id: this.shareId });
        if (this.disposed) return;
        if (r.snapshot.kind !== 'badge') throw Error('分享类型不正确');
        this.public = true;
        this.setData({
          badge: r.snapshot.badge,
          records: r.snapshot.records.map((v, index) => ({
            ...v,
            index,
          })),
          public: true,
        });
      } else {
        await auto.start();
        if (this.disposed) return;
        this.scope = account.activeScope();
        const d = drafts.snapshot(local.read(this.scope)),
          rows = d.sheets?.length
            ? d.sheets.flatMap((s) => s.rows)
            : d.rows || [];
        const item = collection(rows, localDay()).items.find(
          (v) => v.id === this.badgeId && v.badge && v.count,
        );
        if (!item) throw Error('该徽章尚未解锁');
        this.setData({
          badge: {
            id: item.id,
            name: item.name,
            badge: item.badge,
            package: item.package,
          },
          selectedCount: item.rows.length,
          records: item.rows.map((r, i) => ({
            date: r.date,
            from: r.from,
            to: r.to,
            airline: r.airline || '',
            flight: r.flight || '',
            departureTime: r.departureTime || '',
            index: i,
            selected: true,
          })),
        });
      }
    } catch (e) {
      if (!this.disposed) this.setData({ loadError: true, message: e.message });
    } finally {
      this.loadingRequest = false;
      if (!this.disposed)
        this.setData({
          loading: false,
          ...recordView(this.data.records, this.public),
        });
    }
  },
  toggle(e) {
    if (this.public || this.data.busy) return;
    const i = Number(e.currentTarget.dataset.index),
      records = this.data.records.map((r, n) =>
        n === i ? { ...r, selected: !r.selected } : r,
      );
    this.changeSelection(records);
  },
  changeSelection(records) {
    this.shareId = null;
    this.setData({
      ...recordView(records, false),
      selectedCount: records.filter((r) => r.selected).length,
      ready: false,
      cardPath: '',
      message: '',
    });
  },
  selectAll() {
    if (this.public || this.data.busy) return;
    const selected = this.data.selectedCount !== this.data.records.length;
    this.changeSelection(this.data.records.map((r) => ({ ...r, selected })));
  },
  async prepare() {
    if (this.data.busy || this.data.loading || !this.data.selectedCount) return;
    this.setData({ busy: true, message: '' });
    try {
      await auto.ensureSaved();
      if (this.disposed) return;
      const state = auto.getState();
      if (state.phase !== 'saved' || state.scope !== this.scope)
        throw Error('航班尚未同步，请联网后重试');
      const selected = this.data.records
        .filter((r) => r.selected)
        .map((r) => r.index);
      if (!selected.length) throw Error('请至少选择一条航班');
      const r = await callShare('create', {
        kind: 'badge',
        badgeId: this.badgeId,
        selected,
        expected: this.data.records
          .filter((r) => r.selected)
          .map(({ date, from, to, airline, flight, departureTime }) => ({
            date,
            from,
            to,
            airline,
            flight: String(flight),
            departureTime: departureTime || '',
          })),
      });
      if (account.activeScope() !== this.scope)
        throw Error('微信账号已切换，请重新打开此页面');
      if (this.disposed) return;
      await openShareResult(r.snapshot, r.id, this.scope);
    } catch (e) {
      if (!this.disposed) this.setData({ message: e.message });
    } finally {
      if (!this.disposed) this.setData({ busy: false });
    }
  },
  onShareAppMessage() {
    return this.shareId && (this.public || this.scope === account.activeScope())
      ? {
          title: '我的 ' + this.data.badge.name + ' 乘坐徽章',
          path: '/pages/badge-share/index?id=' + this.shareId,
          imageUrl: this.data.cardPath,
        }
      : { title: '我的机型收藏册', path: '/pages/fleet/index' };
  },
  makeMine() {
    wx.switchTab({ url: '/pages/fleet/index' });
  },
});
