// Match the web font stack using fonts already installed on the device.
// No font files are embedded, downloaded or redistributed.
const FONT_FAMILY = '"Segoe UI", "Microsoft YaHei", sans-serif';
function font(run) {
  return (run.weight || 'normal') + ' ' + run.size + 'px ' + FONT_FAMILY;
}
function measure(ctx, run) {
  ctx.font = font(run);
  const chars = Array.from(String(run.text));
  if (!run.spacing) return ctx.measureText(chars.join('')).width;
  return (
    chars.reduce((sum, char) => sum + ctx.measureText(char).width, 0) +
    Math.max(0, chars.length - 1) * run.spacing
  );
}
function text(
  ctx,
  value,
  x,
  y,
  size,
  color,
  spacing = 0,
  weight = 'normal',
  align = ctx.textAlign,
) {
  const run = { text: String(value), size, spacing, weight };
  ctx.save();
  const width = measure(ctx, run);
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  if (align === 'center') x -= width / 2;
  else if (align === 'right' || align === 'end') x -= width;
  if (!spacing) ctx.fillText(run.text, x, y);
  else
    for (const char of Array.from(run.text)) {
      ctx.fillText(char, x, y);
      x += ctx.measureText(char).width + spacing;
    }
  ctx.restore();
  return width;
}
function fitRuns(ctx, source, width, minScale = 0.65) {
  const make = (scale) =>
    source.map((run) => ({
      ...run,
      text: String(run.text),
      size: run.size * scale,
      spacing: (run.spacing || 0) * scale,
      gap: (run.gap || 0) * scale,
    }));
  const total = (runs) =>
    runs.reduce(
      (sum, run) => sum + (run.text ? run.gap + measure(ctx, run) : 0),
      0,
    );
  let scale = 1,
    runs = make(scale);
  while (scale > minScale && total(runs) > width) {
    scale = Math.max(minScale, scale - 0.025);
    runs = make(scale);
  }
  // Shorten the main text first, reserving room for its code or unit.
  for (const run of runs) {
    if (total(runs) <= width) break;
    const chars = Array.from(run.text);
    while (chars.length && total(runs) > width) {
      chars.pop();
      run.text = chars.length ? chars.join('') + '…' : '';
    }
  }
  return { runs, width: total(runs) };
}
function runs(ctx, source, x, y, width, align = 'left', minScale = 0.65) {
  ctx.save();
  const fitted = fitRuns(ctx, source, width, minScale);
  if (align === 'right') x -= fitted.width;
  for (const run of fitted.runs) {
    if (!run.text) continue;
    x += run.gap;
    x += text(
      ctx,
      run.text,
      x,
      y,
      run.size,
      run.color,
      run.spacing,
      run.weight,
      'left',
    );
  }
  ctx.restore();
  return fitted;
}
function ascent(ctx, run) {
  ctx.save();
  ctx.font = font(run);
  const measured = ctx.measureText(String(run.text)).actualBoundingBoxAscent;
  ctx.restore();
  return Number.isFinite(measured) && measured > 0 ? measured : run.size * 0.8;
}
module.exports = { FONT_FAMILY, font, measure, text, fitRuns, runs, ascent };
