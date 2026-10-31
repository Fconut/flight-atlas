const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {read,section,appContext}=require('./helpers/source.cjs');
function dialogContext(){
 class Dialog extends EventTarget{constructor(){super();this.closed=0}getBoundingClientRect(){return {left:10,right:100,top:10,bottom:100}}close(){this.closed++;this.dispatchEvent(new Event('close'))}}
 const dialog=new Dialog(),c=vm.createContext({});let busy=false;
 vm.runInContext(read('dist/app.js').slice(read('dist/app.js').indexOf('function dismissOnBackdrop')),c);
 c.dismissOnBackdrop(dialog,()=>!busy);
 return {dialog,setBusy:value=>busy=value,pointer(type,x,y){const event=new Event(type);Object.assign(event,{clientX:x,clientY:y});dialog.dispatchEvent(event)}};
}
test('Esc is blocked only while a dialog operation is busy',()=>{
 const {dialog,setBusy}=dialogContext();setBusy(true);
 const busyCancel=new Event('cancel',{cancelable:true});dialog.dispatchEvent(busyCancel);assert.equal(busyCancel.defaultPrevented,true);
 setBusy(false);const normalCancel=new Event('cancel',{cancelable:true});dialog.dispatchEvent(normalCancel);assert.equal(normalCancel.defaultPrevented,false);
});
test('backdrop dismissal still works, while clicks or drags starting inside do not dismiss',()=>{
 const {dialog,pointer,setBusy}=dialogContext();
 pointer('pointerdown',20,20);pointer('click',20,20);assert.equal(dialog.closed,0);
 pointer('pointerdown',20,20);pointer('click',2,2);assert.equal(dialog.closed,0);
 setBusy(true);pointer('pointerdown',2,2);pointer('click',2,2);assert.equal(dialog.closed,0);
 setBusy(false);pointer('pointerdown',2,2);pointer('click',2,2);assert.equal(dialog.closed,1);
});
test('invalid flights do not unlock collection badges or inflate missing-aircraft counts',()=>{
 const c=appContext();Object.assign(c,{state:{rows:[
 {date:'2024-01-01',airline:'MU',from:'SHA',to:'NRT',aircraft:'Airbus A320'},
 {date:'2024-01-01',airline:'MU',from:'ZZZ',to:'NRT',aircraft:'Boeing 777-300ER'},
 {date:'BAD-DATE',airline:'MU',from:'SHA',to:'NRT',aircraft:'Boeing 777-300ER'},
 {date:'2024-01-01',airline:'UNKNOWN',from:'SHA',to:'NRT',aircraft:''}
 ]},editorAirports:{SHA:{},NRT:{}},localDate:()=> '2024-12-31'});
 vm.runInContext(read('dist/aircraft-catalog.js')+section(read('dist/editor.js'),'function recordCanceled','function recordAirportName')+section(read('dist/editor.js'),'function recordNeedsCorrection','function recordStatuses')+section(read('dist/fleet.js'),'function fleetKey','function fleetDetail'),c);
 const result=c.fleetGroups();assert.equal(result.groups.length,1);assert.equal(result.groups[0].rows.length,1);assert.equal(result.missing,0);
 c.state.rows[1].from='SHA';assert.equal(c.fleetGroups().groups.length,2);
});
test('late deletion completion cannot show feedback or undo in a replacement dataset',async()=>{
 const rows=[{_id:'one'},{_id:'two'}],feedback=[];let release,handler;
 const c=vm.createContext({state:{rows},row:rows[0],undoDeletion:null,remove:{addEventListener(event,callback){handler=callback}},regenerate:()=>new Promise(resolve=>release=resolve),recordFeedback:(...args)=>feedback.push(args)});
 vm.runInContext(section(read('dist/editor.js'),"remove.addEventListener('click',","actions.append(edit,remove)"),c);
 const pending=handler();assert.equal(rows.length,1);c.state.rows=[{_id:'other-account'}];release();await pending;assert.equal(feedback.length,0);
});
test('late save completion cannot show success on a replacement dataset',async()=>{
 const feedback=[],nodes=new Map(),values={'flight-date':'2024-01-01','flight-from':'SHA','flight-to':'NRT','flight-airline':'MU','flight-number':'2','flight-time':'09:00','flight-aircraft':'Airbus A320'};
 let handler,release;const get=id=>{if(!nodes.has(id))nodes.set(id,{value:values[id]||'',addEventListener(event,callback){handler=callback},close(){}});return nodes.get(id)};
 const c=vm.createContext({$:get,state:{rows:[{_id:'one'}]},editingId:'one',editorSaving:false,validDate:()=>true,resolveAirport:x=>x,normalizeAirlineCode:x=>x,recordIdentity:r=>r._id,regenerate:()=>new Promise(resolve=>release=resolve),recordFeedback:(...args)=>feedback.push(args),flightSaveFeedback:()=> 'saved'});
 vm.runInContext(section(read('dist/editor.js'),"$('flight-form').addEventListener('submit',","for(const id of ['record-year'"),c);
 const pending=handler({preventDefault(){}});c.state.rows=[{_id:'other-account'}];release({status:'ready'});await pending;assert.equal(feedback.length,0);
});
