const { renderPoster,posterDimensions } = require('./poster');
const { posterData } = require('./share-snapshot');
const { releaseCanvas } = require('./canvas-memory');
const temporary = require('./temp-files');
const nextTick = () => new Promise(resolve => wx.nextTick(resolve));
const exportCanvas = canvas => new Promise((resolve,reject)=>wx.canvasToTempFilePath({canvas,width:canvas.width,height:canvas.height,destWidth:canvas.width,destHeight:canvas.height,fileType:'png',success:result=>resolve(result.tempFilePath),fail:reject}));
function loadImage(canvas,src){
 return new Promise((resolve,reject)=>{
  const image=canvas.createImage();let finished=false;
  const finish=error=>{if(finished)return;finished=true;clearTimeout(timer);image.onload=null;image.onerror=null;error?reject(error):resolve(image)};
  const timer=setTimeout(()=>finish(Error('分享图片加载超时，请重试')),8000);
  image.onload=()=>finish(image.width&&image.height?null:Error('分享图片无效，请重试'));
  image.onerror=()=>finish(Error('分享图片加载失败，请重试'));image.src=src;
 });
}
async function renderMedia(page, snapshot, code) {
  page.setData({rendering:true});await nextTick();
  if(page.disposed)throw Error('页面已关闭');
  const nodes=await new Promise(resolve=>page.createSelectorQuery().select('#share-poster').fields({node:true}).select('#share-card').fields({node:true}).exec(resolve));
  let poster=nodes[0]?.node,card=nodes[1]?.node,codePath;
  try {
    if(!poster||!card)throw Error('分享画布尚未就绪');
    const data=posterData(snapshot),dimensions=posterDimensions(data,2160,snapshot.options),baseHeight=dimensions.height;
    poster.width=2160;poster.height=baseHeight+(code?360:0);
    const stampImage=snapshot.options?.posterStamp?await require('./stamp-image').load(poster,snapshot.options.posterStamp):null;
    if(page.disposed)throw Error('页面已关闭');
    renderPoster(poster,data,{...snapshot.options,publicMode:true,stampImage},dimensions);
    if(code){
      codePath=temporary.create('share-code','png');wx.getFileSystemManager().writeFileSync(codePath,code,'base64');
      const qr=await loadImage(poster,codePath);if(page.disposed)throw Error('页面已关闭');const ctx=poster.getContext('2d');
      ctx.fillStyle='#f4f5f0';ctx.fillRect(0,baseHeight,2160,360);
      ctx.fillStyle='#25454d';ctx.font='500 58px "Microsoft YaHei", sans-serif';ctx.fillText('把旅程，绘成一幅地图。',110,baseHeight+140);
      ctx.fillStyle='#80958a';ctx.font='34px "Microsoft YaHei", sans-serif';ctx.fillText('扫码查看飞行足迹 · 制作我的地图',110,baseHeight+220);
      ctx.fillStyle='#fff';ctx.fillRect(1760,baseHeight+20,320,320);ctx.drawImage(qr,1775,baseHeight+35,290,290);
    }
    const posterPath=await exportCanvas(poster);
    if(page.disposed)throw Error('页面已关闭');
    card.width=1000;card.height=800;
    const preview=await loadImage(card,posterPath);if(page.disposed)throw Error('页面已关闭');const ctx=card.getContext('2d');
    ctx.fillStyle='#101c2a';ctx.fillRect(0,0,1000,800);const mapPixels=Math.ceil((115+dimensions.mapHeight*1080/1600)*2),scale=Math.min(1000/2160,500/mapPixels);ctx.drawImage(preview,0,0,2160,mapPixels,(1000-2160*scale)/2,100,2160*scale,mapPixels*scale);
    ctx.fillStyle='#101c2a';ctx.fillRect(0,0,1000,100);ctx.fillRect(0,600,1000,200);
    ctx.fillStyle='#f4e4ba';ctx.font='500 44px "Microsoft YaHei", sans-serif';const title=require('./poster-title');ctx.fillText(title.normalize(snapshot.options?.posterTitle)===title.DEFAULT?'我的飞行足迹':title.normalize(snapshot.options.posterTitle),52,68,896);
    const summary=snapshot.summary;
    for(const [index,value]of [[String(summary.total),'次飞行'],[String(summary.airportCount),'座机场'],[summary.km.toLocaleString('en-US'),'公里']].entries()){
      const x=52+index*320;ctx.fillStyle='#f4e4ba';ctx.font='600 46px "Segoe UI", sans-serif';ctx.fillText(value[0],x,690);ctx.fillStyle='#8fa59f';ctx.font='26px "Microsoft YaHei", sans-serif';ctx.fillText(value[1],x,740);
    }
    return {posterPath,cardPath:await exportCanvas(card)};
  } finally {
    releaseCanvas(poster);releaseCanvas(card);
    if(codePath)try{wx.getFileSystemManager().unlinkSync(codePath)}catch(_){}
    if(!page.disposed)page.setData({rendering:false});
  }
}
module.exports={renderMedia};
