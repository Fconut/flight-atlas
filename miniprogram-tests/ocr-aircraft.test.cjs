const test=require('node:test'),assert=require('node:assert/strict');
const {parseFlightScreenshot}=require('../miniprogram/airport-picker/lib/screenshot-parser');
const {resolveAircraft}=require('../miniprogram/lib/aircraft');
test('OCR model lines never become phantom flights and newly added types reach the collection',()=>{
 const models=['CRJ900','CRJ700','E170','B739','A343','737-900ER','E175 长翼','E175','ATR 72','CRJ9O0'];
 const text=models.map((m,i)=>`2025-01-01\nCA${100+i}\n08:00 上海虹桥\n10:00 北京首都\n机型：${m}`).join('\n');
 const parsed=parseFlightScreenshot(text);assert.equal(parsed.length,10);assert.deepEqual(parsed.map(r=>r.aircraft),models);assert.equal(parsed[9].rawAircraft,'CRJ9O0');
 assert.equal(resolveAircraft(parsed[6].aircraft).icao,'E75L');for(const i of [7,8,9])assert.equal(resolveAircraft(parsed[i].aircraft),null);
 const bare=parseFlightScreenshot('2025-01-01\nCA100\n08:00 上海虹桥\n10:00 北京首都\nCRJ900\nCA101\n11:00 上海虹桥\n13:00 北京首都\nE170');assert.equal(bare.length,2);assert.deepEqual(bare.map(r=>r.aircraft),['CRJ900','E170']);
 const rows=parsed.map(r=>({...r,from:'SHA',to:'PEK'})),before=JSON.stringify(rows),fleet=require('../miniprogram/lib/fleet').collection(rows,'2026-11-10');assert.equal(fleet.unlocked,6);assert.equal(fleet.items.find(a=>a.icao==='B739').count,2);assert.equal(JSON.stringify(rows),before);
 const snapshot=require('../miniprogram/lib/collection-share').buildCollectionSnapshot({rows},'2026-11-10');assert.equal(snapshot.badges.length,6);assert.equal(snapshot.summary.flights,10);
});
test('OCR review offers model choices without auto-changing ambiguous text or blocking import',()=>{
 let page;global.Page=p=>page=p;delete require.cache[require.resolve('../miniprogram/airport-picker/pages/image-import')];const {validate}=require('../miniprogram/airport-picker/pages/image-import');
 page.search={resolve:v=>['SHA','PEK'].includes(v)?v:'',query:()=>[]};const row={_key:0,date:'2025-01-01',airline:'CA',flight:'123',from:'SHA',to:'PEK',aircraft:'E175',rawAircraft:'E175',selected:true};
 const reviewed=page.reviewRow(row);assert.equal(reviewed.invalid,false);assert.equal(reviewed.aircraft,'E175');assert.equal(reviewed.modelOptions.length,2);
 let patch;page.updateReviewRow=(index,value)=>patch=value;page.chooseModel({currentTarget:{dataset:{index:0,value:'EMBRAER E175 LONG WING'}}});const updated=page.reviewRow({...row,...patch});assert.equal(resolveAircraft(updated.aircraft).icao,'E75L');assert.equal(updated.rawAircraft,'E175');assert.equal(updated.modelOptions.length,0);assert.equal(validate(updated,page.search).value.aircraft,'EMBRAER E175 LONG WING');
 const unknown=page.reviewRow({...row,aircraft:'CRJ9O0'});assert.equal(unknown.invalid,false);assert.equal(unknown.modelUnmatched,true);assert.equal(unknown.aircraft,'CRJ9O0');delete global.Page;
});
