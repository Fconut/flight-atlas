const test=require('node:test'),assert=require('node:assert/strict');
const calendar=require('../miniprogram/lib/checkin-calendar');
const plan=[1,7,14,21,28,35,42].map(day=>({day}));
test('claimed rewards and completed ordinary days disappear and future days fill thirty slots',()=>{
 assert.deepEqual(calendar(0,plan,[]),Array.from({length:30},(_,i)=>i+1));
 assert.deepEqual(calendar(1,plan,[{day:1}]),Array.from({length:30},(_,i)=>i+2));
 const pending=calendar(8,plan,[{day:1}]);assert.equal(pending.length,30);assert.equal(pending[0],7);assert.equal(pending[1],9);assert.equal(pending.at(-1),37);
 const claimed=calendar(8,plan,[{day:1},{day:7}]);assert.equal(claimed[0],9);assert.equal(claimed.at(-1),38);
 const old=calendar(50,plan,[]);assert.deepEqual(old.slice(0,7),[1,7,14,21,28,35,42]);assert.equal(old.length,30);assert.equal(new Set(old).size,30);
});
