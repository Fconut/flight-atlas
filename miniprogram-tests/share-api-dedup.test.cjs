const test=require('node:test'),assert=require('node:assert/strict');
test('identical concurrent share requests coalesce and completed requests are not retained',async()=>{
 let calls=0,release;global.wx={getStorageSync:()=>null,setStorageSync(){},cloud:{init(){},callFunction:()=>{calls++;return new Promise(r=>release=r)}}};
 const {callShare}=require('../miniprogram/lib/share-api');
 try{
  const a=callShare('get',{id:'a'}),b=callShare('get',{id:'a'});assert.equal(a,b);assert.equal(calls,1);release({result:{ok:true}});await a;
  const c=callShare('get',{id:'a'});assert.equal(calls,2);release({result:{ok:true}});await c;
 }finally{delete global.wx}
});
test('failed share requests release the coalescing entry so retry reaches the cloud',async()=>{
 let calls=0;global.wx={getStorageSync:()=>null,setStorageSync(){},cloud:{init(){},callFunction:async()=>{calls++;if(calls===1)throw Error('offline');return{result:{ok:true}}}}};
 try{const {callShare}=require('../miniprogram/lib/share-api');await assert.rejects(callShare('get',{id:'retry'}),/offline/);await callShare('get',{id:'retry'});assert.equal(calls,2)}finally{delete global.wx}
});

test('valid share reads and codes reuse bounded account-scoped cache without retaining mutations',async()=>{const file=require.resolve('../miniprogram/lib/share-api');delete require.cache[file];let calls=0,time=100000;const realNow=Date.now,storage=new Map();Date.now=()=>time;global.wx={getStorageSync:key=>storage.get(key),setStorageSync:(k,v)=>storage.set(k,v),cloud:{init(){},callFunction:async o=>{calls++;return {result:{ok:true,...(o.data.action==='code'?{image:'base64'}:{snapshot:{name:'original'}})}}}}};try{const {callShare}=require(file),id='a'.repeat(32);const first=await callShare('get',{id});first.snapshot.name='mutated';assert.equal((await callShare('get',{id})).snapshot.name,'original');assert.equal(calls,1);await callShare('code',{id,envVersion:'trial'});await callShare('code',{id,envVersion:'trial'});assert.equal(calls,2);await callShare('code',{id,envVersion:'release'});assert.equal(calls,3);await callShare('create',{});await callShare('create',{});assert.equal(calls,5);time+=300001;await callShare('get',{id});assert.equal(calls,6);const account=require('../miniprogram/lib/account-state');storage.set(account.SESSION_KEY,{provider:'wechat-cloudbase',env:require('../miniprogram/lib/cloud-config').env,user:{id:'b'.repeat(64)}});await callShare('get',{id});assert.equal(calls,7)}finally{Date.now=realNow;delete global.wx;delete require.cache[file]}});
