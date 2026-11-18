const test=require('node:test'),assert=require('node:assert/strict');
const create=require('../miniprogram/pages/index/logic/create-page');
const local=require('../miniprogram/lib/local-state');
const row=(id,airline='MU')=>({_id:id,date:'2026-10-25',from:'SHA',to:'NRT',airline,flight:id,aircraft:'Airbus A320'});
function setup(){
 const storage={},prompts=[];let failRecovery=false;
 global.wx={getStorageSync:key=>storage[key],setStorageSync:(key,value)=>{if(failRecovery&&key.endsWith('-recovery'))throw Error('无法保留副本');storage[key]=structuredClone(value)},showModal:options=>prompts.push(options),nextTick(){}};
 const page=create('records');page.setData=function(values){Object.assign(this.data,values)};page.localKey='guest';page.load([row('1'),row('2','CA')]);
 return{page,storage,prompts,setFailRecovery:()=>failRecovery=true};
}
test('bulk deletion describes all records rather than the filtered subset and cancellation is harmless',async()=>{
 const {page,prompts}=setup();page.setData({filters:{airline:'MU'}});page.applyFilters();assert.equal(page.data.matchCount,1);page.clearAll();
 assert.match(prompts[0].content,/2 条/);assert.match(prompts[0].content,/筛选外/);assert.equal(prompts[0].cancelText,'保留航班');await prompts[0].success({confirm:false});assert.equal(page.data.rows.length,2);
});
test('newly synchronized rows invalidate bulk-delete confirmation',async()=>{
 const {page,prompts,storage}=setup();page.clearAll();local.write('guest',[...page.data.rows,row('3')],page.preferences(),'remote');
 page.syncTabState=async()=>page.load(local.read('guest').rows,false);
 await prompts[0].success({confirm:true});assert.equal(page.data.rows.length,3);assert.equal(storage['guest-state'].rows.length,3);assert.match(page.data.error,/本次未删除/);
});
test('bulk deletion preserves the recovery snapshot and fails closed if it cannot be saved',async()=>{
 const first=setup();first.setFailRecovery();await complete(first);assert.equal(first.page.data.rows.length,2);
 const second=setup();await complete(second);assert.equal(second.page.data.rows.length,0);assert.equal(require('../miniprogram/lib/backup').rows(second.storage['guest-recovery']).length,2);
});

async function complete(h){h.page.clearAll();await h.prompts[0].success({confirm:true});h.page.clearAllTextChanged({detail:{value:'全部删除'}});await h.page.confirmClearAllText();assert.equal(h.page.data.rows.length,2);await h.prompts[1].success({confirm:true});}
test('bulk delete requires the exact phrase and all three confirmations',async()=>{
 const h=setup();h.page.clearAll();assert.equal(h.page.data.rows.length,2);await h.prompts[0].success({confirm:true});assert.equal(h.page.data.clearAllOpen,true);assert.equal(h.page.data.clearAllText,'');
 for(const value of ['删除全部','全部删',' 全部删除','全部删除 ']){h.page.clearAllTextChanged({detail:{value}});await h.page.confirmClearAllText();assert.equal(h.prompts.length,1);assert.equal(h.page.data.rows.length,2)}
 h.page.clearAllTextChanged({detail:{value:'全部删除'}});await h.page.confirmClearAllText();assert.equal(h.prompts.length,2);assert.equal(h.page.data.rows.length,2);assert.match(h.prompts[1].title,/3\/3/);await h.prompts[1].success({confirm:true});assert.equal(h.page.data.rows.length,0);
});
test('canceling the text step or final confirmation clears typed consent and leaves flights intact',async()=>{
 const h=setup();h.page.clearAll();await h.prompts[0].success({confirm:true});h.page.clearAllTextChanged({detail:{value:'全部删除'}});h.page.cancelClearAll();assert.equal(h.page.data.clearAllText,'');assert.equal(h.page.data.rows.length,2);
 h.page.clearAll();await h.prompts[1].success({confirm:true});h.page.clearAllTextChanged({detail:{value:'全部删除'}});await h.page.confirmClearAllText();await h.prompts[2].success({confirm:false});assert.equal(h.page.data.rows.length,2);assert.equal(h.page.data.clearAllOpen,false);assert.equal(h.page.clearAllContext,null);
});
test('leaving the page or receiving an update after typing invalidates the deletion flow',async()=>{
 const h=setup();h.page.clearAll();await h.prompts[0].success({confirm:true});h.page.clearAllTextChanged({detail:{value:'全部删除'}});await h.page.confirmClearAllText();h.page.onHide();await h.prompts[1].success({confirm:true});assert.equal(h.page.data.rows.length,2);
 const second=setup();second.page.clearAll();await second.prompts[0].success({confirm:true});second.page.clearAllTextChanged({detail:{value:'全部删除'}});await second.page.confirmClearAllText();local.write('guest',[...second.page.data.rows,row('3')],second.page.preferences(),'remote');second.page.syncTabState=async()=>second.page.load(local.read('guest').rows,false);await second.prompts[1].success({confirm:true});assert.equal(second.page.data.rows.length,3);assert.equal(second.page.data.clearAllText,'');
});
