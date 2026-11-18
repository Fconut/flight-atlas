const renderCache = require('../../lib/share-render-cache');
const { callShare } = require('../../lib/share-api');
const { renderCollectionPoster } = require('../../lib/collection-share-poster');
const account = require('../../lib/account-state');
const { renderBadgeCard } = require('../../lib/badge-share-media');
const { renderCollectionCard } = require('../../lib/collection-share-media');
Page({
  data: { loading: true, ready: false, message: '' },
  onLoad() {
    this.getOpenerEventChannel().on('share', (payload) => {
      if (this.disposed) return;
      this.payload = payload;
      this.render();
    });
  },
  onShow() {
    if (this.payload && this.payload.scope !== account.activeScope()) {
      this.payload = null;
      this.code = null;
      this.setData({
        cardPath: '',
        plainPath: '',
        posterPath: '',
        ready: false,
        message: '微信账号已切换，请重新打开分享页面',
      });
    } else if (this.payload && this.layoutVersion !== renderCache.version) {
      this.code = null;
      this.setData({ plainPath: '', posterPath: '', ready: false });
      this.render();
    }
  },
  onUnload() {
    this.disposed = true;
    this.assetReject?.(Error('页面已关闭'));
  },
  ensureAssets(snapshot) {
    if (this.assetsReady) return Promise.resolve();
    const badges =
      snapshot.kind === 'badge' ? [snapshot.badge] : snapshot.badges;
    const loaders = [...new Map(badges.map((b) => [b.package, b])).values()];
    this.assetPending = new Set(loaders.map((b) => b.package));
    return new Promise((resolve, reject) => {
      const finish = (error) => {
        clearTimeout(this.assetTimer);
        this.assetReject = null;
        this.assetResolve = null;
        error ? reject(error) : ((this.assetsReady = true), resolve());
      };
      this.assetResolve = () => finish();
      this.assetReject = finish;
      this.assetTimer = setTimeout(
        () => finish(Error('徽章资源加载超时，请重试')),
        15000,
      );
      this.setData({ assetLoaders: [] });
      wx.nextTick(() => {
        if (!this.disposed) this.setData({ assetLoaders: loaders });
      });
    });
  },
  assetLoaded(e) {
    this.assetPending?.delete(e.currentTarget.dataset.package);
    if (this.assetPending?.size === 0) this.assetResolve?.();
  },
  assetFailed(e) {
    this.assetReject?.(
      Error(
        '徽章资源 ' + e.currentTarget.dataset.package + ' 加载失败，请重试',
      ),
    );
  },
  async render() {
    if (this.working || !this.payload) return;
    this.working = true;
    this.setData({ loading: true, message: '' });
    try {
      const { snapshot, scope } = this.payload;
      if (scope !== account.activeScope())
        throw Error('微信账号已切换，请重新打开分享页面');
      const cached = renderCache.get(scope, snapshot) || {};
      this.setData({
        shareHeading:
          snapshot.kind === 'badge' ? '分享这枚徽章' : '分享我的收藏册',
        stage: '正在加载徽章资源…',
      });
      await this.ensureAssets(snapshot);
      if (this.disposed) return;
      this.setData({
        stage: cached.cardPath ? '正在生成海报…' : '正在生成分享卡片…',
      });
      const cardPath =
        cached.cardPath ||
        (snapshot.kind === 'badge'
          ? await renderBadgeCard(this, snapshot.badge, snapshot.records)
          : await renderCollectionCard(this, snapshot));
      if (this.disposed) return;
      if (scope !== account.activeScope())
        throw Error('微信账号已切换，请重新打开分享页面');
      renderCache.put(scope, snapshot, { cardPath });
      this.setData({ cardPath, stage: '正在生成海报…' });
      const plain =
        cached.plainPath || (await renderCollectionPoster(this, snapshot));
      if (this.disposed) return;
      if (scope !== account.activeScope())
        throw Error('微信账号已切换，请重新打开分享页面');
      renderCache.put(scope, snapshot, { plainPath: plain });
      this.layoutVersion = renderCache.version;
      this.setData({ cardPath, plainPath: plain });
    } catch (error) {
      if (!this.disposed) this.setData({ message: error.message });
    } finally {
      this.working = false;
      if (!this.disposed) this.setData({ loading: false });
    }
  },
  async prepareImage() {
    if (this.posterWorking || !this.payload || !this.data.cardPath) return;
    this.posterWorking = true;
    this.setData({ imageLoading: true, message: '' });
    try {
      const { scope, snapshot, id } = this.payload;
      if (scope !== account.activeScope())
        throw Error('微信账号已切换，请重新打开分享页面');
      this.setData({
        stage: this.code ? '正在生成含小程序码的海报…' : '正在生成小程序码…',
      });
      const result = this.code
        ? { image: this.code }
        : await callShare('code', {
            id,
            envVersion:
              wx.getAccountInfoSync?.().miniProgram.envVersion || 'release',
          });
      this.code = result.image;
      if (this.disposed) return;
      this.setData({ stage: '正在生成含小程序码的海报…' });
      const posterPath = await renderCollectionPoster(
        this,
        snapshot,
        result.image,
      );
      if (this.disposed) return;
      if (scope !== account.activeScope())
        throw Error('微信账号已切换，请重新打开分享页面');
      this.setData({ posterPath, ready: true });
    } catch (e) {
      if (!this.disposed)
        this.setData({ message: '分享图片生成失败：' + e.message });
    } finally {
      this.posterWorking = false;
      if (!this.disposed) this.setData({ imageLoading: false });
    }
  },
  preview() {
    const path = this.data.ready ? this.data.posterPath : this.data.plainPath;
    if (path) wx.previewImage({ urls: [path] });
  },
  shareImage() {
    if (
      !this.data.posterPath ||
      !this.payload ||
      this.payload.scope !== account.activeScope()
    )
      return;
    if (typeof wx.showShareImageMenu !== 'function') {
      wx.previewImage({ urls: [this.data.posterPath] });
      return;
    }
    wx.showShareImageMenu({
      path: this.data.posterPath,
      fail: (error) => {
        if (!this.disposed && !/cancel/i.test(error.errMsg || ''))
          this.setData({ message: '图片分享暂不可用，请重试' });
      },
    });
  },
  onShareAppMessage() {
    if (
      !this.data.ready ||
      !this.data.cardPath ||
      !this.payload ||
      this.payload.scope !== account.activeScope()
    )
      return { title: 'Flight Atlas · 机型收藏册', path: '/pages/fleet/index' };
    const { snapshot, id } = this.payload,
      isBadge = snapshot.kind === 'badge';
    return {
      title: isBadge
        ? '我的 ' + snapshot.badge.name + ' 乘坐徽章'
        : '我的机型收藏册 · 已解锁 ' + snapshot.summary.unlocked + ' 枚徽章',
      path:
        '/pages/' +
        (isBadge ? 'badge-share' : 'collection-share') +
        '/index?id=' +
        id,
      imageUrl: this.data.cardPath,
    };
  },
});
