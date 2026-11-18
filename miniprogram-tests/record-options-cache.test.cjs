const test=require('node:test'),assert=require('node:assert/strict'),create=require('../miniprogram/pages/index/logic/create-page');
test('search and pagination reuse filter options while record or account changes rebuild them',()=>{
 const p=create('records'),updates=[];p.localKey='A';p.setData=function(v){updates.push(v);Object.assign(this.data,v)};
 p.data.rows=[{_id:'1',date:'2025-01-01',from:'SHA',to:'PEK',airline:'CA',flight:'1',aircraft:'B738'}];
 p.applyFilters();const first=p.recordOptionsCache;assert(updates.at(-1).filterOptions);
 p.data.search='SHA';p.applyFilters();assert.equal(p.recordOptionsCache,first);assert.equal(updates.at(-1).filterOptions,undefined);assert.equal(p.data.matchCount,1);
 p.data.rows=[...p.data.rows,{_id:'2',date:'2024-01-01',from:'SHA',to:'NRT',airline:'MU',flight:'2',aircraft:'A320'}];p.applyFilters();assert.notEqual(p.recordOptionsCache,first);assert(updates.at(-1).filterOptions);
 const second=p.recordOptionsCache;p.localKey='B';p.applyFilters();assert.notEqual(p.recordOptionsCache,second);
});
