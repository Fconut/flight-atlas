const cloud = require('wx-server-sdk');
const { createHandler } = require('./service');
const { buildSnapshot } = require('./domain/share-snapshot');
const {buildBadgeSnapshot}=require('./domain/badge-share');
const {buildCollectionSnapshot}=require('./domain/collection-share');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
exports.main = createHandler({ cloud, buildSnapshot, buildBadgeSnapshot, buildCollectionSnapshot });
