const cloud = require('wx-server-sdk');
const { createHandler } = require('./service');
const { recognize } = require('./recognize');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
exports.main = createHandler({ cloud, recognize });
