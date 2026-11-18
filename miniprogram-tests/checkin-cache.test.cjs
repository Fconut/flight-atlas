const test=require('node:test'),assert=require('node:assert/strict');
test('claimed palettes unlock collection without auto-adding, stale replies cannot revoke them and accounts stay isolated',()=>{
 const storage=new Map();global.wx={getStorageSync:key=>storage.get(key),setStorageSync:(key,value)=>storage.set(key,value)};
 try {
  const account=require('../miniprogram/lib/account-state'),store=require('../miniprogram/lib/checkin-store'),library=require('../miniprogram/lib/collection-library');
  const scope=account.activeScope(),item=library.catalog.items.find(x=>!x.free);
  store.save(scope,{revision:2,grants:[{type:'palette',itemId:item.id,day:1}]});
  assert(library.owned(item));assert(!library.includes(item.id));
  store.save(scope,{revision:1,grants:[]});assert(library.owned(item));
  storage.set(account.SESSION_KEY,{provider:'wechat-cloudbase',env:require('../miniprogram/lib/cloud-config').env,user:{id:'a'.repeat(64)}});
  assert(!library.owned(item));
 }finally{delete global.wx;}
});
