const { releaseCanvas } = require("../../../lib/canvas-memory.js");
const atlasPoster = require("../../../lib/poster.js");
const d3 = require("../../../lib/d3");
const world = require("../../../lib/world");
const covered = (data) =>
  data.mapSettingsOpen ||
  data.exportOpen ||
  data.fleetSelected ||
  data.recordFiltersOpen ||
  data.candidateOpen;
module.exports = {
  refreshMapPreview() {
    if (this.disposed || this.pageHidden || this.data.view !== "map" || covered(this.data) || this.previewDrawScheduled) return;
    this.previewDrawScheduled = true;
    wx.nextTick(() => {
      this.previewDrawScheduled = false;
      if (this.disposed || this.pageHidden || covered(this.data)) return;
      this.data.hasData ? this.draw() : this.drawEmpty();
    });
  },
  releaseMapPreview() {
    this.previewPaintSequence=(this.previewPaintSequence||0)+1;
    if (this.previewCanvas) {
      require('../../../lib/stamp-image').clear(this.previewCanvas);
      releaseCanvas(this.previewCanvas);
      this.previewCanvas = null;
    }
    if (this.data.view === 'map') this.previewNeedsRedraw = true;
  },
  exportImage() {
    if (this.disposed || !this.result || this.data.exporting) return;
    const result = this.result,
      scope = this.localKey,
      preferences = JSON.parse(JSON.stringify(this.preferences())),
      preferenceKey = JSON.stringify(preferences);
    const cached=this.exportCache;
    if(cached&&cached.result===result&&cached.scope===scope&&cached.preferenceKey===preferenceKey){
      try{wx.getFileSystemManager().accessSync(cached.path);this.setData({exportOpen:true,exportPath:cached.path,exportFailed:false,exportMessage:'高清图片已生成'});return}catch(_){}
    }
    this.setData({
      exporting: true,
      exportFailed: false,
      exportMessage: "正在生成高清海报…",
      error: "",
    });
    wx.nextTick(() => {
      if (this.disposed) return;
      this.createSelectorQuery()
        .select("#export-atlas")
        .fields({ node: true })
        .exec(async (items) => {
          if (this.disposed) return;
          let exportCanvas;
          try {
            if (!items[0]?.node) throw Error("海报尚未准备好，请重试");
            const canvas = items[0].node;
            exportCanvas = canvas;
            const stampImage=preferences.posterStamp?await require('../../../lib/stamp-image').load(canvas,preferences.posterStamp):null;
            if(this.disposed||this.pageHidden){releaseCanvas(canvas);if(!this.disposed)this.setData({exporting:false});return}
            if(scope!==this.localKey||result!==this.result||preferenceKey!==JSON.stringify(this.preferences()))throw Error('海报设置已更新，请重新生成');
            const dimensions=atlasPoster.posterDimensions(result,2160,preferences);
            canvas.width = dimensions.width;
            canvas.height = dimensions.height;
            atlasPoster.renderPoster(canvas, result, {...preferences,stampImage}, dimensions);
            wx.canvasToTempFilePath({
              canvas,
              width: 2160,
              height: canvas.height,
              destWidth: 2160,
              destHeight: canvas.height,
              fileType: "png",
              success: (r) => {
                releaseCanvas(canvas);
                if (this.disposed) return;
                if (
                  scope !== this.localKey ||
                  result !== this.result ||
                  preferenceKey !== JSON.stringify(this.preferences())
                ) {
                  this.setData({
                    exporting: false,
                    exportOpen: false,
                    exportPath: "",
                    exportFailed: true,
                    exportMessage: "航班或海报设置已更新，请重新打开海报",
                  });
                  return;
                }
                this.exportCache={result,scope,preferenceKey,path:r.tempFilePath};
                this.setData({
                  exporting: false,
                  exportPath: r.tempFilePath,
                  exportOpen: true,
                  exportFailed: false,
                  exportMessage: "高清图片已生成",
                });
              },
              fail: (e) => {
                releaseCanvas(canvas);
                if (this.disposed) return;
                this.setData({
                  exporting: false,
                  exportFailed: true,
                  exportMessage: "生成失败，请点击“重试生成海报”",
                  error: e.errMsg,
                });
              },
            });
          } catch (e) {
            releaseCanvas(exportCanvas);
            if (this.disposed) return;
            this.setData({
              exporting: false,
              exportFailed: true,
              exportMessage: "生成失败，请点击“重试生成海报”",
              error: e.message,
            });
          }
        });
    });
  },
  openSharePreview() {
    if (this.data.exporting || this.data.savingImage || this.disposed) return;
    if (this.data.exportOpen) this.closeExport();
    wx.navigateTo({url:'/pages/share-compose/index',fail:error=>this.setData({error:'无法打开分享：'+error.errMsg})});
  },
  previewExport() {
    if (this.data.exportPath)
      wx.previewImage({
        urls: [this.data.exportPath],
        fail: (e) =>
          this.setData({ exportMessage: "图片预览失败：" + e.errMsg }),
      });
  },
  saveExport() {
    if (!this.data.exportPath || this.data.savingImage) return;
    this.setData({ savingImage: true });
    wx.saveImageToPhotosAlbum({
      filePath: this.data.exportPath,
      success: () =>
        this.setData({ savingImage: false, exportMessage: "已保存到手机相册" }),
      fail: (e) =>
        this.setData({
          savingImage: false,
          exportMessage: /auth|denied|authorize/i.test(e.errMsg)
            ? "未获得相册权限，可点击图片放大后长按保存，或在微信设置中允许保存相册。"
            : "保存失败，请重试：" + e.errMsg,
        }),
    });
  },
  closeExport() {
    this.setData({ exportOpen: false });
    this.refreshMapPreview();
  },
  drawEmpty() {
    if (
      this.disposed ||
      this.pageHidden ||
      covered(this.data) ||
      this.data.view !== "map" ||
      this.data.hasData
    )
      return;
    this.createSelectorQuery()
      .select("#empty-atlas")
      .fields({ node: true, size: true })
      .exec((items) => {
        try {
          if (this.disposed || this.pageHidden || !items[0]?.node) return;
          const item = items[0],
            canvas = item.node;
          if(this.previewCanvas===canvas&&!this.previewNeedsRedraw)return;
          this.previewCanvas = canvas;
          canvas.width = 900;
          canvas.height = 470;
          const ctx = canvas.getContext("2d");
          ctx.clearRect(0, 0, 900, 470);
          const projection = d3
            .geoNaturalEarth1()
            .rotate([-125, 0])
            .fitExtent(
              [
                [0, 10],
                [900, 460],
              ],
              { type: "Sphere" },
            );
          ctx.beginPath();
          d3.geoPath(projection, ctx)(world);
          ctx.fillStyle = "#8fa6b8";
          ctx.globalAlpha = 0.28;
          ctx.fill();
          ctx.strokeStyle = "#142737";
          ctx.lineWidth = 0.5;
          ctx.stroke();
          this.previewNeedsRedraw = false;
        } catch (e) {
          console.error("Empty map rendering:", e);
        }
      });
  },
  draw() {
    if (this.disposed || this.pageHidden || covered(this.data) || this.previewQueryPending) return;
    this.previewQueryPending = true;
    this.createSelectorQuery()
      .select("#atlas")
      .fields({ node: true, size: true })
      .exec((items) => {
        try {
          this.previewQueryPending = false;
          if (this.disposed || this.pageHidden || covered(this.data) || !items[0]?.node || !this.result) { this.previewNeedsRedraw = true; return; }
          const canvas = items[0].node;
          const preferenceKey=JSON.stringify(this.preferences());
          if(this.previewCanvas===canvas&&this.lastPreviewResult===this.result&&this.lastPreviewPreferences===preferenceKey&&!this.previewNeedsRedraw)return;
          this.previewCanvas = canvas;
          const result=this.result,options={...this.preferences()},sequence=this.previewPaintSequence=(this.previewPaintSequence||0)+1;
          const current=()=>!this.disposed&&!this.pageHidden&&!covered(this.data)&&sequence===this.previewPaintSequence&&result===this.result&&preferenceKey===JSON.stringify(this.preferences());
          const paint=stampImage=>{
            if(!current()){this.previewNeedsRedraw=true;return}
            const ratio=Math.max(1,wx.getWindowInfo?.().pixelRatio||1);
            const dimensions=atlasPoster.posterDimensions(result,1080,options),aspect=dimensions.height/1080;
            // Resize only after the stamp is ready, retaining the previous poster while loading.
            canvas.width=Math.min(Math.max(2160,Math.min(2880,Math.round((items[0].width||360)*ratio))),Math.floor(Math.sqrt(9000000/aspect)));
            canvas.height=Math.ceil(canvas.width*aspect);
            atlasPoster.renderPoster(canvas,result,{...options,stampImage},dimensions);
            const previewHeight=Math.round((items[0].width||360)*canvas.height/canvas.width);
            const patch={stampPreviewLoading:false,stampPreviewError:''};
            if(this.data.posterPreviewHeight!==previewHeight)patch.posterPreviewHeight=previewHeight;
            this.setData(patch);this.lastPreviewResult=result;this.lastPreviewPreferences=preferenceKey;this.previewNeedsRedraw=false;
          };
          if(options.posterStamp){
            this.setData({stampPreviewLoading:true,stampPreviewError:''});
            require('../../../lib/stamp-image').load(canvas,options.posterStamp).then(paint).catch(error=>{
              if(sequence!==this.previewPaintSequence||this.disposed)return;
              this.previewNeedsRedraw=true;this.setData({stampPreviewLoading:false,stampPreviewError:error.message});
            });
          }else paint(null);
        } catch (e) {
          this.setData({ error: e.message });
          console.error(e);
        }
      });
  },
  retryStampPreview() {
    this.previewNeedsRedraw=true;
    this.draw();
  },
};
