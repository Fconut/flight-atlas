const { airlineCardTheme } = require('../../../lib/airline-card-theme');
const recordSearch = require('../../../lib/record-search');
const { importResultData } = require('../../../lib/import-complete');
const recordModel = require('../../../lib/record-model.js');
const { localDay } = require('../../../lib/day.js');
const atlasRecordFilters = require('../../../lib/record-filters.js');
const atlasAircraft = require('../../../lib/aircraft.js');
const atlasImport = require('../../../lib/import-report.js');
const atlasNames = require('../../../lib/names.js');
const atlasBackup = require('../../../lib/backup.js');
const localState = require('../../../lib/local-state.js');
const {
  calculate,
  normalizeAirlineCode,
  airlineDirectory,
  dateValue,
} = require('../../../lib/flights');
const airports = require('../../../lib/airports');
module.exports = {
  openFlightReplay() {
    wx.navigateTo({
      url: '/pages/flight-replay/index',
      fail: () => wx.showToast({ title: '回放暂未打开，请重试', icon: 'none' }),
    });
  },
  openAiImportGuide() {
    if (this.disposed || this.openingAiGuide) return;
    this.openingAiGuide = true;
    wx.navigateTo({
      url: '/pages/ai-import/index',
      events: {
        guideClosed: () => {
          if (!this.disposed)
            this.setData({
              setting: 'data',
              mapSettingsTitle: '航班数据',
              mapSettingsOpen: true,
            });
        },
      },
      fail: () => wx.showToast({ title: '页面未打开，请重试', icon: 'none' }),
      complete: () => {
        this.openingAiGuide = false;
      },
    });
  },
  clearTime() {
    this.setData({ 'form.departureTime': '' });
  },
  toggleImportHelp() {
    this.setData({ importHelpOpen: !this.data.importHelpOpen });
  },
  paginationChoices(page, pages) {
    const selected = [...new Set([1, page - 1, page, page + 1, pages])]
        .filter((n) => n >= 1 && n <= pages)
        .sort((a, b) => a - b),
      result = [];
    for (const [i, n] of selected.entries()) {
      if (i && n - selected[i - 1] > 1)
        result.push({ key: 'gap-' + n, gap: true });
      result.push({
        key: 'page-' + n,
        page: n,
        gap: false,
        current: n === page,
      });
    }
    return result;
  },
  jumpPage(e) {
    const page = Number(e.currentTarget.dataset.page);
    if (Number.isInteger(page) && page >= 1 && page <= this.data.pages) {
      this.setData({ pageNumber: page });
      this.applyFilters();
    }
  },
  future(e) {
    if (!!e.detail.value === !!this.data.future) return;
    const previousAirports = new Set(Object.keys(this.result?.airports || {}));
    this.setData({ future: e.detail.value });
    if (this.data.rows.length) this.load(this.data.rows);
    if (
      this.data.labels !== false &&
      Array.isArray(this.data.labelSelection) &&
      this.data.labelSelection.length &&
      this.result
    ) {
      const added = Object.values(this.result.extremes).filter(
        (code) => !previousAirports.has(code),
      );
      if (added.length) {
        this.setData({
          labelSelection: [...new Set([...this.data.labelSelection, ...added])],
        });
        this.updateLabels();
        this.draw();
      }
    }
    this.savePreferences();
  },
  paginate(e) {
    const page = this.data.pageNumber + Number(e.currentTarget.dataset.step);
    if (page > 0 && page <= this.data.pages) {
      this.setData({ pageNumber: page });
      this.applyFilters();
    }
  },
  clearAll() {
    if (!this.data.rows.length || !this.localKey || this.clearAllContext)
      return;
    const context = (this.clearAllContext = {
      scope: this.localKey,
      revision: localState.revision(this.localKey),
      original: JSON.stringify(this.data.rows),
      count: this.data.rows.length,
      stage: 1,
    });
    wx.showModal({
      title: '确认删除范围（1/3）',
      confirmText: '下一步',
      cancelText: '保留航班',
      content:
        '将删除全部 ' +
        context.count +
        ' 条航班（含筛选外记录），云端航班记录也会同步删除。',
      success: async (result) => {
        if (this.clearAllContext !== context || context.stage !== 1) return;
        if (!result.confirm) {
          this.cancelClearAll();
          return;
        }
        if (!(await this.checkClearAllContext(context))) return;
        context.stage = 2;
        this.setData({
          clearAllOpen: true,
          clearAllText: '',
          clearAllCount: context.count,
          clearAllFinalizing: false,
        });
      },
      fail: () => {
        if (this.clearAllContext === context) this.cancelClearAll();
      },
    });
  },
  cancelClearAll() {
    this.clearAllContext = null;
    if (!this.disposed)
      this.setData({
        clearAllOpen: false,
        clearAllText: '',
        clearAllFinalizing: false,
        clearAllKeyboardHeight: 0,
      });
  },
  clearAllTextChanged(event) {
    if (this.clearAllContext?.stage === 2)
      this.setData({ clearAllText: event.detail.value });
  },
  clearAllKeyboardChanged(event) {
    if (this.clearAllContext)
      this.setData({
        clearAllKeyboardHeight: Math.max(0, Number(event.detail.height) || 0),
      });
  },
  clearAllUnchanged(context) {
    return (
      this.clearAllContext === context &&
      !this.disposed &&
      !this.pageHidden &&
      context.scope === this.localKey &&
      context.revision === localState.revision(context.scope) &&
      JSON.stringify(localState.read(context.scope).rows) ===
        context.original &&
      JSON.stringify(this.data.rows) === context.original
    );
  },
  async checkClearAllContext(context) {
    if (this.clearAllContext !== context) return false;
    if (this.disposed || this.pageHidden || context.scope !== this.localKey) {
      this.cancelClearAll();
      return false;
    }
    try {
      if (!this.clearAllUnchanged(context)) {
        this.cancelClearAll();
        await this.syncTabState();
        if (!this.disposed && context.scope === this.localKey)
          this.setData({
            error: '记录已更新，本次未删除。请核对最新记录后重新开始确认。',
          });
        return false;
      }
      return true;
    } catch (error) {
      this.cancelClearAll();
      if (!this.disposed)
        this.setData({ error: '本次未删除：' + error.message });
      return false;
    }
  },
  async confirmClearAllText() {
    const context = this.clearAllContext;
    if (
      !context ||
      context.stage !== 2 ||
      this.data.clearAllText !== '全部删除'
    )
      return;
    context.stage = 3;
    this.setData({ clearAllFinalizing: true });
    wx.hideKeyboard?.();
    if (!(await this.checkClearAllContext(context))) return;
    wx.showModal({
      title: '最后确认（3/3）',
      confirmText: '确认删除',
      cancelText: '保留航班',
      confirmColor: '#a16959',
      content: '确定删除这 ' + context.count + ' 条航班吗？',
      success: async (result) => {
        if (this.clearAllContext !== context || context.stage !== 3) return;
        if (!result.confirm || this.data.clearAllText !== '全部删除') {
          this.cancelClearAll();
          return;
        }
        if (!(await this.checkClearAllContext(context))) return;
        try {
          if (!this.clearAllUnchanged(context)) {
            this.cancelClearAll();
            this.setData({ error: '记录已更新，本次未删除。请重新开始确认。' });
            return;
          }
          wx.setStorageSync(
            context.scope + '-recovery',
            atlasBackup.snapshot(this.data),
          );
          this.cancelClearAll();
          this.load([]);
        } catch (error) {
          this.cancelClearAll();
          if (!this.disposed)
            this.setData({ error: '本次未删除：' + error.message });
        }
      },
      fail: () => {
        if (this.clearAllContext === context) this.cancelClearAll();
      },
    });
  },
  downloadTemplate() {
    wx.navigateTo({
      url: '/file-tools/pages/index?action=export',
      success: (res) =>
        res.eventChannel.emit('exportRows', { template: true, rows: [] }),
      fail: (e) => this.setData({ error: e.errMsg }),
    });
  },
  inlineAirportChange(e) {
    const key = e.currentTarget.dataset.key;
    if (key !== 'from' && key !== 'to') return;
    this.setData({ ['form.' + key]: e.detail.code, formError: '' });
    this.updateAirportNames();
  },
  updateAirportNames() {
    this.setData({
      fromAirportName: atlasNames[this.data.form.from] || '',
      toAirportName: atlasNames[this.data.form.to] || '',
    });
  },
  pickAirport(e) {
    const key = e.currentTarget.dataset.key;
    wx.navigateTo({
      url: '/airport-picker/pages/index?key=' + key,
      events: {
        airportSelected: (r) => {
          this.setData({ ['form.' + key]: r.code });
          this.updateAirportNames();
        },
      },
    });
  },
  swapAirports() {
    this.setData({
      form: {
        ...this.data.form,
        from: this.data.form.to,
        to: this.data.form.from,
      },
    });
    this.updateAirportNames();
  },
  useHistory(e) {
    const route = this.data.filterKeys?.route?.[Number(e.detail.value)];
    if (route) {
      const [from, to] = route.split('|');
      this.setData({ form: { ...this.data.form, from, to } });
      this.updateAirportNames();
    }
  },
  dismissUndo() {
    this.deletedRow = null;
    this.deletedScope = null;
    this.setData({ canUndo: false });
  },
  undoRemove() {
    if (this.deletedRow && this.deletedScope === this.localKey) {
      const row = this.deletedRow;
      if (this.load([...this.data.rows, row])) this.setData({ canUndo: false });
    }
  },
  inlineSuggestionInput(e) {
    this.field(e);
    const kind = e.currentTarget.dataset.key,
      raw = e.detail.value.trim(),
      token = (v) =>
        String(v || '')
          .toLowerCase()
          .replace(/波音/g, 'boeing')
          .replace(/空客/g, 'airbus')
          .replace(/[\s._-]/g, ''),
      q = token(raw);
    let choices = [];
    if (q && kind === 'airline') {
      const normalized = normalizeAirlineCode(raw);
      choices = [
        ...new Map(
          airlineDirectory.map(([, code, name]) => [
            code,
            { value: code, label: name, detail: code },
          ]),
        ).values(),
      ]
        .filter(
          (a) =>
            token(a.label + ' ' + a.detail).includes(q) ||
            a.value === normalized,
        )
        .sort((a, b) => (b.value === normalized) - (a.value === normalized));
    }
    if (q && kind === 'aircraft') {
      choices = atlasAircraft
        .searchAircraft(
          raw,
          this.data.rows.map((r) => r.aircraft),
        )
        .map((a) => ({ value: a.name, label: a.name, detail: a.manufacturer }));
    }
    this.setData({
      airlineSuggestions: [],
      aircraftSuggestions: [],
      [kind + 'Suggestions']: choices.slice(0, 6),
    });
  },
  chooseInlineSuggestion(e) {
    const { key, value } = e.currentTarget.dataset;
    if (!['airline', 'aircraft'].includes(key)) return;
    this.setData({
      ['form.' + key]: value,
      [key + 'Suggestions']: [],
      formError: '',
    });
  },
  openAirlinePicker() {
    this.openCandidate('airline');
  },
  openAircraftPicker() {
    this.openCandidate('aircraft');
  },
  openCandidate(kind) {
    this.prepareCandidates();
    this.setData({
      candidateOpen: kind,
      candidateQuery: '',
      candidateTitle: kind === 'airline' ? '选择航司' : '选择机型',
    });
    this.filterCandidates('');
  },
  candidateSearch(e) {
    this.setData({ candidateQuery: e.detail.value });
    this.filterCandidates(e.detail.value);
  },
  filterCandidates(query) {
    const q = String(query).trim().toLowerCase(),
      all =
        this.data.candidateOpen === 'airline'
          ? this.airlineChoices.map((a) => ({
              value: a.code,
              label: a.name,
              detail: a.code,
            }))
          : this.aircraftChoices.map((a) => ({
              value: a.name,
              label: a.name,
              detail: a.manufacturer,
            }));
    this.setData({
      candidateItems: all.filter((a) =>
        (a.label + ' ' + a.detail).toLowerCase().includes(q),
      ),
    });
  },
  pickCandidate(e) {
    const kind = this.data.candidateOpen;
    if (!['airline', 'aircraft'].includes(kind)) return;
    this.setData({
      ['form.' + kind]: e.currentTarget.dataset.value,
      candidateOpen: '',
      formError: '',
    });
  },
  closeCandidate() {
    this.setData({ candidateOpen: '', candidateQuery: '' });
  },
  prepareCandidates() {
    const airlines = [
      ...new Map(
        airlineDirectory.map(([, code, name]) => [code, { code, name }]),
      ).values(),
    ].sort((a, b) => a.code.localeCompare(b.code));
    this.airlineChoices = airlines;
    this.aircraftChoices = atlasAircraft.aircraftCatalog;
  },
  datePicked(e) {
    this.setData({ 'form.date': e.detail.value });
  },
  timePicked(e) {
    this.setData({ 'form.departureTime': e.detail.value });
  },
  applyFilters() {
    if (
      !Number.isInteger(this.data.statusIndex) ||
      this.data.statusIndex < 0 ||
      this.data.statusIndex >= this.data.statusOptions.length
    )
      this.setData({ statusIndex: 0 });
    const filters = { ...this.data.filters };
    const rows = this.data.rows,
      keys = ['route', 'airline', 'aircraft', 'year'];
    const value = (r, k) =>
      k === 'route'
        ? atlasRecordFilters.routeKey(r)
        : k === 'airline'
          ? atlasRecordFilters.airlineKey(r)
          : k === 'year'
            ? String(r.date).slice(0, 4)
            : atlasRecordFilters.aircraftKey(r);
    if (
      !this.recordOptionsCache ||
      this.recordOptionsCache.rows !== rows ||
      this.recordOptionsCache.scope !== this.localKey
    ) {
      const options = Object.fromEntries(
        keys.map((k) => [k, atlasRecordFilters[k + 'Options'](rows)]),
      );
      this.recordOptionsCache = {
        rows,
        scope: this.localKey,
        options,
        labels: Object.fromEntries(
          keys.map((k) => [k, options[k].map((o) => o.label)]),
        ),
        keys: Object.fromEntries(
          keys.map((k) => [k, options[k].map((o) => o.value)]),
        ),
        values: rows.map((r) =>
          Object.fromEntries(keys.map((k) => [k, value(r, k)])),
        ),
      };
    }
    const cache = this.recordOptionsCache,
      filterOptions = cache.labels,
      filterKeys = cache.keys,
      filterIndices = {},
      filterLabels = {};
    for (const k of keys) {
      const options = cache.options[k];
      if (k === 'aircraft' && filters[k] && !filterKeys[k].includes(filters[k]))
        filters[k] = atlasRecordFilters.aircraftKey({ aircraft: filters[k] });
      if (!filterKeys[k].includes(filters[k] || '')) filters[k] = '';
      filterIndices[k] = filterKeys[k].indexOf(filters[k] || '');
      filterLabels[k] = options[filterIndices[k]].label;
    }
    const aircraftFilterOptions = filterOptions.aircraft;
    const activeFilters = keys
      .filter((key) => filters[key])
      .map((key) => ({
        key,
        label: filterLabels[key].replace(/ · \d+ 次$/, ''),
      }));
    if (this.data.statusIndex)
      activeFilters.push({
        key: 'status',
        label: this.data.statusOptions[this.data.statusIndex],
      });
    if (
      !this.recordSearchCache ||
      this.recordSearchCache.rows !== rows ||
      this.recordSearchCache.scope !== this.localKey
    )
      this.recordSearchCache = {
        rows,
        scope: this.localKey,
        index: recordSearch.buildIndex(rows),
      };
    const matchesSearch = recordSearch.matcher(this.data.search);
    let filtered = rows.filter(
      (r, index) =>
        matchesSearch(this.recordSearchCache.index[index]) &&
        keys.every((k) => !filters[k] || cache.values[index][k] === filters[k]),
    );
    const cutoff = localDay();
    if (
      !this.recordStatusCache ||
      this.recordStatusCache.rows !== rows ||
      this.recordStatusCache.day !== cutoff ||
      this.recordStatusCache.scope !== this.localKey
    ) {
      this.recordStatusCache = {
        rows,
        day: cutoff,
        scope: this.localKey,
        map: new Map(rows.map((r) => [r._id, recordModel.status(r, cutoff)])),
      };
    }
    const statusMap = this.recordStatusCache.map;
    if (this.data.statusIndex) {
      const selected = ['', 'included', 'future'][this.data.statusIndex];
      filtered = filtered.filter((r) => statusMap.get(r._id) === selected);
    }
    const pages = Math.max(1, Math.ceil(filtered.length / this.data.pageSize)),
      page = Math.min(this.data.pageNumber, pages);
    this.filtered = filtered;
    this.setData({
      visibleRows: filtered
        .slice((page - 1) * this.data.pageSize, page * this.data.pageSize)
        .map((r) => {
          const status = recordModel.statusLabels[statusMap.get(r._id)];
          return {
            ...r,
            cardTheme: airlineCardTheme(r.airline),
            fromName: atlasNames[r.from] || r.from,
            toName: atlasNames[r.to] || r.to,
            status,
            displayFlight: r.flight
              ? r.airline &&
                !String(r.flight)
                  .toUpperCase()
                  .startsWith(r.airline.toUpperCase())
                ? r.airline + r.flight
                : r.flight
              : r.airline || '未填写航班号',
            aircraftName:
              atlasAircraft.resolveAircraft(r.aircraft)?.name ||
              r.aircraft ||
              '未填写机型',
          };
        }),
      matchCount: filtered.length,
      pageNumber: page,
      pages,
      pageChoices: this.paginationChoices(page, pages),
      pageRange: filtered.length
        ? (page - 1) * this.data.pageSize +
          1 +
          '–' +
          Math.min(page * this.data.pageSize, filtered.length) +
          ' / ' +
          filtered.length +
          ' 条'
        : '',
      filters,
      ...(this.renderedFilterCache === cache
        ? {}
        : { filterOptions, aircraftFilterOptions, filterKeys }),
      filterLabels,
      filterIndices,
      activeFilters,
      activeFilterCount: activeFilters.length,
    });
    this.renderedFilterCache = cache;
  },
  openRecordFilters() {
    this.setData({
      recordFiltersOpen: true,
      draftFilters: { ...this.data.filters },
      draftStatusIndex: this.data.statusIndex,
      draftFilterIndices: { ...this.data.filterIndices },
    });
  },
  closeRecordFilters() {
    if (this.data.recordFiltersOpen) this.setData({ recordFiltersOpen: false });
  },
  draftFilter(e) {
    const key = e.currentTarget.dataset.key,
      index = Number(e.detail.value);
    if (key === 'status') {
      if (
        Number.isInteger(index) &&
        index >= 0 &&
        index < this.data.statusOptions.length
      )
        this.setData({ draftStatusIndex: index });
      return;
    }
    if (!['route', 'airline', 'aircraft', 'year'].includes(key)) return;
    const options = this.data.filterOptions[key];
    if (!Number.isInteger(index) || index < 0 || index >= options.length)
      return;
    const value =
      this.data.filterKeys[key]?.[index] ?? (index ? options[index] : '');
    this.setData({
      draftFilters: { ...this.data.draftFilters, [key]: value },
      draftFilterIndices: { ...this.data.draftFilterIndices, [key]: index },
    });
  },
  resetDraftFilters() {
    this.setData({
      draftFilters: {},
      draftStatusIndex: 0,
      draftFilterIndices: { route: 0, airline: 0, aircraft: 0, year: 0 },
    });
  },
  applyRecordFilters() {
    this.setData({
      filters: { ...this.data.draftFilters },
      statusIndex: this.data.draftStatusIndex,
      pageNumber: 1,
      recordFiltersOpen: false,
    });
    this.applyFilters();
  },
  removeRecordFilter(e) {
    const key = e.currentTarget.dataset.key;
    if (key === 'status') this.setData({ statusIndex: 0, pageNumber: 1 });
    else
      this.setData({
        filters: { ...this.data.filters, [key]: '' },
        pageNumber: 1,
      });
    this.applyFilters();
  },
  clearRecordConditions() {
    this.setData({ search: '', filters: {}, statusIndex: 0, pageNumber: 1 });
    this.applyFilters();
  },
  clearRecordFilters() {
    this.setData({ filters: {}, statusIndex: 0, pageNumber: 1 });
    this.applyFilters();
  },
  clearSearch() {
    this.search({ detail: { value: '' } });
  },
  search(e) {
    this.setData({ search: e.detail.value, pageNumber: 1 });
    this.applyFilters();
  },
  add() {
    this.closeMapSettings();
    this.prepareCandidates();
    const today = localDay();
    this.setData({
      formError: '',
      editing: true,
      editingId: null,
      form: {
        date: today,
        departureTime: '',
        from: '',
        to: '',
        airline: '',
        flight: '',
        aircraft: '',
      },
    });
  },
  beginEdit(row) {
    this.prepareCandidates();
    this.setData({
      formError: '',
      editing: true,
      editingId: row._id,
      form: Object.fromEntries(
        Object.entries(row).filter(
          ([k]) =>
            ![
              'fromName',
              'toName',
              'status',
              'displayFlight',
              'aircraftName',
            ].includes(k),
        ),
      ),
    });
  },
  addFlightPage() {
    this.openFlightEditor();
  },
  editFlightPage(e) {
    const row = this.data.visibleRows[Number(e.currentTarget.dataset.index)];
    if (row) this.openFlightEditor(row);
  },
  openFlightEditor(row) {
    this.closeMapSettings();
    this.closeRecordFilters();
    wx.navigateTo({
      url:
        '/pages/flight-edit/index' +
        (row
          ? '?identity=' + encodeURIComponent(recordModel.identity(row))
          : ''),
      fail: (e) => this.setData({ error: '无法打开航班编辑页：' + e.errMsg }),
    });
  },
  field(e) {
    this.setData({
      formError: '',
      ['form.' + e.currentTarget.dataset.key]: e.detail.value,
    });
  },
  save() {
    const f = {
      ...this.data.form,
      date: String(this.data.form.date || '').trim(),
      departureTime: String(this.data.form.departureTime || '').trim(),
      flight: String(this.data.form.flight || '').trim(),
      aircraft: String(this.data.form.aircraft || '').trim(),
      airline: normalizeAirlineCode(this.data.form.airline),
      from: this.data.form.from.trim().toUpperCase(),
      to: this.data.form.to.trim().toUpperCase(),
    };
    try {
      if (dateValue(f.date) !== f.date) throw Error('请选择有效的起飞日期。');
      if (!airports[f.from])
        throw Error('请选择有效的出发机场，或填写机场三字码，如 SHA。');
      if (!airports[f.to])
        throw Error('请选择有效的到达机场，或填写机场三字码，如 NRT。');
      if (f.airline && !/^[A-Z0-9]{2}$/.test(f.airline))
        throw Error('请填写航空公司的 IATA 两位代码，如 MU、CA、9C。');
      calculate([f], airports, '9999-12-31', true);
      if (f.departureTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(f.departureTime))
        throw Error('起飞时间请填写 HH:mm，如 09:30');
      const identity = recordModel.identity;
      if (
        this.data.rows.some(
          (r) => r._id !== this.data.editingId && identity(r) === identity(f),
        )
      )
        throw Error(
          '相同日期、航司、航班号和方向的记录已存在，请编辑已有记录。',
        );
      const rows = [...this.data.rows];
      if (this.data.editingId) {
        const index = rows.findIndex((r) => r._id === this.data.editingId);
        if (index < 0) throw Error('这条记录已不存在，请关闭后重试。');
        rows[index] = f;
      } else rows.push(f);
      if (this.load(rows)) this.setData({ editing: false, formError: '' });
      else this.setData({ formError: this.data.error });
    } catch (e) {
      this.setData({ formError: e.message });
    }
  },
  async importFile() {
    if (this.choosingImport) return;
    this.choosingImport = true;
    const scope = this.localKey;
    try {
      const choice = await new Promise((resolve, reject) =>
        wx.showActionSheet({
          itemList: ['从聊天选择文件或图片', '从相册选择航班截图'],
          success: resolve,
          fail: reject,
        }),
      );
      if (this.disposed) return;
      let file, image;
      if (choice.tapIndex === 0) {
        const result = await new Promise((resolve, reject) =>
          wx.chooseMessageFile({
            count: 1,
            type: 'all',
            success: resolve,
            fail: reject,
          }),
        );
        file = result.tempFiles?.[0];
        image =
          file?.type === 'image' ||
          /\.(png|jpe?g|webp|heic)$/i.test(file?.name || file?.path || '');
      } else {
        const result = await wx.chooseMedia({
          count: 1,
          mediaType: ['image'],
          sourceType: ['album'],
          sizeType: ['compressed'],
        });
        const selected = result.tempFiles?.[0];
        if (selected)
          file = {
            path: selected.tempFilePath,
            size: selected.size,
            name: '航班截图',
          };
        image = true;
      }
      if (!file || this.disposed) return;
      if (file.size > 20 * 1024 * 1024)
        throw Error('文件超过 20 MB，请减小后重试');
      if (!image && !/\.(csv|xlsx|xls)$/i.test(file.name || ''))
        throw Error('请选择 Excel、CSV 或航班图片');
      this.openImportReview(file, image, scope);
    } catch (e) {
      if (!this.disposed && !/cancel/i.test(e.errMsg || e.message || '')) {
        wx.showModal({
          title: '无法导入',
          content: e.message || e.errMsg || '请重新选择文件',
          showCancel: false,
        });
      }
    } finally {
      this.choosingImport = false;
    }
  },
  openImportReview(file, image = false, key = this.localKey) {
    this.closeMapSettings();
    let channel;
    wx.navigateTo({
      url: image
        ? '/airport-picker/pages/image-import'
        : '/file-tools/pages/index?action=import',
      success: (result) => {
        channel = result.eventChannel;
        if (file) channel.emit(image ? 'selectedImage' : 'selectedFile', file);
      },
      events: {
        flightsImported: async (result) => {
          if (this.reviewingImport) return;
          this.reviewingImport = true;
          const previousName = this.data.fileName || '';
          let confirmation;
          try {
            if (key !== this.localKey) {
              const migrated =
                wx.getStorageSync('atlas-mini-auto-migrated-sources') || {};
              if (migrated[key] !== this.localKey) {
                this.setData({ error: '微信账号已切换，请重新导入' });
                channel?.emit('importResult', {
                  ok: false,
                  message: '微信账号已切换，请重新导入',
                });
                return;
              }
            }
            const baseline = JSON.stringify(this.data.rows),
              reviewScope = this.localKey;
            const confirmed = (confirmation =
              await require('../../../lib/confirm-import').confirmImport(
                this.data.rows,
                result.rows,
                result.name,
              ));
            if (!confirmed) {
              channel?.emit('importResult', {
                ok: false,
                message: '尚未导入，解析结果已保留，可重新核对',
              });
              return;
            }
            if (
              this.disposed ||
              reviewScope !== this.localKey ||
              baseline !== JSON.stringify(this.data.rows)
            )
              throw Error('记录已变化，请重新核对后导入');
            const report = atlasImport.merge(this.data.rows, confirmed.rows);
            if (!report.added && !report.updated) {
              channel?.emit('importResult', importResultData(report));
              return;
            }
            this.setData({ fileName: result.name || '' });
            if (this.load(report.rows)) {
              channel?.emit('importResult', importResultData(report));
            } else {
              confirmation?.returnOnError?.();
              this.setData({ fileName: previousName });
              channel?.emit('importResult', {
                ok: false,
                message:
                  this.data.error || '本机保存失败，识别结果已保留，请重试',
              });
            }
          } catch (error) {
            confirmation?.returnOnError?.();
            this.setData({
              fileName: previousName,
              error: '导入未完成：' + error.message,
            });
            channel?.emit('importResult', {
              ok: false,
              message: this.data.error,
            });
          } finally {
            this.reviewingImport = false;
          }
        },
      },
      fail: (e) => this.setData({ error: e.errMsg }),
    });
  },
  remove(e) {
    const scope = this.localKey;
    const index = Number(e.currentTarget.dataset.index),
      row = this.data.visibleRows[index];
    wx.showModal({
      title: '删除航班',
      content:
        '确定删除 ' + row.from + ' → ' + row.to + '（' + row.date + '）？',
      success: (r) => {
        if (r.confirm) {
          if (scope !== this.localKey) return;
          const deleted = this.data.rows.find((r) => r._id === row._id);
          if (this.load(this.data.rows.filter((v) => v._id !== row._id))) {
            this.deletedRow = deleted;
            this.deletedScope = scope;
            this.setData({ canUndo: true });
          }
        }
      },
    });
  },
};
