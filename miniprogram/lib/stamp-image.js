const {normalize}=require('./stamp-id');
const packages=new Map(),images=new WeakMap();
const packageNames=new Map(require('./stamp-catalog').items.map(item=>[item.id,item.previewPackage]));
function packageFor(id){return packageNames.get(id)}
const loaders={
 stamps0:()=>require.async('../stamps0/resources.js'),
 stamps1:()=>require.async('../stamps1/resources.js'),
 stamps2:()=>require.async('../stamps2/resources.js'),
 stamps3:()=>require.async('../stamps3/resources.js')
};
function ensurePackage(name){
 if(packages.has(name))return packages.get(name);
 const request=new Promise((resolve,reject)=>{
  let done=false;const timer=setTimeout(()=>finish(Error('印章资源加载超时，请重试')),15000);timer?.unref?.();
  function finish(error){if(done)return;done=true;clearTimeout(timer);error?reject(error):resolve()}
  try{if(typeof require.async==='function'){loaders[name]().then(()=>finish(),()=>finish(Error('印章资源暂未加载，请联网后重试')));return}if(typeof wx.loadSubpackage!=='function'){finish();return}wx.loadSubpackage({name,success:()=>finish(),fail:()=>finish(Error('印章资源暂未加载，请联网后重试'))})}catch(e){finish(e)}
 }).catch(error=>{packages.delete(name);throw error});
 packages.set(name,request);return request;
}
function load(canvas,value){
 const id=normalize(value);if(!id)return Promise.resolve(null);
 let cache=images.get(canvas);if(!cache){cache=new Map();images.set(canvas,cache)}
 if(cache.has(id))return cache.get(id);
 const task=ensurePackage(packageFor(id)).then(()=>new Promise((resolve,reject)=>{
  let image,done=false;const timer=setTimeout(()=>finish(Error('印章图片加载超时，请重试')),10000);timer?.unref?.();
  function finish(error){if(done)return;done=true;clearTimeout(timer);if(image){image.onload=null;image.onerror=null}error?reject(error):resolve(image)}
  try{image=canvas.createImage();image.onload=()=>finish(image.width&&image.height?null:Error('印章图片无效，请重试'));image.onerror=()=>finish(Error('印章图片暂未显示，请重试'));image.src='/'+packageFor(id)+'/assets/'+id+'.png'}catch(e){finish(e)}
 })).catch(error=>{if(cache.get(id)===task)cache.delete(id);throw error});
 cache.set(id,task);
 while(cache.size>2)cache.delete(cache.keys().next().value);
 return task;
}
module.exports={load,clear(canvas){images.delete(canvas)}};
