const rewards = require('./rewards.json').rewards;
const paletteMilestones = Array.from({ length: 56 }, (_, i) => 1 + i * 7);
const stamps = require('./stamp-rewards.json').rewards;
const milestones = [...paletteMilestones,...stamps.map(r=>r.day)].sort((a,b)=>a-b);
const day = (now) => new Date(now + 8 * 3600000).toISOString().slice(0, 10);
function schedule(record, includeStamps=true) {
  const grants = (record?.grants || []).filter(g=>g.type==='palette');
  const used = new Set(grants.map(g => g.rewardId));
  const remaining = rewards.filter(r => !used.has(r.id));
  const palette = paletteMilestones.map(day => {
    const grant = grants.find(g => g.day === day);
    return { day, ...(grant ? rewards.find(r => r.id === grant.rewardId) : remaining.shift()) };
  });
  return [...palette,...(includeStamps?stamps:[])].sort((a,b)=>a.day-b.day);
}
function normalizeGrants(record){return record?{...record,grants:(record.grants||[]).map(g=>g.type==='palette'&&g.day>1&&g.day%7===0?{...g,day:g.day+1}:g)}:record}
function view(record, today, includeStamps=true) {
 record=normalizeGrants(record);
  const count = record?.days || 0,
    grants = record?.grants || [];
  const claimed = new Set(grants.map((g) => g.day));
  const days = includeStamps?milestones:paletteMilestones;
  const plan = schedule(record,includeStamps);
  const pending = days.filter((d) => d <= count && !claimed.has(d));
  return {
    days: count,
    lastDay: record?.lastDay || '',
    signedToday: record?.lastDay === today,
    today,
    pending,
    grants,
    revision: record?.revision || 0,
    nextDay: days.find((d) => d > count) || null,
    planVersion: includeStamps?5:4,
    pendingRewards: plan.filter(r => pending.includes(r.day)),
    nextReward: plan.find(r => r.day > count) || null,
  };
}
function change(record, action, event, today, owner, includeStamps=true) {
  const state = normalizeGrants(record) || {
    version: 1,
    owner,
    days: 0,
    lastDay: '',
    grants: [],
  };
  if (
    state.version !== 1 ||
    state.owner !== owner ||
    !Number.isSafeInteger(state.days) ||
    state.days < 0 ||
    !Array.isArray(state.grants)
  )
    throw Error('INVALID_STATE');
  if (action === 'sign') {
    if (state.lastDay >= today) return { record: state, changed: false };
    return {
      record: {
        ...state,
        days: state.days + 1,
        lastDay: today,
        revision: (state.revision || 0) + 1,
      },
      changed: true,
    };
  }
  if (action === 'claim') {
    const existing = state.grants.find((g) => g.day === event.milestone);
    if (existing) return { record: state, changed: false };
    const current = view(state, today,includeStamps);
    if (!current.pending.includes(event.milestone))
      throw Error('NO_REWARD');
    const reward = current.pendingRewards.find(r => r.day === event.milestone);
    if (!reward || state.grants.some((g) => g.rewardId === reward.id))
      throw Error('INVALID_REWARD');
    return {
      record: {
        ...state,
        revision: (state.revision || 0) + 1,
        grants: [
          ...state.grants,
          {
            day: event.milestone,
            rewardId: reward.id,
            type: reward.type,
            itemId: reward.itemId,
            receivedOn: today,
          },
        ],
      },
      changed: true,
    };
  }
  throw Error('INVALID_ACTION');
}
module.exports = { day, view, change, milestones };
