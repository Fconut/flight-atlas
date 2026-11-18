const config = require('./cloud-config');
const account = require('./account-state');
let epoch = 0,
  verified = null,
  loginTask = null,
  currentTask = null;
function initialize() {
  if (!wx.cloud?.init || !wx.cloud?.callFunction)
    throw Error('当前微信版本暂不支持云端保存，请更新微信后重试。');
  if (!initialize.ready) {
    wx.cloud.init({ env: config.env, traceUser: false });
    initialize.ready = true;
  }
}
async function call(action, data = {}) {
  initialize();
  let response;
  let timeout;
  try {
    response = await Promise.race([
      require('./cloud-usage').callFunction({
        name: config.functionName,
        config: { env: config.env },
        data: { ...data, action },
      }),
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(Error('网络连接超时')), 12000);
        timeout?.unref?.();
      }),
    ]);
  } catch (error) {
    const message = error.errMsg || error.message || '';
    if (
      /not exist|not found|FUNCTION_NOT_FOUND|FUNCTION_NOT_EXIST|-501005/.test(
        message,
      )
    )
      throw Error('登录服务暂不可用，请稍后重试。');
    throw Error('微信云服务暂不可用，请稍后重试。');
  } finally {
    clearTimeout(timeout);
  }
  const result = response?.result;
  if (!result?.ok) {
    const error = Error(result?.message || '微信云服务返回异常');
    error.code = result?.code;
    throw error;
  }
  return result;
}
function sessionFor(result) {
  if (!/^[a-f0-9]{64}$/.test(result.userId || ''))
    throw Error('微信身份校验失败');
  return {
    provider: 'wechat-cloudbase',
    env: config.env,
    user: { id: result.userId },
  };
}
async function identify() {
  return sessionFor(await call('identity'));
}
async function current() {
  const cached = account.cached();
  if (!cached) return null;
  if (loginTask) return loginTask;
  if (verified?.user.id === cached.user.id) return cached;
  if (!currentTask) {
    const start = epoch;
    currentTask = identify()
      .then((session) => {
        if (start !== epoch) throw Error('微信账号已切换，请重新打开小程序');
        if (session.user.id !== cached.user.id) {
          wx.removeStorageSync(account.SESSION_KEY);
          throw Error('微信账号已切换，请重新打开小程序。');
        }
        verified = session;
        return session;
      })
      .finally(() => {
        currentTask = null;
      });
  }
  return currentTask;
}
async function login() {
  if (!loginTask) {
    const start = ++epoch;
    loginTask = identify()
      .then((session) => {
        if (start !== epoch) throw Error('登录已失效，请重新打开小程序');
        wx.setStorageSync(account.SESSION_KEY, session);
        verified = session;
        return session;
      })
      .finally(() => {
        loginTask = null;
      });
  }
  return loginTask;
}
async function authenticated(action, data) {
  const start = epoch,
    session = await current();
  if (!session) throw Error('登录尚未完成，请稍后重试');
  if (start !== epoch || account.cached()?.user.id !== session.user.id)
    throw Error('微信账号已切换，请重新打开小程序。');
  const result = await call(action, data);
  if (
    start !== epoch ||
    result.userId !== session.user.id ||
    account.cached()?.user.id !== session.user.id
  )
    throw Error('微信账号已切换，请重新打开小程序。');
  return result;
}
async function fetchDraft() {
  return (await authenticated('fetch')).record;
}
async function saveDraft(draft, revision) {
  return (await authenticated('save', { draft, expectedRevision: revision }))
    .revision;
}
async function signout() {
  epoch++;
  verified = null;
  wx.removeStorageSync(account.SESSION_KEY);
}
module.exports = { initialize, current, login, fetchDraft, saveDraft, signout };
