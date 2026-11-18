const cloud = require("wx-server-sdk");
const { createHandler } = require("./service");
const deployment = require("./deployment.json");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
exports.main = createHandler({
  getIdentity: () => cloud.getWXContext(),
  database: () => cloud.database(),
  // Enabled after the owner confirmed server-only permissions on mini_atlas_drafts.
  // The environment variable remains an emergency off switch.
  backupEnabled: () =>
    deployment.backupEnabled === true &&
    process.env.ATLAS_BACKUP_ENABLED !== "false",
});
