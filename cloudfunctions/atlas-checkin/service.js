const { createHash } = require('crypto');
const domain = require('./domain');
const COLLECTION = 'mini_atlas_checkins';
async function existing(ref) {
  try {
    const record=(await ref.get()).data;
    if(!record)return null;
    const {_id,...state}=record;return state;
  } catch (error) {
    const message = error.message || error.errMsg || '';
    if (/collection.*(?:not exist|not found|不存在)/i.test(message))
      throw error;
    if (
      /DOCUMENT_NOT_FOUND|document.*(?:not exist|not found|不存在)/i.test(
        message,
      )
    )
      return null;
    throw error;
  }
}
function createHandler({ identity, database, enabled, now = Date.now }) {
  return async (event) => {
    try {
      const { APPID, OPENID } = identity();
      if (
        APPID !== 'wx31f3f3739a7a1743' ||
        typeof OPENID !== 'string' ||
        !/^[A-Za-z0-9_-]{8,128}$/.test(OPENID)
      )
        throw Error('UNAUTHORIZED');
      if (!enabled()) throw Error('SETUP_REQUIRED');
      if (!['status', 'sign', 'claim'].includes(event.action))
        throw Error('INVALID_ACTION');
      const userId = createHash('sha256')
          .update(APPID + '\0' + OPENID)
          .digest('hex'),
        today = domain.day(now()),
        db = database();
      let record;
      if (event.action === 'status') {
        record = await existing(db.collection(COLLECTION).doc(userId));
        if (record && record.owner !== userId) throw Error('UNAUTHORIZED');
      } else {
        record = await db.runTransaction(async (transaction) => {
          const ref = transaction.collection(COLLECTION).doc(userId),
            old = await existing(ref);
          const result = domain.change(old, event.action, event, today, userId,event.planVersion>=5);
          if (result.changed) await ref.set({ data: result.record });
          return result.record;
        });
      }
      return { ok: true, userId, ...domain.view(record, today,event.planVersion>=5) };
    } catch (error) {
      const messages = {
        UNAUTHORIZED: '微信身份校验失败，请重新打开小程序',
        SETUP_REQUIRED: '签到服务准备中',
        NO_REWARD: '当前没有可领取的奖励，请刷新后重试',
        INVALID_REWARD: '这款奖励不可领取或已经拥有',
        INVALID_ACTION: '不支持的操作',
      };
      return {
        ok: false,
        code: messages[error.message] ? error.message : 'SERVICE_UNAVAILABLE',
        message: messages[error.message] || '签到服务暂不可用，请稍后重试',
      };
    }
  };
}
module.exports = { createHandler };
