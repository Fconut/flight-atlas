const test=require('node:test'),assert=require('node:assert/strict'),create=require('../miniprogram/pages/index/logic/create-page');
test('updates received while the map is hidden are redrawn on return without a transient empty canvas',()=>{
 const queue=[];global.wx={getStorageSync:()=>null,setStorageSync(){},nextTick:fn=>queue.push(fn)};
 const page=create('map'),states=[];page.setData=function(d){states.push(d);Object.assign(this.data,d)};page.localKey='guest';page.data.hasData=true;page.pageHidden=true;
 let draws=0;page.draw=()=>{if(!page.pageHidden){draws++;page.previewNeedsRedraw=false}};page.syncTabState=()=>{};page.refreshDay=()=>{};page.resumeDayClock=()=>{};
 page.load([{date:'2025-01-01',from:'SHA',to:'NRT',aircraft:''}],false);while(queue.length)queue.shift()();
 assert.equal(draws,0);assert.equal(page.previewNeedsRedraw,true);assert(!states.some(s=>s.hasData===false));
 page.onShow();while(queue.length)queue.shift()();assert.equal(draws,1);assert.equal(page.previewNeedsRedraw,false);delete global.wx;
});
test('map preview keeps extended height on tab return and rebuilds for changed colors',()=>{
 const create=require('../miniprogram/pages/index/logic/create-page');global.wx={getStorageSync:()=>null,setStorageSync(){},nextTick:fn=>fn(),getWindowInfo:()=>({pixelRatio:3})};
 const page=create('map'),poster=require('../miniprogram/lib/poster'),original=poster.renderPoster,canvas={};page.setData=function(v){Object.assign(this.data,v)};page.localKey='guest';page.data.hasData=true;
 const rows=[{date:'2025-01-01',from:'LYR',to:'FRA',flight:'1'},{date:'2025-01-02',from:'EZE',to:'USH',flight:'2'}];page.result=require('../miniprogram/lib/flights').calculate(rows,require('../miniprogram/lib/airports'),'2026-11-10',false);
 page.createSelectorQuery=()=>({select(){return this},fields(){return this},exec:cb=>cb([{node:canvas,width:360}])});page.syncTabState=()=>{};page.refreshDay=()=>{};page.resumeDayClock=()=>{};let count=0;poster.renderPoster=()=>count++;
 try{page.draw();const height=canvas.height,css=page.data.posterPreviewHeight;assert(height>2300);assert(css>360*1150/1080);page.onHide();page.onShow();assert.equal(count,1);assert.equal(canvas.height,height);assert.equal(page.data.posterPreviewHeight,css);page.data.colors={background:'#ffffff',route:'#315c61'};page.draw();assert.equal(count,2);assert.equal(canvas.height,height)}finally{poster.renderPoster=original;delete global.wx}
});

test('background reclamation redraws the same retained node once while ordinary tab returns reuse it',()=>{
 const generation=require('../miniprogram/lib/foreground-generation'),poster=require('../miniprogram/lib/poster'),original=poster.renderPoster;
 global.wx={getStorageSync:()=>null,setStorageSync(){},nextTick:fn=>fn(),getWindowInfo:()=>({pixelRatio:3})};
 const page=create('map'),canvas={};page.setData=function(v){Object.assign(this.data,v)};page.localKey='guest';page.data.hasData=true;
 page.result=require('../miniprogram/lib/flights').calculate([{date:'2025-01-01',from:'SHA',to:'PEK'}],require('../miniprogram/lib/airports'),'2026-11-15',false);
 page.createSelectorQuery=()=>({select(){return this},fields(){return this},exec:cb=>cb([{node:canvas,width:360}])});page.syncTabState=()=>{};page.refreshDay=()=>{};page.resumeDayClock=()=>{};let count=0;poster.renderPoster=()=>count++;
 try {page.draw();assert.equal(count,1);page.onHide();generation.invalidate();page.onShow();assert.equal(count,2);page.onHide();page.onShow();assert.equal(count,2);assert.equal(page.data.hasData,true);}finally{poster.renderPoster=original;delete global.wx;}
});
