const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),path=require('path');
test('extended map shares append the code below the poster and preserve full map in the card',async()=>{
 const rects=[],exports=[],draws=[],text=[];const ctx={fillRect(...v){rects.push(v)},fillText(...v){text.push(v)},drawImage(...v){draws.push(v)}};
 const node=()=>({width:0,height:0,getContext:()=>ctx,createImage:()=>({width:2160,height:2500,set src(v){this.onload()}})}),poster=node(),card=node();
 const page={setData(){},createSelectorQuery(){return{select(){return this},fields(){return this},exec:cb=>cb([{node:poster},{node:card}])}}};
 const wx={nextTick:fn=>fn(),getFileSystemManager:()=>({writeFileSync(){},unlinkSync(){}}),canvasToTempFilePath:o=>{exports.push({width:o.destWidth,height:o.destHeight});o.success({tempFilePath:'file'+exports.length})}};
 const sandbox={module:{exports:{}},wx,setTimeout,clearTimeout,require:n=>n==='./poster-title'?require('../miniprogram/lib/poster-title'):n==='./poster'?{posterDimensions:()=>({height:2500,mapHeight:998}),renderPoster(){}}:n==='./share-snapshot'?{posterData:()=>({})}:n==='./canvas-memory'?{releaseCanvas(){}}:{create:()=> 'qr.png'}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../miniprogram/lib/share-media.js'),'utf8'),sandbox);
 await sandbox.module.exports.renderMedia(page,{options:{},summary:{total:50,airportCount:20,km:100000}},'qr');
 assert.equal(exports[0].height,2860);assert(rects.some(v=>v[1]===2500&&v[3]===360));assert(text.some(v=>v[2]===2640));assert(draws.some(v=>v[2]===2535));assert.equal(exports[1].height,800);
});
test('failed map share image loads time out and release canvases instead of waiting forever',async()=>{
 let expire,cleared=false;const states=[],poster={getContext:()=>({}),createImage:()=>({})},card={};
 const page={setData:d=>states.push(d),createSelectorQuery(){return{select(){return this},fields(){return this},exec:cb=>cb([{node:poster},{node:card}])}}};
 const sandbox={module:{exports:{}},setTimeout:fn=>{expire=fn;return 1},clearTimeout:()=>cleared=true,wx:{nextTick:fn=>fn(),getFileSystemManager:()=>({writeFileSync(){},unlinkSync(){}})},require:n=>n==='./poster-title'?require('../miniprogram/lib/poster-title'):n==='./poster'?{posterDimensions:()=>({height:2500,mapHeight:998}),renderPoster(){}}:n==='./share-snapshot'?{posterData:()=>({})}:n==='./canvas-memory'?{releaseCanvas:c=>{c.width=1;c.height=1}}:{create:()=> 'qr.png'}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../miniprogram/lib/share-media.js'),'utf8'),sandbox);
 const pending=sandbox.module.exports.renderMedia(page,{options:{},summary:{}},'qr');await new Promise(r=>setImmediate(r));expire();await assert.rejects(pending,/加载超时/);assert(cleared);assert.equal(poster.width,1);assert.equal(card.width,1);assert.equal(states.at(-1).rendering,false);
});
