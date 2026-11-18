const { createHash } = require("crypto");
const APP_ID = "wx31f3f3739a7a1743";
const COLLECTION = "mini_atlas_drafts";
const object = (value) =>
  value && typeof value === "object" && !Array.isArray(value);
function fail(code, message) {
  const error = Error(message);
  error.code = code;
  throw error;
}
function validateDraft(draft) {
  const row = (value) =>
    object(value) &&
    [
      "date",
      "departureTime",
      "from",
      "to",
      "airline",
      "flight",
      "aircraft",
      "_id",
    ].every(
      (key) =>
        value[key] == null || ["string", "number"].includes(typeof value[key]),
    );
  if (
    !object(draft) ||
    draft.version !== 1 ||
    !Array.isArray(draft.sheets) ||
    draft.sheets.length > 100 ||
    !draft.sheets.every(
      (sheet) =>
        object(sheet) &&
        typeof sheet.name === "string" &&
        Array.isArray(sheet.rows) &&
        sheet.rows.every(row),
    ) ||
    !(
      draft.rows === null ||
      (Array.isArray(draft.rows) && draft.rows.every(row))
    ) ||
    !Number.isInteger(draft.activeSheet) ||
    draft.activeSheet < -1 ||
    draft.activeSheet >= draft.sheets.length ||
    !["portrait", "landscape"].includes(draft.layout) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(draft.cutoff || "") ||
    typeof draft.includeFuture !== "boolean" ||
    !(
      draft.labelSelection === null ||
      (Array.isArray(draft.labelSelection) &&
        draft.labelSelection.every((code) => /^[A-Z]{3}$/.test(code)))
    ) ||
    (draft.colors &&
      !["background", "route"].every((key) =>
        /^#[a-f\d]{6}$/i.test(draft.colors[key] || ""),
      ))
  )
    fail("INVALID_DRAFT", "备份格式无效，云端未修改。");
  if (Buffer.byteLength(JSON.stringify(draft), "utf8") > 800 * 1024)
    fail(
      "DRAFT_TOO_LARGE",
      "记录超过当前账号容量，原记录已保留在本机。",
    );
}
async function existing(ref) {
  try {
    return (await ref.get()).data || null;
  } catch (error) {
    if (
      /collection.*(?:not exist|not found|不存在)/i.test(
        error.message || error.errMsg || "",
      )
    )
      throw error;
    if (
      /DOCUMENT_NOT_FOUND|document.*(?:not exist|not found|不存在)/i.test(
        error.message || error.errMsg || "",
      )
    )
      return null;
    throw error;
  }
}
function createHandler({ getIdentity, database, backupEnabled }) {
  return async (event = {}) => {
    try {
      const { OPENID, APPID } = getIdentity();
      if (
        APPID !== APP_ID ||
        typeof OPENID !== "string" ||
        !/^[A-Za-z0-9_-]{8,128}$/.test(OPENID)
      )
        fail("UNAUTHORIZED", "请重新打开小程序后重试。");
      const userId = createHash("sha256")
        .update(APPID + "\0" + OPENID)
        .digest("hex");
      if (event.action === "identity") return { ok: true, userId };
      if (!["fetch", "save"].includes(event.action))
        fail("INVALID_ACTION", "不支持的操作");
      // Fail closed until the developer has configured server-only collection permissions.
      if (!backupEnabled())
        fail(
          "SETUP_REQUIRED",
          "微信登录已完成，云端保存暂不可用。",
        );
      const db = database();
      const checkOwner = (record) => {
        if (record && (record._openid !== OPENID || record.appId !== APPID))
          fail("UNAUTHORIZED", "云端记录身份不匹配");
        return record;
      };
      if (event.action === "fetch") {
        const record = checkOwner(
          await existing(db.collection(COLLECTION).doc(userId)),
        );
        return {
          ok: true,
          userId,
          record: record
            ? {
                payload: record.payload,
                revision: record.revision,
                updated_at: record.updated_at,
              }
            : null,
        };
      }
      validateDraft(event.draft);
      if (
        !Number.isSafeInteger(event.expectedRevision) ||
        event.expectedRevision < 0
      )
        fail("INVALID_REVISION", "备份版本无效");
      const saved = await db.runTransaction(async (transaction) => {
        const ref = transaction.collection(COLLECTION).doc(userId);
        const current = checkOwner(await existing(ref));
        if ((current?.revision || 0) !== event.expectedRevision)
          return { conflict: true };
        const next = event.expectedRevision + 1;
        await ref.set({
          data: {
            _openid: OPENID,
            appId: APPID,
            payload: event.draft,
            revision: next,
            updated_at: new Date().toISOString(),
          },
        });
        return { revision: next };
      });
      if (saved.conflict) fail("40001", "云端已有新版本，请重新核对后保存。");
      return { ok: true, userId, revision: saved.revision };
    } catch (error) {
      const known = [
        "UNAUTHORIZED",
        "INVALID_ACTION",
        "SETUP_REQUIRED",
        "INVALID_DRAFT",
        "DRAFT_TOO_LARGE",
        "INVALID_REVISION",
        "40001",
      ];
      if (known.includes(error.code))
        return { ok: false, code: error.code, message: error.message };
      return {
        ok: false,
        code: "CLOUD_UNAVAILABLE",
        message: "云端保存暂不可用，请稍后重试。",
      };
    }
  };
}
module.exports = { createHandler, validateDraft, COLLECTION };
