const initialData = require("./initial-data.js");
const lifecycle = require("./lifecycle.js");
const records = require("./records.js");
const appearance = require("./appearance.js");
const fleet = require("./fleet.js");
const cloud = require("./cloud.js");
const map = require("./map.js");
const quality = require("./quality.js");
module.exports = (view) => ({
  data: { ...initialData(), view },
  ...lifecycle,
  ...records,
  ...appearance,
  ...fleet,
  ...cloud,
  ...map,
  ...quality,
  ...require("../../../lib/app-share"),
});
