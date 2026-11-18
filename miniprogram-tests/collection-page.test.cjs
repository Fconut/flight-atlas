const test=require('node:test'),assert=require('node:assert/strict');
const library=require('../miniprogram/lib/collection-library');
function setup(){
 const store=new Map();global.wx={getStorageSync:key=>store.get(key),setStorageSync:(key,value)=>store.set(key,value),showToast(){}};
 let definition;global.Page=value=>definition=value;
 const file=require.resolve('../miniprogram/pages/collection/palettes');delete require.cache[file];require(file);delete global.Page;
 const page={...definition,data:JSON.parse(JSON.stringify(definition.data)),setData(value){Object.assign(this.data,value)}};
 return {page,cleanup(){delete global.wx;delete require.cache[file];}};
}
test('series browsing and detail membership remain consistent without changing active colors',()=>{
 const {page,cleanup}=setup();
 try {
  page.refresh();assert.equal(page.data.series.length,10);assert.equal(page.data.items.length,0);
  page.onLoad({series:'deep-sea'});page.refresh();assert.equal(page.data.items.length,10);
  const item=library.catalog.items.find(x=>x.free&&!library.active(x));
  page.open({currentTarget:{dataset:{id:item.id}}});assert.equal(page.data.selected.previewPath,item.previewAsset.path);
  page.toggleIncluded();assert.equal(page.data.selected.included,false);assert.equal(library.active(item),false);
  page.close();assert.equal(page.data.selected,null);
  page.detailImageError({currentTarget:{dataset:{id:item.id}}});assert.equal(page.data.error,'');
  page.filter({currentTarget:{dataset:{filter:'owned'}}});assert.equal(page.data.series.length,0);assert.equal(page.data.seriesId,'deep-sea');
 }finally{cleanup();}
});
test('preview asset association survives a reordered catalog',()=>{
 const {cleanup}=setup();const reordered=library.catalog.items.slice().reverse();
 try{const state=library.snapshot();for(const item of reordered){const view=state.decorate(item);assert.equal(view.previewPackage,item.previewAsset.package);assert.equal(view.previewPath,item.previewAsset.path);}}
 finally{cleanup();}
});

test('series opens a native page stack layer and back preserves the parent filter',()=>{const {page,cleanup}=setup();try{let target,backs=0;wx.navigateTo=options=>{target=options};wx.navigateBack=()=>backs++;page.onLoad({filter:'owned'});page.series({currentTarget:{dataset:{id:'deep-sea'}}});assert.equal(target.url,'/pages/collection/palettes?series=deep-sea&filter=owned');assert.equal(page.data.seriesId,'');assert.equal(page.data.filter,'owned');let calls=0;wx.navigateTo=()=>calls++;page.series({currentTarget:{dataset:{id:'forest'}}});assert.equal(calls,0);target.complete();page.backToSeries();assert.equal(backs,1);page.onLoad({series:'invalid',filter:'invalid'});assert.equal(page.data.seriesId,'');assert.equal(page.data.filter,'all');}finally{cleanup()}});

test('unchanged collection refresh sends no list or image bindings to the view',()=>{const {page,cleanup}=setup();try{page.onLoad({series:'deep-sea'});page.refresh();let patches=[];const set=page.setData;page.setData=value=>{patches.push(value);set.call(page,value)};page.refresh();assert.equal(patches.length,0);page.data.error='old error';page.refresh();assert.deepEqual(Object.keys(patches[0]),['error']);assert.equal(page.data.items.length,10)}finally{cleanup()}});
