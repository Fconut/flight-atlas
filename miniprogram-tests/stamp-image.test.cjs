const test=require('node:test'),assert=require('node:assert/strict');
const modulePath=require.resolve('../miniprogram/lib/stamp-image');
function fresh(){delete require.cache[modulePath];return require(modulePath)}
test('stamp image requests coalesce per canvas, load only their package, and retry failure',async()=>{
 const requests=[];global.wx={loadSubpackage:r=>{requests.push(r);r.success()}};
 try{
  const loader=fresh(),created=[];const canvas={createImage(){const im={width:384,height:384};created.push(im);return im}};
  const a=loader.load(canvas,'stamp-001'),b=loader.load(canvas,'stamp-001');assert.equal(a,b);
  await new Promise(resolve=>setImmediate(resolve));assert.equal(requests.length,1);assert.equal(created.length,1);
  created[0].onerror();await assert.rejects(a,/重试/);
  const retry=loader.load(canvas,'stamp-001');await new Promise(resolve=>setImmediate(resolve));created[1].onload();
  assert.equal(await retry,created[1]);assert.equal(requests.length,1);
  assert.equal(created[1].src,'/stamps0/assets/stamp-001.png');
  loader.clear(canvas);
  const next=loader.load(canvas,'stamp-001');await new Promise(resolve=>setImmediate(resolve));created[2].onload();
  assert.equal(await next,created[2]);assert.equal(await loader.load(canvas,null),null);
 }finally{delete global.wx;delete require.cache[modulePath]}
});
test('failed stamp package requests can be retried without a permanent cached rejection',async()=>{
 let count=0;global.wx={loadSubpackage:r=>{count++;count===1?r.fail():r.success()}};
 try{const loader=fresh(),canvas={createImage(){const im={width:1,height:1};setImmediate(()=>im.onload());return im}};
 await assert.rejects(loader.load(canvas,'stamp-100'),/联网/);await loader.load(canvas,'stamp-100');assert.equal(count,2);
 }finally{delete global.wx;delete require.cache[modulePath]}
});

test('canvas stamp loading still works when explicit subpackage API is unavailable',async()=>{global.wx={};try{const loader=fresh(),canvas={createImage(){const im={width:384,height:384};setImmediate(()=>im.onload());return im}};const image=await loader.load(canvas,'stamp-001');assert.equal(image.src,'/stamps0/assets/stamp-001.png')}finally{delete global.wx;delete require.cache[modulePath]}});
