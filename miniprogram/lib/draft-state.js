const backup = require("./backup");
function snapshot(local) {
  return backup.snapshot({ ...local.prefs, rows: local.rows });
}
function localState(draft) {
  return {
    rows: backup.rows(draft),
    prefs: {
      theme: "navy",
      colors: draft.colors || null,
      posterContent: require("./poster-content").normalize(draft.posterContent),
      posterTitle: require("./poster-title").normalize(draft.posterTitle),
      posterStamp: require('./stamp-id').normalize(draft.posterStamp),
      labels: !(draft.labelSelection && draft.labelSelection.length === 0),
      labelSelection: draft.labelSelection,
      future: draft.includeFuture,
      fileName: typeof draft.fileName === "string" ? draft.fileName : "",
    },
  };
}
function validate(draft) {
  return backup.parseBackup(
    JSON.stringify({ format: "flight-atlas-backup", version: 1, draft }),
  );
}
const key = (draft) =>
  require("./cloud-content").backupContentKey(draft) +
  "|" +
  JSON.stringify(draft.fileName || "");
module.exports = { snapshot, localState, validate, key };
