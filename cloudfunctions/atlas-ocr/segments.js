// Each region includes context outside its owned band so a boundary cannot cut
// a text line. Only line centres inside that band's coordinates are retained.
function planSegments(width, height) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0 || width > 12000 || height > 12000 || width * height > 10000000) throw Error('图片尺寸无效');
  if (height <= 2400) return [{ left: 0, top: 0, width, height, start: 0, end: height }];
  const regions = [];
  for (let start = 0; start < height; start += 1800) {
    const end = Math.min(height, start + 1800);
    const top = Math.max(0, start - 160), bottom = Math.min(height, end + 160);
    regions.push({ left: 0, top, width, height: bottom - top, start, end });
  }
  return regions;
}
function ownedLines(lines, region) {
  if (!Array.isArray(lines)) throw Error('识别结果缺少行位置信息，请重试');
  return lines.filter(line => {
    const box = line.bbox;
    if (!box || ![box.x0,box.x1,box.y0,box.y1].every(Number.isFinite)) throw Error('识别结果位置无效，请重试');
    const centre = (box.y0 + box.y1) / 2;
    return centre >= region.start && centre < region.end && String(line.text || '').trim();
  });
}
function joinLines(lines) {
  return lines.slice().sort((a,b) => a.bbox.y0 - b.bbox.y0 || a.bbox.x0 - b.bbox.x0).map(line => line.text.trim()).join('\n');
}
module.exports = { planSegments, ownedLines, joinLines };
