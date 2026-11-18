const config = require('./cloud-config');
const cloud = require('./cloud');
async function requestShare(action, data = {}) {
  cloud.initialize();
  let timer;
  try {
    const response = await Promise.race([
      require('./cloud-usage').callFunction({
        name: 'atlas-share',
        config: { env: config.env },
        data: { ...data, action },
      }),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(Error('分享服务连接超时，请稍后重试')),
          25000,
        );
      }),
    ]);
    if (!response.result?.ok)
      throw Error(response.result?.message || '分享服务返回异常');
    return response.result;
  } finally {
    clearTimeout(timer);
  }
}
const account = require('./account-state');
const pending = new Map();
const cache = new Map();
let cacheSize = 0;
function discard(key) {
  const entry = cache.get(key);
  if (entry) cacheSize -= entry.size;
  cache.delete(key);
}
function callShare(action, data = {}) {
  const scope = account.activeScope();
  const key = JSON.stringify([config.env, scope, action, data]);
  const cached = cache.get(key);
  if (cached) {
    if (Date.now() < cached.until) {
      cache.delete(key);
      cache.set(key, cached);
      return Promise.resolve(JSON.parse(cached.json));
    }
    discard(key);
  }
  if (pending.has(key)) return pending.get(key);
  const request = requestShare(action, data)
    .then((result) => {
      // Read-only results are reusable; creation always goes through the server.
      if (
        /^[a-f0-9]{32}$/.test(data.id || '') &&
        account.activeScope() === scope &&
        ((action === 'get' && result.snapshot) ||
          (action === 'code' && result.image))
      ) {
        const json = JSON.stringify(result),
          size = json.length;
        if (size <= 2 * 1024 * 1024) {
          discard(key);
          cache.set(key, {
            json,
            size,
            until: Date.now() + (action === 'code' ? 1800000 : 300000),
          });
          cacheSize += size;
          while (cache.size > 8 || cacheSize > 2 * 1024 * 1024)
            discard(cache.keys().next().value);
        }
      }
      return result;
    })
    .finally(() => pending.delete(key));
  pending.set(key, request);
  return request;
}
module.exports = { callShare };
