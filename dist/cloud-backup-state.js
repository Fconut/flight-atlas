'use strict';
function backupContentKey(snapshot){
 const clean=value=>Array.isArray(value)?value.map(clean):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).filter(k=>!['_id','_line'].includes(k)).sort().map(k=>[k,clean(value[k])])):value;
 const rows=(snapshot.sheets?.length?snapshot.sheets.flatMap(s=>s.rows):snapshot.rows||[]).map(clean).map(r=>JSON.stringify(r)).sort();
 return JSON.stringify(clean({rows,colors:snapshot.colors||null,labels:snapshot.labelSelection===null?null:[...(snapshot.labelSelection||[])].sort(),includeFuture:!!snapshot.includeFuture}));
}
function cloudBackupSummary(snapshot){return {count:snapshot?(snapshot.sheets?.length?snapshot.sheets.flatMap(s=>s.rows):snapshot.rows||[]).length:0,savedAt:snapshot?.savedAt||null};}

async function saveReviewedCloud({snapshot,readCloud,confirmSave,keepPrevious,writeCloud}){
 const cloud=await readCloud();
 if(cloud&&backupContentKey(snapshot)===backupContentKey(cloud.payload))return {status:'unchanged',cloud};
 if(!await confirmSave(cloud))return {status:'canceled',cloud};
 if(cloud)await keepPrevious(cloud);
 const revision=await writeCloud(snapshot,cloud?.revision||0);
 return {status:'saved',cloud:{payload:snapshot,revision,updated_at:new Date().toISOString()}};
}
