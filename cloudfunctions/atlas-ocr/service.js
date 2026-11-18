const { createHash, randomBytes } = require('crypto');
const ENV = 'cloud1-d5g931htr9ee8f18c';
const COLLECTION = 'mini_atlas_drafts';
const fail = (code, message) => { const e = Error(message); e.code = code; throw e; };
function dimensions(data) {
  if (data.length >= 24 && data[0] === 137) return [data.readUInt32BE(16), data.readUInt32BE(20)];
  let i = 2;
  while (i + 8 < data.length) {
    if (data[i++] !== 255) return [];
    while (data[i] === 255) i++;
    const marker = data[i++];
    if (marker === 217 || marker === 218) return [];
    const size = data.readUInt16BE(i);
    if (size < 2 || i + size > data.length) return [];
    if ([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)) return [data.readUInt16BE(i+5), data.readUInt16BE(i+3)];
    i += size;
  }
  return [];
}
async function get(ref) {
  try { return (await ref.get()).data || null; }
  catch(e) { if (/DOCUMENT_NOT_FOUND|document.*(?:not exist|not found|不存在)/i.test(e.message || e.errMsg || '')) return null; throw e; }
}
function createHandler({ cloud, recognize, now = Date.now }) {
  return async (event = {}) => {
    let ownedFile;
    try {
      const { APPID, OPENID } = cloud.getWXContext();
      if (APPID !== 'wx31f3f3739a7a1743' || !/^[\w-]{8,128}$/.test(OPENID || '')) fail('UNAUTHORIZED', '请从当前小程序识别图片');
      const owner = createHash('sha256').update(APPID + '\0' + OPENID).digest('hex');
      const db = cloud.database(), collection = db.collection(COLLECTION);
      if (event.action === 'prepare') {
        const token = randomBytes(16).toString('hex'), day = new Date(now() + 8 * 3600000).toISOString().slice(0,10);
        const path = 'atlas-ocr/' + owner + '/' + token + '.jpg';
        await db.runTransaction(async tx => {
          const quota = tx.collection(COLLECTION).doc('ocr-quota-' + owner), current = await get(quota);
          const count = current?.day === day ? current.count : 0;
          if (count >= 20) fail('RATE_LIMIT', '今日图片识别申请已达 20 次，请明天再试');
          const tickets = (current?.tickets || []).filter(ticket => ticket.expires >= now());
          tickets.push({ token, path, expires: now() + 5 * 60000 });
          await quota.set({ data: { owner, day, count: count + 1, tickets } });
        });
        return { ok: true, token, path };
      }
      if (event.action !== 'recognize' || !/^[a-f0-9]{32}$/.test(event.token || '')) fail('INVALID_REQUEST', '识别请求无效');
      const expected = 'atlas-ocr/' + owner + '/' + event.token + '.jpg';
      const prefix = 'cloud://' + ENV + '.';
      if (typeof event.fileID !== 'string' || !event.fileID.startsWith(prefix) || event.fileID.slice(event.fileID.indexOf('/', 8) + 1) !== expected) fail('INVALID_FILE', '图片不属于当前微信账号');
      await db.runTransaction(async tx => {
        const ref = tx.collection(COLLECTION).doc('ocr-quota-' + owner), quota = await get(ref);
        const job = quota?.tickets?.find(ticket => ticket.token === event.token);
        if (!job || quota.owner !== owner || job.path !== expected || job.expires < now()) fail('EXPIRED', '识别请求已失效，请重新选择图片');
        await ref.update({ data: { tickets: quota.tickets.filter(ticket => ticket.token !== event.token && ticket.expires >= now()) } });
      });
      ownedFile = event.fileID;
      const { fileContent } = await cloud.downloadFile({ fileID: ownedFile });
      const jpeg = fileContent?.[0] === 255 && fileContent?.[1] === 216;
      const png = Buffer.isBuffer(fileContent) && fileContent.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
      if (!Buffer.isBuffer(fileContent) || fileContent.length > 4 * 1024 * 1024 || (!jpeg && !png)) fail('INVALID_IMAGE', '请选择不超过 4 MB 的 JPEG 或 PNG 图片');
      const [width, height] = dimensions(fileContent);
      if (!(width > 0 && height > 0 && width <= 12000 && height <= 12000 && width * height <= 10000000)) fail('INVALID_IMAGE', '图片尺寸过大或文件损坏，请裁剪后重试');
      const text = await recognize(fileContent, { width, height });
      if (String(text).length > 60000) fail('TEXT_TOO_LONG', '截图内容过多，请分段截图后重试，本次未导入记录');
      return { ok: true, text: String(text) };
    } catch (e) {
      return { ok: false, code: e.code || 'OCR_FAILED', message: e.code ? e.message : '图片识别暂不可用，请稍后重试或手动添加航班' };
    } finally {
      if (ownedFile) { try { await cloud.deleteFile({ fileList: [ownedFile] }); } catch (_) {} }
    }
  };
}
module.exports = { createHandler, dimensions };
