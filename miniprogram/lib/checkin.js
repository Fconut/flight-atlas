const cloud = require('./cloud');
const account = require('./account-state');
const config = require('./cloud-config');
const store = require('./checkin-store');
const pending = new Map();
const failures = new Map();
async function request(action, data = {}) {
  cloud.initialize();
  const session = (await cloud.current()) || (await cloud.login()),
    scope = account.scopeFor(session);
  let response, timer;
  try {
    response = await Promise.race([
      require('./cloud-usage').callFunction({
        name: 'atlas-checkin',
        config: { env: config.env },
        data: { ...data, action, planVersion: 5 },
      }),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(Error('TIMEOUT')), 15000);
        timer?.unref?.();
      }),
    ]);
  } catch (error) {
    throw Error('签到服务连接失败，请稍后重试');
  } finally {
    clearTimeout(timer);
  }
  const result = response?.result;
  if (!result?.ok)
    throw Error(result?.message || '签到服务暂不可用，请稍后重试');
  if (account.activeScope() !== scope || result.userId !== session.user.id)
    throw Error('账号已变化，请重新打开签到');
  return store.save(scope, result);
}
function status(force = false, { passive = false } = {}) {
  const scope = account.activeScope(),
    cached = store.read(scope),
    now = Date.now();
  const age = cached ? now - cached.fetchedAt : Infinity;
  if (
    !force &&
    cached &&
    cached.state.planVersion === 5 &&
    age >= 0 &&
    cached.state.today ===
      new Date(now + 8 * 3600000).toISOString().slice(0, 10) &&
    age < (passive ? 1800000 : 300000)
  )
    return Promise.resolve(cached.state);
  const failure = failures.get(scope);
  if (!force && failure && now < failure.until)
    return Promise.reject(failure.error);
  const key = scope + ':status';
  if (!pending.has(key)) {
    const task = request('status')
      .then((state) => {
        failures.delete(scope);
        return state;
      })
      .catch((error) => {
        failures.set(scope, { error, until: Date.now() + 60000 });
        while (failures.size > 2) failures.delete(failures.keys().next().value);
        throw error;
      })
      .finally(() => pending.delete(key));
    pending.set(key, task);
  }
  return pending.get(key);
}
function mutate(action,data={}) {
 const scope=account.activeScope(),key=scope+':'+action+':'+(data.milestone||'');
 if(pending.has(key))return pending.get(key);
 const cached=store.read(scope)?.state,today=new Date(Date.now()+8*3600000).toISOString().slice(0,10);
 // A successful sign-in for this server day is immutable; a new day must go back to the server.
 if(action==='sign'&&cached?.planVersion===5&&cached.today===today&&cached.lastDay===today)
   return Promise.resolve(cached);
 const task=request(action,data).then(state=>{failures.delete(scope);return state}).finally(()=>pending.delete(key));
 pending.set(key,task);return task;
}
module.exports = {
 status,
 sign: () => mutate('sign'),
 claim: (milestone) => mutate('claim', { milestone }),
 cached: () => store.read()?.state || null,
};
