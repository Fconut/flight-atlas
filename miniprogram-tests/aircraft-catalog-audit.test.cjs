const test=require('node:test'),assert=require('node:assert/strict');
const {aircraftCatalog,resolveAircraft}=require('../miniprogram/lib/aircraft');
test('verified codes preserve series ambiguity and distinguish engine generations',()=>{
 for(const [text,id]of Object.entries({B738:'b737-800','738':'b737-800','73H':'b737-800',B737:'b737-700',B38M:'b737-max8','7M8':'b737-max8',A20N:'a320neo',A21N:'a321neo',A19N:'a319neo','32Q':'a321neo'}))assert.equal(resolveAircraft(text).id,id,text);
 assert.equal(resolveAircraft('737'),null);assert.equal(resolveAircraft('Boeing 737'),null);assert.equal(resolveAircraft('B739').id,'b737-900');
 assert.notEqual(resolveAircraft('B738').id,resolveAircraft('B38M').id);
});
test('new aircraft without artwork count as recorded aircraft but not unlocked badges',()=>{
 const {collection}=require('../miniprogram/lib/fleet');const rows=[{date:'2025-01-01',from:'SHA',to:'PEK',aircraft:'B734'}],before=JSON.stringify(rows),c=collection(rows,'2026-11-09');
 assert.equal(c.recordedTypes,1);assert.equal(c.recordedFlights,1);assert.equal(c.unlocked,0);assert.equal(c.items.find(a=>a.id==='b737-400').count,1);assert.equal(JSON.stringify(rows),before);
});
test('aircraft metadata is independent of artwork and ambiguous qualifiers are preserved',()=>{
 assert.equal(new Set(aircraftCatalog.map(a=>a.id)).size,aircraftCatalog.length);assert(aircraftCatalog.every(a=>!Object.hasOwn(a,'badge')));
 assert.equal(resolveAircraft('波音737-800').id,'b737-800');assert.equal(resolveAircraft('空中客车 A320').id,'a320');
 for(const text of ['A320系列','不确定A320','737','A380','Airbus A330'])assert.equal(resolveAircraft(text),null,text);
 assert.notEqual(resolveAircraft('A320').id,resolveAircraft('A320neo').id);
});
test('new badges unlock consistently in local and cloud single and collection shares',()=>{
 const fs=require('fs'),path=require('path');
 const {collection}=require('../miniprogram/lib/fleet');
 const {buildBadgeSnapshot}=require('../miniprogram/lib/badge-share');
 const {buildCollectionSnapshot}=require('../miniprogram/lib/collection-share');
 const cloud=require('../cloudfunctions/atlas-share/domain/collection-share');
 const rows=['A19N','7M9','AIRBUS A319neo','BOEING 737 MAX 9'].map((aircraft,i)=>({date:`2025-01-0${i+1}`,from:'SHA',to:'PEK',aircraft}));
 const original=JSON.stringify(rows),draft={rows},today='2026-11-09',data=collection(rows,today);
 assert.equal(data.unlocked,2);assert.equal(data.recordedFlights,4);
 for(const id of ['a319neo','b737-max9']){
  const item=data.items.find(a=>a.id===id);assert.equal(item.count,2);assert.equal(item.package,'badges4');
  const file=path.join(__dirname,'../miniprogram',item.badge);
  assert(fs.existsSync(file));assert(fs.statSync(file).size<200*1024);
  assert.equal(buildBadgeSnapshot(draft,today,id,[0,1]).records.length,2);
 }
 const snapshot=buildCollectionSnapshot(draft,today);assert.equal(snapshot.badges.length,2);assert.deepEqual(cloud.buildCollectionSnapshot(draft,today),snapshot);
 assert.equal(JSON.stringify(rows),original);
});
test('common verified codes, fullwidth input and legacy aliases share one search resolver',()=>{
 const {searchAircraft}=require('../miniprogram/lib/aircraft');
 for(const [input,id]of Object.entries({A332:'a330-200','333':'a330-300',A359:'a350-900',A35K:'a350-1000',B77W:'b777-300er',B788:'b787-8',B789:'b787-9',BCS3:'a220-300','Ｂ７３８':'b737-800','波音７３７－８００':'b737-800','庞巴迪CS300':'a220-300','巴西航空工业E195':'e195',Q400:'dash8-400'})){
  assert.equal(resolveAircraft(input)?.id,id,input);assert.equal(searchAircraft(input)[0]?.id,id,input);
 }
 assert(searchAircraft('CS3').some(a=>a.id==='a220-300'));
 for(const input of ['Dash 8','DE HAVILLAND DASH 8','737','787','A350','A321XLR'])assert.equal(resolveAircraft(input),null,input);
 assert.equal(searchAircraft('custom',['custom jet','custom jet']).length,1);
 assert.equal(searchAircraft('737').length,6);assert.deepEqual(searchAircraft(''),[]);
 const rows=['B789','波音787-9'].map(aircraft=>({date:'2025-01-01',from:'SHA',to:'PEK',aircraft}));
 assert.equal(require('../miniprogram/lib/fleet').collection(rows,'2026-11-09').items.find(a=>a.id==='b787-9').count,2);
 assert.deepEqual(require('../cloudfunctions/atlas-share/domain/aircraft').searchAircraft('B789'),searchAircraft('B789'));
});

test('next aircraft batch separates generations, legacy names and ICAO-aligned 747 labels',()=>{
 const {collection}=require('../miniprogram/lib/fleet'),{buildCollectionSnapshot}=require('../miniprogram/lib/collection-share'),{buildBadgeSnapshot}=require('../miniprogram/lib/badge-share');
 for(const [input,id]of Object.entries({BCS1:'a220-100',CS100:'a220-100','庞巴迪CS100':'a220-100',E75L:'e175-long',E75S:'e175-short',E7W:'e175-long',E290:'e190-e2',E295:'e195-e2',B752:'b757-200','BOEING 747-8I':'b747-8i'}))assert.equal(resolveAircraft(input)?.id,id,input);
 for(const input of ['757','E175','ATR 42','ATR 72','ATR 42-500','E175-E2'])assert.equal(resolveAircraft(input),null,input);
 assert.notEqual(resolveAircraft('E190').id,resolveAircraft('E190-E2').id);assert.notEqual(resolveAircraft('E195').id,resolveAircraft('E195-E2').id);
 const rows=['BCS1','E75L','B752','E290','E295','747-8I'].map((aircraft,i)=>({date:'2025-01-0'+(i+1),from:'SHA',to:'PEK',aircraft}));const original=JSON.stringify(rows),draft={rows},today='2026-11-09';
 const data=collection(rows,today);assert.equal(data.recordedTypes,6);assert.equal(data.recordedFlights,6);assert.equal(data.unlocked,6);
 const shared=buildCollectionSnapshot(draft,today);assert.equal(shared.badges.length,6);assert.equal(shared.summary.flights,6);
 for(const id of ['a220-100','e175-long','b757-200','e190-e2','e195-e2','b747-8i'])assert.equal(buildBadgeSnapshot(draft,today,id,[0]).records.length,1);
 assert.equal(JSON.stringify(rows),original);assert.deepEqual(require('../cloudfunctions/atlas-share/domain/collection-share').buildCollectionSnapshot(draft,today),shared);
});
test('fleet hides unflown artwork gaps and shows recorded gaps as compact readable entries',()=>{
 const behavior=require('../miniprogram/pages/index/logic/fleet');
 const rows=[{_id:'known',date:'2020-01-01',from:'SHA',to:'PEK',aircraft:'B734'},{_id:'raw',date:'2020-01-02',from:'SHA',to:'PEK',aircraft:'Custom Jet'},{_id:'badge',date:'2020-01-03',from:'SHA',to:'PEK',aircraft:'B738'}];
 const page={data:{rows},setData(v){Object.assign(this.data,v)}};behavior.updateFleet.call(page);
 const boeing=page.data.fleetSections.find(s=>s.maker==='波音'),other=page.data.fleetSections.find(s=>s.maker==='其他');
 assert(boeing.items.every(a=>a.badge));assert.equal(boeing.unbadged.length,1);assert.equal(boeing.unbadged[0].id,'b737-400');assert.equal(boeing.unbadged[0].count,1);assert.equal(boeing.count,2);
 assert(!page.data.fleetSections.some(s=>[...s.items,...s.unbadged].some(a=>a.id==='b737-500')));
 assert.equal(other.unbadged[0].name,'Custom Jet');assert.equal(page.data.fleetRecordedTypes,3);assert.equal(page.data.fleetUnlocked,1);
 assert(page.data.fleetSections.every(s=>[...s.items,...s.unbadged].every(a=>!Object.hasOwn(a,'rows'))));
 behavior.fleetDetail.call(page,{detail:{id:'b737-400'}});assert.equal(page.data.fleetSelected.rows.length,1);assert.equal(page.data.fleetSelected.badge,undefined);
 const share=require('../miniprogram/lib/collection-share').buildCollectionSnapshot({rows},'2026-11-09');assert.equal(share.badges.length,1);assert.equal(share.summary.flights,3);
});
test('new indexed badge PNGs include transparency for their exterior palette index',()=>{
 const fs=require('fs'),path=require('path');
 for(const id of ['a319neo','b737-max9','a220-100','e175','b757-200','e190-e2','e195-e2','b747-8i']){
  const png=fs.readFileSync(path.join(__dirname,'../miniprogram/badges4/assets',id+'.png'));let palette,alpha;
  for(let offset=8;offset<png.length;){const length=png.readUInt32BE(offset),type=png.toString('ascii',offset+4,offset+8),data=png.subarray(offset+8,offset+8+length);if(type==='PLTE')palette=data;if(type==='tRNS')alpha=data;offset+=12+length}
  assert.equal(palette.length,768,id+' full palette');assert.equal(alpha.length,256,id+' transparency table');assert.equal(alpha[255],0,id+' exterior transparent');assert.equal(alpha[0],255,id+' artwork opaque');
 }
});
test('all 50 badge assets unlock and share without losing records or mixing model identities',()=>{
 const fs=require('fs'),path=require('path'),art=require('../miniprogram/lib/badge-assets');
 const rows=art.flatMap((a,i)=>[0,1].map(j=>({_id:a.id+j,date:'2025-01-01',from:'SHA',to:'PEK',aircraft:a.name,flight:String(i*2+j+1)})));
 const before=JSON.stringify(rows),today='2026-11-09',fleet=require('../miniprogram/lib/fleet').collection(rows,today);
 assert.equal(fleet.unlocked,50);assert.equal(fleet.recordedTypes,50);assert.equal(fleet.recordedFlights,100);
 const share=require('../miniprogram/lib/collection-share').buildCollectionSnapshot({rows},today);assert.equal(share.badges.length,50);assert.equal(share.summary.flights,100);
 for(const a of art){assert.equal(fleet.items.find(v=>v.id===a.id).count,2);assert.equal(share.badges.find(v=>v.id===a.id).count,2);assert.equal(require('../miniprogram/lib/badge-share').buildBadgeSnapshot({rows},today,a.id,[0,1]).records.length,2);assert(fs.statSync(path.join(__dirname,'../miniprogram',a.badge)).size<200*1024)}
 assert.equal(JSON.stringify(rows),before);assert.deepEqual(require('../cloudfunctions/atlas-share/domain/collection-share').buildCollectionSnapshot({rows},today),share);
});
test('ICAO catalog is one code per badge with explicit ATR and E175 ambiguity boundaries',()=>{
 const fs=require('fs'),path=require('path'),catalog=aircraftCatalog,art=require('../miniprogram/lib/badge-assets');
 assert.equal(catalog.length,54);assert.equal(new Set(catalog.map(a=>a.icao)).size,54);assert(catalog.every(a=>/^[A-Z0-9]{2,4}$/.test(a.icao)));
 assert.equal(art.length,50);assert.equal(new Set(art.map(a=>a.icao)).size,50);
 for(const a of catalog)assert.equal(resolveAircraft(a.icao)?.id,a.id,a.icao);
 assert.equal(resolveAircraft('Boeing 777-200').id,resolveAircraft('777-200ER').id);assert.equal(resolveAircraft('B772').id,'b777-200');
 assert.equal(resolveAircraft('B748').id,resolveAircraft('747-8F').id);assert.equal(resolveAircraft('777F').id,resolveAircraft('B77L').id);
 assert.equal(resolveAircraft('AT46').id,'atr42-600');assert.equal(resolveAircraft('AT76').id,'atr72-600');
 for(const text of ['ATR 42','ATR 72','ATR42-500','ATR72-500','AT45','AT75','E175','ERJ175'])assert.equal(resolveAircraft(text),null,text);
 assert.notEqual(resolveAircraft('E75L').id,resolveAircraft('E75S').id);
 for(const id of ['atr42-600','atr72-600','e175-short','e175-long']){const a=art.find(a=>a.id===id),png=fs.readFileSync(path.join(__dirname,'../miniprogram',a.badge));let alpha;for(let o=8;o<png.length;){let n=png.readUInt32BE(o);if(png.toString('ascii',o+4,o+8)==='tRNS')alpha=png.subarray(o+8,o+8+n);o+=12+n}assert.equal(alpha[255],0,id);assert(png.length<200*1024)}
 const models=['777-200','777-200ER','E75L','E75S','E175','ATR 42','ATR 42-600','ATR 72-600'];const rows=models.map((aircraft,i)=>({_id:'icao'+i,date:'2025-01-01',from:'SHA',to:'PEK',flight:String(i+1),aircraft}));const original=JSON.stringify(rows),data=require('../miniprogram/lib/fleet').collection(rows,'2026-11-09');
 assert.equal(data.items.find(a=>a.id==='b777-200').count,2);assert.equal(data.unlocked,5);assert.equal(data.recordedFlights,8);assert.equal(JSON.stringify(rows),original);
 const filters=require('../miniprogram/lib/record-filters').aircraftOptions(rows);assert.equal(filters.find(a=>a.value==='b777-200').count,2);
 assert.deepEqual(require('../cloudfunctions/atlas-share/domain/collection-share').buildCollectionSnapshot({rows},'2026-11-09'),require('../miniprogram/lib/collection-share').buildCollectionSnapshot({rows},'2026-11-09'));
 // Historical shared snapshots retain their original asset paths after classification changes.
 for(const file of ['badges0/assets/atr42.png','badges3/assets/atr72.png','badges4/assets/e175.png','badges0/assets/b777-200er.png'])assert(fs.existsSync(path.join(__dirname,'../miniprogram',file)));
});
test('unresolved Chinese manufacturers remain in the correct collection section without unlocking',()=>{
 const {aircraftManufacturer}=require('../miniprogram/lib/aircraft');
 for(const [name,maker]of [['波音737','Boeing'],['空客A340-600','Airbus'],['空中客车 A220','Airbus'],['A220','Airbus'],['Custom Jet','Other']])assert.equal(aircraftManufacturer(name),maker,name);
 const rows=['波音737','空客A340-600'].map((aircraft,i)=>({date:'2025-01-0'+(i+1),from:'SHA',to:'PEK',aircraft}));
 const c=require('../miniprogram/lib/fleet').collection(rows,'2026-11-09');assert.equal(c.unlocked,0);assert.equal(c.items.find(a=>a.name==='波音737').manufacturer,'Boeing');assert.equal(c.items.find(a=>a.name==='空客A340-600').manufacturer,'Airbus');
 assert.deepEqual(require('../cloudfunctions/atlas-share/domain/fleet').collection(rows,'2026-11-09'),c);
});
test('requested five aircraft share ICAO identity across aliases, search, filters and snapshots',()=>{
 const {searchAircraft}=require('../miniprogram/lib/aircraft'),fs=require('fs'),path=require('path'),art=require('../miniprogram/lib/badge-assets');
 const cases={B739:'b737-900','737-900ER':'b737-900','波音737-900':'b737-900',CRJ7:'crj700',CR7:'crj700','庞巴迪CRJ700':'crj700',CRJ9:'crj900',CR9:'crj900',E170:'e170',E70:'e170',A343:'a340-300','空客A340-300':'a340-300'};
 for(const [name,id]of Object.entries(cases)){assert.equal(resolveAircraft(name)?.id,id,name);assert.equal(searchAircraft(name)[0]?.id,id,name)}
 assert.equal(resolveAircraft('A340-600'),null);assert.equal(resolveAircraft('CRJ1000'),null);
 const rows=Object.keys(cases).map((aircraft,i)=>({_id:'new-five'+i,date:'2025-01-01',from:'SHA',to:'PEK',flight:String(i+1),aircraft}));const data=require('../miniprogram/lib/fleet').collection(rows,'2026-11-10');assert.equal(data.unlocked,5);assert.equal(data.recordedTypes,5);assert.equal(data.recordedFlights,rows.length);
 const snapshot=require('../miniprogram/lib/collection-share').buildCollectionSnapshot({rows},'2026-11-10');assert.equal(snapshot.badges.length,5);assert.deepEqual(snapshot,require('../cloudfunctions/atlas-share/domain/collection-share').buildCollectionSnapshot({rows},'2026-11-10'));
 for(const id of new Set(Object.values(cases))){const a=art.find(a=>a.id===id),png=fs.readFileSync(path.join(__dirname,'../miniprogram',a.badge));let alpha;for(let o=8;o<png.length;){const n=png.readUInt32BE(o);if(png.toString('ascii',o+4,o+8)==='tRNS')alpha=png.subarray(o+8,o+8+n);o+=12+n}assert.equal(alpha[255],0,id);assert(png.length<200*1024)}
});
