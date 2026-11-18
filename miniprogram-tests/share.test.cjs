const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {buildSnapshot,posterData}=require('../miniprogram/lib/share-snapshot');
const {createHandler}=require('../cloudfunctions/atlas-share/service');
const appId='wx31f3f3739a7a1743';
const owner=id=>crypto.createHash('sha256').update(appId+'\0'+id).digest('hex');
const draft={version:1,rows:null,fileName:'SECRET-PERSONAL-FILE',includeFuture:true,colors:{background:'#101c2a',route:'#e8bf79'},labelSelection:['SHA','NRT','JFK'],sheets:[{name:'private',rows:[
 {date:'2025-01-01',from:'SHA',to:'NRT',airline:'MU',flight:'SECRET123',aircraft:'PRIVATE-MODEL'},
 {date:'2099-01-01',from:'LAX',to:'JFK',airline:'CA',flight:'FUTURE123'},
 {date:'2025-01-02',from:'SHA',to:'LAX',airline:'CA',flight:'CANCELED123',canceled:true}
]}]};
test('share snapshots whitelist aggregates, exclude future and canceled journeys, and contain no flight details',()=>{
 const before=JSON.stringify(draft),snapshot=buildSnapshot(draft,'2026-11-07'),text=JSON.stringify(snapshot);
 assert.equal(snapshot.summary.total,1);assert.equal(snapshot.summary.airportCount,2);assert.deepEqual(Object.keys(snapshot.map.airports).sort(),['NRT','SHA']);
 for(const secret of ['SECRET123','PRIVATE-MODEL','FUTURE123','CANCELED123','2025-01-01','SECRET-PERSONAL-FILE'])assert(!text.includes(secret));
 assert.equal(snapshot.map.longestRoutes[0].flight,undefined);assert.equal(snapshot.map.routes[0].count,1);assert.equal(posterData(snapshot).routes[0].flights.length,1);
 assert.deepEqual(snapshot.options.labelSelection,['SHA','NRT']);assert.equal(snapshot.options.publicMode,true);assert.equal(JSON.stringify(draft),before);
});
function harness(){
 let identity={APPID:appId,OPENID:'wechat-alice'},time=Date.UTC(2026,10,7),beforeTransaction;
 const store=new Map([[owner(identity.OPENID),{_openid:identity.OPENID,appId,payload:structuredClone(draft),revision:1}]]);
 const db={collection(){return{doc(id){return{
  async get(){return{data:structuredClone(store.get(id))}},async set({data}){store.set(id,structuredClone(data))},async update({data}){store.set(id,{...store.get(id),...structuredClone(data)})},async remove(){store.delete(id)}
 }}}},async runTransaction(fn){if(beforeTransaction)beforeTransaction();return fn(db)}};
 const cloud={getWXContext:()=>identity,database:()=>db,openapi:{wxacode:{getUnlimited:async options=>{assert.equal(options.scene.length,32);assert.equal(options.page,'pages/share-view/index');return{buffer:Buffer.from('test-image')}}}}};
 const handler=createHandler({cloud,buildSnapshot,buildBadgeSnapshot:require('../miniprogram/lib/badge-share').buildBadgeSnapshot,buildCollectionSnapshot:require('../miniprogram/lib/collection-share').buildCollectionSnapshot,now:()=>time});
 return{handler,store,setCode:fn=>cloud.openapi.wxacode.getUnlimited=fn,setUser:id=>identity={APPID:appId,OPENID:id},setTime:value=>time=value,getTime:()=>time,beforeTransaction:fn=>beforeTransaction=fn};
}
test('public share reads expose only the fixed snapshot without management endpoints',async()=>{
 const h=harness(),original=structuredClone(h.store.get(owner('wechat-alice'))),created=await h.handler({action:'create',owner:'forged-user',snapshot:{secret:'ignored'}});
 assert(created.ok);assert.match(created.id,/^[a-f0-9]{32}$/);assert.equal(created.expires,undefined);
 h.store.get(owner('wechat-alice')).payload.sheets[0].rows=[];
 h.setUser('wechat-bob');const read=await h.handler({action:'get',id:created.id});assert.equal(read.snapshot.summary.total,1);assert.equal(read.owner,undefined);assert.equal(read.isOwner,false);
 assert.equal((await h.handler({action:'revoke',id:created.id})).code,'INVALID_REQUEST');assert.equal((await h.handler({action:'list'})).code,'INVALID_REQUEST');
 h.setUser('wechat-alice');assert.equal((await h.handler({action:'code',id:created.id,envVersion:'develop'})).ok,true);
 assert.equal((await h.handler({action:'revoke',id:created.id})).code,'INVALID_REQUEST');assert.equal((await h.handler({action:'get',id:created.id})).ok,true);
 assert.equal(h.store.get(owner('wechat-alice')).revision,original.revision);
});
test('links have no automatic expiry, legacy deadlines are ignored, and share creation checks current revision',async()=>{
 const h=harness(),created=await h.handler({action:'create'});h.store.get('share-'+created.id).expires=h.getTime()+1;h.setTime(h.getTime()+8*86400000);
 assert.equal((await h.handler({action:'get',id:created.id})).ok,true);assert.equal((await h.handler({action:'get',id:owner('wechat-alice')})).code,'UNAVAILABLE');
 const next=harness();next.beforeTransaction(()=>{next.store.get(owner('wechat-alice')).revision++});
 assert.equal((await next.handler({action:'create'})).code,'CHANGED');assert.equal([...next.store.keys()].filter(key=>key.startsWith('share-')&&!key.startsWith('share-owner-')).length,0);
});
test('identical snapshots reuse a permanent link while new content preserves old snapshots',async()=>{
 const h=harness(),first=await h.handler({action:'create'});h.setTime(h.getTime()+365*86400000);const again=await h.handler({action:'create'});assert.equal(again.id,first.id);assert.equal(again.createdAt,first.createdAt);
 const record=h.store.get(owner('wechat-alice'));record.payload.sheets[0].rows.push({date:'2025-02-01',from:'SHA',to:'NRT',airline:'MU',flight:'101'});record.revision++;
 const next=await h.handler({action:'create'});assert.notEqual(next.id,first.id);assert.equal(next.snapshot.summary.total,2);assert.equal((await h.handler({action:'get',id:first.id})).snapshot.summary.total,1);
});
test('different snapshots can be created beyond the previous daily quota',async()=>{
 const h=harness();let first,last;const record=h.store.get(owner('wechat-alice'));
 for(let i=0;i<20;i++){h.setTime(h.getTime()+30000);record.payload.sheets[0].rows.push({date:'2025-02-01',from:'SHA',to:'NRT',airline:'MU',flight:String(1000+i)});record.revision++;const result=await h.handler({action:'create'});assert(result.ok);first=first||result.id;last=result.id}
 assert.equal((await h.handler({action:'create'})).id,last);
 record.payload.sheets[0].rows.push({date:'2025-02-01',from:'SHA',to:'NRT',airline:'MU',flight:'2000'});record.revision++;h.setTime(h.getTime()+30000);assert.equal((await h.handler({action:'create'})).ok,true);h.setUser('wechat-bob');assert.equal((await h.handler({action:'code',id:first})).code,'UNAVAILABLE');
});

test('share landing page only reads share data and does not import another user\'s flights',async()=>{
 let page;global.Page=value=>page=value;global.wx={getStorageSync:()=>null,setStorageSync(){},cloud:{init(){},callFunction:async options=>{assert.equal(options.data.action,'get');return{result:{ok:false,message:'这份分享已失效'}}}}};
 delete require.cache[require.resolve('../miniprogram/pages/share-view/index')];require('../miniprogram/pages/share-view/index');page.setData=function(values){Object.assign(this.data,values)};
 page.onLoad({id:'a'.repeat(32)});await page.onReady();assert.equal(page.data.active,false);assert.equal(page.data.posterPath,'');assert.match(page.data.message,/失效/);
 assert.equal(page.load,undefined);assert.equal(page.openFlightEditor,undefined);
});

test('share cards remain generic until a snapshot is explicitly created and cannot reuse another account scope',()=>{
 const storage={};global.wx={getStorageSync:key=>storage[key],setStorageSync:(key,value)=>storage[key]=value,removeStorageSync:key=>delete storage[key]};let page;global.Page=value=>page=value;
 delete require.cache[require.resolve('../miniprogram/pages/share-compose/index')];require('../miniprogram/pages/share-compose/index');page.setData=function(values){Object.assign(this.data,values)};
 page.ownerScope=require('../miniprogram/lib/account-state').activeScope();page.snapshot=buildSnapshot(draft,'2026-11-07');page.data.cardPath='private-preview-file';
 assert.equal(page.onShareAppMessage().imageUrl,undefined);assert.equal(page.onShareAppMessage().path,'/pages/index/index');
 page.data.ready=true;page.readyShare={id:'a'.repeat(32)};assert.equal(page.onShareAppMessage().path,'/pages/share-view/index?id='+'a'.repeat(32));
 page.ownerScope='another-account';assert.equal(page.onShareAppMessage().imageUrl,undefined);assert.equal(page.onShareAppMessage().path,'/pages/index/index');
});

test('badge shares validate selected records against the saved owner draft',async()=>{
 const h=harness(),record=h.store.get(owner('wechat-alice'));
 record.payload={rows:[{date:'2025-01-01',from:'SHA',to:'NRT',airline:'MU',flight:'123',aircraft:'BOEING 737-800'}]};
 const expected=[{date:'2025-01-01',from:'SHA',to:'NRT',airline:'MU',flight:'123',departureTime:''}];
 const request={action:'create',kind:'badge',badgeId:'b737-800',selected:[0],expected};
 const created=await h.handler(request);assert.equal(created.ok,true);assert.deepEqual(created.snapshot.records,expected);
 const reordered=expected.map(r=>({flight:r.flight,airline:r.airline,to:r.to,from:r.from,date:r.date}));assert.equal((await h.handler({...request,expected:reordered})).ok,true);
 const stale=await h.handler({...request,expected:[{...expected[0],flight:'forged'}]});assert.equal(stale.code,'CHANGED');
 record.payload.rows=[];h.setUser('wechat-bob');const read=await h.handler({action:'get',id:created.id});assert.deepEqual(read.snapshot.records,expected);
 assert.equal((await h.handler(request)).code,'NO_DRAFT');
});

test('collection links use trusted saved data and remain fixed after the owner edits flights',async()=>{
 const h=harness(),record=h.store.get(owner('wechat-alice'));
 record.payload={rows:[{date:'2025-01-01',from:'SHA',to:'NRT',aircraft:'BOEING 737-800',flight:'PRIVATE123'}]};
 const made=await h.handler({action:'create',kind:'collection',snapshot:{secret:'forged'}});assert.equal(made.ok,true);assert.equal(made.snapshot.kind,'collection');assert.equal(made.snapshot.summary.unlocked,1);assert(!JSON.stringify(made.snapshot).includes('PRIVATE123'));assert(!JSON.stringify(made.snapshot).includes('forged'));
 record.payload.rows=[];h.setUser('wechat-bob');assert.equal((await h.handler({action:'get',id:made.id})).snapshot.summary.unlocked,1);assert.equal((await h.handler({action:'create',kind:'collection'})).code,'NO_DRAFT');
});

test('share reuse survives database reordering of snapshot object fields',async()=>{
 const h=harness(),first=await h.handler({action:'create'});
 const reverse=value=>Array.isArray(value)?value.map(reverse):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).reverse().map(([k,v])=>[k,reverse(v)])):value;
 h.store.get('share-'+first.id).snapshot=reverse(first.snapshot);
 const again=await h.handler({action:'create'});assert.equal(again.id,first.id);assert.equal(h.store.get('share-owner-'+owner('wechat-alice')).latestId,first.id);
});


test('new shares wait 30 seconds while identical content bypasses frequency checks',async()=>{
 const h=harness(),first=await h.handler({action:'create'});assert.equal((await h.handler({action:'create'})).id,first.id);
 const record=h.store.get(owner('wechat-alice'));record.payload.sheets[0].rows.push({date:'2025-02-01',from:'SHA',to:'NRT',flight:'2'});record.revision++;
 h.setTime(h.getTime()+29999);assert.equal((await h.handler({action:'create'})).code,'RATE_LIMIT');h.setTime(h.getTime()+1);assert.equal((await h.handler({action:'create'})).ok,true);
});
test('codes are cached per share and version; failures release the lock for immediate retry',async()=>{
 const h=harness(),share=await h.handler({action:'create'});let calls=0,broken=true;
 h.setCode(async()=>{calls++;if(broken)throw Error('upstream');return{buffer:Buffer.from('qr')}});
 assert.equal((await h.handler({action:'code',id:share.id,envVersion:'develop'})).code,'CODE_UNAVAILABLE');broken=false;
 assert.equal((await h.handler({action:'code',id:share.id,envVersion:'develop'})).ok,true);assert.equal(calls,2);
 assert.equal((await h.handler({action:'code',id:share.id,envVersion:'develop'})).ok,true);assert.equal(calls,2);
 assert.equal((await h.handler({action:'code',id:share.id,envVersion:'release'})).ok,true);assert.equal(calls,3);
});
test('a second request cannot generate the same code while its lease is active',async()=>{
 const h=harness(),share=await h.handler({action:'create'});let finish,started;const signal=new Promise(r=>started=r);
 h.setCode(()=>new Promise(r=>{finish=r;started()}));const pending=h.handler({action:'code',id:share.id});await signal;
 assert.equal((await h.handler({action:'code',id:share.id})).code,'BUSY');finish({buffer:Buffer.from('qr')});assert.equal((await pending).ok,true);
});
