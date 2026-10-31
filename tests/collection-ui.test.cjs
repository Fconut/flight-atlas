const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {read,section}=require('./helpers/source.cjs');
function element(tag='div'){return {tag,children:[],style:{},attributes:{},textContent:'',append(...items){this.children.push(...items)},replaceChildren(...items){this.children=items;this.rebuilds=(this.rebuilds||0)+1},setAttribute(k,v){this.attributes[k]=v}}}
function fleetContext(rows=[]){
 const nodes=new Map(),get=id=>{if(!nodes.has(id))nodes.set(id,element());return nodes.get(id)};
 const c=vm.createContext({state:{rows},today:'2024-12-31',dateValue:x=>x,recordCanceled:r=>!!r.canceled,normalizeAirlineCode:x=>x||'',airportCode:x=>x,$:get,document:{createElement:element},fitFleetBadge:()=>{}});
 c.localDate=()=>c.today;
 vm.runInContext(read('dist/aircraft-catalog.js'),c);
 const fleet=read('dist/fleet.js');
 vm.runInContext(section(fleet,'function aircraftBadge','const fleetPage')+section(fleet,'function fleetKey','function fleetDetail')+section(fleet,'function fleetMaker','const originalShowWorkspace'),c);
 vm.runInContext('let fleetRenderedKey=null;',c);
 return {c,get};
}
function descendants(node){return [node,...node.children.flatMap(descendants)]}
test('unknown aircraft retain their name and record while showing a visible placeholder',()=>{
 const {c,get}=fleetContext([{date:'2024-01-01',aircraft:'MY UNKNOWN MODEL',from:'SHA',to:'NRT'}]);c.renderFleet();
 const all=descendants(get('fleet-grid'));
 assert.ok(all.some(n=>n.className==='fleet-placeholder'));
 assert.ok(all.some(n=>n.textContent==='MY UNKNOWN MODEL'));
 assert.ok(all.some(n=>n.textContent==='暂无徽章'));
 assert.match(get('fleet-count').textContent,/已解锁 0 枚徽章 · 已记录 1 种机型 · 1 次飞行/);
 const locked=all.filter(n=>n.className==='fleet-card is-locked');
 assert.equal(locked.length,37);assert.ok(locked.every(n=>n.disabled));
});
test('collection does not rebuild for color or label changes but refreshes for records and day changes',()=>{
 const {c,get}=fleetContext();c.renderFleet();const box=get('fleet-grid'),first=box.children[0];
 c.state.colors={background:'blue'};c.state.labelSelection=['SHA'];c.renderFleet();assert.equal(box.rebuilds,1);assert.equal(box.children[0],first);
 c.state.rows.push({date:'2025-01-01',aircraft:'Airbus A320'});c.renderFleet();assert.equal(box.rebuilds,2);assert.match(get('fleet-count').textContent,/已记录 0/);
 c.today='2025-01-01';c.renderFleet();assert.equal(box.rebuilds,3);assert.match(get('fleet-count').textContent,/已解锁 1/);
});
test('badge fitting scans pixels once for the same asset, including simultaneous image loads',()=>{
 let scans=0;const c=vm.createContext({document:{createElement:()=>({getContext:()=>({drawImage(){},getImageData(){scans++;return {data:new Uint8Array([0,0,0,255,0,0,0,255,0,0,0,255,0,0,0,255])}}})})}});
 vm.runInContext('const fleetBadgeFits=new Map();'+read('dist/fleet.js').slice(read('dist/fleet.js').indexOf('function fitFleetBadge')),c);
 const img=()=>({src:'badge.webp',naturalWidth:2,naturalHeight:2,style:{},addEventListener(event,handler){this.load=handler}});
 const a=img(),b=img();c.fitFleetBadge(a);c.fitFleetBadge(b);a.load();b.load();assert.equal(scans,1);assert.equal(a.style.transform,b.style.transform);
 const d=img();c.fitFleetBadge(d);assert.equal(d.style.transform,a.style.transform);assert.equal(scans,1);
});
function cloudContext(accept){
 const nodes=new Map(),get=id=>{if(!nodes.has(id))nodes.set(id,{hidden:true});return nodes.get(id)};
 const snap=n=>({rows:Array.from({length:n},(_,i)=>({flight:String(i)})),sheets:[],labelSelection:null,includeFuture:false});
 const c=vm.createContext({cloudInfo:null,draftWrites:Promise.resolve(),accountId:'a',draftKey:'user:a',draftEpoch:0,localSnapshot:()=>snap(2),fetchCloud:async()=>({payload:snap(1),revision:7}),validBackup:()=>true,renderCloudInfo(){},cloudTime:()=>'',confirm:()=>accept,draftDB:Promise.resolve({}),draftTransaction:async()=>{},atlasClient:{rpc:async()=>({data:8})},$:get,accountMessage(){},refreshCloudInfo:async()=>{}});
 c.conflicts=0;c.showCloudConflict=()=>c.conflicts++;
 vm.runInContext(read('dist/cloud-backup-state.js')+section(read('dist/account.js'),'async function saveAccountCloud()',"$('account-push')"),c);
 return c;
}
test('canceling cloud save does not open a conflict or write a backup',async()=>{
 const c=cloudContext(false);let writes=0;c.draftTransaction=async()=>writes++;c.atlasClient.rpc=async()=>{writes++;return {data:8}};
 await c.saveAccountCloud();assert.equal(c.conflicts,0);assert.equal(writes,0);
});
test('only a real concurrent cloud update opens the conflict notice',async()=>{
 const c=cloudContext(true);c.atlasClient.rpc=async()=>({error:{code:'40001'}});
 await assert.rejects(c.saveAccountCloud(),/另一台设备更新/);assert.equal(c.conflicts,1);
});
test('switching account drafts clears prior import and operation messages',async()=>{
 const nodes=new Map(['import-result','record-feedback','backup-message'].map(id=>[id,{textContent:'old message',replaceChildren(){this.textContent=''}}]));
 const get=id=>{if(!nodes.has(id))nodes.set(id,{value:''});return nodes.get(id)};
 const c=vm.createContext({$:get,draftWrites:Promise.resolve(),draftEpoch:0,state:{rows:[]},atlasColors:()=>({}),syncAtlasColorControls(){},restoreLocalDraft:async()=>{},regenerate:async()=>{}});
 vm.runInContext(section(read('dist/workspace.js'),'function resetDataFeedback','function showSetting')+section(read('dist/account.js'),'async function loadAccountDraft','async function onAccountSession'),c);
 await c.loadAccountDraft('user:new');for(const id of ['import-result','record-feedback','backup-message'])assert.equal(get(id).textContent,'');
 assert.equal(c.draftKey,'user:new');
});
