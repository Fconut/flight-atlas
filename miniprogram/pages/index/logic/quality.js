const { scan } = require('../../../lib/data-quality');
module.exports = {
  updateQualitySummary(rows) {
    this.setData({ qualityCount: scan(rows).total });
  },
  openDataCheck() {
    wx.navigateTo({ url: '/pages/data-check/index', fail: error => this.setData({ error: '无法打开数据检查：' + error.errMsg }) });
  }
};
