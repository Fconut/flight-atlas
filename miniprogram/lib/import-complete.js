let navigating = false;
function importComplete(report = {}) {
  if (navigating) return;
  navigating = true;
  wx.switchTab({
    url: '/pages/index/index',
    success() {
      navigating = false;
      wx.showToast({
        title: report.added || report.updated
          ? '已保存 ' + ((report.added || 0) + (report.updated || 0)) + ' 条记录'
          : '记录无需更新',
        icon: 'none'
      });
    },
    fail() { navigating = false; wx.navigateBack(); }
  });
}
function importResultData(report) { return {ok:true,added:report.added||0,updated:report.updated||0,skipped:report.skipped||0}; }
module.exports = { importComplete, importResultData };
