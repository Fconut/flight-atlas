const atlasTheme = require('../../../lib/theme.js');
const atlasNames = require('../../../lib/names.js');
const airports = require('../../../lib/airports');
module.exports = {
  posterTitleInput(e) {
    const title = require('../../../lib/poster-title');
    const draft = title.input(e.detail.value);
    this.setData({
      posterTitleDraft: draft,
      posterTitleLength: Array.from(draft).length,
      posterTitle: title.normalize(draft),
      posterTitleError: '',
    });
    if (!this.savePreferences()) {
      const restored = title.normalize(this.data.posterTitle);
      this.setData({
        posterTitleDraft: restored,
        posterTitleLength: Array.from(restored).length,
        posterTitleError: '标题未保存，请重试。',
      });
    }
    this.previewNeedsRedraw = true;
  },
  posterTitleBlur() {
    const value = require('../../../lib/poster-title').normalize(
      this.data.posterTitle,
    );
    this.setData({
      posterTitleDraft: value,
      posterTitleLength: Array.from(value).length,
    });
  },
  updatePosterContent() {
    const content = require('../../../lib/poster-content');
    const selection = content.normalize(this.data.posterContent),
      chosen = selection === null ? content.defaultSelection : selection;
    const values = this.result ? content.build(this.result) : {};
    const preview = (id) => {
      const item = values[id];
      if (!item) return this.result ? '暂无可展示的数据' : '添加航班后可展示';
      if (item.kind === 'airport')
        return (
          item.value +
          ' ' +
          item.code +
          (item.detail ? ' · ' + item.detail : '')
        );
      if (item.kind === 'route')
        return item.entries
          .map(
            (entry) =>
              (atlasNames[entry.a] || entry.a) +
              ' → ' +
              (atlasNames[entry.b] || entry.b) +
              ' · ' +
              entry.value +
              ' ' +
              entry.unit,
          )
          .join('\n');
      if (item.kind === 'ranking')
        return item.rows.map((r) => r.name + ' ' + r.count + ' 次').join(' · ');
      return (
        item.value +
        (item.unit ? ' ' + item.unit : '') +
        (item.detail ? ' · ' + item.detail : '')
      );
    };
    this.setData({
      posterTitleDraft: require('../../../lib/poster-title').normalize(
        this.data.posterTitle,
      ),
      posterTitleLength: Array.from(
        require('../../../lib/poster-title').normalize(this.data.posterTitle),
      ).length,
      posterContentCustom: selection !== null,
      posterContentCount: chosen.length,
      posterContentGroups: content.groups.map((group) => ({
        ...group,
        items: content.fields
          .filter((field) => field.group === group.id)
          .map((field) => ({
            ...field,
            checked: chosen.includes(field.id),
            preview: preview(field.id),
          })),
      })),
    });
  },
  choosePosterContent(e) {
    this.setData({
      posterContent: require('../../../lib/poster-content').normalize(
        e.detail.value,
      ),
    });
    this.savePreferences();
    this.updatePosterContent();
    this.previewNeedsRedraw = true;
  },
  resetPosterContent() {
    this.setData({
      posterContent: null,
      posterTitle: require('../../../lib/poster-title').DEFAULT,
      posterTitleError: '',
    });
    this.savePreferences();
    this.updatePosterContent();
    this.previewNeedsRedraw = true;
  },
  labels(e) {
    this.setData({ labels: e.detail.value, labelSelection: null });
    this.savePreferences();
    this.updateLabels();
    if (this.data.hasData) this.draw();
  },
  managePosterPalettes() {
    this.setData({ paletteManaging: !this.data.paletteManaging });
  },
  openStampCollection() {
    this.closeMapSettings();
    wx.navigateTo({url:'/stamps0/pages/index'});
  },
  managePosterStamps() {
    this.setData({stampManaging:!this.data.stampManaging});
  },
  removePosterStamp(e) {
    try{require('../../../lib/stamp-library').setIncluded(e.currentTarget.dataset.id,false);this.updateAppearance()}
    catch(error){wx.showToast({title:error.message,icon:'none'})}
  },
  choosePosterStamp(e) {
    if(this.data.stampManaging)return;
    const id=e.currentTarget.dataset.id||null,library=require('../../../lib/stamp-library');
    if(id&&!library.snapshot().selected.has(id))return;
    if(id===(this.data.posterStamp||null))return;
    this.setData({posterStamp:id});
    if(this.savePreferences())this.previewNeedsRedraw=true;
  },
  removePosterPalette(e) {
    try {
      require('../../../lib/collection-library').setIncluded(
        e.currentTarget.dataset.id,
        false,
      );
      this.updateAppearance();
    } catch (error) {
      wx.showToast({ title: error.message, icon: 'none' });
    }
  },
  openCollection() {
    this.closeMapSettings();
    wx.navigateTo({ url: '/pages/collection/palettes' });
  },
  preset(e) {
    if (this.data.paletteManaging) return;
    const index = Number(e.currentTarget.dataset.index);
    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index >= this.data.presets.length
    )
      return;
    const colors = this.data.presets[index];
    if (
      !colors ||
      (this.data.colors?.background === colors.background &&
        this.data.colors?.route === colors.route)
    )
      return;
    this.setData({
      colors: { background: colors.background, route: colors.route },
    });
    if (!this.savePreferences()) return;
    if (this.data.hasData) this.draw();
  },
  updateLabels() {
    const data = this.result;
    if (!data) {
      this.setData({ labelOptions: [], labelCount: 0, labelTotal: 0 });
      return;
    }
    const chosen = new Set(
      Array.isArray(this.data.labelSelection)
        ? this.data.labelSelection
        : [
            ...Object.values(data.extremes),
            'CDG',
            'DXB',
            'IST',
            'CAI',
            'LAX',
            'RDU',
          ],
    );
    const names = atlasNames;
    this.setData({
      labelModeName: Array.isArray(this.data.labelSelection)
        ? '自定义'
        : '推荐',
      labelCount:
        this.data.labels === false
          ? 0
          : [...chosen].filter((c) => data.airports[c]).length,
      labelTotal: Object.keys(data.airports).length,
      labelOptions: Object.keys(data.airports)
        .sort(
          (a, b) =>
            data.airports[b].n - data.airports[a].n || a.localeCompare(b),
        )
        .filter(
          (code) =>
            !this.data.labelQuery ||
            (code + ' ' + (names[code] || ''))
              .toLowerCase()
              .includes(this.data.labelQuery.toLowerCase()),
        )
        .map((code) => ({
          code,
          name: names[code] || code,
          count: data.airports[code].n,
          checked: this.data.labels !== false && chosen.has(code),
        })),
    });
  },
  chooseLabels(e) {
    const visible = new Set(this.data.labelOptions.map((a) => a.code)),
      old = Array.isArray(this.data.labelSelection)
        ? this.data.labelSelection
        : [
            ...new Set([
              ...Object.values(this.result?.extremes || {}),
              'CDG',
              'DXB',
              'IST',
              'CAI',
              'LAX',
              'RDU',
            ]),
          ].filter((c) => this.result?.airports[c]);
    this.setData({
      labelSelection: [
        ...new Set([...old.filter((c) => !visible.has(c)), ...e.detail.value]),
      ],
      labels: true,
    });
    this.savePreferences();
    this.updateLabels();
    this.draw();
  },
  labelMode(e) {
    const mode = e.currentTarget.dataset.key;
    this.setData({
      labelSelection:
        mode === 'auto'
          ? null
          : mode === 'all'
            ? Object.keys(this.result?.airports || {})
            : [],
      labels: true,
    });
    this.savePreferences();
    this.updateLabels();
    if (this.data.hasData) this.draw();
  },
  labelSearch(e) {
    this.setData({ labelQuery: e.detail.value });
    this.updateLabels();
  },
  updateAppearance() {
    const colors = this.data.colors || {
      background: '#101c2a',
      route: '#e8bf79',
    };
    this.setData({
      presets: require('../../../lib/collection-library')
        .candidates()
        .map((item) => ({ id: item.id, name: item.name, ...item.colors })),
      paletteCapacity: require('../../../lib/collection-library').CAPACITY,
      stampPresets: require('../../../lib/stamp-library').candidates(),
      stampCapacity: require('../../../lib/stamp-library').CAPACITY,
      selectedColor: colors.background + '|' + colors.route,
      colorNote:
        atlasTheme.atlasContrast(colors.background, colors.route) < 2
          ? '当前航线与背景比较接近，建议选择明暗差更大的配色。'
          : '',
    });
  },
};
