const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
for(const name of ['badge-share','collection-share'])test(name+' stops before creating a public snapshot if closed during autosave',async()=>{
 let page,finish,calls=0;
 const auto={ensureSaved:()=>new Promise(resolve=>finish=resolve),getState:()=>({phase:'saved',scope:'owner'})};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../miniprogram/pages',name,'index.js'),'utf8'),{Page:p=>page=p,require:name=>name.endsWith('/auto-save')?auto:name.endsWith('/share-api')?{callShare:()=>{calls++;throw Error('unexpected request')}}:{}});
 page.data={selectedCount:1,snapshot:{},records:[]};page.setData=function(data){Object.assign(this.data,data)};page.scope='owner';
 const pending=page.prepare();page.onUnload();finish();await pending;assert.equal(calls,0);
});
