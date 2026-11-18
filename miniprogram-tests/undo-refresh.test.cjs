const test=require('node:test'),assert=require('node:assert/strict'),create=require('../miniprogram/pages/index/logic/create-page');
test('background reload keeps undo for the same account, while restored rows or changed accounts invalidate it',()=>{
 global.wx={getStorageSync(){},setStorageSync(){},nextTick(){}};
 try{
  const page=create('records');page.localKey='guest';page.setData=function(v){Object.assign(this.data,v)};
  page.load([{date:'2025-01-01',from:'SHA',to:'PEK',flight:'1'},{date:'2025-01-02',from:'PEK',to:'SHA',flight:'2'}],false);
  const [deleted,remaining]=page.data.rows;page.deletedRow=deleted;page.deletedScope='guest';
  page.load([remaining],false);assert.equal(page.data.canUndo,true);assert.equal(page.deletedRow._id,deleted._id);
  page.load([remaining,deleted],false);assert.equal(page.data.canUndo,false);
  page.deletedRow=deleted;page.deletedScope='guest';page.localKey='other';page.load([remaining],false);assert.equal(page.data.canUndo,false);
 }finally{delete global.wx}
});
test('single deletion remains undoable after repeated background refreshes and a tab round trip',()=>{
 const storage={};global.wx={getStorageSync:k=>storage[k],setStorageSync:(k,v)=>storage[k]=JSON.parse(JSON.stringify(v)),nextTick(){},showModal:o=>o.success({confirm:true})};
 try{
  const p=create('records');p.localKey='undo-isolated';p.setData=function(v){Object.assign(this.data,v)};
  p.load([{date:'2025-01-01',from:'SHA',to:'PEK',flight:'1'},{date:'2025-01-02',from:'PEK',to:'SHA',flight:'2'}]);
  p.remove({currentTarget:{dataset:{index:0}}});assert.equal(p.data.rows.length,1);
  for(let i=0;i<20;i++)p.load(storage['undo-isolated-state'].rows,false);
  p.syncTabState=()=>p.load(storage['undo-isolated-state'].rows,false);p.refreshDay=()=>{};p.resumeDayClock=()=>{};
  p.onHide();p.onShow();assert.equal(p.data.canUndo,true);
  p.undoRemove();assert.equal(p.data.rows.length,2);assert.equal(storage['undo-isolated-state'].rows.length,2);assert.equal(p.data.canUndo,false);
 }finally{delete global.wx}
});
