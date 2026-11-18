const checkin = require('../../lib/checkin');
const library = require('../../lib/collection-library');
const calendarDays = require('../../lib/checkin-calendar');
const stamps = require('../../lib/stamp-library');
const rewardItem = id => {
 const item=library.item(id)||stamps.item(id);
 return item?{...item,sheet:item.type==='stamp'?'/assets/collection/stamps.jpg':'/assets/collection/palettes.jpg'}:null;
};
const updateView = require('../../lib/view-state');
Page({
  data: {
    days: 0,
    pending: [],
    signedToday: false,
    busy: false,
    refreshing: false,
    loaded: false,
    selectedReward: null,
    claimedReward: null,
    calendar: [],
    error: '',
  },
  onShow() {
    this.disposed = false;
    const cached = checkin.cached();
    if (cached) this.update(cached);
    this.refresh();
  },
  onUnload() {
    this.disposed = true;
  },
  update(state) {
    const decorate = (r) => (r ? { ...r, ...rewardItem(r.itemId) } : null);
    const plan = new Map([...library.rewardPlan(),...stamps.rewardPlan()].map((r) => [r.day, r]));
    const claimed = new Set(state.grants.map((g) => g.day));
    const calendar = calendarDays(
      state.days,
      [...plan.values()],
      state.grants,
    ).map((day) => {
      const reward = decorate(plan.get(day));
      return {
        day,
        reward,
        completed: day <= state.days,
        label: reward
          ? claimed.has(day)
            ? '已领取'
            : day <= state.days
              ? '可领取'
              : reward.name
          : '',
      };
    });
    const today = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
    updateView(this, {
      days: state.days,
      pending: state.pending,
      signedToday: state.lastDay === today,
      selectedReward: this.data.selectedReward
        ? calendar.find((r) => r.day === this.data.selectedReward.day) || null
        : null,
      calendar,
      loaded: true,
      error: '',
    });
  },
  retry() {
    return this.refresh(true);
  },
  async refresh(force = false) {
    if (this.data.busy || this.data.refreshing) return;
    const mutation = this.mutation || 0;
    this.setData({ refreshing: true, error: '' });
    try {
      const state = await checkin.status(force);
      if (!this.disposed && mutation === (this.mutation || 0))
        this.update(state);
    } catch (error) {
      if (
        !this.disposed &&
        mutation === (this.mutation || 0) &&
        !this.data.busy &&
        !this.data.claimedReward
      )
        this.setData({ error: error.message });
    } finally {
      if (!this.disposed) this.setData({ refreshing: false });
    }
  },
  async mutate(action, onSuccess) {
    if (this.data.busy) return;
    this.mutation = (this.mutation || 0) + 1;
    this.setData({ busy: true, error: '' });
    try {
      const state = await action();
      if (!this.disposed) {
        this.update(state);
        onSuccess?.(state);
      }
    } catch (error) {
      if (!this.disposed) this.setData({ error: error.message });
    } finally {
      if (!this.disposed) this.setData({ busy: false });
    }
  },
  sign() {
    if (!this.data.loaded || this.data.signedToday) return;
    return this.mutate(() => checkin.sign());
  },
  openReward(e) {
    const selectedReward = this.data.calendar.find(
      (r) => r.day === Number(e.currentTarget.dataset.day),
    );
    if (selectedReward?.reward && !this.data.busy)
      this.setData({ selectedReward, claimedReward: null });
  },
  closeReward() {
    if (!this.data.busy)
      this.setData({ selectedReward: null, claimedReward: null });
  },
  stop() {},
  rewardArtError() {
    this.setData({error:'印章预览加载失败，可关闭后重试；已获得的奖励不会丢失。'});
  },
  claim() {
    const day = this.data.selectedReward?.day;
    if (!this.data.pending.includes(day)) return;
    return this.mutate(
      () => checkin.claim(day),
      (state) => {
        const grant = state.grants.find((g) => g.day === day);
        this.setData({
          selectedReward: null,
          claimedReward: rewardItem(grant?.itemId) || { name: '新奖励' },
        });
      },
    );
  },
});
