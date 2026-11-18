const test=require('node:test'),assert=require('node:assert/strict'),create=require('../miniprogram/pages/index/logic/create-page');
test('record status cache survives searches but invalidates on rows, date and account changes',()=>{
 global.wx={getStorageSync:()=>null,setStorageSync(){},nextTick(){}};
 const page=create('records');page.setData=function(d){Object.assign(this.data,d)};page.localKey='alice';page.data.rows=[{_id:'r',date:'2025-01-01',from:'SHA',to:'NRT',airline:'MU',flight:'1'}];
 page.applyFilters();const first=page.recordStatusCache;page.data.search='MU';page.applyFilters();assert.equal(page.recordStatusCache,first);
 page.data.rows=[...page.data.rows];page.applyFilters();assert.notEqual(page.recordStatusCache,first);
 const second=page.recordStatusCache;second.day='2000-01-01';page.applyFilters();assert.notEqual(page.recordStatusCache,second);
 const third=page.recordStatusCache;page.localKey='bob';page.applyFilters();assert.notEqual(page.recordStatusCache,third);delete global.wx;
});
