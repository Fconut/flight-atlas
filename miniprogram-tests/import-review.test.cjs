const test=require('node:test'),assert=require('node:assert/strict'),{review}=require('../miniprogram/lib/import-report');
const row={date:'2025-01-01',from:'SHA',to:'PEK',airline:'CA',flight:'100',aircraft:'A320',departureTime:'10:00'};
test('import review matches the merge result, shows only changed fields and never clears optional data',()=>{
 const current=[row],incoming=[{...row,aircraft:'A321',departureTime:''},{...row,flight:'101'},{...row,flight:'101'}];
 const original=JSON.stringify({current,incoming}),r=review(current,incoming);
 assert.equal(r.added,1);assert.equal(r.updated,1);assert.equal(r.skipped,1);
 assert.equal(r.groups.added.length,1);assert.deepEqual(r.groups.updated[0].changes,[{field:'aircraft',label:'机型',before:'A320',after:'A321'}]);
 assert.equal(r.groups.updated[0].departureTime,'10:00');assert.equal(JSON.stringify({current,incoming}),original);
});
test('same records stay duplicates while a new leg on the same flight is added',()=>{
 const r=review([row],[{...row},{...row,from:'PEK',to:'NRT'}]);assert.equal(r.groups.duplicate.length,1);assert.equal(r.groups.added.length,1);assert.equal(r.updated,0);
});
test('review cancellation and navigation failure do not approve saving',async()=>{
 const {confirmImport}=require('../miniprogram/lib/confirm-import');
 global.wx={navigateTo:o=>require('../miniprogram/lib/confirm-import').decideReview(o.url.split('token=')[1],false)};
 try{assert.equal(await confirmImport([row],[row],'a.xlsx'),false);global.wx.navigateTo=o=>o.fail();await assert.rejects(confirmImport([row],[row],'a.xlsx'),/未打开/)}finally{delete global.wx}
});
test('selected import rows alone are merged; unchecked updates preserve existing fields',async()=>{
 const {confirmImport}=require('../miniprogram/lib/confirm-import'),{merge}=require('../miniprogram/lib/import-report');
 const incoming=[{...row,aircraft:'A321'},{...row,flight:'101'}];
 global.wx={navigateTo:o=>require('../miniprogram/lib/confirm-import').decideReview(o.url.split('token=')[1],[0,0,999,-1])};
 try{
  const chosen=await confirmImport([row],incoming,'a.xlsx');assert.equal(chosen.rows.length,1);assert.equal(chosen.rows[0].flight,'101');
  const saved=merge([row],chosen.rows);assert.equal(saved.added,1);assert.equal(saved.updated,0);assert.equal(saved.rows[0].aircraft,'A320');
 }finally{delete global.wx}
});
test('review selection persists across tabs and applies select-all to the whole category',()=>{
 let definition,request;global.Page=p=>definition=p;global.wx={navigateTo:o=>request=o};
 try{
  delete require.cache[require.resolve('../miniprogram/pages/import-review/index')];require('../miniprogram/pages/import-review/index');
  const bridge=require('../miniprogram/lib/confirm-import');
  bridge.confirmImport([],Array.from({length:35},(_,i)=>({...row,flight:String(i)})),'test.xlsx');
  const token=request.url.split('token=')[1],review=bridge.readReview(token);
  review.updated=1;review.groups.updated=[{reviewId:35}];
  const page={...definition,data:{...definition.data},setData(v){Object.assign(this.data,v)}};page.onLoad({token});  page.toggleAll();assert.equal(page.selected.size,1);assert.equal(page.data.visible.length,30);
  page.select({currentTarget:{dataset:{key:'updated'}}});assert.equal(page.data.groupSelected,1);
  page.toggle({currentTarget:{dataset:{id:35}}});assert.equal(page.selected.size,0);
  page.select({currentTarget:{dataset:{key:'added'}}});page.toggleAll();assert.equal(page.selected.size,35);
 }finally{delete global.Page;delete global.wx}
});
