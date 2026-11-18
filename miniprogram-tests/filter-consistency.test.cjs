const test=require('node:test'),assert=require('node:assert/strict');
const create=require('../miniprogram/pages/index/logic/create-page');
test('empty-result reset clears search and all list conditions without touching map preferences',()=>{
 global.wx={getStorageSync:()=>null,setStorageSync(){},nextTick(){}};
 const page=create('records');page.setData=function(values){Object.assign(this.data,values)};
 page.data.search='not-found';page.data.filters={airline:'MU'};page.data.statusIndex=2;page.data.pageNumber=4;page.data.future=true;
 let applied=0;page.applyFilters=()=>applied++;page.clearRecordConditions();
 assert.equal(page.data.search,'');assert.deepEqual(page.data.filters,{});assert.equal(page.data.statusIndex,0);assert.equal(page.data.pageNumber,1);assert.equal(page.data.future,true);assert.equal(applied,1);delete global.wx;
});
test('aircraft filters group aliases, preserve generations and keep raw records unchanged',()=>{
 const filters=require('../miniprogram/lib/record-filters');
 const models=['B738','738','波音737-800','B38M','E190','E290','Custom Jet','Other Jet',''];
 const rows=models.map((aircraft,i)=>({_id:'model'+i,date:'2025-01-01',from:'SHA',to:'PEK',aircraft,flight:String(i+1)}));const original=JSON.stringify(rows);
 const options=filters.aircraftOptions(rows);assert.equal(options.length,8);assert.equal(options[1].value,'b737-800');assert.equal(options[1].count,3);assert.match(options[1].label,/BOEING 737-800 · 3 次/);
 assert(options.some(o=>o.value==='b737-max8'));assert(options.some(o=>o.value==='e190'));assert(options.some(o=>o.value==='e190-e2'));assert(options.some(o=>o.label.includes('Custom Jet')));assert(options.some(o=>o.label.includes('未填写机型')));
 global.wx={getStorageSync:()=>null,setStorageSync(){},nextTick(){}};
 const page=create('records');page.setData=function(v){Object.assign(this.data,v)};page.localKey='guest';page.load(rows,false);
 page.data.filters={aircraft:'B738'};page.applyFilters();assert.equal(page.data.filters.aircraft,'b737-800');assert.equal(page.data.matchCount,3);assert.equal(page.data.filterIndices.aircraft,1);assert.match(page.data.activeFilters.find(v=>v.key==='aircraft').label,/BOEING 737-800/);
 page.data.filters={aircraft:'e190-e2'};page.applyFilters();assert.equal(page.data.matchCount,1);assert.equal(page.filtered[0].aircraft,'E290');
 page.data.filters={aircraft:filters.aircraftKey({aircraft:'Custom Jet'})};page.applyFilters();assert.equal(page.data.matchCount,1);assert.equal(page.filtered[0].aircraft,'Custom Jet');
 assert.equal(JSON.stringify(rows),original);delete global.wx;
});
test('record search connects model aliases, airline names and airport names without rewriting rows',()=>{
 const search=require('../miniprogram/lib/record-search');
 const rows=[{_id:'one',date:'2025-01-02',from:'SHA',to:'PEK',airline:'CES',flight:'1234',aircraft:'B738'},{_id:'two',date:'2025-02-03',from:'NRT',to:'KIX',airline:'CA',flight:'5678',aircraft:'B38M'},{_id:'three',date:'2025-03-04',from:'SHA',to:'NRT',airline:'MU',flight:'99',aircraft:'Custom Jet'}];const before=JSON.stringify(rows),index=search.buildIndex(rows);
 const ids=q=>index.map((entry,i)=>search.matcher(q)(entry)?rows[i]._id:null).filter(Boolean);
 for(const q of ['波音737-800','Ｂ７３８','738','Boeing 737 800','中国东方航空','东航','CES','MU','上海虹桥','SHA','1234','2025-01-02'])assert(ids(q).includes('one'),q);
 assert.deepEqual(ids('7M8'),['two']);assert.deepEqual(ids('B738'),['one']);assert.deepEqual(ids('Custom Jet'),['three']);assert.deepEqual(ids(''),['one','two','three']);assert.deepEqual(ids('not found'),[]);assert.equal(JSON.stringify(rows),before);
 global.wx={getStorageSync:()=>null,setStorageSync(){},nextTick(){}};const page=create('records');page.setData=function(v){Object.assign(this.data,v)};page.localKey='guest';page.load(rows,false);const cached=page.recordSearchCache;
 page.data.search='东航';page.applyFilters();assert.equal(page.data.matchCount,2);assert.equal(page.recordSearchCache,cached);
 page.data.filters={aircraft:'b737-800'};page.applyFilters();assert.equal(page.data.matchCount,1);
 page.localKey='another';page.applyFilters();assert.notEqual(page.recordSearchCache,cached);delete global.wx;
});
test('search ignores internal metadata and year options retain descending order',()=>{
 const search=require('../miniprogram/lib/record-search'),filters=require('../miniprogram/lib/record-filters');
 const entry=search.buildIndex([{_id:'secret-identity',date:'2025-01-01',from:'SHA',to:'PEK',aircraft:'B738',syncToken:'private-marker',canceled:true}])[0];
 for(const q of ['secret-identity','private-marker','true'])assert.equal(search.matcher(q)(entry),false,q);
 assert(search.matcher('B738')(entry));assert.deepEqual(filters.yearOptions([{date:'2024-01-01'},{date:'2026-01-01'},{date:'2024-03-01'},{date:'2025-01-01'}]).map(o=>o.value),['','2026','2025','2024']);
});
