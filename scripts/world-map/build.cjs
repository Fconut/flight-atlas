// Build only merged land geometry: no country boundaries enter the runtime map.
// node scripts/world-map/build.cjs [--check]
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const topology=JSON.parse(fs.readFileSync(path.join(root,'dist/data/world.json'),'utf8'));
const used=new Map();
function remap(value){
  if(Array.isArray(value))return value.map(remap);
  const original=value<0?~value:value;
  if(!used.has(original))used.set(original,used.size);
  const next=used.get(original);
  return value<0?~next:next;
}
const geometries=topology.objects.land.geometries.map(({type,arcs})=>({type,arcs:remap(arcs)}));
function encode(v){let x=v<0?~(v<<1):v<<1,s='';while(x>=32){s+=String.fromCharCode((32|(x&31))+63);x>>>=5}return s+String.fromCharCode(x+63)}
const packed=[...used.keys()].map(i=>topology.arcs[i].map(p=>encode(p[0])+encode(p[1])).join(''));
const output=`// Generated land-only map by scripts/world-map/build.cjs.\nconst packed=${JSON.stringify(packed)},geometries=${JSON.stringify(geometries)},transform=${JSON.stringify(topology.transform)};const arcs=packed.map(s=>{let i=0,x=0,y=0,points=[];function n(){let r=0,shift=0,b;do{b=s.charCodeAt(i++)-63;r|=(b&31)<<shift;shift+=5}while(b>=32);return r&1?~(r>>>1):r>>>1}while(i<s.length){x+=n();y+=n();points.push([x*transform.scale[0]+transform.translate[0],y*transform.scale[1]+transform.translate[1]])}return points});function ring(ids){const p=[];for(const id of ids){const a=id<0?[...arcs[~id]].reverse():arcs[id];p.push(...(p.length?a.slice(1):a))}return p}module.exports={type:'FeatureCollection',features:geometries.map(g=>({type:'Feature',geometry:{type:g.type,coordinates:g.type==='Polygon'?g.arcs.map(ring):g.arcs.map(p=>p.map(ring))}}))};`;
const target=path.join(root,'miniprogram/lib/world.js');
if(process.argv.includes('--check')){
  if(fs.readFileSync(target,'utf8')!==output)throw Error('Runtime land map is outdated');
  console.log('Land-only runtime map agrees with source topology');
}else{
  const existing=fs.existsSync(target)?fs.readFileSync(target,'utf8'):'';
  if(existing===output){console.log('Land-only map already current; no file rewritten');process.exit(0)}
  const before=Buffer.byteLength(existing);fs.writeFileSync(target,output);
  console.log(`Built merged land geometry: ${used.size} arcs; ${before} -> ${Buffer.byteLength(output)} bytes`);
}
