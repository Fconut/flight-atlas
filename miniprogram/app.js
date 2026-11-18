const cloud = require("./lib/cloud");
const account = require("./lib/account-state");
const autoSave = require("./lib/auto-save");
App({
  onLaunch() {
    try {
      account.initialize();
      cloud.initialize();
      autoSave.start().catch(() => {});
      wx.onNetworkStatusChange?.(({ isConnected }) => {
        try {
          if (isConnected) autoSave.online()?.catch?.(() => {});
        } catch (_) {}
      });
    } catch (error) {
      console.warn("云端初始化暂未完成：" + error.message);
    }
  },
  onShow() {
    try {
      autoSave.resume()?.catch?.(() => {});
    } catch (_) {}
  },
  onHide() {
    require("./lib/foreground-generation").invalidate();
    autoSave.hide();
  },
});
