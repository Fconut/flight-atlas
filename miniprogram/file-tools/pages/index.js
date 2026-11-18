const {importComplete}=require('../../lib/import-complete');
const tempFiles = require('../../lib/temp-files.js');
const XLSX = require('../xlsx'),
  { parseSheet } = require('../../lib/flights');
Page({
  data: { message: '请选择 CSV 或 Excel 航班文件', action: 'import' },
  onLoad(options) {
    this.setData({ action: options.action || 'import' });
    this.getOpenerEventChannel().on('exportRows', (data) => this.exportRows(data));
    this.getOpenerEventChannel().on('importResult', result => {
      if (this.disposed || !this.awaitingImport) return;
      this.awaitingImport = false;
      if (result.ok) {
        this.importResult = null;
        importComplete(result);
      } else this.setData({ processing: false, canRetryImport: true, message: result.message || '保存失败，解析结果已保留，请重试' });
    });
    this.getOpenerEventChannel().on('selectedFile', (file) => this.choose(file));
  },
  onUnload() {
    this.disposed = true;
    this.operationId = (this.operationId || 0) + 1;
  },
  async choose(selectedFile) {
    if (this.data.processing) return;
    const id = (this.operationId = (this.operationId || 0) + 1);
    this.setData({ processing: true });
    try {
      const res = selectedFile?.path ? { tempFiles: [selectedFile] } : await new Promise((resolve, reject) =>
        wx.chooseMessageFile({
          count: 1,
          type: 'file',
          extension: ['csv', 'xlsx', 'xls'],
          success: resolve,
          fail: reject
        })
      );
      if (this.disposed || id !== this.operationId) return;
      const file = res.tempFiles?.[0];
      if (!file) throw Error('没有选择文件');
      if (file.size > 20 * 1024 * 1024) throw Error('文件超过 20 MB');
      const raw = await new Promise((resolve, reject) =>
        wx.getFileSystemManager().readFile({ filePath: file.path, success: resolve, fail: reject })
      );
      if (this.disposed || id !== this.operationId) return;
      const book = XLSX.read(raw.data, { type: 'array', raw: true, cellDates: true, codepage: 65001 }),
        sheets = [];
      for (const name of book.SheetNames) {
        const sheet = parseSheet(
          XLSX.utils.sheet_to_json(book.Sheets[name], { header: 1, defval: '', raw: true }),
          name
        );
        if (sheet) sheets.push(sheet);
      }
      if (!sheets.length) throw Error('未识别表头，至少需要日期、出发机场、到达机场。');
      this.importResult = {
        rows: sheets.flatMap((s) => s.rows),
        name: file.name
      };
      this.submitImport();
    } catch (e) {
      if (!this.disposed && id === this.operationId && !/cancel/i.test(e.errMsg || e.message || ''))
        this.setData({ message: '导入失败：' + (e.message || e.errMsg) });
    } finally {
      if (!this.disposed && id === this.operationId && !this.awaitingImport) this.setData({ processing: false });
    }
  },
  submitImport() {
    if (!this.importResult || this.awaitingImport || this.disposed) return;
    this.awaitingImport = true;
    this.setData({ processing: true, canRetryImport: false, message: '正在保存航班…' });
    this.getOpenerEventChannel().emit('flightsImported', this.importResult);
  },
  retryImport() { this.submitImport(); },
  exportRows(data) {
    if (this.data.processing || this.data.sharing || this.disposed) return;
    this.setData({ processing: true, exportFailed: false });
    this.lastExport = data;
    try {
      const rows = data.rows || [],
        matrix = [
          ['Date', 'Departure Time', 'From', 'To', 'Airline', 'Flight', 'Aircraft Type Name'],
          ...rows.map((r) => [
            r.date,
            r.departureTime || '',
            r.from,
            r.to,
            r.airline || '',
            r.flight || '',
            r.aircraft || ''
          ])
        ],
        book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(matrix), 'Flights');
      const bytes = XLSX.write(book, { type: 'array', bookType: 'xlsx' }),
        filePath = tempFiles.create('template', 'xlsx');
      wx.getFileSystemManager().writeFile({
        filePath,
        data: bytes,
        success: () => {
          tempFiles.cleanup();
          if (this.disposed) return;
          this.setData({
            processing: false,
            exportFailed: false,
            filePath,
            fileName: data.template ? 'flight-atlas-template.xlsx' : 'flight-atlas-flights.xlsx',
            message: 'Excel 已生成，可通过微信发送并保存。'
          });
          this.shareAgain();
        },
        fail: (e) => {
          if (!this.disposed) this.setData({ processing: false, exportFailed: true, message: '模板生成失败，请重试：' + e.errMsg });
        }
      });
    } catch (e) {
      if (!this.disposed) this.setData({ processing: false, exportFailed: true, message: '模板生成失败，请重试：' + e.message });
    }
  },
  shareAgain() {
    if (!this.data.filePath || this.data.sharing || this.disposed) return;
    this.setData({ sharing: true });
    if (!wx.shareFileMessage) {
      this.setData({ sharing: false, message: '当前环境不支持文件分享，请在手机微信中导出。' });
      return;
    }
    wx.shareFileMessage({
      filePath: this.data.filePath,
      fileName: this.data.fileName,
      success: () => {
        if (!this.disposed) this.setData({ message: '文件已分享，可在会话中保存' });
      },
      fail: (e) => {
        if (!this.disposed) this.setData({ message: '分享未完成，可点击“发送 Excel 文件”重试：' + e.errMsg });
      },
      complete: () => {
        if (!this.disposed) this.setData({ sharing: false });
      }
    });
  },
  retryExport() {
    if (this.lastExport) this.exportRows(this.lastExport);
  },
  back() {
    wx.navigateBack();
  }
});
