const aircraftModels=require('../../lib/aircraft');
const {importComplete}=require('../../lib/import-complete');
const { parseFlightScreenshot } = require('../lib/screenshot-parser');
const AirportSearch = require('../lib/airport-search');
const { dateValue, normalizeAirlineCode } = require('../../lib/flights');
const config = require('../../lib/cloud-config');
const account = require('../../lib/account-state');
const { imageSize } = require('../lib/ocr-image-size');
const airports = require('../airports'), names = require('../../lib/names'), metadata = require('../search-metadata');
const fields = [
  { key: 'date', label: '日期', placeholder: 'YYYY-MM-DD' },
  { key: 'airline', label: '航空公司', placeholder: '如 MU' }, { key: 'flight', label: '航班号', placeholder: '如 5358' },
  { key: 'from', label: '出发机场', placeholder: '机场、城市或机场代码' }, { key: 'to', label: '到达机场', placeholder: '机场、城市或机场代码' },
  { key: 'departureTime', label: '当地起飞时间（选填）', placeholder: 'HH:mm' }, { key: 'aircraft', label: '机型（选填）', placeholder: '未识别到机型时可留空' }
];
function validate(row, search) {
  const value = Object.fromEntries(fields.map(f => [f.key, String(row[f.key] || '').trim()]));
  value.from = search.resolve(value.from); value.to = search.resolve(value.to); value.airline = normalizeAirlineCode(value.airline);
  const errors = {};
  if (!dateValue(value.date)) errors.date = '请补齐有效日期';
  if (!/^[A-Z0-9]{2}$/.test(value.airline || '')) errors.airline = '请填写航空公司的 IATA 两位代码';
  if (!/^\d{1,4}$/.test(value.flight)) errors.flight = '航班号请填写 1–4 位数字';
  if (!value.from) errors.from = '请明确选择出发机场';
  if (!value.to) errors.to = '请明确选择到达机场';
  if (value.from && value.from === value.to) errors.to = '出发机场和到达机场不能相同';
  if (value.departureTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.departureTime)) errors.departureTime = '请使用 HH:mm 格式';
  value.date = dateValue(value.date);
  return { value, errors };
}
Page({
  data: { fields, fieldGroups: [{id:'date',items:[fields[0]]},{id:'flight',items:[fields[1],fields[2]]},{id:'from',items:[fields[3]]},{id:'to',items:[fields[4]]},{id:'optional',items:[fields[5],fields[6]]}], rows: [], processing: false, selectedCount: 0, invalidCount: 0, message: '建议使用清晰、完整的截图；缺失的日期和机场需手动补齐。' },
  onLoad() {
    this.scope = account.activeScope(); this.search = AirportSearch.create(airports, names, metadata);
    this.getOpenerEventChannel().on('selectedImage', file => this.recognizeFile(file));
    this.getOpenerEventChannel().on('importResult', result => {
      if (this.disposed) return;
      if (result.ok) importComplete(result);
      else { this.confirmed = false; this.setData({ message: result.message || '记录尚未保存，请重试' }); }
    });
  },
  onUnload() { this.disposed = true; },
  close() { wx.navigateBack(); },
  preview() { if (this.data.image) wx.previewImage({ urls: [this.data.image] }); },
  toggleRaw() { this.setData({ showRaw: !this.data.showRaw }); },
  toggleImage() { this.setData({ showImage: !this.data.showImage }); },
  toggleIssues() { this.setData({ issuesOnly: !this.data.issuesOnly }); },
  selectAll() {
    const selected = !this.data.allSelected;
    this.setData({ rows: this.data.rows.map(row => ({ ...row, selected })) });
    this.revalidate();
  },
  async call(data) {
    const response = await require('../../lib/cloud-usage').callFunction({ name: 'atlas-ocr', config: { env: config.env }, data, timeout: 65000 });
    if (!response.result?.ok) throw Error(response.result?.message || '识别服务返回异常');
    return response.result;
  },
  async choose() {
    if (this.data.processing) return;
    this.setData({ processing: true });
    let selected;
    try {
      const media = await wx.chooseMedia({ count: 1, mediaType: ['image'], sourceType: ['album'], sizeType: ['compressed'] });
      selected = media.tempFiles?.[0];
    } catch(e) {
      if (!this.disposed && !/cancel/i.test(e.errMsg || e.message || '')) this.setData({ message: '选图失败：' + (e.message || e.errMsg) });
    } finally { if (!this.disposed) this.setData({ processing: false }); }
    if (selected && !this.disposed) await this.recognizeFile({ path: selected.tempFilePath, size: selected.size });
  },
  async recognizeFile(file) {
    if (this.data.processing || this.disposed) return;
    this.setData({ processing: true }); let fileID;
    try {
      const image = file.path;
      if (!image || file.size > 20 * 1024 * 1024) throw Error('请选择大小不超过 20 MB 的图片');
      this.setData({ image, rows: [], rawText: '', showRaw: false, showImage: false, selectedCount: 0, invalidCount: 0, issuesOnly: false, message: '正在准备图片…' });
      const owner = account.activeScope();
      const digest = await new Promise(resolve => wx.getFileSystemManager().getFileInfo({filePath:image,digestAlgorithm:'md5',success:r=>resolve(r.digest||''),fail:()=>resolve('')}));
      const cacheKey = digest ? owner + ':' + digest : '';
      let result;
      if (cacheKey && this.ocrCache?.key === cacheKey) result = {text:this.ocrCache.text};
      else {
      const info = await wx.getImageInfo({ src: image });
      const sizePlan = imageSize(info.width, info.height);
      const compressed = await wx.compressImage({ src: image, quality: 85, compressedWidth: sizePlan.width, compressedHeight: sizePlan.height });
      const size = await new Promise((resolve, reject) => wx.getFileSystemManager().getFileInfo({ filePath: compressed.tempFilePath, success: r => resolve(r.size), fail: reject }));
      if (size > 4 * 1024 * 1024) throw Error('图片压缩后仍超过 4 MB，请裁剪后重试');
      if (this.disposed) return;
      const request = await this.call({ action: 'prepare' });
      if (this.disposed) return;
      fileID = (await wx.cloud.uploadFile({ cloudPath: request.path, filePath: compressed.tempFilePath, config: { env: config.env } })).fileID;
      if (this.disposed) return;
      this.setData({ message: sizePlan.long ? '正在分段识别长截图，完成后统一核对，请稍候…' : '正在识别中英文航班信息，首次识别可能稍慢…' });
      result = await this.call({ action: 'recognize', token: request.token, fileID });
      if (!this.disposed && cacheKey && account.activeScope()===owner) this.ocrCache={key:cacheKey,text:result.text};
      }
      if (account.activeScope()!==owner) throw Error('微信账号已切换，请重新选择截图');
      if (this.disposed) return;
      this.setData({ rawText: result.text });
      const parsed = parseFlightScreenshot(result.text);
      if (parsed.length > 100) throw Error('识别到 ' + parsed.length + ' 条航班，超过单次核对上限 100 条。请分批截图，本次没有导入任何航班。');
      const rows = parsed.map((row, i) => ({ ...row, from: this.search.resolve(row.from) || row.from, to: this.search.resolve(row.to) || row.to, selected: true, _key: i }));
      this.setData({ rawText: result.text, rows, message: rows.length ? '识别完成' : '未找到航班。可查看识别文字，或换一张更清晰的截图。' });
      this.revalidate();
    } catch(e) {
      if (!this.disposed && !/cancel/i.test(e.errMsg || e.message || '')) this.setData({ message: '识别失败：' + (e.message || e.errMsg || '请稍后重试') });
    } finally {
      if (fileID) { try { await wx.cloud.deleteFile({ fileList: [fileID], config: { env: config.env } }); } catch (_) {} }
      if (!this.disposed) this.setData({ processing: false });
    }
  },
  reviewRow(row) {
      const errors = row.selected ? validate(row, this.search).errors : {};
      const recommendations = {};
      for (const key of ['from', 'to']) recommendations[key] = row.selected && !this.search.resolve(row[key]) ? this.search.query(row[key] || row[key === 'from' ? 'rawFrom' : 'rawTo'], 4) : [];
      const model=aircraftModels.resolveAircraft(row.aircraft);
      const modelOptions=row.selected&&!model&&String(row.aircraft||'').trim()?aircraftModels.searchAircraft(row.aircraft):[];
      return { ...row, modelOptions, modelName:model?.name||'', modelUnmatched:!!row.aircraft&&!model, errors, recommendations, invalid: Object.keys(errors).length > 0 };
  },
  refreshCounts() {
    const rows = this.data.rows;
    const selectedCount = rows.filter(row => row.selected).length;
    this.setData({ selectedCount, invalidCount: rows.filter(row => row.selected && row.invalid).length, allSelected: selectedCount > 0 && selectedCount === rows.length });
  },
  revalidate() {
    this.setData({ rows: this.data.rows.map(row => this.reviewRow(row)) });
    this.refreshCounts();
  },
  updateReviewRow(index, patch) {
    index = Number(index);
    if (!Number.isInteger(index) || !this.data.rows[index]) return;
    this.setData({ ['rows['+index+']']: this.reviewRow({ ...this.data.rows[index], ...patch }) });
    this.refreshCounts();
  },
  toggle(e) { const i = Number(e.currentTarget.dataset.index); this.updateReviewRow(i, { selected: !this.data.rows[i].selected }); },
  input(e) { const { index, key } = e.currentTarget.dataset; if (fields.some(field => field.key === key)) this.updateReviewRow(index, { [key]: e.detail.value }); },
  clearTime(e) { this.updateReviewRow(e.currentTarget.dataset.index, { departureTime: '' }); },
  focus(e) { const { index, key } = e.currentTarget.dataset; this.suggest(index, key, this.data.rows[index][key]); },
  suggest(index, key, value) {
    if (!['from','to'].includes(key)) return;
    this.setData({ ['rows['+index+'].recommendations.'+key]: this.search.resolve(value) ? [] : this.search.query(value, 4) });
  },
  chooseModel(e){const {index,value}=e.currentTarget.dataset;const model=aircraftModels.resolveAircraft(value);if(model)this.updateReviewRow(index,{aircraft:model.name})},
  chooseAirport(e) { const { index, key, code } = e.currentTarget.dataset; if (['from','to'].includes(key)) this.updateReviewRow(index, { [key]: code }); },
  confirm() {
    if (this.data.processing || this.confirmed) return;
    const active = account.activeScope(), claims = wx.getStorageSync('atlas-mini-auto-migrated-sources') || {};
    if (active !== this.scope && claims[this.scope] !== active) { this.setData({ message: '微信账号已切换，请重新导入图片' }); return; }
    this.revalidate();
    const chosen = this.data.rows.filter(r => r.selected), results = chosen.map(row => validate(row, this.search));
    if (!chosen.length || results.some(r => Object.keys(r.errors).length)) {
      this.setData({ issuesOnly: false, message: '请补充或修正红框字段，也可取消选择对应航班。' });
      const index = this.data.rows.findIndex(row => row.selected && row.invalid);
      if (index >= 0) wx.nextTick(() => { if (!this.disposed) wx.pageScrollTo({ selector: '#flight-' + index, duration: 250 }); });
      return;
    }
    this.confirmed = true;
    this.getOpenerEventChannel().emit('flightsImported', { rows: results.map(r => r.value), name: '航班图片识别' });
  }
});
module.exports = { validate };
