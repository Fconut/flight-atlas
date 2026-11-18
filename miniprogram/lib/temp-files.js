const own = /^atlas-(template|backup|share-code)-(\d+)-[a-z0-9]+\.(xlsx|json|png)$/;
function directory() {
  return wx.env.USER_DATA_PATH + '/atlas-temp';
}
function cleanup(now = Date.now()) {
  const api = wx.getFileSystemManager(),
    dir = directory();
  if (!api.readdirSync || !api.unlinkSync) return;
  let entries;
  try {
    entries = api.readdirSync(dir);
  } catch (_) {
    return;
  }
  const files = entries
    .filter((name) => own.test(name))
    .map((name) => ({ name, time: Number(name.match(own)[2]) }))
    .sort((a, b) => b.time - a.time);
  for (const [index, file] of files.entries())
    if (index >= 5 || now - file.time > 86400000)
      try {
        api.unlinkSync(dir + '/' + file.name);
      } catch (_) {}
}
function create(kind, ext) {
  if (!['template', 'backup', 'share-code'].includes(kind) || !['xlsx', 'json', 'png'].includes(ext))
    throw Error('无效临时文件类型');
  const api = wx.getFileSystemManager(),
    dir = directory();
  try {
    if (api.mkdirSync) api.mkdirSync(dir, true);
  } catch (_) {}
  cleanup();
  return (
    dir +
    '/atlas-' +
    kind +
    '-' +
    Date.now() +
    '-' +
    Math.random().toString(36).slice(2, 9) +
    '.' +
    ext
  );
}
module.exports = { create, cleanup };
