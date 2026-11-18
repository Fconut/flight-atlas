const {resolveAircraft,searchAircraft,aircraftCatalog}=require('./aircraft');
const {normalizeAirlineCode,airlineDirectory}=require('./flights');
const names=require('./names');
const normalize=value=>String(value??'').normalize('NFKC').toLowerCase().replace(/[\s._-]+/g,'');
const airlines=new Map(airlineDirectory.map(([icao,iata,name])=>[iata,[icao,iata,name]]));
const shortNames={CA:'国航',MU:'东航',CZ:'南航',HU:'海航',MF:'厦航',ZH:'深航',SC:'山航','3U':'川航',FM:'上航'};
function buildIndex(rows){return rows.map(row=>{
 const model=resolveAircraft(row.aircraft),airline=normalizeAirlineCode(row.airline);
 const fields=[row.date,row.departureTime,row.from,row.to,row.airline,row.flight,row.aircraft,names[String(row.from||'').toUpperCase()],names[String(row.to||'').toUpperCase()],...(airlines.get(airline)||[]),shortNames[airline],model?.name,model?.id];
 return {text:fields.filter(v=>v!=null).map(normalize).join('|'),aircraft:model?.id};
})}
function matcher(value){
 const raw=String(value||'').trim(),q=normalize(raw);if(!q)return ()=>true;
 const exact=resolveAircraft(raw),models=new Set((exact?[exact]:searchAircraft(raw,[],aircraftCatalog.length)).map(a=>a.id));
 return entry=>entry.text.includes(q)||!!entry.aircraft&&models.has(entry.aircraft);
}
module.exports={buildIndex,matcher};
