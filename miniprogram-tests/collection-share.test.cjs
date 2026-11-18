const test=require('node:test'),assert=require('node:assert/strict');
const {buildCollectionSnapshot}=require('../miniprogram/lib/collection-share');
test('collection shares expose unlocked badges and maker totals without flight details',()=>{
 const rows=[{date:'2024-01-01',from:'SHA',to:'PEK',aircraft:'BOEING 737-800',flight:'SECRET123'}, {date:'2024-01-02',from:'PEK',to:'SHA',aircraft:'AIRBUS A320'}, {date:'2024-01-03',from:'SHA',to:'PEK',aircraft:'BOEING 737-800'}, {date:'2099-01-01',from:'SHA',to:'PEK',aircraft:'AIRBUS A380-800'}, {date:'2024-01-04',from:'SHA',to:'PEK',aircraft:'AIRBUS A380-800',canceled:true}];
 const before=JSON.stringify(rows),s=buildCollectionSnapshot({rows},'2026-11-07');
 assert.equal(s.kind,'collection');assert.equal(s.badges.length,2);assert.equal(s.badges[0].id,'b737-800');assert.equal(s.summary.flights,3);
 assert.deepEqual(s.summary.makers.map(m=>m.count),[2,1,0]);assert.equal(s.summary.types,2);
 for(const secret of ['SECRET123','2024-01-01','2099','SHA','PEK','rows','first'])assert(!JSON.stringify(s).includes(secret));
 assert.equal(JSON.stringify(rows),before);assert.throws(()=>buildCollectionSnapshot({rows:[]},'2026-11-07'));
 assert.deepEqual(buildCollectionSnapshot({sheets:[{rows}]},'2026-11-07'),s);
});
