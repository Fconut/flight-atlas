const test=require('node:test'),assert=require('node:assert/strict');
const {createAutoSave}=require('../miniprogram/lib/auto-save');
const {mergeDrafts}=require('../miniprogram/lib/merge-drafts');
const draft=require('../miniprogram/lib/draft-state');
const copy=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
const row=(flight='1')=>({_id:'row-'+flight,date:'2025-01-01',from:'SHA',to:'NRT',airline:'MU',flight,aircraft:'Airbus A320'});
const payload=(rows,prefs={})=>draft.snapshot({rows,prefs});
test('foreground refresh checks other-device updates once the five-minute reuse window expires',async()=>{
 let time=1000;const h=harness({now:()=>time,server:{payload:payload([row()]),revision:1}});let fetches=0;const fetch=h.cloud.fetchDraft;h.cloud.fetchDraft=async()=>{fetches++;return fetch()};
 try{await h.service.start();await h.service.flush();const count=fetches;h.server={payload:payload([row(),row('2')]),revision:2};
  time=300999;await h.service.resume();assert.equal(fetches,count);assert.equal(h.local.read('wx:A').rows.length,1);
  time=301000;await h.service.resume();assert.equal(fetches,count+1);assert.equal(h.local.read('wx:A').rows.length,2);
 }finally{h.service.stop()}
});
test('share preparation verifies acknowledged saves without repeatedly fetching unchanged drafts',async()=>{
 const h=harness({server:{payload:payload([row()]),revision:1}});let fetches=0;const fetch=h.cloud.fetchDraft;h.cloud.fetchDraft=async()=>{fetches++;return fetch()};
 try{await h.service.start();await h.service.flush();const baseline=fetches;
  await h.service.ensureSaved();await h.service.ensureSaved();assert.equal(fetches,baseline);assert.equal(h.saves,0);
  h.local.write('wx:A',[row(),row('2')],{});await Promise.resolve();await h.service.ensureSaved();assert.equal(h.saves,1);assert.equal(h.server.payload.sheets[0].rows.length,2);
 }finally{h.service.stop()}
});
test('share save confirmation performs startup cloud reconciliation before claiming saved',async()=>{
 const h=harness({server:{payload:payload([row()]),revision:1}});
 try{await h.service.ensureSaved();assert.equal(h.service.getState().phase,'saved');assert.equal(h.local.read('wx:A').rows.length,1)}finally{h.service.stop()}
});
test('ordinary edits after initial sync save with revision checking without a separate fetch',async()=>{
 const h=harness({server:{payload:payload([row()]),revision:1}});let fetches=0;const fetch=h.cloud.fetchDraft;h.cloud.fetchDraft=async()=>{fetches++;return fetch()};
 try{await h.service.start();await h.service.flush();const baseline=fetches;
  h.local.write('wx:A',[row(),row('2')],{});await Promise.resolve();await h.service.flush();
  assert.equal(fetches,baseline);assert.equal(h.saves,1);assert.equal(h.server.revision,2);assert.equal(h.server.payload.sheets[0].rows.length,2);
 }finally{h.service.stop()}
});
test('a stale direct save fetches and merges the other device changes before retrying',async()=>{
 const h=harness({server:{payload:payload([row()]),revision:1}});let fetches=0;const fetch=h.cloud.fetchDraft;h.cloud.fetchDraft=async()=>{fetches++;return fetch()};
 try{await h.service.start();await h.service.flush();const baseline=fetches;
  h.server={payload:payload([row(),row('3')]),revision:2};
  h.local.write('wx:A',[row(),row('2')],{});await Promise.resolve();await h.service.flush();
  assert.equal(fetches,baseline+1);assert.deepEqual(h.server.payload.sheets[0].rows.map(r=>r.flight).sort(),['1','2','3']);assert.equal(h.server.revision,3);
 }finally{h.service.stop()}
});
test('clean foreground, network and background events reuse a recent successful sync',async()=>{
 const h=harness();let fetches=0;const fetch=h.cloud.fetchDraft;h.cloud.fetchDraft=async()=>{fetches++;return fetch()};
 try{await h.service.start();await h.service.flush();const baseline=fetches;
  for(let i=0;i<5;i++){await h.service.resume();await h.service.online();h.service.hide();}
  assert.equal(fetches,baseline);assert.equal(h.saves,0);
  await h.service.flush();assert.equal(fetches,baseline+1,'explicit flush still checks cloud');
 }finally{h.service.stop()}
});
test('local edits remain immediate and coalesce into a two-second cloud save; hide flushes dirty data',async()=>{
 const h=harness();try{await h.service.start();await h.service.flush();
  h.local.write('wx:A',[row()],{});await Promise.resolve();assert.equal(h.local.read('wx:A').rows.length,1);assert.equal(h.saves,0);
  assert([...h.timers.values()].some(t=>t.delay===2000));
  h.local.write('wx:A',[row(),row('2')],{});await Promise.resolve();assert.equal(h.timers.size,1);
  h.service.hide();await h.service.flush();assert.equal(h.server.payload.sheets[0].rows.length,2);assert.equal(h.saves,1);
 }finally{h.service.stop()}
});
function harness({cache={},server=null,user='A',offline=false,now=Date.now}={}) {
  const values=copy(cache),listeners=new Set(),revisions=new Map(),timers=new Map();let seq=0,saves=0;
  const storage={get:key=>copy(values[key]),set:(key,value)=>{values[key]=copy(value);}};
  const local={read:scope=>storage.get(scope+'-state')||{version:1,rows:[],prefs:{}},revision:scope=>revisions.get(scope)||0,
    write(scope,rows,prefs,origin='user'){storage.set(scope+'-state',{version:1,rows,prefs});revisions.set(scope,this.revision(scope)+1);
      for(const fn of listeners)Promise.resolve().then(()=>fn({scope,origin}));},
    subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);}};
  const account={activeScope:()=> 'guest',initialize:()=> 'guest',scopeFor:session=>'wx:'+session.user.id};
  const cloud={login:async()=>{if(offline)throw Error('offline');return {user:{id:user}};},fetchDraft:async()=>{if(offline)throw Error('offline');return copy(server);},
    saveDraft:async(data,revision)=>{if(offline)throw Error('offline');saves++;if((server?.revision||0)!==revision){const error=Error('conflict');error.code='40001';throw error;}
      server={payload:copy(data),revision:revision+1};return server.revision;}};
  const service=createAutoSave({cloud,account,local,storage,now,timers:{set(fn,delay){const id=++seq;timers.set(id,{fn,delay});return id;},clear:id=>timers.delete(id)}});
  return {service,cloud,local,values,timers,storage,get server(){return server;},set server(value){server=copy(value);},get saves(){return saves;},online(){offline=false;},goOffline(){offline=true;},setUser(id){user=id;}};
}
test('new device automatically loads account records and preferences without uploading an empty snapshot',async()=>{
 const h=harness({server:{payload:payload([row()],{future:true,colors:{background:'#122e2b',route:'#e0b778'}}),revision:3}});
 try{await h.service.start();await h.service.flush();assert.equal(h.local.read('wx:A').rows.length,1);
 assert.equal(h.local.read('wx:A').prefs.future,true);assert.equal(h.local.read('wx:A').prefs.colors.background,'#122e2b');assert.equal(h.saves,0);
 assert.equal(h.service.getState().phase,'saved');}finally{h.service.stop();}
});
test('adding a flight automatically saves it, and a fresh device restores it on launch',async()=>{
 const h=harness();try{await h.service.start();await h.service.flush();h.local.write('wx:A',[row()],{});await Promise.resolve();
 assert.equal(h.service.getState().phase,'saving');await h.service.flush();assert.equal(h.server.payload.sheets[0].rows.length,1);
 const second=harness({server:h.server});try{await second.service.start();await second.service.flush();assert.equal(second.local.read('wx:A').rows[0].flight,'1');}finally{second.service.stop();}
 }finally{h.service.stop();}
});
test('offline records are retained and automatically saved after reconnection, with one-time legacy migration',async()=>{
 const old={version:1,rows:[row()],prefs:{}};
 const h=harness({cache:{'guest-state':old},offline:true});
 try{await h.service.start();await h.service.flush();assert.equal(h.service.getState().phase,'offline');assert.equal(h.local.read('guest').rows.length,1);
 h.local.write('guest',[row(),row('2')],{});await Promise.resolve();h.online();await h.service.resume();
 assert.equal(h.server.payload.sheets[0].rows.length,2);assert.equal(h.values['atlas-mini-auto-migrated-sources'].guest,'wx:A');
 assert.equal(h.local.read('guest').rows.length,2);
 const other=harness({cache:h.values,user:'B'});try{await other.service.start();await other.service.flush();assert.equal(other.local.read('wx:B').rows.length,0);assert.equal(other.saves,0);}finally{other.service.stop();}
 }finally{h.service.stop();}
});
test('conflicting revisions preserve a local deletion and another device addition',async()=>{
 const h=harness({server:{payload:payload([row(),row('2')]),revision:1}});
 try{await h.service.start();await h.service.flush();h.local.write('wx:A',[row('2')],h.local.read('wx:A').prefs);await Promise.resolve();
 const save=h.cloud.saveDraft;let first=true;h.cloud.saveDraft=async(d,r)=>{if(first){first=false;h.server={payload:payload([row(),row('2'),row('3')]),revision:2};}return save(d,r);};
 await h.service.flush();assert.deepEqual(h.server.payload.sheets[0].rows.map(r=>r.flight).sort(),['2','3']);assert.equal(h.service.getState().phase,'saved');
 }finally{h.service.stop();}
});
test('edits made while a save is in flight are not overwritten by its acknowledgement',async()=>{
 const h=harness();try{await h.service.start();await h.service.flush();
 let release;const original=h.cloud.saveDraft;let first=true;
 h.cloud.saveDraft=async(d,r)=>{if(first){first=false;await new Promise(resolve=>release=resolve);}return original(d,r);};
 h.local.write('wx:A',[row()],{});await Promise.resolve();const pending=h.service.flush();
 while(!release)await new Promise(r=>setImmediate(r));
 h.local.write('wx:A',[row(),row('2')],{});await Promise.resolve();release();await pending;
 assert.equal(h.server.payload.sheets[0].rows.length,2);assert.equal(h.local.read('wx:A').rows.length,2);
 }finally{h.service.stop();}
});
test('three-way merge combines independent edits to a flight and honours remote deletion',()=>{
 const base=payload([row()]);const local=payload([{...row(),date:'2025-02-01'}]);const remote=payload([{...row(),aircraft:'Airbus A350-900'}]);
 const result=mergeDrafts(base,local,remote);assert.equal(result.sheets[0].rows.length,1);assert.equal(result.sheets[0].rows[0].date,'2025-02-01');assert.equal(result.sheets[0].rows[0].aircraft,'Airbus A350-900');
 assert.equal(mergeDrafts(base,base,payload([])).sheets[0].rows.length,0);
});
test('pending offline deletions survive closing the app and are sent on the next launch',async()=>{
 const h=harness({server:{payload:payload([row(),row('2')]),revision:1}});
 await h.service.start();await h.service.flush();h.goOffline();h.local.write('wx:A',[row('2')],h.local.read('wx:A').prefs);await Promise.resolve();
 await h.service.flush();h.service.stop();
 const restarted=harness({cache:h.values,server:h.server});try{await restarted.service.start();await restarted.service.flush();
 assert.deepEqual(restarted.server.payload.sheets[0].rows.map(r=>r.flight),['2']);}finally{restarted.service.stop();}
});
test('an unrelated damaged legacy cache does not block valid account records',async()=>{
 const h=harness({cache:{'guest-state':{version:99}},server:{payload:payload([row()]),revision:1}}),read=h.local.read;
 h.local.read=scope=>{if(scope==='guest')throw Error('旧记录格式异常');return read(scope);};
 try{await h.service.start();await h.service.flush();assert.equal(h.local.read('wx:A').rows.length,1);assert.equal(h.saves,0);
 assert.equal(h.values['guest-state'].version,99);assert(h.service.getState().text.includes('旧记录'));}finally{h.service.stop();}
});
test('appearance changes are automatically saved even before the first flight',async()=>{
 const h=harness();try{await h.service.start();await h.service.flush();
 h.local.write('wx:A',[],{colors:{background:'#122e2b',route:'#e0b778'}});await Promise.resolve();await h.service.flush();
 assert.equal(h.server.payload.colors.background,'#122e2b');}finally{h.service.stop();}
});

test('launch followed immediately by foreground sync reads the remote draft only once',async()=>{const h=harness();let reads=0;const fetch=h.cloud.fetchDraft;h.cloud.fetchDraft=async()=>{reads++;return fetch()};try{await h.service.start();await h.service.resume();assert.equal(reads,1)}finally{h.service.stop()}});
