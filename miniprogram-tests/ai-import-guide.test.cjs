const test=require('node:test'),assert=require('node:assert/strict');
const records=require('../miniprogram/pages/index/logic/records');
test('AI guide blocks concurrent opens, recovers after failure and safely restores its opener',()=>{
 let request,calls=0,toast;global.wx={navigateTo(o){calls++;request=o},showToast(o){toast=o.title}};
 const page={data:{},setData(v){Object.assign(this.data,v)}};
 try{
  records.openAiImportGuide.call(page);records.openAiImportGuide.call(page);assert.equal(calls,1);
  request.fail();request.complete();assert.match(toast,/重试/);
  records.openAiImportGuide.call(page);assert.equal(calls,2);
  request.events.guideClosed();assert.equal(page.data.mapSettingsOpen,true);
  page.disposed=true;page.data.mapSettingsOpen=false;request.events.guideClosed();assert.equal(page.data.mapSettingsOpen,false);
 }finally{delete global.wx}
});
test('AI guide displays and copies identical content and permits retry after clipboard failure',()=>{
 let definition,request,calls=0;global.Page=p=>definition=p;global.wx={setClipboardData(o){request=o;calls++},showToast(){}};
 try{
  delete require.cache[require.resolve('../miniprogram/pages/ai-import/index')];require('../miniprogram/pages/ai-import/index');
  definition.copy();definition.copy();assert.equal(calls,1);assert.equal(request.data,definition.data.prompt);
  request.fail();request.complete();definition.copy();assert.equal(calls,2);
  assert.doesNotThrow(()=>definition.onUnload());
 }finally{delete global.Page;delete global.wx}
});
test('scope change adds newly visible extreme airports while respecting disabled or empty labels',()=>{
 for(const [labels,selection,expected]of [[true,['SHA'],['SHA','LYR']],[false,['SHA'],['SHA']],[true,[],[]]]){
  let saves=0;const page={data:{future:false,rows:[{}],labels,labelSelection:selection},result:{airports:{SHA:{}}},setData(v){Object.assign(this.data,v)},load(){this.result={airports:{SHA:{},LYR:{}},extremes:{north:'LYR',south:'SHA'}}},draw(){},updateLabels(){},savePreferences(){saves++}};
  records.future.call(page,{detail:{value:true}});assert.deepEqual(page.data.labelSelection,expected);assert.equal(saves,1);
  records.future.call(page,{detail:{value:true}});assert.equal(saves,1);
 }
});
