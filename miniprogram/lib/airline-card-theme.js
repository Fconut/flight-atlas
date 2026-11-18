const { normalizeAirlineCode } = require('./flights');
const palettes = require('./airline-brand-colors');
const neutral = { background: '#f4f6f3', border: '#e0e7e1' };
const themes = Object.create(null);
for (const [code, palette] of Object.entries(palettes))
  themes[code] = { background: palette.surface, border: '#e0e7e1' };
function airlineCardTheme(code) {
  return themes[normalizeAirlineCode(code)] || neutral;
}
// Parse each palette once; canvas gradient objects stay bound to their own context.
const gradientSpecs = new Map();
function airlineCanvasBackground(ctx, code, x, y, width, height) {
  const surface = airlineCardTheme(code).background;
  if (!surface.startsWith('linear-gradient')) return surface;
  if (!gradientSpecs.has(surface)) {
    const angle =
      (Number(surface.match(/linear-gradient\(([-\d.]+)deg/)?.[1] || 115) *
        Math.PI) /
      180;
    const stops = (surface.match(/#[a-f0-9]{6}(?:\s+\d+%)?/gi) || []).map(
      (stop, i, all) => {
        const [color, position] = stop.split(/\s+/);
        return [
          position ? parseInt(position, 10) / 100 : i / (all.length - 1),
          color,
        ];
      },
    );
    gradientSpecs.set(surface, { angle, stops });
  }
  const { angle, stops } = gradientSpecs.get(surface);
  const dx = Math.sin(angle),
    dy = -Math.cos(angle);
  const length = Math.abs(width * dx) + Math.abs(height * dy);
  const cx = x + width / 2,
    cy = y + height / 2;
  const gradient = ctx.createLinearGradient(
    cx - (dx * length) / 2,
    cy - (dy * length) / 2,
    cx + (dx * length) / 2,
    cy + (dy * length) / 2,
  );
  stops.forEach(([position, color]) => gradient.addColorStop(position, color));
  return gradient;
}
module.exports = { airlineCardTheme, airlineCanvasBackground };
