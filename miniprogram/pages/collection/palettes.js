const library = require('../../lib/collection-library');
const updateView = require('../../lib/view-state');
Page({
  data: {
    series: [],
    seriesId: '',
    seriesName: '',
    items: [],
    ownedCount: 0,
    filter: 'all',
    total: library.catalog.items.length,
    capacity: library.CAPACITY,
    selected: null,
    error: '',
  },
  onLoad(options = {}) {
    const target=library.item(options.item);
    this.rewardTarget=target?.id;
    const series = library.catalog.series.find((s) => s.id === (target?.seriesId||options.series));
    this.setData({
      seriesId: series?.id || '',
      seriesName: series?.name || '',
      filter: options.filter === 'owned' ? 'owned' : 'all',
    });
  },
  onShow() {
    this.disposed = false;
    this.refresh();
    if(this.rewardTarget){const id=this.rewardTarget;this.rewardTarget=null;if(library.snapshot().isOwned(library.item(id)))this.open({currentTarget:{dataset:{id}}});}
    require('../../lib/checkin')
      .status(false, { passive: true })
      .then(() => {
        if (!this.disposed) this.refresh();
      })
      .catch(() => {});
  },
  onHide() {
    this.disposed = true;
  },
  onUnload() {
    this.disposed = true;
  },
  refresh() {
    try {
      const state = library.snapshot();
      updateView(this, {
        ownedCount: library.ownedItems().length,
        series: this.data.seriesId ? [] : library.series(this.data.filter),
        items: library
          .members(this.data.seriesId, this.data.filter)
          .map(state.decorate),
        selected: this.data.selected
          ? state.decorate(library.item(this.data.selected.id))
          : null,
        error: '',
      });
    } catch (error) {
      this.setData({ error: error.message });
    }
  },
  filter(e) {
    const filter = e.currentTarget.dataset.filter;
    if (!['all', 'owned'].includes(filter) || filter === this.data.filter)
      return;
    this.setData({ filter });
    this.refresh();
  },
  series(e) {
    const id = e.currentTarget.dataset.id;
    if (
      id === this.data.seriesId ||
      !library.catalog.series.some((s) => s.id === id)
    )
      return;
    if (this.openingSeries) return;
    this.openingSeries = true;
    wx.navigateTo({
      url:
        '/pages/collection/palettes?series=' +
        encodeURIComponent(id) +
        '&filter=' +
        this.data.filter,
      fail: () => wx.showToast({ title: '暂时无法打开，请重试', icon: 'none' }),
      complete: () => {
        this.openingSeries = false;
      },
    });
  },
  backToSeries() {
    wx.navigateBack();
  },
  open(e) {
    const item = library.item(e.currentTarget.dataset.id);
    if (!item) return;
    try {
      this.setData({
        selected: library.snapshot().decorate(item),
        detailLoading: true,
        error: '',
      });
    } catch (error) {
      this.setData({ error: error.message });
    }
  },
  detailImageReady(e) {
    if (
      !this.data.selected ||
      e.currentTarget.dataset.id !== this.data.selected.id
    )
      return;
    this.setData({ detailLoading: false, error: '' });
  },
  detailImageError(e) {
    if (
      !this.data.selected ||
      e.currentTarget.dataset.id !== this.data.selected.id
    )
      return;
    this.setData({
      detailLoading: false,
      error: '高清示例加载失败，请关闭后重试',
    });
  },
  close() {
    this.setData({ selected: null, detailLoading: false, error: '' });
  },
  stop() {},
  toggleIncluded() {
    if (!this.data.selected) return;
    try {
      const included = !library.includes(this.data.selected.id);
      library.setIncluded(this.data.selected.id, included);
      this.refresh();

      wx.showToast({ title: included ? '已添加' : '已移除', icon: 'success' });
    } catch (error) {
      this.setData({ error: error.message });
    }
  },
});
