const {collection}=require('./fleet');
function buildBadgeSnapshot(draft,today,id,selected){
 const rows=draft.sheets?.length?draft.sheets.flatMap(s=>s.rows):draft.rows||[];
 const item=collection(rows,today).items.find(v=>v.id===id&&v.badge&&v.count);
 if(!item)throw Error('该徽章尚未解锁');
 if(!Array.isArray(selected)||!selected.length||selected.some(i=>!Number.isInteger(i)||i<0||i>=item.rows.length))throw Error('请选择要分享的航班');
 return {version:1,kind:'badge',badge:{id:item.id,name:item.name,badge:item.badge,package:item.package},records:[...new Set(selected)].sort((a,b)=>a-b).map(i=>{const r=item.rows[i];return {date:r.date,from:r.from,to:r.to,airline:r.airline||'',flight:String(r.flight||''),departureTime:r.departureTime||''}})};
}
module.exports={buildBadgeSnapshot};
