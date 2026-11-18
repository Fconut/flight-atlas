const d3=require('./d3');
const wrap=lon=>((lon+180)%360+360)%360-180;
function mapProjection(data){
 const routes=data.routes.map((route,index)=>{
  const interpolate=d3.geoInterpolate(data.airports[route.a].xy,data.airports[route.b].xy);
  return {route,index,samples:Array.from({length:129},(_,i)=>interpolate(i/128))};
 });
 let center=125,best=Infinity;
 for(let candidate=-180;candidate<180;candidate+=5){
  let score=0;
  for(const {route,samples}of routes){
   const crosses=samples.some((p,i)=>i&&Math.abs(wrap(p[0]-candidate)-wrap(samples[i-1][0]-candidate))>180);
   if(crosses)score+=100*Math.sqrt(route.flights.length);
  }
  for(const airport of Object.values(data.airports)){const edge=180-Math.abs(wrap(airport.xy[0]-candidate));if(edge<8)score+=(8-edge)*.25}
  score+=Math.abs(wrap(candidate-125))*.00001;
  if(score<best){best=score;center=candidate}
 }
 // Preserve the original scale and geographic placement; extend the viewport instead.
 const scale=1600/(2*Math.PI);
 const projection=d3.geoMercator().rotate([-center,0]).center([0,36]).scale(scale).translate([800,425]);
 const points=[...Object.values(data.airports).map(a=>a.xy),...routes.flatMap(r=>r.samples)];
 const ys=points.map(p=>projection([p[0],Math.max(-85,Math.min(85,p[1]))])[1]);
 const top=Math.min(0,Math.floor(Math.min(...ys)-35)),bottom=Math.max(850,Math.ceil(Math.max(...ys)+35));
 const mapHeight=bottom-top;
 projection.translate([800,425-top]).clipExtent([[0,0],[1600,mapHeight]]);
 return {projection,center,mapHeight,extraHeight:(mapHeight-850)*1080/1600};
}
module.exports={mapProjection};
