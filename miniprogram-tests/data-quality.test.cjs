const test=require('node:test'),assert=require('node:assert/strict');
const {scan}=require('../miniprogram/lib/data-quality');
const row=(id,patch={})=>({_id:id,date:'2026-10-25',from:'SHA',to:'NRT',airline:'MU',flight:'5358',aircraft:'Airbus A320',departureTime:'20:30',...patch});
test('quality checks are read-only and normal future journeys are valid',()=>{
 const rows=[Object.freeze(row('a',{date:'2035-01-01'})),Object.freeze(row('b',{date:'2026-10-24',airline:'CES'}))];Object.freeze(rows);
 const before=JSON.stringify(rows);const result=scan(rows);assert.equal(result.total,0);assert.equal(result.checked,2);assert.equal(JSON.stringify(rows),before);
});
test('date airport and time problems are counted once per affected record, before optional model gaps',()=>{
 const result=scan([row('model',{flight:'1',aircraft:''}),row('bad',{date:'2026-02-30',from:'ZZZ',departureTime:'25:00',aircraft:''})]);
 assert.equal(result.total,2);assert.equal(result.errors,1);assert.equal(result.missing,2);assert.equal(result.items[0].id,'bad');assert.equal(result.items[0].errors.length,3);
 assert.equal(scan([row('same',{from:'SHA',to:'SHA'})]).errors,1);
});
test('suspected duplicates normalize airline aliases and prefixed flight numbers, while different complete flights remain distinct',()=>{
 let result=scan([row('a'),row('b',{airline:'CES',flight:'MU5358'})]);
 assert.equal(result.duplicates,2);assert(result.items.every(item=>item.duplicateNotes[0].includes('同一起降方向')));
 result=scan([row('a'),row('b',{flight:'5359'})]);assert.equal(result.duplicates,0);
 result=scan([row('a'),row('b',{flight:'',airline:''})]);assert.equal(result.duplicates,2);
 result=scan([row('a'),row('b',{date:'2026-10-24',flight:''})]);assert.equal(result.duplicates,0);
});
test('connecting segments and reverse directions with the same flight number are not duplicate warnings',()=>{
 const result=scan([row('a'),row('b',{from:'NRT',to:'KIX'}),row('c',{from:'NRT',to:'SHA'})]);
 assert.equal(result.duplicates,0);assert.equal(result.total,0);
});
test('canceled records are excluded and non-empty unknown aircraft names are retained',()=>{
 assert.equal(scan([row('a',{canceled:'true',date:'',aircraft:''})]).total,0);
 assert.equal(scan([row('b',{aircraft:'新机型（待确认）'})]).missing,0);
});
function setup(){
 const storage={},events=[];let page;global.Page=value=>page=value;global.wx={getStorageSync:key=>storage[key],setStorageSync:(key,value)=>storage[key]=structuredClone(value),removeStorageSync:key=>delete storage[key],nextTick(){},navigateTo:options=>events.push(options.url),showModal:options=>events.push(options),pageScrollTo(){}};
 delete require.cache[require.resolve('../miniprogram/pages/data-check/index')];require('../miniprogram/pages/data-check/index');page.setData=function(values){Object.assign(this.data,values)};page.localKey='guest';return{page,storage,events};
}
test('quality page edits the selected identity and refreshes counts after fixes without clearing the active category',()=>{
 const {page,events}=setup();page.load([row('a',{aircraft:''})],false);assert.equal(page.data.qualityTotal,1);
 page.selectQualityFilter({currentTarget:{dataset:{key:'missing'}}});page.editQualityFlight({currentTarget:{dataset:{id:'a'}}});assert(events[0].startsWith('/pages/flight-edit/index?identity='));
 page.load([row('a')],false);assert.equal(page.data.qualityTotal,0);assert.equal(page.data.qualityFilter,'missing');assert.equal(page.data.qualityItems.length,0);
});
test('quality entry updates on records pages and large reports are paged',()=>{
 const {page}=setup();page.load(Array.from({length:45},(_,i)=>row('row'+i,{flight:String(i+1),aircraft:''})),false);
 assert.equal(page.data.qualityItems.length,20);assert.equal(page.data.qualityPages,3);page.turnQualityPage({currentTarget:{dataset:{step:1}}});assert.equal(page.data.qualityPage,2);
 const records=require('../miniprogram/pages/index/logic/create-page')('records');records.setData=function(v){Object.assign(this.data,v)};records.localKey='guest';records.load([row('a',{aircraft:''})],false);assert.equal(records.data.qualityCount,1);
});
test('suspected duplicate deletion requires confirmation, supports undo, and blocks changed records',async()=>{
 const {page,events}=setup();const rows=[row('a'),row('b',{airline:'CA',flight:''})];page.load(rows);page.syncTabState=async()=>{};
 page.deleteQualityFlight({currentTarget:{dataset:{id:'a'}}});assert.equal(page.data.rows.length,2);await events[0].success({confirm:false});assert.equal(page.data.rows.length,2);
 page.deleteQualityFlight({currentTarget:{dataset:{id:'a'}}});await events[1].success({confirm:true});assert.equal(page.data.rows.length,1);assert.equal(page.data.canUndo,true);page.undoRemove();assert.equal(page.data.rows.length,2);
 page.deleteQualityFlight({currentTarget:{dataset:{id:'a'}}});const prompt=events[2];page.data.rows.find(r=>r._id==='a').aircraft='Boeing 737-800';await prompt.success({confirm:true});assert.equal(page.data.rows.length,2);assert.match(page.data.error,/记录已更新/);
});

test('quality deletion leaves unreadable storage and switched-account records untouched',async()=>{
 const {page,storage,events}=setup();page.load([row('a'),row('b',{flight:''})]);page.syncTabState=async()=>{};
 page.deleteQualityFlight({currentTarget:{dataset:{id:'a'}}});storage['guest-state']={version:99};await events[0].success({confirm:true});assert.equal(page.data.rows.length,2);assert.equal(storage['guest-state'].version,99);assert.match(page.data.error,/本次未删除/);
 page.deleteQualityFlight({currentTarget:{dataset:{id:'a'}}});page.localKey='other-user';await events[1].success({confirm:true});assert.equal(page.data.rows.length,2);
});
test('model review separates optional unmatched names from errors and artwork availability',()=>{
 const rows=[row('broad',{aircraft:'737'}),row('new',{aircraft:'B734',date:'2026-10-24'}),row('alias',{aircraft:'B789',date:'2026-10-23'}),row('unknown',{aircraft:'自定义机型',date:'2026-10-22'}),row('missing',{aircraft:'',date:'2026-10-21'})];
 const before=JSON.stringify(rows),report=scan(rows);assert.equal(report.errors,0);assert.equal(report.models,3);assert.equal(report.missing,1);
 assert.deepEqual(report.items.map(r=>r.id),['broad','unknown','missing']);assert.equal(JSON.stringify(rows),before);
 const {page}=setup();page.load(rows,false);page.selectQualityFilter({currentTarget:{dataset:{key:'missing'}}});assert.equal(page.data.qualityItems.length,3);
 assert.equal(page.data.qualityTabs.find(t=>t.key==='missing').label,'待完善机型');
 page.startModel({currentTarget:{dataset:{id:'broad'}}});assert.equal(page.data.modelBefore,'737');assert.equal(page.data.modelQuery,'737');assert(page.data.modelSuggestions.length);
 page.pickModel({currentTarget:{dataset:{value:'BOEING 737-800'}}});assert.equal(page.data.rows[0].aircraft,'737');page.cancelModel();assert.equal(page.data.rows[0].aircraft,'737');
 page.startModel({currentTarget:{dataset:{id:'new'}}});assert.equal(page.data.modelTarget,null);
});
