const { uniqueFlightRows, compareFlightDeparture } = require('./flights.js');
function normalizeRows(input) {
  const ids = new Set();
  return uniqueFlightRows(input, true)
    .rows.sort(compareFlightDeparture)
    .map((row) => {
      let id = typeof row._id === 'string' ? row._id : '';
      if (!id || ids.has(id))
        id = 'row-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
      ids.add(id);
      return { ...row, _id: id };
    });
}
module.exports = { normalizeRows };
