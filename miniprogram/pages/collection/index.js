const library = require('../../lib/collection-library');
const checkin = require('../../lib/checkin');
const updateView = require('../../lib/view-state');
Page({
  ...require("../../lib/app-share"),
  data: {
    paletteCount: 0,
    stampCount: 0,
    total: library.catalog.items.length,
    checkinLabel: '签到',
    checkinDone: false,
    hasReward: false,
  },
  updateCheckin(state) {
    const today = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
    const signed = state?.lastDay === today;
    const hasReward = !!state?.pending?.length;
    updateView(this, {
      paletteCount: library.ownedItems().length,
      stampCount: require('../../lib/stamp-library').ownedItems().length,
      checkinDone: signed && !hasReward,
      hasReward,
      checkinLabel: hasReward ? '领取奖励' : signed ? '已签到' : '签到',
    });
  },
  onShow() {
    this.disposed = false;
    this.updateCheckin(checkin.cached());
    checkin
      .status(false, { passive: true })
      .then((state) => {
        if (!this.disposed) this.updateCheckin(state);
      })
      .catch(() => {});
  },
  onHide() {
    this.disposed = true;
  },
  onUnload() {
    this.disposed = true;
  },
});
