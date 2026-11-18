// Keep unchanged lists and image bindings out of the view bridge.
module.exports = function updateView(page, next) {
  const patch = {};
  for (const key of Object.keys(next)) {
    const old = page.data[key],
      value = next[key];
    if (old === value) continue;
    if (
      old &&
      value &&
      typeof old === 'object' &&
      typeof value === 'object' &&
      JSON.stringify(old) === JSON.stringify(value)
    )
      continue;
    patch[key] = value;
  }
  if (Object.keys(patch).length) page.setData(patch);
};
