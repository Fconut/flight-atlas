const aircraft=require('../../lib/aircraft');
const account=require('../../lib/account-state');
const {localDay}=require('../../lib/day');
const createPage = require('../index/logic/create-page');
const lifecycle = require('../index/logic/lifecycle');
const { scan } = require('../../lib/data-quality');
const localState = require('../../lib/local-state');
const notes = {
  all: '检查只标记问题，不会自动修改记录。',
  errors: '检查日期、机场、航空公司代码和起飞时间，未来行程不视为错误。',
  missing: '机型选填。未匹配的名称可保留原文；只在确认具体型号后修改。',
  duplicates: '联程中的不同航段不视为重复。同日同方向的多条记录会提示核对，确认重复后再删除。'
};
const page = createPage('quality');
Object.assign(page.data, { qualityFilter: 'all', qualityPage: 1, qualityItems: [], qualityTotal: 0, qualityReady: false, qualityNote: notes.all });
Object.assign(page, {
  onLoad(options){if(options.filter==='missing')this.setData({qualityFilter:'missing'});this.historyOnly=options.history==='1'},
  startModel(e){const row=this.data.rows.find(r=>r._id===e.currentTarget.dataset.id);if(!row||aircraft.resolveAircraft(row.aircraft))return;this.modelOriginal=JSON.stringify(row);this.modelScope=this.localKey;this.setData({modelTarget:row._id,modelQuery:row.aircraft||'',modelBefore:row.aircraft||'',modelSuggestions:aircraft.searchAircraft(row.aircraft),modelError:''})},
  modelInput(e){const query=e.detail.value;this.setData({modelQuery:query,modelSuggestions:aircraft.searchAircraft(query),modelError:''})},
  pickModel(e){this.setData({modelQuery:e.currentTarget.dataset.value,modelSuggestions:[]})},
  cancelModel(){this.setData({modelTarget:null,modelQuery:'',modelSuggestions:[],modelError:''})},
  async saveModel(){if(this.modelSaving)return;const value=String(this.data.modelQuery||'').trim();if(!value)return this.setData({modelError:'请输入或选择机型'});if(value===this.data.modelBefore){this.cancelModel();return;}this.modelSaving=true;try{await this.syncTabState();if(this.disposed)return;const row=this.data.rows.find(r=>r._id===this.data.modelTarget);if(this.localKey!==this.modelScope||account.activeScope()!==this.localKey||!row||JSON.stringify(row)!==this.modelOriginal)throw Error('记录已更新，请重新选择');if(this.load(this.data.rows.map(r=>r._id===row._id?{...r,aircraft:value}:r))){this.cancelModel();wx.showToast({title:'已保存机型',icon:'success'})}}catch(e){if(!this.disposed)this.setData({modelError:e.message})}finally{this.modelSaving=false}},
  resumeDayClock() {},
  load(rows, persist = true) {
    const success = lifecycle.load.call(this, rows, persist);
    if (success) this.updateQualityReport();
    return success;
  },
  updateQualityReport() {
    this.qualityReport = scan(this.data.rows);
    this.setData({
      qualityTotal: this.qualityReport.total, qualityChecked: this.qualityReport.checked,
      qualityReady: true,
      qualityTabs: [
        { key: 'all', label: '全部', count: this.qualityReport.total },
        { key: 'errors', label: '需修正', count: this.qualityReport.errors },
        { key: 'missing', label: '待完善机型', count: this.qualityReport.models },
        { key: 'duplicates', label: '疑似重复', count: this.qualityReport.duplicates }
      ]
    });
    this.applyQualityFilter();
  },
  applyQualityFilter() {
    const filter = this.data.qualityFilter;
    const items = this.qualityReport.items.filter(item => filter === 'all' || (filter === 'errors' ? item.errors.length : filter === 'missing' ? (item.missing||item.unmatched)&&(!this.historyOnly||item.date<=localDay()) : item.duplicate));
    const pages = Math.max(1, Math.ceil(items.length / 20));
    const current = Math.max(1, Math.min(this.data.qualityPage, pages));
    this.setData({ qualityItems: items.slice((current-1)*20,current*20), qualityPage: current, qualityPages: pages, qualityMatch: items.length, qualityNote: notes[filter] });
  },
  selectQualityFilter(event) {
    const key = event.currentTarget.dataset.key;
    if (!Object.prototype.hasOwnProperty.call(notes, key)) return;
    this.setData({ qualityFilter: key, qualityPage: 1 }); this.applyQualityFilter();
  },
  turnQualityPage(event) {
    const next = this.data.qualityPage + Number(event.currentTarget.dataset.step);
    if (next < 1 || next > this.data.qualityPages) return;
    this.setData({ qualityPage: next }); this.applyQualityFilter(); wx.pageScrollTo({ scrollTop: 0, duration: 200 });
  },
  editQualityFlight(event) {
    const item = this.data.qualityItems.find(item => item.id === event.currentTarget.dataset.id);
    const row = item && this.data.rows[item.rowIndex];
    if (row && row._id === item.id) this.openFlightEditor(row);
  },
  deleteQualityFlight(event) {
    const item = this.data.qualityItems.find(item => item.id === event.currentTarget.dataset.id);
    const row = item && this.data.rows[item.rowIndex], scope = this.localKey;
    if (!row || row._id !== item.id || !item.duplicate) return;
    const original = JSON.stringify(row);
    wx.showModal({ title: '删除这条疑似重复记录？', content: item.date + ' ' + item.time + '\n' + item.fromName + ' → ' + item.toName + ' · ' + item.flight + '\n请对照原始记录，确认不是另一次实际乘坐。删除结果会自动保存到当前账号。', confirmText: '确认删除', confirmColor: '#a16959', success: async result => {
      if (!result.confirm || this.disposed || scope !== this.localKey) return;
      await this.syncTabState();
      if (this.disposed || scope !== this.localKey) return;
      let latest;
      try { latest = localState.read(scope); }
      catch (error) { this.setData({ error: '无法读取最新记录，本次未删除：' + error.message }); return; }
      const current = this.data.rows.find(value => value._id === item.id);
      const stored = latest.rows.find(value => value._id === item.id);
      if (localState.revision(scope) !== this.stateRevision || !stored || JSON.stringify(stored) !== original || !current || JSON.stringify(current) !== original) { this.setData({ error: '记录已更新，请重新核对后操作' }); return; }
      if (this.load(latest.rows.filter(value => value._id !== item.id))) {
        this.deletedRow = current;
        this.deletedScope = scope;
        this.setData({ canUndo: true });
      }
    } });
  }
});
Page(page);
