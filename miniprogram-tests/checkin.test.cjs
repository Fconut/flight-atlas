const test=require('node:test'),assert=require('node:assert/strict');
const baseDomain=require('../cloudfunctions/atlas-checkin/domain');
// Retain the pre-stamp client contract as a backwards-compatibility suite.
const domain={...baseDomain,milestones:baseDomain.milestones.filter(d=>(d-1)%7===0),view:(r,t)=>baseDomain.view(r,t,false),change:(r,a,e,t,o)=>baseDomain.change(r,a,e,t,o,false)};
const rewards=require('../cloudfunctions/atlas-checkin/rewards.json').rewards;
const owner='test-owner';
test('56 unique rewards exclude the four free palettes and milestones are 1,8,15 without an annual reset',()=>{
 const catalog=require('../miniprogram/lib/collection-catalog');
 assert.equal(rewards.length,56);assert.equal(new Set(rewards.map(r=>r.id)).size,56);
 assert(rewards.every(r=>catalog.items.some(p=>p.id===r.itemId&&!p.free)));
 assert.deepEqual(domain.milestones.slice(0,4),[1,8,15,22]);assert.equal(domain.milestones.at(-1),386);
 assert.equal(domain.day(Date.parse('2026-12-31T16:00:00Z')),'2027-01-01');
 let record={version:1,owner,days:6,lastDay:'2026-12-25',grants:[]};
 record=domain.change(record,'sign',{},'2027-01-01',owner).record;
 assert.equal(record.days,7);assert.deepEqual(domain.view(record,'2027-01-01').pending,[1]);
 assert.equal(domain.change(record,'sign',{days:100},'2027-01-01',owner).changed,false);
});
test('reward claim is idempotent by milestone and cannot claim duplicates or unearned rewards',()=>{
 let record={version:1,owner,days:8,lastDay:'2026-11-16',grants:[]};
 record=domain.change(record,'claim',{milestone:1,rewardId:rewards[0].id},'2026-11-16',owner).record;
 assert.equal(record.grants.length,1);
 assert.equal(domain.change(record,'claim',{milestone:1,rewardId:rewards[1].id},'2026-11-16',owner).changed,false);
 const second=domain.change(record,'claim',{milestone:8,rewardId:rewards[55].id},'2026-11-16',owner).record; assert.equal(second.grants[1].rewardId,rewards[1].id); assert.deepEqual(domain.view(record,'2026-11-16').pendingRewards.map(r=>r.id),[rewards[1].id]);
 assert.throws(()=>domain.change(record,'claim',{milestone:15,rewardId:rewards[1].id},'2026-11-16',owner),/NO_REWARD/);
 assert.throws(()=>domain.change(record,'sign',{},'2026-11-16','other'),/INVALID_STATE/);
});
test('service derives ownership from cloud identity, transacts mutations and never trusts client day or user',async()=>{
 const {createHandler}=require('../cloudfunctions/atlas-checkin/service');let saved,transactions=0,writes=0;
 const ref={async get(){return {data:saved?{...saved,_id:'server-document-id'}:null}},async set({data}){saved=data;writes++}};
 const db={collection:()=>({doc:()=>ref}),async runTransaction(fn){transactions++;return fn(this)}};
 const handler=createHandler({identity:()=>({APPID:'wx31f3f3739a7a1743',OPENID:'test-openid-123'}),database:()=>db,enabled:()=>true,now:()=>Date.parse('2026-11-16T01:00:00Z')});
 const first=await handler({action:'sign',today:'2099-01-01',days:999,userId:'other'});
 assert.equal(first.days,1);assert.equal(first.today,'2026-11-16');assert.equal(first.userId.length,64);
 await handler({action:'sign'});assert.equal(writes,1);assert.equal(transactions,2);
 const claim=await handler({action:'claim',milestone:1,rewardId:rewards[0].id});assert.equal(claim.grants.length,1);
 await handler({action:'claim',milestone:1,rewardId:rewards[0].id});assert.equal(writes,2);
 const disabled=createHandler({identity:()=>({APPID:'wx31f3f3739a7a1743',OPENID:'test-openid-123'}),database:()=>{throw Error('must not access')},enabled:()=>false});
 assert.equal((await disabled({action:'sign'})).code,'SETUP_REQUIRED');
});

test('legacy rewards remain owned and subsequent fixed rewards never duplicate them',()=>{let record={version:1,owner,days:386,lastDay:'2026-11-16',grants:[{day:1,rewardId:rewards[5].id,type:'palette',itemId:rewards[5].itemId}]};const plan=domain.view(record,'2026-11-16').pendingRewards;assert.equal(plan.length,55);for(const reward of plan){record=domain.change(record,'claim',{milestone:reward.day,rewardId:'forged'},'2026-11-16',owner).record;assert.equal(record.grants.at(-1).rewardId,reward.id)}assert.equal(new Set(record.grants.map(g=>g.rewardId)).size,56);});

test('earned day rewards can be claimed in any order without changing other assigned rewards',()=>{let record={version:1,owner,days:15,lastDay:'2026-11-16',grants:[]};const before=domain.view(record,'2026-11-16').pendingRewards;record=domain.change(record,'claim',{milestone:15},'2026-11-16',owner).record;assert.equal(record.grants[0].rewardId,before[2].id);assert.deepEqual(domain.view(record,'2026-11-16').pendingRewards,before.slice(0,2));});

test('shuffled reward schedule matches client and separates neighboring series',()=>{const catalog=require('../miniprogram/lib/collection-catalog');const client=require('../miniprogram/lib/checkin-rewards');assert.deepEqual(client,rewards.map((r,i)=>({itemId:r.itemId,day:domain.milestones[i]})));const series=rewards.map(r=>catalog.items.find(p=>p.id===r.itemId).seriesId);assert(series.every((id,i)=>!i||id!==series[i-1]));});

test('opening rewards balance series and light backgrounds',()=>{const catalog=require('../miniprogram/lib/collection-catalog');const opening=rewards.slice(0,5).map(r=>catalog.items.find(p=>p.id===r.itemId));assert.equal(new Set(opening.map(p=>p.seriesId)).size,5);assert.equal(new Set(rewards.slice(0,10).map(r=>catalog.items.find(p=>p.id===r.itemId).seriesId)).size,10);const lights=opening.filter(p=>parseInt(p.colors.background.slice(1,3),16)>190);assert.equal(lights.length,2);});

