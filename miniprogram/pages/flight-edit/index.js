const accountState = require("../../lib/account-state");
const createPage = require("../index/logic/create-page");
const records = require("../index/logic/records");
const cloud = require("../index/logic/cloud");
const localState = require("../../lib/local-state");
const recordModel = require("../../lib/record-model");
const page = createPage("editor");
Object.assign(page, {
  onLoad(options) {
    this.editIdentity = null;
    this.rawEditIdentity = options.identity || null;
    if (options.identity) {
      try {
        this.editIdentity = decodeURIComponent(options.identity);
      } catch (_) {
        this.editIdentity = options.identity;
      }
    }
    wx.setNavigationBarTitle({
      title: this.editIdentity ? "编辑航班" : "添加航班",
    });
  },
  async restoreSession() {
    if (!(await cloud.restoreSession.call(this))) return false;
    if (this.disposed) return false;
    if (this.editIdentity) {
      const row = this.data.rows.find((row) =>
        [this.editIdentity, this.rawEditIdentity].includes(
          recordModel.identity(row),
        ),
      );
      if (!row) {
        this.setData({ editorStale: "这条航班已不存在，请返回列表重新选择。" });
        return false;
      }
      this.beginEdit(row);
    } else records.add.call(this);
    this.editorScope = this.localKey;
    this.editorRevision = localState.revision(this.localKey);
    this.updateAirportNames();
    this.originalForm = JSON.stringify(this.data.form);
    return true;
  },
  // Returning from airport search must preserve the form being edited.
  onShow() {
    this.pageHidden = false;
    if (this.editorScope) {
      this.checkEditorState();
      this.updateDirty();
    }
  },
  resumeDayClock() {},
  adoptEditorState(scope) {
    if (scope !== this.editorScope) {
      const claims =
        wx.getStorageSync("atlas-mini-auto-migrated-sources") || {};
      if (claims[this.editorScope] !== scope) return false;
    }
    const value = localState.read(scope),
      original = JSON.parse(this.originalForm);
    const comparable = (row) =>
      JSON.stringify(
        Object.fromEntries(
          Object.keys(row)
            .filter((key) => !["_id", "_line"].includes(key))
            .sort()
            .map((key) => [key, row[key]]),
        ),
      );
    let row;
    if (this.data.editingId) {
      row = value.rows.find(
        (item) =>
          item._id === this.data.editingId ||
          recordModel.identity(item) === recordModel.identity(original),
      );
      if (!row || comparable(row) !== comparable(original)) return false;
    }
    this.localKey = this.editorScope = scope;
    this.stateRevision = this.editorRevision = localState.revision(scope);
    const prefs = value.prefs,
      form = { ...this.data.form };
    if (row) {
      form._id = row._id;
      original._id = row._id;
    }
    this.originalForm = JSON.stringify(original);
    this.setData({
      rows: value.rows,
      form,
      editingId: row ? row._id : null,
      editorStale: "",
      fileName: prefs.fileName || "",
      theme: prefs.theme || "navy",
      colors: prefs.colors || null,
      labels: prefs.labels !== false,
      labelSelection: prefs.labelSelection || null,
      future: !!prefs.future,
    });
    this.applyFilters();
    this.updateDirty();
    return true;
  },
  checkEditorState() {
    try {
      const scope = accountState.activeScope();
      if (
        scope === this.editorScope &&
        localState.revision(scope) === this.editorRevision
      ) {
        if (this.data.editorStale) this.setData({ editorStale: "" });
        return true;
      }
      if (this.originalForm && this.adoptEditorState(scope)) return true;
      this.setData({
        editorStale:
          "记录已更新或微信账号已切换，请返回列表重新打开，原记录未被覆盖。",
      });
    } catch (error) {
      this.setData({
        editorStale: "无法核对本机记录，请返回后重试：" + error.message,
      });
    }
    return false;
  },
  updateDirty() {
    if (!this.originalForm) return;
    const dirty = JSON.stringify(this.data.form) !== this.originalForm;
    if (dirty === this.data.editorDirty) return;
    this.setData({ editorDirty: dirty });
    if (dirty)
      wx.enableAlertBeforeUnload?.({ message: "航班修改尚未保存，确定离开？" });
    else wx.disableAlertBeforeUnload?.();
  },
  cancel() {
    const leave = () => {
      wx.disableAlertBeforeUnload?.();
      wx.navigateBack();
    };
    if (this.data.editorDirty)
      wx.showModal({
        title: "放弃本次修改？",
        content: "尚未保存的内容会丢失。",
        confirmText: "放弃修改",
        success: (r) => {
          if (r.confirm) leave();
        },
      });
    else leave();
  },
  save() {
    if (
      this.data.initializing ||
      !this.data.editing ||
      this.data.editorStale ||
      !this.checkEditorState()
    )
      return;
    records.save.call(this);
    if (!this.data.editing && !this.data.formError) {
      wx.disableAlertBeforeUnload?.();
      wx.navigateBack({
        success: () => wx.showToast({ title: "航班已保存", icon: "success" }),
      });
    }
  },
});
for (const method of [
  "field",
  "datePicked",
  "timePicked",
  "clearTime",
  "swapAirports",
  "inlineAirportChange",
  "chooseInlineSuggestion",
  "pickCandidate",
]) {
  const original = page[method];
  page[method] = function (...args) {
    original.apply(this, args);
    this.updateDirty();
  };
}
Page(page);
