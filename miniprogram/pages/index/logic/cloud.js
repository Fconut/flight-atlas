const account = require("../../../lib/account-state");
const local = require("../../../lib/local-state");
const autoSave = require("../../../lib/auto-save");
module.exports = {
  async restoreSession() {
    try {
      this.unsubscribeAutoSave?.();
      this.unsubscribeAutoSave = autoSave.subscribe(() => {
        try {
          this.consumeAutoState();
        } catch (error) {
          if (!this.disposed)
            this.setData({ error: "本机记录读取异常：" + error.message });
        }
      });
      await autoSave.start();
      if (this.disposed) return false;
      this.consumeAutoState(true);
      return true;
    } catch (error) {
      if (!this.disposed)
        this.setData({ error: "记录读取失败，原数据保留：" + error.message });
      return false;
    }
  },
  consumeAutoState(force = false) {
    if (this.disposed) return;
    const state = autoSave.getState();
    this.setData({ savePhase: state.phase, saveStatusText: state.text });
    if (!state.scope) return;
    const changed =
      this.localKey !== state.scope ||
      this.stateRevision !== local.revision(state.scope);
    if (!force && !changed) return;
    // An open form must never be replaced by a background pull.
    if (this.data.view === "editor" && this.originalForm) {
      this.checkEditorState();
      return;
    }
    const value = local.read(state.scope),
      prefs = value.prefs;
    if (this.localKey !== state.scope)
      this.setData({
        filters: {},
        search: "",
        statusIndex: 0,
        pageNumber: 1,
        labelQuery: "",
      });
    this.localKey = state.scope;
    this.setData({
      fileName: prefs.fileName || "",
      theme: prefs.theme || "navy",
      colors: prefs.colors || null,
      posterStamp: require("../../../lib/stamp-id").normalize(prefs.posterStamp),
      labels: prefs.labels !== false,
      labelSelection: prefs.labelSelection || null,
        posterContent: prefs.posterContent ?? null,
        posterTitle: require("../../../lib/poster-title").normalize(prefs.posterTitle),
      future: !!prefs.future,
    });
    this.load(value.rows, false);
  },
  // Internal page/state transition only; there is no account management UI.
  async switchAccount(session) {
    const scope = account.scopeFor(session),
      value = local.read(scope),
      prefs = value.prefs;
    this.localKey = scope;
    this.setData({
      fileName: prefs.fileName || "",
      theme: prefs.theme || "navy",
      colors: prefs.colors || null,
      posterStamp: require("../../../lib/stamp-id").normalize(prefs.posterStamp),
      labels: prefs.labels !== false,
      labelSelection: prefs.labelSelection || null,
        posterContent: prefs.posterContent ?? null,
        posterTitle: require("../../../lib/poster-title").normalize(prefs.posterTitle),
      future: !!prefs.future,
      filters: {},
      search: "",
      statusIndex: 0,
      pageNumber: 1,
      labelQuery: "",
      editing: false,
      editingId: null,
    });
    this.load(value.rows, false);
  },
  updateCloudStatus() {
    const state = autoSave.getState();
    this.setData({ savePhase: state.phase, saveStatusText: state.text });
  },
};
