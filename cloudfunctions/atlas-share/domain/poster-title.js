const DEFAULT = '我的足迹';
const MAX_LENGTH = 20;
function input(value) {
  if (typeof value !== 'string') return '';
  return Array.from(
    value.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, ' '),
  )
    .slice(0, MAX_LENGTH)
    .join('');
}
function normalize(value) {
  return input(value).replace(/\s+/g, ' ').trim() || DEFAULT;
}
module.exports = { DEFAULT, MAX_LENGTH, input, normalize };
