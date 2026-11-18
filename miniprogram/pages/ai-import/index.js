const prompt = require('../../lib/ai-import-guide');
Page({
  data: { prompt },
  copy() {
    if (this.copying) return;
    this.copying = true;
    wx.setClipboardData({
      data: prompt,
      fail: () => wx.showToast({ title: '复制失败，请重试', icon: 'none' }),
      complete: () => { this.copying = false; }
    });
  },
  back() { wx.navigateBack(); },
  onUnload() { this.getOpenerEventChannel?.()?.emit?.('guideClosed'); }
});
