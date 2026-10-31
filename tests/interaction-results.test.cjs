const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {appContext,read,section}=require('./helpers/source.cjs');
const airports={SHA:{xy:[121,31]},NRT:{xy:[140,35]}};
function harness(){
 const c=appContext(),nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',hidden:false,disabled:true,children:[],append(...items){this.children.push(...items)},replaceChildren(...items){this.children=items},setAttribute(){},showModal(){}});return nodes.get(id);};
 Object.assign(c,{$:node,state:{rows:[{date:'2024-01-01',airline:'MU',flight:'1',from:'SHA',to:'NRT'}],sheets:[],revision:0},localDate:()=> '2026-10-31',normalizeFlightStore:()=>{},status:text=>node('status').textContent=text,error:e=>node('status').textContent=e.message,window:{dispatchEvent(){}},CustomEvent:class{},assets:Promise.resolve([airports,{},''])});
 const app=read('dist/app.js');
 vm.runInContext(section(app,'async function importFlightFile','function calculate'),c);
 vm.runInContext(section(app,'async function regenerate()','function updateSize'),c);
 return {c,node};
}
test('invalid imported rows remain editable and the result explains why no map was generated',async()=>{
 const {c,node}=harness();
 await c.importFlightFile({name:'test.csv',size:100,text:async()=> 'Date,Airline,Flight,From,To\nBAD-DATE,MU,2,SHA,NRT'});
 assert.equal(c.state.rows.length,2);
 assert.match(node('import-result').textContent,/已导入：新增 1/);
 assert.match(node('import-result').textContent,/记录已保留，但地图未生成/);
 assert.match(node('import-result').textContent,/缺少有效日期/);
 assert.doesNotMatch(node('import-result').textContent,/成功/);
});
test('render reports empty, failed and superseded states to callers',async()=>{
 const {c}=harness();
 c.state.rows=[];assert.equal((await c.regenerate()).status,'empty');
 c.state.rows=[{date:'BAD',from:'SHA',to:'NRT'}];assert.equal((await c.regenerate()).status,'error');
 c.state.rows=[{date:'2024-01-01',from:'SHA',to:'NRT'}];
 let release;c.assets=new Promise(resolve=>release=resolve);
 const pending=c.regenerate();c.state.revision++;release([airports,{},'']);
 assert.equal((await pending).status,'superseded');
});
test('manual save feedback never claims map success for a failed or superseded render',()=>{
 const {c}=harness();
 vm.runInContext(section(read('dist/editor.js'),'function flightSaveFeedback','function closeFlightDialog'),c);
 assert.match(c.flightSaveFeedback(true,{status:'error',message:'世界底图加载失败'}),/已保存修改；地图未生成：世界底图加载失败/);
 assert.match(c.flightSaveFeedback(false,{status:'superseded'}),/地图正在更新/);
 assert.match(c.flightSaveFeedback(true,{status:'ready'}),/地图已更新/);
});
test('editor becomes available with airport data even if the map and Chinese names fail',async()=>{
 const {c,node}=harness();c.airportDataReady=Promise.resolve({});
 c.assets=Promise.reject(Error('海报模板加载失败'));c.assets.catch(()=>{});
 Object.assign(c,{fetch:()=>Promise.reject(Error('names unavailable')),checkResponse:r=>r,document:{createDocumentFragment:()=>({append(){}}),createElement:()=>({}),createTextNode:text=>({textContent:text})},renderRecords:()=>{},editorAirports:null,editorNames:null,editorReady:false});
 const editor=read('dist/editor.js'),start=editor.indexOf('Promise.all([airportDataReady');
 const end=editor.indexOf('\nrenderRecords();',start);
 assert.ok(start>=0&&end>start);await vm.runInContext(editor.slice(start,end),c);
 assert.equal(c.editorReady,true);assert.equal(node('manual-start').disabled,false);assert.equal(node('add-record').disabled,false);
 assert.deepEqual(Object.keys(c.editorNames),[]);
});
test('resource errors identify the failed dependency',async()=>{
 const c=vm.createContext({fetch:()=>Promise.reject(Error('network'))});
 vm.runInContext(section(read('dist/app.js'),'function loadAtlasResource','const airportDataReady'),c);
 await assert.rejects(c.loadAtlasResource('world','世界底图'),/世界底图加载失败/);
});
test('fleet details use the same departure-time order as the flight list',()=>{
 const {c,node}=harness();
 Object.assign(c,{document:{createElement:()=>({children:[],append(...items){this.children.push(...items)}})},recordAirportName:x=>x,fleetDialog:node('dialog')});
 vm.runInContext(section(read('dist/fleet.js'),'function fleetDetail','function fleetMaker'),c);
 c.fleetDetail({name:'A320',rows:[{date:'2024-01-01',departureTime:'08:00',airline:'MU',flight:'early',from:'SHA',to:'NRT'},{date:'2024-01-01',departureTime:'18:00',airline:'MU',flight:'late',from:'NRT',to:'SHA'}]});
 assert.match(node('fleet-detail').children[0].children[1].textContent,/late/);
 assert.match(node('fleet-detail').children[1].children[1].textContent,/early/);
});
