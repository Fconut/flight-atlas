const test=require('node:test'),assert=require('node:assert/strict');
const domain=require('../cloudfunctions/atlas-checkin/domain');
const rewards=require('../cloudfunctions/atlas-checkin/stamp-rewards.json').rewards;
const catalog=require('../miniprogram/lib/stamp-catalog');
const owner='stamp-test';
const state=days=>({version:1,owner,days,lastDay:'2026-11-17',grants:[]});
test('100 stable stamps have 60 fixed, interleaved rewards on days 2 to 415',()=>{
 assert.equal(catalog.items.length,100);assert.equal(new Set(catalog.items.map(x=>x.id)).size,100);
 assert.equal(rewards.length,60);assert.equal(new Set(rewards.map(x=>x.itemId)).size,60);
 rewards.forEach((r,i)=>{assert.equal(r.day,2+7*i);assert(catalog.items.some(x=>x.id===r.itemId));if(i)assert.notEqual(catalog.items.find(x=>x.id===r.itemId).seriesId,catalog.items.find(x=>x.id===rewards[i-1].itemId).seriesId)});
 assert.equal(rewards.at(-1).day,415);
});
test('stamp and palette rewards coexist, while legacy clients keep the original plan',()=>{
 assert.deepEqual(domain.view(state(2),'2026-11-17').pending,[1,2]);
 assert.deepEqual(domain.view(state(16),'2026-11-17').pending,[1,2,8,9,15,16]);
 assert.deepEqual(domain.view(state(16),'2026-11-17',false).pending,[1,8,15]);
 assert.equal(domain.view(state(2),'2026-11-17').planVersion,5);
 assert.equal(domain.view(state(2),'2026-11-17',false).planVersion,4);
 assert.throws(()=>domain.change(state(1),'claim',{milestone:2},'2026-11-17',owner),/NO_REWARD/);
});
test('stamp claims are fixed, idempotent and preserve previous palette grants',()=>{
 const palette=require('../cloudfunctions/atlas-checkin/rewards.json').rewards[0];
 const old={...state(415),grants:[{day:1,type:'palette',itemId:palette.itemId,rewardId:palette.id}]};
 let current=domain.change(old,'claim',{milestone:2,itemId:'stamp-100',type:'palette'},'2026-11-17',owner).record;
 assert.equal(current.grants[1].itemId,rewards[0].itemId);assert.equal(current.grants[1].type,'stamp');
 assert.equal(domain.change(current,'claim',{milestone:2},'2026-11-17',owner).changed,false);
 for(const r of rewards.slice(1).reverse())current=domain.change(current,'claim',{milestone:r.day},'2026-11-17',owner).record;
 assert.deepEqual(current.grants[0],old.grants[0]);
 assert.equal(new Set(current.grants.map(g=>g.rewardId)).size,61);
 assert.equal(domain.view(current,'2026-11-17').pendingRewards.filter(r=>r.type==='stamp').length,0);
});
test('stamp entitlement never auto-adds or applies and active selection is protected',()=>{
 const storage=new Map();global.wx={getStorageSync:k=>storage.get(k),setStorageSync:(k,v)=>storage.set(k,v)};
 try{
  const account=require('../miniprogram/lib/account-state'),store=require('../miniprogram/lib/checkin-store'),library=require('../miniprogram/lib/stamp-library'),local=require('../miniprogram/lib/local-state');
  const scope=account.activeScope();store.save(scope,{revision:100,grants:rewards.slice(0,7).map(r=>({...r,rewardId:r.id}))});
  assert.equal(library.ownedItems().length,7);assert.equal(library.candidates().length,0);assert.equal(library.snapshot().activeId,null);
  for(const r of rewards.slice(0,6))library.setIncluded(r.itemId,true);
  assert.throws(()=>library.setIncluded(rewards[6].itemId,true),/最多添加6枚/);
  local.write(scope,[],{posterStamp:rewards[0].itemId});
  assert.throws(()=>library.setIncluded(rewards[0].itemId,false),/先在首页切换/);
  library.setIncluded(rewards[1].itemId,false);library.setIncluded(rewards[6].itemId,true);
  assert.equal(library.candidates().length,6);assert.equal(library.ownedItems().length,7);
 }finally{delete global.wx}
});
test('one stamp survives backup and public share normalization; unknown or multiple IDs do not',()=>{
 const normalize=require('../miniprogram/lib/stamp-id').normalize;
 assert.equal(normalize('stamp-001'),'stamp-001');assert.equal(normalize('stamp-100'),'stamp-100');
 for(const bad of['stamp-000','stamp-101',['stamp-001','stamp-002'],{},''])assert.equal(normalize(bad),null);
 const draft=require('../miniprogram/lib/backup').snapshot({rows:[{date:'2026-01-01',from:'SHA',to:'PEK'}],posterStamp:'stamp-001'});
 assert.equal(require('../miniprogram/lib/draft-state').localState(draft).prefs.posterStamp,'stamp-001');
 assert.equal(require('../miniprogram/lib/share-snapshot').buildSnapshot(draft,'2026-11-17').options.posterStamp,'stamp-001');
 assert.equal(require('../cloudfunctions/atlas-share/domain/share-snapshot').buildSnapshot(draft,'2026-11-17').options.posterStamp,'stamp-001');
});
test('cloud handler negotiates the new reward plan without exposing stamp claims to old clients',async()=>{
 const {createHash}=require('crypto'),{createHandler}=require('../cloudfunctions/atlas-checkin/service');
 const app='wx31f3f3739a7a1743',openid='stamp-test-openid',userId=createHash('sha256').update(app+'\0'+openid).digest('hex');
 let saved={...state(2),owner:userId};
 const ref={async get(){return {data:saved}},async set({data}){saved=data}};
 const db={collection:()=>({doc:()=>ref}),runTransaction:fn=>fn(db)};
 const handler=createHandler({identity:()=>({APPID:app,OPENID:openid}),database:()=>db,enabled:()=>true,now:()=>Date.parse('2026-11-17T01:00:00Z')});
 const legacy=await handler({action:'status'});assert.equal(legacy.planVersion,4);assert.deepEqual(legacy.pending,[1]);
 const current=await handler({action:'status',planVersion:5});assert.equal(current.planVersion,5);assert.deepEqual(current.pending,[1,2]);
 assert.equal((await handler({action:'claim',milestone:2})).code,'NO_REWARD');
 const claimed=await handler({action:'claim',planVersion:5,milestone:2,rewardId:'stamp:stamp-100'});
 assert.equal(claimed.ok,true);assert.equal(claimed.grants[0].itemId,rewards[0].itemId);
 assert.deepEqual((await handler({action:'status'})).pending,[1]);
});
