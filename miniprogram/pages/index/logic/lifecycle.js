const accountState = require('../../../lib/account-state');
const { normalizeRows } = require('../../../lib/normalize-rows.js');
const { localDay } = require('../../../lib/day.js');
const atlasLocalState = require('../../../lib/local-state.js');
const { calculate } = require('../../../lib/flights');
const airports = require('../../../lib/airports');
async function initializePage(page) {
  page.setData({ initializing: true });
  try {
    await page.restoreSession();
  } finally {
    if (!page.disposed) {
      page.setData({ initializing: false });
      if (!page.pageHidden) page.resumeDayClock();
    }
  }
}
module.exports = {
  onReady() {
    this.disposed = false;
    initializePage(this);
  },
  load(rows, persist = true) {
    this.atlasDay = localDay();
    rows = normalizeRows(rows);
    try {
      if (persist)
        atlasLocalState.write(
          this.localKey || 'atlas-mini-guest',
          rows,
          this.preferences(),
        );
    } catch (e) {
      this.setData({ error: '本机保存失败，修改未保存：' + e.message });
      return false;
    }
    this.stateRevision = atlasLocalState.revision(this.localKey);
    if (this.data.view === 'map') this.previewNeedsRedraw = true;
    const keepUndo =
      persist === false &&
      this.deletedRow &&
      this.deletedScope === this.localKey &&
      !rows.some(
        (row) =>
          row._id === this.deletedRow._id ||
          require('../../../lib/record-model').identity(row) ===
            require('../../../lib/record-model').identity(this.deletedRow),
      );
    if (!keepUndo) {
      this.deletedRow = null;
      this.deletedScope = null;
    }
    this.setData({
      canUndo: !!keepUndo,
      fleetSelected: null,
      exportOpen: false,
      exportPath: '',
      exportFailed: false,
    });
    this.setData({
      rows,
      hasData:
        this.data.view === 'map' && rows.length ? this.data.hasData : false,
      total: 0,
      km: 0,
      airportCount: 0,
      error: '',
    });
    this.applyFilters();
    if (this.data.view === 'records') this.updateQualitySummary(rows);
    this.fleetDirty = true;
    if (this.data.view === 'fleet') this.updateFleet();
    this.result = null;
    this.updateCloudStatus();
    // Records, collection and editor pages do not render a map. Calculate the
    // full poster only on the map tab, after cross-tab state has been restored.
    if (this.data.view !== 'map') return true;
    this.updateAppearance();
    if (!rows.length) {
      this.updateLabels();
      if (this.data.view === 'map') wx.nextTick(() => this.drawEmpty());
      return true;
    }
    try {
      const cutoff = localDay();
      this.result = calculate(rows, airports, cutoff, !!this.data.future);
      this.setData({
        total: this.result.total,
        km: this.result.totalKm,
        airportCount: Object.keys(this.result.airports).length,
        hasData: true,
      });
      this.updateLabels();
      if (this.data.view === 'map') this.refreshMapPreview();
    } catch (e) {
      this.result = null;
      this.setData({
        hasData: false,
        error: '记录已保存，地图未生成：' + e.message,
      });
      this.refreshMapPreview();
    }
    return true;
  },
  onShow() {
    this.pageHidden = false;
    const generation = require('../../../lib/foreground-generation').current();
    if (generation !== (this.previewForegroundGeneration || 0)) {
      this.previewForegroundGeneration = generation;
      this.previewNeedsRedraw = true;
    }
    if (this.localKey) {
      this.syncTabState();
      this.refreshDay();
      this.resumeDayClock();
      if (this.previewNeedsRedraw) this.refreshMapPreview();
    }
  },
  onHide() {
    this.pageHidden = true;
    this.cancelClearAll?.();
    this.closeMapSettings();
    this.closeRecordFilters();
    this.pauseDayClock();
  },
  onUnload() {
    this.disposed = true;
    this.cancelClearAll?.();
    this.releaseMapPreview?.();
    this.unsubscribeAutoSave?.();
    this.pauseDayClock();
  },
  resumeDayClock() {
    this.pauseDayClock();
    this.dayTimer = setInterval(() => this.refreshDay(), 60000);
  },
  pauseDayClock() {
    if (this.dayTimer) {
      clearInterval(this.dayTimer);
      this.dayTimer = null;
    }
  },
  refreshDay() {
    if (!this.localKey) return;
    const day = localDay();
    if (this.atlasDay && this.atlasDay !== day)
      this.load(this.data.rows, false);
    this.atlasDay = day;
  },
  // Native tab pages retain their own filters, pagination and scroll position.
  async syncTabState() {
    try {
      const session = accountState.cached();
      const key = accountState.scopeFor(session);
      if (key !== this.localKey) {
        await this.switchAccount(session);
        return;
      }
      if (this.stateRevision === atlasLocalState.revision(key)) return;
      const local = atlasLocalState.read(key),
        prefs = local.prefs;
      this.setData({
        editing: false,
        editingId: null,
        candidateOpen: false,
        fileName: prefs.fileName || '',
        theme: prefs.theme || 'navy',
        colors: prefs.colors || null,
        posterStamp: require('../../../lib/stamp-id').normalize(prefs.posterStamp),
        labels: prefs.labels !== false,
        labelSelection: prefs.labelSelection || null,
        posterContent: prefs.posterContent ?? null,
        posterTitle: require('../../../lib/poster-title').normalize(
          prefs.posterTitle,
        ),
        future: !!prefs.future,
      });
      this.load(local.rows, false);
    } catch (e) {
      this.setData({ error: '页面同步失败，原记录保留：' + e.message });
    }
  },
  nav(e) {
    const paths = {
      map: '/pages/index/index',
      fleet: '/pages/fleet/index',
      records: '/pages/records/index',
    };
    const url = paths[e.currentTarget.dataset.key];
    if (url) wx.switchTab({ url });
  },
  openMapSettings(e) {
    const setting = e.currentTarget.dataset.key;
    const titles = {
      data: '航班数据',
      colors: '海报装饰',
      labels: '机场标注',
      content: '海报内容',
    };
    if (!titles[setting]) return;
    if (setting === 'content') this.updatePosterContent();
    if (setting === 'colors') this.updateAppearance();
    this.setData({
      setting,
      mapSettingsTitle: titles[setting],
      paletteManaging: false,
      mapSettingsOpen: true,
    });
  },
  closeMapSettings() {
    if (this.data.mapSettingsOpen) {
      this.setData({ mapSettingsOpen: false });
      this.refreshMapPreview();
    }
  },
  preferences() {
    return {
      fileName: this.data.fileName || '',
      theme: this.data.theme,
      labels: this.data.labels,
      future: !!this.data.future,
      colors: this.data.colors || null,
      posterStamp: require('../../../lib/stamp-id').normalize(this.data.posterStamp),
      labelSelection: this.data.labelSelection || null,
      posterContent: this.data.posterContent ?? null,
      posterTitle: require('../../../lib/poster-title').normalize(
        this.data.posterTitle,
      ),
    };
  },
  savePreferences() {
    try {
      atlasLocalState.write(
        this.localKey || 'atlas-mini-guest',
        this.data.rows,
        this.preferences(),
      );
      this.stateRevision = atlasLocalState.revision(this.localKey);
      this.updateCloudStatus();
      this.updateAppearance();
      return true;
    } catch (e) {
      try {
        const p = atlasLocalState.read(
          this.localKey || 'atlas-mini-guest',
        ).prefs;
        this.setData({
          theme: p.theme || 'navy',
          colors: p.colors || null,
          posterStamp: require('../../../lib/stamp-id').normalize(p.posterStamp),
          labels: p.labels !== false,
          labelSelection: p.labelSelection || null,
          posterContent: p.posterContent ?? null,
          posterTitle: require('../../../lib/poster-title').normalize(
            p.posterTitle,
          ),
          posterTitleDraft: require('../../../lib/poster-title').normalize(
            p.posterTitle,
          ),
          future: !!p.future,
        });
      } catch (_) {}
      this.setData({ error: '设置保存失败，已恢复原设置：' + e.message });
      return false;
    }
  },
  stopDialogTap() {},
};
