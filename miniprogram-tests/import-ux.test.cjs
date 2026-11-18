const test=require('node:test'),assert=require('node:assert/strict');
const records=require('../miniprogram/pages/index/logic/records');
function stateful(page){page.data=structuredClone(page.data||{});page.setData=function(values){for(const [path,value]of Object.entries(values)){const keys=path.replace(/\[(\d+)\]/g,'.$1').split('.');let target=this.data;for(const k of keys.slice(0,-1))target=target[k];target[keys.at(-1)]=value;}};return page;}
test('one import entry routes spreadsheet and chat images without requesting the same file twice',async()=>{
  for(const [file,image]of [[{name:'flights.xlsx',path:'file.xlsx',size:1},false],[{name:'screenshot.png',type:'image',path:'image.png',size:1},true]]){
    let opened;global.wx={showActionSheet:o=>o.success({tapIndex:0}),chooseMessageFile:o=>{assert.equal(o.type,'all');o.success({tempFiles:[file]})}};
    const page={...records,localKey:'guest',openImportReview:(...args)=>opened=args};
    await page.importFile();assert.deepEqual(opened,[file,image,'guest']);assert.equal(page.choosingImport,false);
  }
});
test('album import excludes camera and cancellation leaves records untouched',async()=>{
  for(const tapIndex of [1]){
    let opened;global.wx={showActionSheet:o=>{assert.equal(o.itemList.length,2);o.success({tapIndex})},chooseMedia:async o=>{assert.deepEqual(o.sourceType,['album']);return{tempFiles:[{tempFilePath:'image',size:1}]}}};
    const page={...records,localKey:'guest',openImportReview:(...args)=>opened=args};await page.importFile();assert.equal(opened[1],true);
  }
  global.wx={showActionSheet:o=>o.fail({errMsg:'cancel'})};const page={...records,openImportReview:()=>assert.fail('must not open')};await page.importFile();assert.equal(page.choosingImport,false);
});
function review(){
  let definition;global.Page=p=>definition=p;delete require.cache[require.resolve('../miniprogram/airport-picker/pages/image-import')];require('../miniprogram/airport-picker/pages/image-import');
  const page=stateful({...definition});const AirportSearch=require('../miniprogram/airport-picker/lib/airport-search');
  page.search=AirportSearch.create({OSL:{name:'Gardermoen',city:'Oslo'},TRF:{name:'Torp',city:'Oslo'},SHA:{name:'Hongqiao',city:'Shanghai'}},{OSL:'奥斯陆',TRF:'桑讷菲尤尔',SHA:'上海虹桥'});
  return page;
}
test('choosing the same screenshot on one review page reuses OCR text without another upload',async()=>{
 const page=review();let calls=0,uploads=0;
 global.wx={getStorageSync:()=>null,setStorageSync(){},getImageInfo:async()=>({width:100,height:100}),compressImage:async()=>({tempFilePath:'compressed'}),getFileSystemManager:()=>({getFileInfo:o=>o.success({size:10,digest:'same-image'})}),cloud:{uploadFile:async()=>{uploads++;return{fileID:'temporary'}},deleteFile:async()=>{}}};
 page.call=async r=>{calls++;return r.action==='prepare'?{path:'path',token:'token'}:{text:'2026-10-25\nMU1234\n12:00 OSL\n13:00 SHA'}};
 await page.recognizeFile({path:'image',size:10});assert.equal(page.data.rows.length,1);
 await page.recognizeFile({path:'other-temp-path',size:10});assert.equal(page.data.rows.length,1);assert.equal(calls,2);assert.equal(uploads,1);
});
const row={date:'2026-10-25',airline:'MU',flight:'5358',from:'Oslo',to:'SHA',selected:true};
test('ambiguous airport recommendations appear without focus and one tap clears the field error',()=>{
  const page=review();page.data.rows=[{...row}];page.revalidate();assert(page.data.rows[0].errors.from);assert.equal(page.data.invalidCount,1);
  assert.deepEqual(page.data.rows[0].recommendations.from.map(a=>a.code),['OSL','TRF']);
  page.chooseAirport({currentTarget:{dataset:{index:0,key:'from',code:'OSL'}}});assert.equal(page.data.rows[0].from,'OSL');assert.equal(page.data.invalidCount,0);assert.deepEqual(page.data.rows[0].recommendations.from,[]);
});
test('confirm locates the first invalid flight and skipped flights do not block import',()=>{
  const page=review();let scrolled,emitted=false;
  global.wx={getStorageSync:()=>null,setStorageSync(){},removeStorageSync(){},nextTick:fn=>fn(),pageScrollTo:options=>scrolled=options.selector};
  page.scope=require('../miniprogram/lib/account-state').activeScope();page.getOpenerEventChannel=()=>({emit:()=>emitted=true});
  page.data.rows=[{...row,from:'OSL'},{...row,date:'',from:'OSL'}];page.confirm();assert.equal(emitted,false);assert.equal(scrolled,'#flight-1');
  page.toggle({currentTarget:{dataset:{index:1}}});page.confirm();assert.equal(emitted,true);assert.equal(page.data.selectedCount,1);assert.equal(page.data.invalidCount,0);
});

test('editing one OCR field only revalidates that flight',()=>{
 const page=review();page.data.rows=[{...row,from:'OSL'},{...row,from:'OSL'}];page.revalidate();
 const unchanged=page.data.rows[1],original=page.reviewRow;let calls=0;page.reviewRow=function(row){calls++;return original.call(this,row)};
 page.input({currentTarget:{dataset:{index:0,key:'date'}},detail:{value:'2026-10-26'}});
 assert.equal(calls,1);assert.equal(page.data.rows[1],unchanged);assert.equal(page.data.rows[0].date,'2026-10-26');
});
test('over-limit screenshot results are rejected explicitly and temporary image is removed',async()=>{
 const page=review(),deleted=[];let imported=false;
 global.wx={getStorageSync:()=>null,setStorageSync(){},getImageInfo:async()=>({width:100,height:100}),compressImage:async()=>({tempFilePath:'compressed'}),getFileSystemManager:()=>({getFileInfo:o=>o.success({size:10})}),cloud:{uploadFile:async()=>({fileID:'temporary'}),deleteFile:async o=>deleted.push(...o.fileList)}};
 const text=Array.from({length:101},(_,i)=>'2026-10-25\nMU'+(1000+i)+'\n12:00 OSL\n13:00 SHA').join('\n');
 page.call=async request=>request.action==='prepare'?{path:'path',token:'token'}:{text};page.getOpenerEventChannel=()=>({emit:()=>imported=true});
 await page.recognizeFile({path:'image',size:10});assert.equal(page.data.rows.length,0);assert.match(page.data.message,/101.*100/);assert.equal(imported,false);assert.deepEqual(deleted,['temporary']);
});

test('spreadsheet import waits for durable-save acknowledgement and retains rows for retry',()=>{
 let definition,backs=0;global.Page=p=>definition=p;delete require.cache[require.resolve('../miniprogram/file-tools/pages/index')];require('../miniprogram/file-tools/pages/index');
 const handlers={},sent=[];global.wx={navigateBack:()=>backs++,switchTab:()=>backs++};const page=stateful({...definition});page.getOpenerEventChannel=()=>({on:(name,fn)=>handlers[name]=fn,emit:(name,data)=>sent.push({name,data})});page.onLoad({});
 const result={rows:[{...row,from:'OSL'}],name:'flights.xlsx'};page.importResult=result;page.submitImport();assert.equal(backs,0);assert.equal(page.data.processing,true);
 handlers.importResult({ok:false,message:'磁盘写入失败'});assert.equal(backs,0);assert.equal(page.importResult,result);assert.equal(page.data.canRetryImport,true);
 page.retryImport();assert.equal(sent.length,2);handlers.importResult({ok:true});assert.equal(backs,1);assert.equal(page.importResult,null);
});
