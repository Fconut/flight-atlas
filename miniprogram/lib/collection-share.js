const {collection}=require('./fleet');
function buildCollectionSnapshot(draft,today){
 const rows=draft.sheets?.length?draft.sheets.flatMap(s=>s.rows):draft.rows||[];
 const data=collection(rows,today);
 const badges=data.items.filter(v=>v.badge&&v.count).map(({id,name,badge,package:pkg,count,manufacturer})=>({id,name,badge,package:pkg,count,manufacturer})).sort((a,b)=>b.count-a.count||a.id.localeCompare(b.id));
 if(!badges.length)throw Error('还没有解锁徽章');
 return {version:1,kind:'collection',badges,summary:{unlocked:badges.length,types:data.recordedTypes,flights:data.recordedFlights,makers:['Boeing','Airbus','Other'].map(maker=>({name:maker==='Boeing'?'波音':maker==='Airbus'?'空客':'其他',count:data.items.filter(v=>(v.manufacturer==='Boeing'?'Boeing':v.manufacturer==='Airbus'?'Airbus':'Other')===maker).reduce((n,v)=>n+v.count,0)}))}};
}
module.exports={buildCollectionSnapshot};
