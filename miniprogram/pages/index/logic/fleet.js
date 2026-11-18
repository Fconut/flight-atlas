const { localDay } = require('../../../lib/day.js');
const atlasFleet = require('../../../lib/fleet.js');
const atlasNames = require('../../../lib/names.js');
const { airlineCardTheme } = require('../../../lib/airline-card-theme');
const { badgeRecordSummary } = require('../../../lib/badge-record-summary');
module.exports = {
  updateFleet() {
    const today = localDay();
    if (!this.fleetDirty && this.fleetDay === today && this.fleetItems) return;
    const c = atlasFleet.collection(this.data.rows, today);
    this.fleetItems = c.items;
    this.fleetDirty = false;
    this.fleetDay = today;
    this.setData({
      fleetSections: ['波音', '空客', '其他'].map((maker) => {
        const recorded = c.items.filter(
          (v) =>
            (v.manufacturer === 'Boeing'
              ? '波音'
              : v.manufacturer === 'Airbus'
                ? '空客'
                : '其他') === maker,
        );
        const visible = recorded
          .filter((v) => v.badge || v.count)
          .sort(
            (a, b) =>
              b.count - a.count ||
              a.name.localeCompare(b.name, undefined, { numeric: true }),
          );
        const display = visible.map(({ rows, ...item }) => item);
        return {
          maker,
          items: display.filter((v) => v.badge),
          unbadged: display.filter((v) => !v.badge),
          count: recorded.reduce((n, v) => n + v.count, 0),
        };
      }),
      fleetMissing: c.missing,
      fleetUnlocked: c.unlocked,
      fleetRecordedTypes: c.recordedTypes,
      fleetRecordedFlights: c.recordedFlights,
    });
  },
  shareCollection() {
    wx.navigateTo({ url: '/pages/collection-share/index' });
  },
  shareBadge() {
    const item = this.data.fleetSelected;
    if (item?.badge)
      wx.navigateTo({
        url: '/pages/badge-share/index?badge=' + encodeURIComponent(item.id),
      });
  },
  selectFleetTab(e) {
    const maker = e.currentTarget.dataset.maker;
    if (
      !['波音', '空客', '其他'].includes(maker) ||
      maker === this.data.fleetTab
    )
      return;
    const visited = {
      ...(this.data.fleetVisited || {}),
      [this.data.fleetTab]: true,
      [maker]: true,
    };
    this.setData({ fleetTab: maker, fleetVisited: visited });
  },
  openFleet() {
    this.updateFleet();
  },
  fleetSelect(e) {
    this.fleetDetail({ detail: { id: e.currentTarget.dataset.id } });
  },
  fleetDetail(e) {
    const item = e.detail?.id
      ? this.fleetItems.find((v) => v.id === e.detail.id)
      : this.fleetItems[Number(e.currentTarget.dataset.index)];
    if (item && item.count) {
      const summary = badgeRecordSummary(item.rows);
      this.setData({
        fleetSelected: {
          ...item,
          airlineCount: summary.airlines,
          routeCount: summary.routes,
          rows: item.rows.map((r) => ({
            ...r,
            cardTheme: airlineCardTheme(r.airline),
            fromName: atlasNames[r.from] || r.from,
            toName: atlasNames[r.to] || r.to,
          })),
        },
      });
    }
  },
  closeFleet() {
    this.setData({ fleetSelected: null });
  },
};
