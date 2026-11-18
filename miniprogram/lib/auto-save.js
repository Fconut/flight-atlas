const defaults = {
  cloud: require("./cloud"),
  account: require("./account-state"),
  local: require("./local-state"),
};
const draft = require("./draft-state");
const { mergeDrafts } = require("./merge-drafts");
const empty = () => draft.snapshot({ rows: [], prefs: {} });
function createAutoSave(dependencies = {}) {
  const { cloud, account, local } = { ...defaults, ...dependencies };
  const storage = dependencies.storage || {
    get: (key) => wx.getStorageSync(key),
    set: (key, value) => wx.setStorageSync(key, value),
  };
  const timers = dependencies.timers || {
    set: setTimeout,
    clear: clearTimeout,
  };
  let state = {
      scope: null,
      session: null,
      phase: "loading",
      text: "正在读取航班…",
    },
    started = false,
    stopped = false,
    hidden = false;
  let work = null,
    again = false,
    timer = null,
    retryCount = 0,
    unsubscribe;
  const now = dependencies.now || Date.now;
  let lastSyncedKey = null, lastSyncAt = 0;
  const listeners = new Set();
  const emit = (phase, text) => {
    state = { ...state, phase, text };
    for (const listener of listeners) listener(state);
  };
  const cancelTimer = () => {
    if (timer) {
      timers.clear(timer);
      timer = null;
    }
  };
  const schedule = (delay) => {
    cancelTimer();
    if (stopped || hidden) return;
    timer = timers.set(() => {
      timer = null;
      flush();
    }, delay);
    timer?.unref?.();
  };
  function journal(scope) {
    const value = storage.get(scope + "-auto-save");
    if (!value) return null;
    if (
      value.version !== 1 ||
      !Number.isSafeInteger(value.revision) ||
      value.revision < 0 ||
      !value.base
    )
      throw Error("保存状态异常，原记录已保留，请勿清除缓存。");
    draft.validate(value.base);
    return value;
  }
  function writeJournal(scope, base, revision) {
    storage.set(scope + "-auto-save", { version: 1, base, revision });
  }
  function apply(scope, next) {
    const current = local.read(scope),
      value = draft.localState(next);
    if (
      JSON.stringify(current.rows) !== JSON.stringify(value.rows) ||
      JSON.stringify(current.prefs) !== JSON.stringify(value.prefs)
    )
      local.write(scope, value.rows, value.prefs, "remote");
  }
  function migrate(scope, remote) {
    const source = account.initialize();
    if (source === scope) return;
    const claims = storage.get("atlas-mini-auto-migrated-sources") || {};
    if (claims[source]) return;
    let old;
    try {
      old = local.read(source);
    } catch (_) {
      state = {
        ...state,
        migrationWarning: "部分旧记录读取异常，原数据已保留",
      };
      return;
    }
    const current = local.read(scope);
    if (old.rows.length || Object.keys(old.prefs).length) {
      const sourceDraft = draft.snapshot(old),
        currentDraft = draft.snapshot(current);
      const preferred =
        current.rows.length || Object.keys(current.prefs).length
          ? currentDraft
          : remote;
      const merged = mergeDrafts(
        null,
        preferred || sourceDraft,
        preferred ? sourceDraft : null,
      );
      if (!current.rows.length && !remote)
        merged.fileName = sourceDraft.fileName;
      apply(scope, merged);
    }
    storage.set("atlas-mini-auto-migrated-sources", {
      ...claims,
      [source]: scope,
    });
  }
  async function reconcile() {
    if (!state.session) {
      const session = await cloud.login();
      if (stopped) return;
      const scope = account.scopeFor(session);
      local.read(scope);
      state = { ...state, session, scope, bootError: null };
      emit(state.phase === "loading" ? "loading" : "saving", "正在读取航班…");
    }
    const scope = state.scope;
    // After this session has fetched the cloud, let the server's atomic revision
    // check reject stale edits instead of always paying for a separate fetch.
    const known = lastSyncedKey !== null ? journal(scope) : null;
    if (known && storage.get(scope + '-state')) {
      const pending = draft.snapshot(local.read(scope));
      if (draft.key(pending) !== draft.key(known.base)) {
        try {
          const revision = await cloud.saveDraft(pending, known.revision);
          if (stopped) return;
          storage.set(scope + '-auto-recovery', known.base);
          writeJournal(scope, pending, revision);
          if (draft.key(draft.snapshot(local.read(scope))) !== draft.key(pending)) again = true;
          return;
        } catch (error) {
          if (error.code !== '40001') throw error;
          // Fetch and three-way merge only when another device has written.
        }
      }
    }
    const record = await cloud.fetchDraft();
    if (stopped) return;
    const remote = record ? draft.validate(record.payload) : null;
    const revision = record?.revision || 0;
    if (!Number.isSafeInteger(revision) || revision < 0)
      throw Error("账号记录版本异常，本机内容已保留。");
    migrate(scope, remote);
    const saved = journal(scope),
      hasLocal = !!storage.get(scope + "-state");
    const current = hasLocal ? draft.snapshot(local.read(scope)) : null;
    const merged = mergeDrafts(saved?.base || null, current, remote);
    apply(scope, merged);
    writeJournal(scope, remote || empty(), revision);
    emit("saving", "正在保存…");
    if (!remote && !saved && draft.key(merged) === draft.key(empty())) {
      // A new empty account needs no document until the first meaningful change.
      writeJournal(scope, merged, 0);
      return;
    }
    if (draft.key(merged) === draft.key(remote || empty())) return;
    if (remote) storage.set(scope + "-auto-recovery", remote);
    const nextRevision = await cloud.saveDraft(merged, revision);
    if (stopped) return;
    writeJournal(scope, merged, nextRevision);
    if (draft.key(draft.snapshot(local.read(scope))) !== draft.key(merged))
      again = true;
  }
  function flush() {
    if (!started || stopped) return Promise.resolve();
    cancelTimer();
    if (work) {
      again = true;
      return work;
    }
    work = (async () => {
      try {
        let attempts = 0;
        do {
          again = false;
          try {
            await reconcile();
            if (!stopped && state.scope) {
              lastSyncedKey = draft.key(journal(state.scope)?.base || empty());
              lastSyncAt = now();
            }
          } catch (error) {
            if (error.code === "40001" && ++attempts < 4) {
              again = true;
              continue;
            }
            throw error;
          }
          attempts++;
        } while (again && !stopped && attempts < 4);
        retryCount = 0;
        if (!stopped) {
          if (again) schedule(250);
          else
            emit(
              "saved",
              state.migrationWarning
                ? "已保存；" + state.migrationWarning
                : "已保存",
            );
        }
      } catch (error) {
        if (stopped) return;
        const fatal =
          [
            "INVALID_DRAFT",
            "DRAFT_TOO_LARGE",
            "INVALID_REVISION",
            "SETUP_REQUIRED",
          ].includes(error.code) || /异常|格式/.test(error.message || "");
        emit(
          fatal ? "error" : "offline",
          fatal
            ? "记录已保留在本机，暂未保存到账号：" + error.message
            : "暂时离线，记录已保存在本机，联网后自动保存",
        );
        if (!fatal) schedule(Math.min(60000, 3000 * Math.pow(2, retryCount++)));
      } finally {
        work = null;
      }
    })();
    return work;
  }
  function syncIfNeeded() {
    if (work) return work;
    if (state.phase === 'saved' && state.scope && lastSyncedKey !== null &&
        draft.key(draft.snapshot(local.read(state.scope))) === lastSyncedKey &&
        (hidden || now() - lastSyncAt < 300000)) return Promise.resolve();
    return flush();
  }
  async function ensureSaved() {
    await start();
    if (work) await work;
    // Share creation reads the authoritative cloud draft itself. A clean local
    // journal only needs its previous write acknowledged, not another fetch.
    if (state.session && state.phase === 'saved' && state.scope &&
        draft.key(draft.snapshot(local.read(state.scope))) === draft.key(journal(state.scope)?.base || empty())) return;
    return flush();
  }
  function start() {
    if (started) return Promise.resolve(state);
    stopped = false;
    lastSyncedKey = null;
    lastSyncAt = 0;
    // Show cached records immediately. Identity and remote loading run in the background.
    state = { ...state, scope: account.activeScope(), session: null };
    try {
      local.read(state.scope);
    } catch (error) {
      state = { ...state, bootError: error.message };
    }
    started = true;
    unsubscribe = local.subscribe((event) => {
      if (event.origin === "remote" || event.scope !== state.scope || stopped)
        return;
      if (state.phase === "saved" && draft.key(draft.snapshot(local.read(state.scope))) === lastSyncedKey) return;
      emit("saving", "正在保存…");
      schedule(2000);
    });
    emit("loading", "正在读取航班…");
    Promise.resolve().then(() => { if (!work) flush(); });
    return Promise.resolve(state);
  }
  return {
    start,
    flush,
    ensureSaved,
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    resume() {
      hidden = false;
      if (started) return syncIfNeeded();
      return start();
    },
    online() {
      if (!hidden) return started ? syncIfNeeded() : start();
      return Promise.resolve();
    },
    hide() {
      hidden = true;
      cancelTimer();
      if (started) syncIfNeeded();
    },
    stop() {
      stopped = true;
      cancelTimer();
      unsubscribe?.();
    },
    createAutoSave,
  };
}
module.exports = { ...createAutoSave(), createAutoSave };
