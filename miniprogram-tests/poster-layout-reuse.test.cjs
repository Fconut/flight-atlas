const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createRequire}=require('node:module');
test('poster rendering reuses only layouts prepared for the same data and scales the output height',()=>{
 const file=path.join(__dirname,'../miniprogram/lib/poster.js'),req=createRequire(file),real=req('./poster-projection');let projections=0;const module={exports:{}};
 vm.runInNewContext(fs.readFileSync(file,'utf8'),{module,require:id=>id==='./poster-projection'?{mapProjection:data=>{projections++;return real.mapProjection(data)}}:req(id)});
 const data=req('./flights').calculate([{date:'2025-01-01',from:'LYR',to:'FRA',flight:'1'},{date:'2025-01-02',from:'EZE',to:'USH',flight:'2'}],req('./airports'),'2026-11-14',false);
 const ctx=new Proxy({measureText:()=>({width:50}),createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}})},{get:(o,k)=>k in o?o[k]:()=>{}}),canvas={width:2160,height:0,getContext:()=>ctx};
 const {posterDimensions,renderPoster}=module.exports,layout=posterDimensions(data,1080);assert.equal(projections,1);
 renderPoster(canvas,data,{labels:false},layout);assert.equal(projections,1);assert.equal(canvas.height,layout.height*2);
 renderPoster(canvas,{...data},{labels:false},layout);assert.equal(projections,2,'different data must recompute layout');
});
