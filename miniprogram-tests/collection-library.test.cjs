const test=require('node:test'),assert=require('node:assert/strict');
const library=require('../miniprogram/lib/collection-library');
test('collection catalog has stable unique IDs and exactly four starter entitlements',()=>{
 assert.equal(library.catalog.items.length,100);
 assert.equal(new Set(library.catalog.items.map(x=>x.id)).size,100);
 assert.equal(library.catalog.items.filter(item=>item.free).length,4);
 for(const item of library.catalog.items)assert(library.catalog.series.some(s=>s.id===item.seriesId));
});
test('candidate membership never changes active colors or records and cannot add locked palettes',()=>{
 const store=new Map();global.wx={getStorageSync:key=>store.get(key),setStorageSync:(key,value)=>store.set(key,value)};
 const account=require('../miniprogram/lib/account-state'),local=require('../miniprogram/lib/local-state');
 try {
 const scope=account.activeScope(),rows=[{_id:'a',from:'SHA',to:'PEK'}];local.write(scope,rows,{colors:{background:'#101c2a',route:'#e8bf79'},posterTitle:'保留标题'});
 const before=local.read(scope),item=library.catalog.items.find(x=>library.owned(x)&&!library.active(x));assert.equal(library.candidates().length,4);
 library.setIncluded(item.id,false);assert.equal(library.includes(item.id),false);assert.deepEqual(local.read(scope),before);
 library.setIncluded(item.id,true);library.setIncluded(item.id,true);assert.equal(library.candidates().length,4);assert.deepEqual(local.read(scope),before);
 for(const free of library.catalog.items.filter(x=>library.owned(x)&&!library.active(x)))library.setIncluded(free.id,false);assert.equal(library.candidates().length,1);
 assert.throws(()=>library.setIncluded(library.candidates()[0].id,false),/先在首页切换/);
 assert.throws(()=>library.setIncluded(library.catalog.items.find(x=>!library.owned(x)).id,true),/尚未解锁/);
 }finally{delete global.wx;}
});

test('six slots enforce capacity but allow a new addition after removing a non-active palette',()=>{
 const store=new Map(),extras=library.catalog.items.filter(x=>!x.free).slice(0,3);
 global.wx={getStorageSync:key=>store.get(key),setStorageSync:(key,value)=>store.set(key,value)};
 try {const account=require('../miniprogram/lib/account-state');store.set(account.activeScope()+'-poster-palettes',library.candidates().map(x=>x.id));extras.forEach(x=>x.free=true);extras.slice(0,2).forEach(x=>library.setIncluded(x.id,true));assert.equal(library.candidates().length,6);assert.throws(()=>library.setIncluded(extras[2].id,true),/最多添加6款/);library.setIncluded(extras[0].id,false);library.setIncluded(extras[2].id,true);assert.equal(library.candidates().length,6);assert(library.includes(extras[2].id));}
 finally{extras.forEach(x=>x.free=false);delete global.wx;}
});

test('one state snapshot decorates the entire catalog without further storage reads',()=>{
 let reads=0,writes=0;const store=new Map();
 global.wx={getStorageSync(key){reads++;return store.get(key)},setStorageSync(key,value){writes++;store.set(key,value)}};
 try {
  const state=library.snapshot(),baseline=reads;
  library.catalog.items.forEach(item=>state.decorate(item));
  assert.equal(reads,baseline);
  const item=library.catalog.items.find(library.owned),before=writes;
  library.setIncluded(item.id,true);assert.equal(writes,before);
  assert.equal(library.series('all').length,10);
  assert.equal(library.members('deep-sea').length,10);
 }finally{delete global.wx;}
});

test('legacy shortlist shrinks to six once while retaining the active palette and ownership',()=>{
 const store=new Map(),extras=library.catalog.items.filter(x=>!x.free).slice(0,8);
 let writes=0;
 global.wx={getStorageSync:key=>store.get(key),setStorageSync(key,value){writes++;store.set(key,value)}};
 try {
  const account=require('../miniprogram/lib/account-state'),local=require('../miniprogram/lib/local-state'),scope=account.activeScope();
  extras.forEach(x=>x.free=true);
  const active=extras.at(-1),rows=[{from:'SHA',to:'PEK'}];
  local.write(scope,rows,{colors:active.colors,posterTitle:'保留标题'});
  const original=local.read(scope),ids=library.catalog.items.filter(x=>x.free).map(x=>x.id);
  store.set(scope+'-poster-palettes',ids);
  const before=writes,expected=[...ids.filter(id=>id!==active.id).slice(0,5),active.id];
  assert.equal(library.CAPACITY,6);
  assert.deepEqual([...library.snapshot().selected],expected);
  assert.deepEqual(store.get(scope+'-poster-palettes'),expected);
  assert.equal(writes,before+1);
  library.snapshot();assert.equal(writes,before+1);
  assert.deepEqual(local.read(scope),original);
  assert(extras.every(library.owned));
  assert.throws(()=>library.setIncluded(active.id,false),/先在首页切换/);
 }finally{extras.forEach(x=>x.free=false);delete global.wx;}
});
