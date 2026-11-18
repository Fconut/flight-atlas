const test=require('node:test'),assert=require('node:assert/strict');
const d3=require('../miniprogram/lib/d3'),world=require('../miniprogram/lib/world');
test('merged land retains continental and island locations while leaving oceans empty',()=>{
  for(const p of[[116.4,39.9],[91.86,27.58],[79.1,35.2],[110,19],[121,23.5],[2.35,48.85],[-87.63,41.88],[134.6,48.38]])
    assert.equal(d3.geoContains(world,p),true,`land at ${p}`);
  for(const p of[[-150,0],[-30,0],[80,-20]])assert.equal(d3.geoContains(world,p),false,`ocean at ${p}`);
});
test('runtime outlines do not contain inland country boundary segments',()=>{
  const topology=require('../dist/data/world.json'),edges=new Set();
  const key=(a,b)=>[a,b].map(p=>p.map(v=>v.toFixed(6)).join(',')).sort().join('|');
  function ring(points){for(let i=1;i<points.length;i++)edges.add(key(points[i-1],points[i]))}
  for(const f of world.features){if(f.geometry.type==='Polygon')f.geometry.coordinates.forEach(ring);else f.geometry.coordinates.forEach(p=>p.forEach(ring))}
  for(const id of[1185,1188,540]){
    let x=0,y=0;const points=topology.arcs[id].map(p=>{x+=p[0];y+=p[1];return[x*topology.transform.scale[0]+topology.transform.translate[0],y*topology.transform.scale[1]+topology.transform.translate[1]]});
    for(let i=1;i<points.length;i++)assert.equal(edges.has(key(points[i-1],points[i])),false,`inland segment ${id}:${i}`);
  }
});
