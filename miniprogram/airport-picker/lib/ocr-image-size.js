function imageSize(width, height) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) throw Error('图片尺寸无效，请重新选择');
  const long = height > 2400 && height / width > 3;
  const scale = long
    ? Math.min(1, 1440 / width, 12000 / height, Math.sqrt(9000000 / (width * height)))
    : Math.min(1, 1800 / width, 2400 / height);
  const targetWidth = Math.max(1, Math.floor(width * scale)), targetHeight = Math.max(1, Math.floor(height * scale));
  if (long && targetWidth < Math.min(600, width)) throw Error('截图过长，压缩后文字会过小，请拆成多张截图再识别');
  return { width: targetWidth, height: targetHeight, long };
}
module.exports = { imageSize };
