const test=require('node:test'),assert=require('node:assert/strict'),{replayData}=require('../miniprogram/lib/flight-replay');
test('completed trails draw once, append on advancement and rebuild after seeking backward',()=>{
 const p=require('../miniprogram/pages/flight-replay/replay-page')(false);let strokes=0,resets=0;
 const ctx=new Proxy({stroke(){strokes++}},{get:(o,k)=>k in o?o[k]:()=>{}});
 p.timeline=replayData([{date:'2025-01-01',from:'SHA',to:'PEK',flight:'1'},{date:'2025-01-02',from:'PEK',to:'NRT',flight:'2'}],'2026-11-13');
 p.layout=require('../miniprogram/lib/poster-projection').mapProjection(p.timeline);p.base={getContext:()=>ctx};p.mapOffset=[0,0];p.mapScale=1;p.colors={route:'#dfbc7e'};p.trailIndex=0;p.data.index=1;
 p.prepareTrails();assert.equal(strokes,1);p.prepareTrails();assert.equal(strokes,1);
 p.data.index=2;p.prepareTrails();assert.equal(strokes,2);
 p.paintBase=()=>{resets++;p.trailIndex=0};p.data.index=1;p.prepareTrails();assert.equal(resets,1);assert.equal(strokes,3);
});
test('airport label layout is reused across frames and rebuilt only when visible labels change',()=>{
 const p=require('../miniprogram/pages/flight-replay/replay-page')(false);let measures=0;
 const ctx=new Proxy({measureText:()=>{measures++;return {width:90}}},{get:(o,k)=>k in o?o[k]:()=>{}});
 p.labelCodes=new Set(['SHA','PEK']);p.colors={background:'#132638'};p.timeline={airports:{SHA:{xy:[121,31]},PEK:{xy:[116,40]}}};p.layout={mapHeight:850,projection:xy=>xy};
 p.paintLabels(ctx,new Set(['SHA']));assert.equal(measures,1);assert.equal(ctx.font,'21px sans-serif');
 p.paintLabels(ctx,new Set(['SHA']));assert.equal(measures,1);
 p.paintLabels(ctx,new Set(['SHA','PEK']));assert.equal(measures,3);assert.equal(p.labelLayout.boxes.length,2);
});
test('replay respects custom, empty, disabled and recommended airport label selections',()=>{
 const {replayLabelCodes}=require('../miniprogram/lib/flight-replay'),airports={SHA:{xy:[121,31]},LYR:{xy:[15,78]},USH:{xy:[-68,-54]}};
 assert.deepEqual([...replayLabelCodes(airports,{labelSelection:['LYR','XXX']})],['LYR']);
 assert.equal(replayLabelCodes(airports,{labelSelection:[]}).size,0);assert.equal(replayLabelCodes(airports,{labels:false}).size,0);
 assert(replayLabelCodes(airports).has('LYR'));assert(replayLabelCodes(airports).has('USH'));
});
test('canvas taps prefer viewport coordinates and normalize display scaling and offsets',()=>{
 const {replayTouchPoint}=require('../miniprogram/lib/flight-replay');
 const rect={left:10,top:20,width:900,height:400};
 assert.deepEqual(replayTouchPoint({changedTouches:[{clientX:460,clientY:220,x:999,y:999}]},rect,1800,800),{x:900,y:400});
 assert.deepEqual(replayTouchPoint({detail:{x:450,y:200}},rect,1800,800),{x:900,y:400});
 assert.equal(replayTouchPoint({},rect,1800,800),null);
});
test('fullscreen tap hit-testing invokes play, restart, speed and exit exactly once',()=>{
 const p=require('../miniprogram/pages/flight-replay/replay-page')(true),calls=[];
 p.data={...p.data,mapWidth:900,mapHeight:400};p.canvasRect={left:10,top:20,width:900,height:400};p.createSelectorQuery=()=>({select(){return this},boundingClientRect(cb){cb(p.canvasRect);return this},exec(){}});
 p.hitTargets=['orientation','toggle','restart','speed'].map((action,i)=>({x:i*100,y:10,width:80,height:40,action}));
 for(const name of ['orientation','toggle','restart','speed'])p[name]=()=>calls.push(name);
 for(let i=0;i<4;i++)p.touchCanvas({changedTouches:[{clientX:10+i*100+20,clientY:40,x:999,y:999}]});
 assert.deepEqual(calls,['orientation','toggle','restart','speed']);
});
test('playing hides expired controls and tapping the map reveals them again',()=>{
 const p=require('../miniprogram/pages/flight-replay/replay-page')(true);p.data={...p.data,playing:true,mapWidth:900,mapHeight:400};p.hudUntil=0;p.hitTargets=[{action:'old'}];
 p.paintControls();assert.deepEqual(p.hitTargets,[]);
 p.createSelectorQuery=()=>({select(){return this},boundingClientRect(cb){cb({left:0,top:0,width:900,height:400});return this},exec(){}});
 let painted=false;p.paint=()=>painted=true;p.touchCanvas({changedTouches:[{clientX:450,clientY:200}]});assert(p.hudUntil>Date.now());assert.equal(painted,true);
});
test('replay excludes future, cancelled and invalid records, deduplicates and sorts by local departure date/time',()=>{
 const base={date:'2025-01-02',from:'SHA',to:'PEK',airline:'CA',flight:'1'};
 const rows=[{...base,departureTime:'20:00'},{...base,flight:'2',departureTime:'08:00'},{...base,date:'2025-01-01',flight:'3'},{...base,date:'2027-01-01'},{...base,canceled:true,flight:'4'},{...base,from:'XXX',flight:'5'},{...base,departureTime:'20:00'}];
 const original=JSON.stringify(rows),result=replayData(rows,'2026-11-11');assert.deepEqual(result.flights.map(r=>r.flight),['3','2','1']);assert.equal(result.routes.length,3);assert.equal(result.airports.SHA.n,3);assert.equal(JSON.stringify(rows),original);
});
test('replay releases animation and canvases on exit and pauses on hide',()=>{
 let definition;global.Page=p=>definition=p;
 try{
  delete require.cache[require.resolve('../miniprogram/pages/flight-replay/index')];require('../miniprogram/pages/flight-replay/index');
  const p={...definition,data:{...definition.data},setData(v){Object.assign(this.data,v)},canvas:{width:100,height:100,cancelAnimationFrame(id){assert.equal(id,7)}},base:{width:100,height:100},frame:7};
  p.onHide();assert.equal(p.data.playing,false);assert.equal(p.frame,null);p.onUnload();assert.equal(p.canvas.width,1);assert.equal(p.base.height,1);
 }finally{delete global.Page}
});
test('landscape replay returns its progress and speed only to the same account',()=>{
 const create=require('../miniprogram/pages/flight-replay/replay-page');
 const wide=create(true);wide.scope='same';wide.data={...wide.data,ready:true,index:12,speed:4};wide.fraction=.6;wide.setData=function(v){Object.assign(this.data,v)};wide.onUnload();
 const portrait=create(false);portrait.scope='same';portrait.canvas={};portrait.setData=function(v){Object.assign(this.data,v)};portrait.seekIndex=function(v){this.data.index=v};portrait.paint=function(v){this.paintedFraction=v};portrait.onShow();
 assert.equal(portrait.data.index,12);assert.equal(portrait.data.speed,4);assert.equal(portrait.paintedFraction,.6);
 wide.onUnload();portrait.scope='different';portrait.data.index=2;portrait.onShow();assert.equal(portrait.data.index,2);
});
test('landscape uses the whole viewport and fits the complete map without stretching',()=>{
 global.wx={getWindowInfo:()=>({windowWidth:844,windowHeight:390})};
 try{
  const p=require('../miniprogram/pages/flight-replay/replay-page')(true);p.canvas={};p.base={};p.layout={mapHeight:943};p.setData=function(v){Object.assign(this.data,v)};p.resizeViewport();
  assert.equal(p.data.mapWidth,844);assert.equal(p.data.mapHeight,390);
  assert(p.mapScale*1600<=p.canvas.width+.01);assert(p.mapScale*943<=p.canvas.height+.01);assert(p.mapOffset.every(v=>v>=0));
  p.resizeViewport({windowWidth:390,windowHeight:844});assert.equal(p.data.mapWidth,844);assert.equal(p.data.mapHeight,390);
  p.resizeViewport({windowWidth:932,windowHeight:430});assert.equal(p.data.mapWidth,932);assert.equal(p.data.mapHeight,430);
 }finally{delete global.wx}
});
test('completed route geometry is reused and invalid viewport sizes do not allocate canvases',()=>{
 const p=require('../miniprogram/pages/flight-replay/replay-page')(true);
 p.timeline=replayData([{date:'2025-01-01',from:'SHA',to:'PEK',flight:'1'}],'2026-11-12');
 const first=p.prepareGeometry();assert.equal(p.prepareGeometry(),first);assert.equal(first[0].line.coordinates.length,49);
 p.canvas={width:10,height:10};p.base={};p.layout={mapHeight:850};
 assert.equal(p.resizeViewport({windowWidth:0,windowHeight:0}),false);assert.equal(p.canvas.width,10);
});
test('fullscreen progress and playback button hit regions do not overlap',()=>{
 const ctx=new Proxy({measureText:()=>({width:40})},{get:(o,k)=>k in o?o[k]:()=>{}});
 const p=require('../miniprogram/pages/flight-replay/replay-page')(true);p.canvas={width:900,getContext:()=>ctx};
 p.data={...p.data,mapWidth:900,mapHeight:400,total:10,index:10,date:'2025-01-01',flight:'CA1',fromName:'上海',toName:'北京'};p.fraction=.9;p.paintControls();
 const progress=p.hitTargets.find(b=>b.action==='progress');
 for(const button of p.hitTargets.filter(b=>['toggle','speed','restart'].includes(b.action)))assert(progress.y+progress.height<=button.y);
});
test('pause cancels animation handle zero as well as positive handles',()=>{
 const p=require('../miniprogram/pages/flight-replay/replay-page')(false);let canceled;
 p.frame=0;p.canvas={cancelAnimationFrame:id=>canceled=id};p.setData=()=>{};p.pause();assert.equal(canceled,0);assert.equal(p.frame,null);
});
test('high-density phones render replay at physical pixel resolution within the canvas memory budget',()=>{
 global.wx={getWindowInfo:()=>({pixelRatio:3})};
 try{
  const p=require('../miniprogram/pages/flight-replay/replay-page')(true);p.canvas={};p.base={};p.layout={mapHeight:850};p.setData=function(v){Object.assign(this.data,v)};
  p.resizeViewport({windowWidth:932,windowHeight:430});assert.equal(p.canvas.width,2796);assert.equal(p.canvas.height,1290);assert.equal(p.base.width,p.canvas.width);
  p.resizeViewport({windowWidth:2000,windowHeight:1000});assert(p.canvas.width*p.canvas.height<4010000);
 }finally{delete global.wx}
});

test('seeking preserves fractional position, updates flight details and reaches a complete ending',()=>{
 const p=require('../miniprogram/pages/flight-replay/replay-page')(false);p.timeline={flights:[{date:'2025-01-01',from:'SHA',to:'PEK',airline:'CA',flight:'1'},{date:'2025-01-02',from:'PEK',to:'NRT',airline:'CA',flight:'2'}]};p.data={...p.data,ready:true,total:2};p.setData=function(v){Object.assign(this.data,v)};p.paint=function(f){this.painted=f};
 p.seek({detail:{value:75}});assert.equal(p.data.index,1);assert.equal(p.fraction,.5);assert.equal(p.data.progress,75);assert.equal(p.data.flight,'CA2');assert.equal(p.painted,.5);assert.equal(p.data.playing,false);
 p.seek({detail:{value:100}});assert.equal(p.data.ended,true);assert.equal(p.data.index,2);assert.equal(p.fraction,0);
 p.seek({detail:{value:0}});assert.equal(p.data.ended,false);assert.equal(p.data.flight,'CA1');
});

test('playback advances progress within a flight, preserves overflow and stops at the end',()=>{
 const p=require('../miniprogram/pages/flight-replay/replay-page')(false);p.timeline={flights:[{date:'2025-01-01',from:'SHA',to:'PEK'},{date:'2025-01-02',from:'PEK',to:'NRT'}]};p.data={...p.data,ready:true,total:2,playing:true};p.setData=function(v){Object.assign(this.data,v)};p.paint=()=>{};p.canvas={requestAnimationFrame:()=>7,cancelAnimationFrame:()=>{}};
 const original=Date.now;let now=1000;Date.now=()=>now;
 try{p.fraction=.3;p.lastTime=900;p.tick();assert(p.data.progress>15);assert.equal(p.data.index,0);p.fraction=.95;now=1100;p.tick();assert.equal(p.data.index,1);assert(Math.abs(p.fraction-(.95+1/12-1))<1e-8);p.fraction=.99;now=1200;p.tick();assert.equal(p.data.ended,true);assert.equal(p.data.progress,100);assert.equal(p.data.playing,false);assert.equal(p.frame,null);}finally{Date.now=original}
});

test('landscape dragging captures progress, clamps outside bounds and does not trigger buttons on release',()=>{
 const p=require('../miniprogram/pages/flight-replay/replay-page')(true),values=[];p.data={...p.data,mapWidth:900,mapHeight:400};p.hitTargets=[{x:100,y:100,width:200,height:32,action:'progress'}];p.createSelectorQuery=()=>({select(){return this},boundingClientRect(cb){cb({left:0,top:0,width:900,height:400});return this},exec(){}});p.seek=e=>values.push(e.detail.value);p.touchCanvas=()=>assert.fail('drag must not also tap');const event=(x,y=110)=>({changedTouches:[{clientX:x,clientY:y}]});
 p.dragStart(event(150));p.dragMove(event(250,300));p.dragEnd(event(400));assert.deepEqual(values,[25,75,100]);assert.equal(p.replayGesture,null);assert(p.hudUntil>Date.now());
 p.dragStart(event(150));p.dragCancel();p.dragMove(event(200));assert.equal(values.length,4);
});
test('quick drag release waits for measurement and cancellation ignores late callbacks',()=>{
 const p=require('../miniprogram/pages/flight-replay/replay-page')(true),values=[];let callback;p.data={...p.data,mapWidth:900,mapHeight:400};p.hitTargets=[{x:100,y:100,width:200,height:32,action:'progress'}];p.createSelectorQuery=()=>({select(){return this},boundingClientRect(cb){callback=cb;return this},exec(){}});p.seek=e=>values.push(e.detail.value);const event=x=>({changedTouches:[{clientX:x,clientY:110}]});
 p.dragStart(event(150));p.dragMove(event(200));p.dragEnd(event(250));callback({width:900,height:400});assert.deepEqual(values,[75]);assert.equal(p.replayGesture,null);p.dragStart(event(150));p.dragCancel();callback({width:900,height:400});assert.deepEqual(values,[75]);
});

test('seeking paints only the selected position and malformed progress leaves playback unchanged',()=>{
 const p=require('../miniprogram/pages/flight-replay/replay-page')(true);p.timeline={flights:[{date:'2025-01-01',from:'SHA',to:'PEK'}]};p.data={...p.data,total:1,ready:true,playing:true};p.setData=function(v){Object.assign(this.data,v)};let paints=0,canceled=0;p.paint=()=>paints++;p.canvas={cancelAnimationFrame:()=>canceled++};p.frame=7;
 p.seek({detail:{value:'bad'}});assert.equal(p.data.playing,true);assert.equal(canceled,0);assert.equal(paints,0);p.seek({detail:{value:50}});assert.equal(paints,1);assert.equal(canceled,1);assert.equal(p.data.playing,false);assert.equal(p.fraction,.5);p.restart();assert.equal(paints,2);assert.equal(p.fraction,0);
});
