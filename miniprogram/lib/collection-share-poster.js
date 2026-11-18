const { airlineCanvasBackground } = require('./airline-card-theme');
const { drawAirlineIdentity } = require('./airline-identity');
const names = require('./names');
const { badgeRecordSummary } = require('./badge-record-summary');
const { releaseCanvas } = require('./canvas-memory');
const temporary = require('./temp-files');
function load(canvas, src, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const image = canvas.createImage();
    let done = false;
    const finish = (error) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
      error ? reject(error) : resolve(image);
    };
    const timer = setTimeout(
      () => finish(Error('海报图片加载超时，请重试')),
      timeout,
    );
    image.onload = () =>
      finish(
        image.width && image.height ? null : Error('海报图片无效，请重试'),
      );
    image.onerror = () => finish(Error('海报图片加载失败，请重试'));
    image.src = src;
  });
}
async function renderCollectionPoster(page, snapshot, code) {
  let canvas, codePath;
  page.setData({ posterRendering: true });
  try {
    await new Promise((resolve) => wx.nextTick(resolve));
    if (page.disposed) throw Error('页面已关闭');
    canvas = await new Promise((resolve) =>
      page
        .createSelectorQuery()
        .select('#collection-poster')
        .fields({ node: true })
        .exec((r) => resolve(r[0]?.node)),
    );
    if (!canvas) throw Error('海报画布尚未就绪');
    const badgeMode = snapshot.kind === 'badge';
    const records = snapshot.records || [];
    const groups = badgeMode
      ? []
      : ['Boeing', 'Airbus', 'Other']
          .map((maker, index) => ({
            name: ['波音', '空客', '其他'][index],
            badges: snapshot.badges.filter(
              (b) =>
                (b.manufacturer === 'Boeing'
                  ? 'Boeing'
                  : b.manufacturer === 'Airbus'
                    ? 'Airbus'
                    : 'Other') === maker,
            ),
            count: snapshot.summary.makers[index].count,
          }))
          .filter((g) => g.badges.length);
    const height = badgeMode
      ? 560 + records.length * 210 + (code ? 190 : 40)
      : 500 +
        groups.reduce(
          (n, g) => n + 100 + Math.ceil(g.badges.length / 3) * 330,
          0,
        ) +
        (code ? 200 : 50); // Keep one complete image while bounding canvas memory and device texture dimensions.
    const outputScale = Math.min(
      1,
      Math.sqrt(8000000 / (1200 * height)),
      12000 / height,
    );
    canvas.width = Math.max(1, Math.floor(1200 * outputScale));
    canvas.height = Math.max(1, Math.floor(height * outputScale));
    if (code) {
      codePath = temporary.create('share-code', 'png');
      wx.getFileSystemManager().writeFileSync(codePath, code, 'base64');
    }
    const [main, qr] = await Promise.all([
      badgeMode ? load(canvas, snapshot.badge.badge) : Promise.resolve(null),
      code ? load(canvas, codePath) : Promise.resolve(null),
    ]);
    if (page.disposed) throw Error('页面已关闭');
    const ctx = canvas.getContext('2d');
    if (outputScale < 1) ctx.scale(outputScale, outputScale);
    ctx.fillStyle = badgeMode ? '#ffffff' : '#f8faf6';
    ctx.fillRect(0, 0, 1200, height);
    if (badgeMode) {
      const scale = Math.min(168 / main.width, 168 / main.height);
      ctx.drawImage(
        main,
        60 + (168 - main.width * scale) / 2,
        62 + (168 - main.height * scale) / 2,
        main.width * scale,
        main.height * scale,
      );
      ctx.fillStyle = '#213c46';
      ctx.font = '600 44px sans-serif';
      ctx.fillText(snapshot.badge.name, 260, 132, 880);
      const summary = badgeRecordSummary(records);
      const firstDate = summary.firstDate;
      if (firstDate) {
        ctx.fillStyle = '#82958c';
        ctx.font = '25px sans-serif';
        ctx.fillText('最早记录 ' + firstDate, 260, 180, 880);
      }
      const stats = [
        [summary.total, '次飞行'],
        [summary.airlines, '家航空公司'],
        [summary.routes, '条单向航线'],
      ];
      stats.forEach(([value, label], i) => {
        ctx.textAlign = 'center';
        ctx.fillStyle = '#31575d';
        ctx.font = '600 36px sans-serif';
        ctx.fillText(String(value), 240 + i * 360, 310);
        ctx.fillStyle = '#82948c';
        ctx.font = '23px sans-serif';
        ctx.fillText(label, 240 + i * 360, 352);
        if (i) {
          ctx.fillStyle = '#e6ece5';
          ctx.fillRect(60 + i * 360, 275, 1, 85);
        }
      });
      ctx.textAlign = 'left';
      ctx.fillStyle = '#e5ece5';
      ctx.fillRect(60, 390, 1080, 2);
      ctx.fillStyle = '#213c46';
      ctx.font = '600 30px sans-serif';
      ctx.fillText('乘坐记录', 60, 490);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#91a098';
      ctx.font = '23px sans-serif';
      ctx.fillText('最新在前', 1140, 490);
      ctx.textAlign = 'left';
      records.forEach((r, i) => {
        const y = 560 + i * 210;
        ctx.fillStyle = airlineCanvasBackground(
          ctx,
          r.airline,
          60,
          y - 40,
          1080,
          210,
        );
        ctx.fillRect(60, y - 40, 1080, 210);
        ctx.textAlign = 'left';
        ctx.font = '26px sans-serif';
        ctx.fillStyle = '#597078';
        ctx.fillText(r.date + '  ' + (r.departureTime || ''), 80, y);
        drawAirlineIdentity(ctx, r, 1120, y, {
          align: 'right',
          fontSize: 26,
          markHeight: 36,
          maxWidth: 410,
        });
        ctx.textAlign = 'right';
        ctx.font = '600 34px sans-serif';
        ctx.fillStyle = '#31535b';
        ctx.fillText(names[r.to] || r.to, 1120, y + 70, 420);
        ctx.textAlign = 'left';
        ctx.fillText(names[r.from] || r.from, 80, y + 70, 420);
        ctx.font = '25px sans-serif';
        ctx.fillStyle = '#91a69d';
        ctx.fillText(r.from, 80, y + 112);
        ctx.textAlign = 'right';
        ctx.fillText(r.to, 1120, y + 112);
        ctx.textAlign = 'center';
        ctx.font = '38px sans-serif';
        ctx.fillText('→', 600, y + 75);
        ctx.textAlign = 'left';
        ctx.fillStyle = '#e0e8df';
        ctx.fillRect(60, y + 169, 1080, 1);
      });
    } else {
      ctx.fillStyle = '#9c8353';
      ctx.font = '22px sans-serif';
      ctx.fillText('FLIGHT ATLAS / AIRCRAFT LOGBOOK', 60, 66);
      const images = {};
      await Promise.all(
        snapshot.badges.map(async (b) => {
          images[b.id] = await load(canvas, b.badge);
        }),
      );
      if (page.disposed) throw Error('页面已关闭');
      ctx.fillStyle = '#213c46';
      ctx.font = '600 48px sans-serif';
      ctx.fillText('我的机型收藏册', 60, 142);
      ctx.font = '28px sans-serif';
      ctx.fillStyle = '#71858a';
      ctx.fillText(
        '已解锁 ' +
          snapshot.summary.unlocked +
          ' 枚徽章 · 已记录 ' +
          snapshot.summary.types +
          ' 种机型',
        60,
        202,
      );
      ctx.fillStyle = '#eaf0e9';
      ctx.fillRect(60, 242, 1080, 142);
      ctx.fillStyle = '#315c61';
      ctx.font = '600 34px sans-serif';
      ctx.fillText(snapshot.summary.flights + ' 次飞行', 88, 300);
      ctx.font = '24px sans-serif';
      ctx.fillText(
        snapshot.summary.makers
          .map((m) => m.name + ' ' + m.count + ' 次')
          .join('    /    '),
        88,
        348,
      );
      let y = 500;
      for (const g of groups) {
        ctx.fillStyle = '#315c61';
        ctx.font = '600 30px sans-serif';
        ctx.fillText(g.name, 60, y);
        ctx.font = '23px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(
          g.count +
            ' 次飞行 · ' +
            (snapshot.summary.flights
              ? Math.round((g.count / snapshot.summary.flights) * 100)
              : 0) +
            '%',
          1140,
          y,
        );
        ctx.textAlign = 'left';
        ctx.fillStyle = '#dfe7dc';
        ctx.fillRect(60, y + 24, 1080, 2);
        y += 65;
        g.badges.forEach((b, i) => {
          const x = 60 + (i % 3) * 360,
            top = y + Math.floor(i / 3) * 330,
            image = images[b.id],
            scale = Math.min(300 / image.width, 265 / image.height),
            w = image.width * scale,
            h = image.height * scale;
          ctx.drawImage(image, x + (330 - w) / 2, top + (265 - h) / 2, w, h);
          ctx.fillStyle = '#315c61';
          ctx.font = '25px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(b.count + ' 次飞行', x + 165, top + 304);
          ctx.textAlign = 'left';
        });
        y += Math.ceil(g.badges.length / 3) * 330 + 35;
      }
    }
    if (qr) {
      const footer = height - 155;
      ctx.fillStyle = '#dbe5da';
      ctx.fillRect(60, footer - 30, 1080, 2);
      ctx.fillStyle = '#83978d';
      ctx.font = '22px sans-serif';
      ctx.fillText(
        '扫码查看' + (badgeMode ? '徽章与乘坐记录' : '完整机型收藏册'),
        60,
        footer + 58,
      );
      ctx.drawImage(qr, 1020, footer, 120, 120);
    }
    return await new Promise((resolve, reject) =>
      wx.canvasToTempFilePath({
        canvas,
        fileType: 'png',
        destWidth: canvas.width,
        destHeight: canvas.height,
        success: (r) => resolve(r.tempFilePath),
        fail: reject,
      }),
    );
  } finally {
    releaseCanvas(canvas);
    if (codePath)
      try {
        wx.getFileSystemManager().unlinkSync(codePath);
      } catch (_) {}
    if (!page.disposed) page.setData({ posterRendering: false });
  }
}
module.exports = { renderCollectionPoster };
