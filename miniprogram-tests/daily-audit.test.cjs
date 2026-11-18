const test=require('node:test'),assert=require('node:assert/strict');
const base='../miniprogram/',create=require(base+'pages/index/logic/create-page');
const row={date:'2025-01-01',from:'SHA',to:'NRT',airline:'MU',flight:'1',aircraft:'Airbus A320'};
function setup(view='map') {
  const storage={},page=create(view);let updates=0;
  global.wx={getStorageSync:k=>storage[k],setStorageSync:(k,v)=>storage[k]=JSON.parse(JSON.stringify(v)),nextTick(){}};
  page.setData=function(values){updates++;Object.assign(this.data,JSON.parse(JSON.stringify(values)));};
  return {page,storage,updates:()=>updates};
}
test('non-map pages load records and collection without generating poster data',()=>{
  for(const view of ['records','fleet','editor']){
    const {page}=setup(view);page.localKey='atlas-mini-guest';page.load([row]);
    assert.equal(page.result,null);assert.equal(page.data.matchCount,1);
    assert.equal(page.airlineChoices,undefined);
    if(view==='fleet')assert.equal(page.data.fleetRecordedFlights,1);
  }
  const {page}=setup('map');page.load([row]);assert.equal(page.result.total,1);
});
test('late startup response cannot update a page that has been closed',async()=>{
  const {page,updates}=setup('map'),cloud=require(base+'lib/auto-save'),original=cloud.start;
  let resolve;cloud.start=()=>new Promise(r=>resolve=r);
  try{
    page.onReady();page.onUnload();const before=updates();resolve(null);
    await new Promise(r=>setImmediate(r));
    assert.equal(updates(),before);assert.equal(page.localKey,undefined);
  }finally{cloud.start=original;page.pauseDayClock();}
});
test('export uses a style snapshot and rejects stale style or disposed-page callbacks',()=>{
  const {page,updates}=setup(),poster=require(base+'lib/poster'),original=poster.renderPoster;
  let request,rendered;const canvas={};
  page.localKey='atlas-mini-guest';page.result={};
  page.data.colors={background:'#101c2a',route:'#e8bf79'};
  page.createSelectorQuery=()=>({select(){return this},fields(){return this},exec(cb){cb([{node:canvas}]);}});
  global.wx.nextTick=fn=>fn();global.wx.canvasToTempFilePath=o=>request=o;
  poster.renderPoster=(_canvas,_result,options)=>rendered=options;
  try{
    page.exportImage();page.data.colors.route='#ffffff';
    assert.equal(rendered.colors.route,'#e8bf79');
    request.success({tempFilePath:'stale.png'});
    assert.equal(page.data.exportOpen,false);assert.equal(page.data.exportPath,'');
    assert(page.data.exportMessage.includes('海报设置已更新'));assert.equal(page.data.exportFailed,true);
    page.exportImage();page.disposed=true;const before=updates();
    request.success({tempFilePath:'closed.png'});
    assert.equal(updates(),before);assert.equal(canvas.width,1);assert.equal(canvas.height,1);
  }finally{poster.renderPoster=original;}
});
