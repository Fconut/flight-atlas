const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
exports.main = require('./service').createHandler({
  identity: () => cloud.getWXContext(),
  database: () => cloud.database(),
  enabled: () =>
    require('./deployment.json').enabled === true &&
    process.env.ATLAS_CHECKIN_ENABLED !== 'false',
});
