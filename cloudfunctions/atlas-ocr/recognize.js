const fs = require('fs'), path = require('path'), os = require('os');
const { createWorker } = require('tesseract.js');
const { planSegments, ownedLines, joinLines } = require('./segments');
const { PNG } = require('pngjs');
const jpeg = require('jpeg-js');
function decode(image) {
  return image[0] === 137 ? PNG.sync.read(image) : jpeg.decode(image, { useTArray: true, maxResolutionInMP: 10, maxMemoryUsageInMB: 256 });
}
function crop(bitmap, region) {
  const output = new PNG({ width: region.width, height: region.height });
  const rowBytes = region.width * 4;
  for (let y = 0; y < region.height; y++) {
    const start = ((region.top + y) * bitmap.width + region.left) * 4;
    output.data.set(bitmap.data.subarray(start, start + rowBytes), y * rowBytes);
  }
  return PNG.sync.write(output);
}
async function recognize(image, size) {
  const langPath = path.join(os.tmpdir(), 'atlas-ocr-languages');
  fs.mkdirSync(langPath, { recursive: true });
  for (const lang of ['chi_sim', 'eng']) {
    const data = require('@tesseract.js-data/' + lang);
    const source = path.join(data.langPath, lang + '.traineddata.gz');
    const target = path.join(langPath, lang + '.traineddata.gz');
    if (!fs.existsSync(target)) fs.copyFileSync(source, target);
  }
  let worker;
  try {
    worker = await createWorker('chi_sim+eng', 1, { langPath, cachePath: langPath, logger() {} });
    const [width, height] = size ? [size.width, size.height] : require('./service').dimensions(image);
    const regions = planSegments(width, height);
    if (regions.length === 1) return (await worker.recognize(image)).data.text;
    const bitmap = decode(image);
    if (bitmap.width !== width || bitmap.height !== height) throw Error('图片尺寸与内容不一致');
    const lines = [];
    for (const region of regions) {
      const result = await worker.recognize(crop(bitmap, region));
      if (!Array.isArray(result.data.lines)) throw Error('识别结果缺少行位置信息');
      const positioned = result.data.lines.map(line => ({ ...line, bbox: { ...line.bbox, y0: line.bbox.y0 + region.top, y1: line.bbox.y1 + region.top } }));
      lines.push(...ownedLines(positioned, region));
    }
    return joinLines(lines);
  } finally { if (worker) await worker.terminate(); }
}
module.exports = { recognize };
