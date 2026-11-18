const test=require('node:test'),assert=require('node:assert/strict');
const {importComplete}=require('../miniprogram/lib/import-complete');
test('reviewed imports finish with a nonblocking toast instead of a modal over the native map canvas',()=>{
 let route,toast;global.wx={switchTab:o=>{route=o.url;o.success()},showToast:o=>toast=o,showModal:()=>assert.fail('must not block map')};
 try{importComplete({added:5});assert.equal(route,'/pages/index/index');assert.match(toast.title,/5/);importComplete({added:1,updated:2,skipped:3});assert.match(toast.title,/3/);importComplete({});assert.equal(toast.title,'记录无需更新')}finally{delete global.wx}
});
test('import completion cannot start two simultaneous tab navigations',()=>{
 let calls=0,pending;global.wx={switchTab:o=>{calls++;pending=o},showToast(){}};
 try{importComplete({added:1});importComplete({added:1});assert.equal(calls,1);pending.success();importComplete({added:1});assert.equal(calls,2);pending.success()}finally{delete global.wx}
});
