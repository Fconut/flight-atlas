const test=require('node:test'),assert=require('node:assert/strict');
const {mapProjection}=require('../miniprogram/lib/poster-projection'),d3=require('../miniprogram/lib/d3'),airports=require('../miniprogram/lib/airports');
const {calculate}=require('../miniprogram/lib/flights');
test('single, dense, transoceanic and 500-flight samples keep dense route points inside the viewport',()=>{
 for(const [codes,count]of [[['SHA','PEK'],1],[['LHR','CDG','AMS','BRU','FRA','ZRH','MUC','VIE','PRG','FCO'],50],[['PVG','LAX','NRT','SFO','ICN','YVR','HKG','SEA','SYD'],50],[['JFK','LHR','BOS','CDG','IAD','FRA','ORD','AMS'],50],[['LYR','FRA','JFK','EZE','USH','SCL','AKL','SYD','JNB'],500]]){
  const rows=Array.from({length:count},(_,i)=>({date:'2025-01-01',from:codes[i%(codes.length-1)],to:codes[i%(codes.length-1)+1],flight:String(i+1)})),result=calculate(rows,airports,'2026-11-10',false),layout=mapProjection(result);
  assert.equal(result.total,count);assert.equal(layout.projection.scale(),1600/(2*Math.PI));
  for(const route of result.routes){const interpolate=d3.geoInterpolate(result.airports[route.a].xy,result.airports[route.b].xy);for(let i=0;i<=1024;i++){const [x,y]=layout.projection(interpolate(i/1024));assert(Number.isFinite(x)&&Number.isFinite(y));assert(y>=0&&y<=layout.mapHeight,route.a+'-'+route.b);}}
 }
});
function data(codes){return calculate(codes.slice(1).map((to,i)=>({date:'2025-01-01',from:codes[i],to,flight:String(i+1)})),airports,'2026-11-10',false)}
function check(result){
 const original=JSON.stringify(result),{projection,mapHeight}=mapProjection(result);assert.equal(projection.rotate()[1],0,'world map stays north-up');assert.equal(projection.scale(),1600/(2*Math.PI),'original map scale is fixed');
 for(const [index,r]of result.routes.entries()){
  let starts=0,points=[];const stream=projection.stream({lineStart(){starts++},lineEnd(){},point(x,y){points.push([x,y])},polygonStart(){},polygonEnd(){}});d3.geoStream({type:'LineString',coordinates:[result.airports[r.a].xy,result.airports[r.b].xy]},stream);
  assert(starts>=1);for(const [x,y]of points)assert(x>=0&&x<=1600&&y>=35&&y<=mapHeight-35,r.a+'-'+r.b+' stays in view');
  const line=d3.geoInterpolate(result.airports[r.a].xy,result.airports[r.b].xy);for(let i=0;i<=128;i++){const [x,y]=projection(line(i/128));assert(Number.isFinite(x)&&Number.isFinite(y)&&y>=35&&y<=mapHeight-35)}
 }
 assert.equal(JSON.stringify(result),original);return {projection};
}
test('southern world map fits curves at original scale without numbered markers',()=>{
 const result=data(['SCL','LIM','GRU','EZE','SCL','AKL','SYD','MEL','SYD','JNB','CPT','JNB','GRU','SCL']);check(result);const source=require('node:fs').readFileSync(require('node:path').join(__dirname,'../miniprogram/lib/poster.js'),'utf8');assert(!source.includes('同号航线'));assert(!source.includes('continuation.label'));
});
test('north south and mixed flight networks share the same north-up world-map rule',()=>{
 for(const codes of [['SHA','PEK','NRT'],['SYD','MEL','AKL'],['PVG','LHR','JFK','LAX','SYD','JNB','GRU','SCL','AKL','NRT'],['KEF','SEA','NRT','HEL']])check(data(codes));
 const result=data(['SHA','PEK','NRT']),a=mapProjection(result),b=mapProjection(result);assert.equal(a.center,b.center);assert.deepEqual(a.projection(airports.SHA.xy),b.projection(airports.SHA.xy));
});

test('Ushuaia and high northern flights extend the canvas without shrinking or panning the base map',()=>{
 const result=data(['LYR','FRA','JFK','EZE','USH','SCL','AKL','SYD']),layout=mapProjection(result),dimensions=require('../miniprogram/lib/poster').posterDimensions(result);
 assert(layout.mapHeight>850);assert(dimensions.height>2300);assert.equal(dimensions.width,2160);assert.equal(layout.projection.scale(),1600/(2*Math.PI));
 const p=layout.projection(airports.USH.xy);assert(p[1]>850&&p[1]<layout.mapHeight-30);
 check(result);
 const local=data(['SHA','PEK','NRT']);assert.equal(mapProjection(local).mapHeight,850);assert.equal(require('../miniprogram/lib/poster').posterDimensions(local).height,2300);
});
