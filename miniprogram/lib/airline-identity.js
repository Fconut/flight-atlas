const { normalizeAirlineCode } = require('./flights');
const colors = require('./airline-brand-colors');

function blend(color, base, amount) {
  return (
    '#' +
    [1, 3, 5]
      .map((i) =>
        Math.round(
          parseInt(color.slice(i, i + 2), 16) * amount +
            parseInt(base.slice(i, i + 2), 16) * (1 - amount),
        )
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}
function luminance(color) {
  const values = [1, 3, 5]
    .map((i) => parseInt(color.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
}
function contrast(a, b) {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
const themes = new Map();
function theme(code) {
  code = colors[code] ? code : '';
  if (!themes.has(code)) {
    const palette = colors[code] || {
      ink: '#52716c',
      chip: '#eaf0ed',
    };
    const representative = palette.ink;
    const background = palette.chip;
    let color = representative;
    // Retain hue while keeping light brand colors readable on a pale background.
    for (let i = 0; i < 24 && contrast(color, background) < 4.5; i++)
      color = blend(color, '#000000', 0.93);
    themes.set(code, {
      color,
      background,
    });
  }
  return themes.get(code);
}
function airlineIdentity(row = {}) {
  const raw = String(row.airline || '')
    .trim()
    .toUpperCase();
  const normalized = normalizeAirlineCode(raw);
  const code = /^[A-Z0-9]{2,3}$/.test(normalized) ? normalized : '';
  let number = String(row.flight ?? '').trim();
  if (code) {
    const prefix = [code, raw]
      .filter(Boolean)
      .find(
        (value) =>
          number.toUpperCase().startsWith(value) &&
          (number.length === value.length ||
            /^\d/.test(number.slice(value.length).trim())),
      );
    if (prefix) number = number.slice(prefix.length).trim();
  }
  return { code, number: number || '未填写航班号', ...theme(code) };
}
function drawAirlineIdentity(ctx, row, x, y, options = {}) {
  const item = airlineIdentity(row),
    size = options.fontSize || 26;
  const height = options.markHeight || 34,
    gap = 12;
  ctx.save();
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.font = '500 ' + size + 'px sans-serif';
  const markSize = Math.round(size * 0.85);
  const numberWidth = ctx.measureText(item.number).width;
  ctx.font = '600 ' + markSize + 'px sans-serif';
  const markWidth = item.code
    ? Math.max(48, ctx.measureText(item.code).width + 16)
    : 0;
  const limit = options.maxWidth || 430;
  const width = Math.min(
    limit,
    numberWidth + (markWidth ? markWidth + gap : 0),
  );
  if (options.align === 'right') x -= width;
  if (item.code) {
    const top = y - height * 0.8,
      radius = 6;
    ctx.beginPath();
    ctx.moveTo(x + radius, top);
    ctx.lineTo(x + markWidth - radius, top);
    ctx.quadraticCurveTo(x + markWidth, top, x + markWidth, top + radius);
    ctx.lineTo(x + markWidth, top + height - radius);
    ctx.quadraticCurveTo(
      x + markWidth,
      top + height,
      x + markWidth - radius,
      top + height,
    );
    ctx.lineTo(x + radius, top + height);
    ctx.quadraticCurveTo(x, top + height, x, top + height - radius);
    ctx.lineTo(x, top + radius);
    ctx.quadraticCurveTo(x, top, x + radius, top);
    ctx.closePath();
    ctx.fillStyle = item.background;
    ctx.fill();
    ctx.fillStyle = item.color;
    ctx.textAlign = 'center';
    ctx.fillText(item.code, x + markWidth / 2, y - height * 0.05);
    x += markWidth + gap;
  }
  ctx.textAlign = 'left';
  ctx.font = '500 ' + size + 'px sans-serif';
  ctx.fillStyle = options.color || '#527880';
  ctx.fillText(
    item.number,
    x,
    y,
    Math.max(1, limit - (markWidth ? markWidth + gap : 0)),
  );
  ctx.restore();
  return item;
}
module.exports = { airlineIdentity, drawAirlineIdentity, contrast };
