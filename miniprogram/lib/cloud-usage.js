// Development-only, in-memory request counts. Never record payloads or upload telemetry.
let counts = Object.create(null);
const allowed = {
  'atlas-checkin': new Set(['status', 'sign', 'claim']),
  'atlas-account': new Set(['identity', 'fetch', 'save']),
  'atlas-share': new Set(['get', 'create', 'code']),
  'atlas-ocr': new Set(['prepare', 'recognize']),
};
function snapshot() {
  return {
    total: Object.values(counts).reduce((a, b) => a + b, 0),
    calls: { ...counts },
  };
}
function reset() {
  counts = Object.create(null);
  return snapshot();
}
function callFunction(options) {
  try {
    if (wx.getAccountInfoSync?.().miniProgram?.envVersion === 'develop') {
      const action = options.data?.action;
      if (allowed[options.name]?.has(action)) {
        const key = options.name + '.' + action;
        counts[key] = (counts[key] || 0) + 1;
      }
      if (typeof getApp === 'function')
        getApp().cloudUsage = { snapshot, reset };
    }
  } catch (_) {
    /* Diagnostics must never interrupt business calls. */
  }
  return wx.cloud.callFunction(options);
}
module.exports = { callFunction, snapshot, reset };
