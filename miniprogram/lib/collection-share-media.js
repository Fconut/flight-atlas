const {releaseCanvas}=require('./canvas-memory');
async function renderCollectionCard(page,snapshot){
 page.setData({rendering:true});await new Promise(resolve=>wx.nextTick(resolve));if(page.disposed)throw Error('页面已关闭');
 const node=await new Promise(resolve=>page.createSelectorQuery().select('#collection-card').fields({node:true}).exec(r=>resolve(r[0]?.node)));
 try{
 if(!node||page.disposed)throw Error('分享画布尚未就绪');node.width=1000;node.height=800;const ctx=node.getContext('2d');
 ctx.fillStyle='#f4f5f0';ctx.fillRect(0,0,1000,800);ctx.fillStyle='#9c8353';ctx.font='22px sans-serif';ctx.fillText('MY AIRCRAFT COLLECTION',50,52);
 ctx.fillStyle='#213c46';ctx.font='600 46px sans-serif';ctx.fillText('我的机型收藏册',50,122);ctx.font='28px sans-serif';ctx.fillText('已解锁 '+snapshot.summary.unlocked+' 枚徽章 · '+snapshot.summary.flights+' 次飞行',50,178);
 const top=snapshot.badges.slice(0,6);
 const images=await Promise.all(top.map(b=>new Promise((resolve,reject)=>{const image=node.createImage();let done=false;const finish=error=>{if(done)return;done=true;clearTimeout(timer);image.onload=null;image.onerror=null;error?reject(error):resolve(image)};const timer=setTimeout(()=>finish(Error('徽章加载超时，请重试')),8000);image.onload=()=>finish(image.width&&image.height?null:Error('徽章图片无效'));image.onerror=()=>finish(Error('徽章加载失败，请重试'));image.src=b.badge})));
 if(page.disposed)throw Error('页面已关闭');
 images.forEach((image,i)=>{const cols=Math.min(top.length,3),cell=930/cols,x=35+(i%cols)*cell,y=215+Math.floor(i/cols)*220,scale=Math.min((cell-25)/image.width,160/image.height),w=image.width*scale,h=image.height*scale;ctx.drawImage(image,x+(cell-25-w)/2,y+(160-h)/2,w,h);ctx.fillStyle='#57766c';ctx.font='22px sans-serif';ctx.fillText(top[i].count+' 次飞行',x+(cell-25)/2-50,y+195)});
 ctx.fillStyle='#315c61';ctx.font='26px sans-serif';snapshot.summary.makers.forEach((m,i)=>ctx.fillText(m.name+' · '+m.count+' 次',50+i*315,727));ctx.font='20px sans-serif';ctx.fillText('打开查看全部收藏 →',50,778);
 return await new Promise((resolve,reject)=>wx.canvasToTempFilePath({canvas:node,fileType:'png',destWidth:1000,destHeight:800,success:r=>resolve(r.tempFilePath),fail:reject}));
 }finally{releaseCanvas(node);if(!page.disposed)page.setData({rendering:false})}
}
module.exports={renderCollectionCard};
