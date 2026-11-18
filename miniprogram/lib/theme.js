'use strict';
const atlasDefaultColors = { background: '#101c2a', route: '#e8bf79' };
function atlasColors(value) {
  const valid = (c) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);
  return Object.fromEntries(
    Object.entries(atlasDefaultColors).map(([k, v]) => [
      k,
      valid(value?.[k]) ? value[k].toLowerCase() : v
    ])
  );
}
function atlasMix(a, b, t) {
  const rgb = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  return (
    '#' +
    rgb(a)
      .map((v, i) =>
        Math.round(v * (1 - t) + rgb(b)[i] * t)
          .toString(16)
          .padStart(2, '0')
      )
      .join('')
  );
}
function atlasLuminance(c) {
  const v = [1, 3, 5]
    .map((i) => parseInt(c.slice(i, i + 2), 16) / 255)
    .map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return v[0] * 0.2126 + v[1] * 0.7152 + v[2] * 0.0722;
}
function atlasContrast(a, b) {
  const x = atlasLuminance(a),
    y = atlasLuminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
function atlasReadable(color, bg, min = 4.5) {
  const target =
    atlasContrast('#ffffff', bg) > atlasContrast('#101820', bg) ? '#ffffff' : '#101820';
  for (let i = 0; i <= 20; i++) {
    const c = atlasMix(color, target, i / 20);
    if (atlasContrast(c, bg) >= min) return c;
  }
  return target;
}

function resolveColors(value, legacyTheme) {
  return atlasColors(
    value || (legacyTheme === 'light' ? { background: '#edf0e9', route: '#937745' } : null)
  );
}
module.exports = {
  resolveColors,
  atlasMix,
  atlasReadable,
  atlasLuminance,
  atlasContrast,
  atlasColors,
  atlasDefaultColors
};
