const test=require('node:test'),assert=require('node:assert/strict');
test('missing-model quick entry opens the requested filter and supports in-place model search',async()=>{
 let page;global.Page=p=>page=p;require('../miniprogram/pages/data-check/index');page.setData=function(d){Object.assign(this.data,d)};
 page.onLoad({filter:'missing',history:'1'});assert.equal(page.data.qualityFilter,'missing');assert.equal(page.historyOnly,true);
 page.data.rows=[{_id:'r',aircraft:''}];page.localKey='owner';page.startModel({currentTarget:{dataset:{id:'r'}}});assert.equal(page.data.modelTarget,'r');
 page.modelInput({detail:{value:'波音737'}});assert(page.data.modelSuggestions.some(m=>m.id==='b737-800'));
 page.pickModel({currentTarget:{dataset:{value:'BOEING 737-800'}}});assert.equal(page.data.modelQuery,'BOEING 737-800');assert.equal(page.data.modelSuggestions.length,0);
 page.cancelModel();assert.equal(page.data.modelTarget,null);await page.saveModel();assert.match(page.data.modelError,/请输入/);delete global.Page;
});
