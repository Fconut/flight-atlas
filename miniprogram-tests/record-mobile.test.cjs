const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = '../miniprogram/';
const create = require(base + 'pages/index/logic/create-page');
const identity = require(base + 'lib/record-model').identity;
const sample = (flight = '1') => ({ date: '2025-01-01', from: 'SHA', to: 'NRT', airline: 'MU', flight, aircraft: 'Airbus A320' });
function setup() {
  const storage = {}, events = [];
  global.wx = {
    getStorageSync: key => storage[key],
    setStorageSync: (key,value) => { storage[key] = JSON.parse(JSON.stringify(value)); },
    nextTick() {}, setNavigationBarTitle() {},
    enableAlertBeforeUnload: () => events.push('dirty'),
    disableAlertBeforeUnload: () => events.push('clean'),
    navigateBack: o => { events.push('back'); o?.success?.(); },
    navigateTo: o => events.push(o.url),
    showToast() {}, showModal: o => o.success({ confirm: false })
  };
  const attach = page => {
    page.setData = function(values) {
      for (const [key,value] of Object.entries(JSON.parse(JSON.stringify(values)))) {
        const keys=key.split('.'); let target=this.data;
        for (const part of keys.slice(0,-1)) target=target[part] ??= {};
        target[keys.at(-1)]=value;
      }
    };
    return page;
  };
  const records=attach(create('records')); records.localKey='atlas-mini-guest';
  const editor = () => {
    let page; global.Page = p => page=p;
    delete require.cache[require.resolve(base+'pages/flight-edit/index')];
    require(base+'pages/flight-edit/index');
    const initialized=attach(page), originalRestore=initialized.restoreSession;
    initialized.restoreSession=async function(){
      const facade=require(base+'pages/index/logic/cloud'), original=facade.restoreSession;
      facade.restoreSession=async function(){await this.switchAccount(null);return true;};
      try{return await originalRestore.call(this);}finally{facade.restoreSession=original;}
    };
    return initialized;
  };
  return { storage, events, records, editor };
}

test('mixed import saves selected new rows and updates only; reimporting them performs no storage write',async()=>{
 const {records:p}=setup(),bridge=require(base+'lib/confirm-import');p.load([sample('1'),sample('2')]);
 let handler,selection='mixed',writes=0;
 const originalWrite=wx.setStorageSync;wx.setStorageSync=(...args)=>{writes++;originalWrite(...args)};
 wx.navigateTo=o=>{
  if(o.events?.flightsImported){handler=o.events.flightsImported;o.success?.({eventChannel:{emit(){}}});return;}
  const token=o.url.split('token=')[1],r=bridge.readReview(token);
  const ids=selection==='mixed'?[r.groups.added.find(x=>x.flight.endsWith('3')).reviewId,r.groups.updated.find(x=>x.flight.endsWith('1')).reviewId]:[];
  bridge.decideReview(token,ids);
 };
 p.openImportReview();
 const incoming=[{...sample('1'),aircraft:'Airbus A321'},sample('2'),sample('3'),sample('4'),sample('3')];
 await handler({rows:incoming,name:'synthetic.xlsx'});
 assert.equal(p.data.rows.length,3);assert.equal(p.data.rows.find(r=>r.flight==='1').aircraft,'Airbus A321');assert(!p.data.rows.some(r=>r.flight==='4'));
 const after=writes;selection='duplicate';await handler({rows:p.data.rows.map(r=>({...r})),name:'repeat.xlsx'});assert.equal(writes,after);assert.equal(p.data.rows.length,3);assert.equal(p.reviewingImport,false);
});

test('changed records during review block saving the previously selected import',async()=>{
 const {records:p}=setup(),bridge=require(base+'lib/confirm-import');p.load([sample('1')]);let handler;
 wx.navigateTo=o=>{
  if(o.events?.flightsImported){handler=o.events.flightsImported;o.success?.({eventChannel:{emit(){}}});return;}
  p.load([sample('1'),sample('9')]);bridge.decideReview(o.url.split('token=')[1],[0]);
 };
 p.openImportReview();await handler({rows:[sample('2')],name:'synthetic.xlsx'});
 assert.deepEqual(p.data.rows.map(r=>r.flight),['1','9']);assert.match(p.data.error,/记录已变化/);assert.equal(p.reviewingImport,false);
});
test('filter drafts cancel safely; confirming and clearing chips retain the search query', () => {
  const {records:p}=setup();p.load([sample(),{...sample('2'),airline:'CA'}]);
  p.search({detail:{value:'SHA'}});p.openRecordFilters();
  const index=p.data.filterKeys.airline.indexOf('MU');
  p.draftFilter({currentTarget:{dataset:{key:'airline'}},detail:{value:index}});
  p.closeRecordFilters();assert.equal(p.data.matchCount,2);assert(!p.data.filters.airline);
  p.openRecordFilters();p.draftFilter({currentTarget:{dataset:{key:'airline'}},detail:{value:index}});
  p.applyRecordFilters();assert.equal(p.data.matchCount,1);assert.equal(p.data.activeFilterCount,1);
  p.openRecordFilters();assert.equal(p.data.draftFilterIndices.airline,index);
  p.resetDraftFilters();p.closeRecordFilters();assert.equal(p.data.matchCount,1);
  p.removeRecordFilter({currentTarget:{dataset:{key:'airline'}}});
  assert.equal(p.data.matchCount,2);assert.equal(p.data.search,'SHA');assert.equal(p.data.activeFilterCount,0);
});
test('editor saves the selected identity and returning list retains pagination and filters', async () => {
  const {records:p,editor,storage,events}=setup(),cloud=require(base+'lib/cloud'),original=cloud.current;
  cloud.current=async()=>null;
  try {
    p.load(Array.from({length:25},(_,i)=>sample(String(i))));
    p.setData({pageNumber:2,filters:{airline:'MU'},search:'SHA'});p.applyFilters();
    const selected=p.data.visibleRows[0];p.editFlightPage({currentTarget:{dataset:{index:0}}});
    assert(events.at(-1).includes('/pages/flight-edit/index?identity='));
    const e=editor();e.onLoad({identity:encodeURIComponent(identity(selected))});await e.restoreSession();e.data.initializing=false;
    e.field({currentTarget:{dataset:{key:'aircraft'}},detail:{value:'Airbus A350-900'}});
    assert(e.data.editorDirty);e.save();assert(events.includes('back'));
    assert.equal(storage['atlas-mini-guest-state'].rows.length,25);
    assert.equal(storage['atlas-mini-guest-state'].rows.find(r=>identity(r)===identity(selected)).aircraft,'Airbus A350-900');
    await p.syncTabState();assert.equal(p.data.pageNumber,2);assert.equal(p.data.filters.airline,'MU');assert.equal(p.data.search,'SHA');
  } finally {cloud.current=original;}
});
test('editor preserves a dirty form after airport search and accepts unrelated background additions', async () => {
  const {records:p,editor,events,storage}=setup(),cloud=require(base+'lib/cloud'),original=cloud.current;
  cloud.current=async()=>null;
  try {
    p.load([sample()]);const e=editor();e.onLoad({});await e.restoreSession();e.data.initializing=false;
    e.setData({'form.from':'PEK'});e.onShow();assert.equal(e.data.form.from,'PEK');assert(e.data.editorDirty);
    e.cancel();assert(!events.includes('back'));
    e.setData({'form.to':'NRT','form.airline':'MU','form.flight':'3'});
    p.load([sample(),sample('2')]);e.save();assert(!e.data.editorStale);assert.equal(storage['atlas-mini-guest-state'].rows.length,3);
  } finally {cloud.current=original;}
});
test('editor will not overwrite a flight changed by a background update',async()=>{
 const {records:p,editor,storage}=setup();p.load([sample()]);
 const e=editor();e.onLoad({identity:encodeURIComponent(identity(p.data.rows[0]))});await e.restoreSession();e.data.initializing=false;
 e.field({currentTarget:{dataset:{key:'aircraft'}},detail:{value:'Boeing 777'}});
 p.load([{...p.data.rows[0],aircraft:'Airbus A350-900'}]);e.save();
 assert(e.data.editorStale);assert.equal(storage['atlas-mini-guest-state'].rows[0].aircraft,'Airbus A350-900');
});
test('an unsaved new flight follows the one-time automatic move into its WeChat account',async()=>{
 const {records:p,editor,storage}=setup();p.load([sample()]);const e=editor();e.onLoad({});await e.restoreSession();e.data.initializing=false;
 e.setData({'form.from':'PEK','form.to':'NRT','form.airline':'MU','form.flight':'3'});
 const config=require(base+'lib/cloud-config'),session={provider:'wechat-cloudbase',env:config.env,user:{id:'a'.repeat(64)}};
 const scope=require(base+'lib/account-state').scopeFor(session);
 storage['atlas-mini-wechat-session']=session;storage[scope+'-state']={version:1,rows:p.data.rows,prefs:{}};
 storage['atlas-mini-auto-migrated-sources']={'atlas-mini-guest':scope};
 e.save();assert(!e.data.editorStale);assert.equal(storage[scope+'-state'].rows.length,2);assert.equal(storage['atlas-mini-guest-state'].rows.length,1);
});
test('all editor includes have balanced markup and bind to real page methods', () => {
  const {editor}=setup(),page=editor();
  const read=file=>fs.readFileSync(file,'utf8').replace(/<include src="([^"]+)"\s*\/>/g,(_,src)=>read(path.resolve(path.dirname(file),src)));
  const markup=read(path.join(__dirname,base,'pages/flight-edit/index.wxml')).replace(/{{[\s\S]*?}}/g,'VALUE');
  const stack=[];
  for(const match of markup.matchAll(/<\/?([\w-]+)\b[^>]*>/g)) {
    if(match[0].startsWith('</'))assert.equal(stack.pop(),match[1]);
    else if(!match[0].endsWith('/>'))stack.push(match[1]);
  }
  assert.deepEqual(stack,[]);
  for(const match of markup.matchAll(/(?:bind|catch)\w+="([\w]+)"/g))assert.equal(typeof page[match[1]],'function',match[1]);
});
test('editor accepts already-decoded identities with percent signs and blocks failed storage checks', async () => {
  const {records:p,editor,storage}=setup(),cloud=require(base+'lib/cloud'),original=cloud.current;
  cloud.current=async()=>null;
  try {
    p.load([sample('%41')]);const saved=JSON.stringify(storage['atlas-mini-guest-state']);
    const e=editor();e.onLoad({identity:identity(p.data.rows[0])});await e.restoreSession();e.data.initializing=false;
    assert.equal(e.data.form.flight,'%41');assert(e.data.editing);
    global.wx.getStorageSync=()=>{throw Error('storage unavailable');};e.save();
    assert(e.data.editorStale.includes('无法核对'));assert.equal(JSON.stringify(storage['atlas-mini-guest-state']),saved);
  }finally{cloud.current=original;}
});
test('an import finishing during automatic sign-in follows the same-user migration',async()=>{
 const {records:p,storage}=setup();p.load([sample()]);let imported;
 wx.navigateTo=options=>{if(options.events?.flightsImported) imported=options.events.flightsImported; else require(base+'lib/confirm-import').decideReview(options.url.split('token=')[1],[0]);};wx.showModal=()=>{};p.openImportReview();
 const config=require(base+'lib/cloud-config'),session={provider:'wechat-cloudbase',env:config.env,user:{id:'a'.repeat(64)}};
 const scope=require(base+'lib/account-state').scopeFor(session);
 storage[scope+'-state']={version:1,rows:p.data.rows,prefs:{}};
 storage['atlas-mini-auto-migrated-sources']={'atlas-mini-guest':scope};
 await p.switchAccount(session);await imported({rows:[sample('2')],name:'flights.csv'});
 assert.equal(storage[scope+'-state'].rows.length,2);assert.equal(storage['atlas-mini-guest-state'].rows.length,1);assert.equal(p.data.error,'');
});

test('inline airport and model selections participate in unsaved-change protection',async()=>{
 const h=setup(),p=h.editor();p.onLoad({});await p.restoreSession();
 p.inlineAirportChange({currentTarget:{dataset:{key:'from'}},detail:{code:'SHA'}});assert(h.events.includes('dirty'));
 p.originalForm=JSON.stringify(p.data.form);p.updateDirty();h.events.length=0;
 p.chooseInlineSuggestion({currentTarget:{dataset:{key:'aircraft',value:'BOEING 737-800'}}});assert(h.events.includes('dirty'));
});
