const test=require('node:test'),assert=require('node:assert/strict');
const create=require('../miniprogram/pages/index/logic/create-page');
function setup(){const queue=[],page=create('map');global.wx={nextTick:fn=>queue.push(fn)};
page.setData=function(v){Object.assign(this.data,v)};return {page,queue,flush:()=>{while(queue.length)queue.shift()();}};}
test('covered maps do not draw; closing dialogs redraws only after the view is restored',()=>{
 const {page,flush}=setup();let queries=0,draws=0,emptyDraws=0;
 page.createSelectorQuery=()=>{queries++;throw Error('covered canvas must not be queried');};
 for(const flag of ['mapSettingsOpen','exportOpen','fleetSelected','recordFiltersOpen','candidateOpen']){
  page.data[flag]=true;page.draw();page.drawEmpty();page.data[flag]=false;
 }
 assert.equal(queries,0);
 page.draw=()=>draws++;page.drawEmpty=()=>emptyDraws++;
 page.setData({mapSettingsOpen:true,hasData:true});page.closeMapSettings();assert.equal(draws,0);flush();assert.equal(draws,1);
 page.setData({mapSettingsOpen:true});page.closeMapSettings();flush();assert.equal(draws,2);
 page.setData({exportOpen:true,hasData:false});page.closeExport();flush();assert.equal(emptyDraws,1);
 page.setData({mapSettingsOpen:true,hasData:true});page.closeMapSettings();page.disposed=true;flush();assert.equal(draws,2);
});
test('export waits for its conditional canvas to mount and releases it before opening the image',()=>{
 const {page,flush}=setup(),poster=require('../miniprogram/lib/poster'),original=poster.renderPoster;
 let queries=0,request;const canvas={};page.result={};page.localKey='atlas-mini-guest';
 page.createSelectorQuery=()=>{queries++;return {select(){return this},fields(){return this},exec(cb){cb([{node:canvas}])}}};
 wx.canvasToTempFilePath=options=>request=options;poster.renderPoster=()=>{};
 try{page.exportImage();assert.equal(page.data.exporting,true);assert.equal(queries,0);flush();assert.equal(queries,1);
 request.success({tempFilePath:'wxfile://poster.png'});assert.equal(page.data.exporting,false);assert.equal(page.data.exportOpen,true);
 assert.equal(canvas.width,1);assert.equal(canvas.height,1);
 }finally{poster.renderPoster=original;}
});
