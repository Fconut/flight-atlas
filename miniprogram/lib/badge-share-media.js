const names = require('./names');
const { badgeRecordSummary } = require('./badge-record-summary');
const { airlineCanvasBackground } = require('./airline-card-theme');
const { drawAirlineIdentity } = require('./airline-identity');
const { releaseCanvas } = require('./canvas-memory');
async function renderBadgeCard(page, badge, records) {
  page.setData({ rendering: true });
  await new Promise((resolve) => wx.nextTick(resolve));
  if (page.disposed) throw Error('页面已关闭');
  const node = await new Promise((resolve) =>
    page
      .createSelectorQuery()
      .select('#badge-card')
      .fields({ node: true })
      .exec((r) => resolve(r[0]?.node)),
  );
  try {
    if (!node) throw Error('分享卡片尚未生成，请重试');
    if (page.disposed) throw Error('页面已关闭');
    node.width = 1000;
    node.height = 800;
    const ctx = node.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 1000, 800);
    const image = await new Promise((resolve, reject) => {
      const img = node.createImage();
      let settled = false;
      const finish = (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        img.onload = null;
        img.onerror = null;
        error ? reject(error) : resolve(img);
      };
      const timer = setTimeout(
        () => finish(Error('徽章图片加载超时，请重试')),
        8000,
      );
      img.onload = () =>
        finish(img.width && img.height ? null : Error('徽章图片无效，请重试'));
      img.onerror = () => finish(Error('徽章图片加载失败，请重试'));
      img.src = badge.badge;
    });
    if (page.disposed) throw Error('页面已关闭');
    const scale = Math.min(144 / image.width, 144 / image.height),
      w = image.width * scale,
      h = image.height * scale;
    ctx.drawImage(image, 52 + (144 - w) / 2, 52 + (144 - h) / 2, w, h);
    ctx.fillStyle = '#213c46';
    ctx.font = '600 36px sans-serif';
    ctx.fillText(badge.name, 228, 104, 720);
    const summary = badgeRecordSummary(records);
    const firstDate = summary.firstDate;
    if (firstDate) {
      ctx.fillStyle = '#82958c';
      ctx.font = '22px sans-serif';
      ctx.fillText('最早记录 ' + firstDate, 228, 148, 720);
    }
    const stats = [
      [summary.total, '次飞行'],
      [summary.airlines, '家航空公司'],
      [summary.routes, '条单向航线'],
    ];
    stats.forEach(([value, label], i) => {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#31575d';
      ctx.font = '600 32px sans-serif';
      ctx.fillText(String(value), 202 + i * 298, 232);
      ctx.fillStyle = '#82948c';
      ctx.font = '19px sans-serif';
      ctx.fillText(label, 202 + i * 298, 265);
      if (i) {
        ctx.fillStyle = '#e6ece5';
        ctx.fillRect(52 + i * 298, 205, 1, 64);
      }
    });
    ctx.textAlign = 'left';
    ctx.fillStyle = '#e5ece5';
    ctx.fillRect(52, 292, 896, 1);
    records.slice(0, 3).forEach((r, i) => {
      const y = 336 + i * 140;
      ctx.fillStyle = airlineCanvasBackground(
        ctx,
        r.airline,
        52,
        y - 30,
        896,
        140,
      );
      ctx.fillRect(52, y - 30, 896, 140);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#597078';
      ctx.font = '21px sans-serif';
      ctx.fillText(r.date, 72, y, 440);
      drawAirlineIdentity(ctx, r, 928, y, {
        align: 'right',
        fontSize: 22,
        markHeight: 30,
        maxWidth: 298,
      });
      ctx.fillStyle = '#25434b';
      ctx.font = '600 27px sans-serif';
      ctx.fillText(names[r.from] || r.from, 72, y + 50, 360);
      ctx.textAlign = 'right';
      ctx.fillText(names[r.to] || r.to, 928, y + 50, 360);
      ctx.fillStyle = '#8a9d98';
      ctx.font = '19px sans-serif';
      ctx.fillText(r.to, 928, y + 80, 360);
      ctx.textAlign = 'left';
      ctx.fillText(r.from, 72, y + 80, 360);
      ctx.textAlign = 'center';
      ctx.font = '28px sans-serif';
      ctx.fillText('→', 500, y + 51);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#e5ece5';
      ctx.fillRect(52, y + 109, 896, 1);
    });
    if (records.length > 3) {
      ctx.fillStyle = '#71858a';
      ctx.font = '20px sans-serif';
      ctx.fillText('打开查看全部记录 →', 52, 778);
    }
    return await new Promise((resolve, reject) =>
      wx.canvasToTempFilePath({
        canvas: node,
        fileType: 'png',
        destWidth: 1000,
        destHeight: 800,
        success: (r) => resolve(r.tempFilePath),
        fail: reject,
      }),
    );
  } finally {
    releaseCanvas(node);
    if (!page.disposed) page.setData({ rendering: false });
  }
}
module.exports = { renderBadgeCard };
