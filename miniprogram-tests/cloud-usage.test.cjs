const test=require('node:test'),assert=require('node:assert/strict'),usage=require('../miniprogram/lib/cloud-usage');
test('development counters record actual request attempts without payloads and reset locally',async()=>{
 let app={},calls=0;global.getApp=()=>app;global.wx={getAccountInfoSync:()=>({miniProgram:{envVersion:'develop'}}),cloud:{callFunction:async()=>{calls++;return {ok:true}}}};usage.reset();
 try{await usage.callFunction({name:'atlas-account',data:{action:'fetch',privateText:'must-not-record'}});assert.equal(calls,1);assert.deepEqual(app.cloudUsage.snapshot(),{total:1,calls:{'atlas-account.fetch':1}});assert(!JSON.stringify(usage.snapshot()).includes('privateText'));assert.equal(app.cloudUsage.reset().total,0)}finally{delete global.wx;delete global.getApp}
});
test('release and trial builds do not count requests or expose a debug panel',async()=>{
 for(const envVersion of ['release','trial']){
  const app={};global.getApp=()=>app;global.wx={getAccountInfoSync:()=>({miniProgram:{envVersion}}),cloud:{callFunction:async()=>1}};usage.reset();
  try{assert.equal(await usage.callFunction({name:'atlas-share',data:{action:'get'}}),1);assert.equal(usage.snapshot().total,0);assert.equal(app.cloudUsage,undefined)}finally{delete global.wx;delete global.getApp}
 }
});
