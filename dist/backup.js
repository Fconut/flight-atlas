'use strict';
// Portable backups contain application data only, never authentication sessions.
function snapshotRows(draft){return draft.sheets.length?draft.sheets.flatMap(s=>s.rows):draft.rows||[];}
function validBackupRow(row){return row&&typeof row==='object'&&!Array.isArray(row)&&['date','from','to','airline','flight','aircraft','_id'].every(k=>row[k]===undefined||row[k]===null||['string','number'].includes(typeof row[k]));}
function validBackup(draft){
 if(!validSnapshot(draft)||!draft.sheets.every(sheet=>sheet.rows.every(validBackupRow))||!(draft.rows===null||draft.rows.every(validBackupRow))||!Number.isInteger(draft.activeSheet)||draft.activeSheet < -1||draft.activeSheet>=draft.sheets.length)return false;
 return (draft.labelSelection===null||Array.isArray(draft.labelSelection)&&draft.labelSelection.every(c=>typeof c==='string'&&/^[A-Z]{3}$/.test(c)))&&typeof draft.includeFuture==='boolean';
}
function downloadBackup(snapshot=localSnapshot()){
 const url=URL.createObjectURL(new Blob([JSON.stringify({format:'flight-atlas-backup',version:1,draft:snapshot},null,2)],{type:'application/json'}));
 const link=document.createElement('a');link.href=url;link.download='flight-atlas-backup-'+localDate()+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
}
async function applyBackup(snapshot){
 if(!validBackup(snapshot))throw Error('备份格式无效，本机记录未改动。');
 await draftWrites;const key=draftKey,epoch=draftEpoch,recovery=localSnapshot(),db=await draftDB;
 if(key!==draftKey||epoch!==draftEpoch)throw Error('账号已切换，请重新恢复备份。');
 // Keep recovery and replacement in one transaction: either both succeed or neither does.
 await draftTransaction(db,'readwrite',store=>{store.put(recovery,key+':recovery');store.put(snapshot,key);});
 if(key!==draftKey||epoch!==draftEpoch)throw Error('账号已切换，备份已保存到原账号，请切回查看。');
 draftTouched=false;state.rows=null;state.sheets=[];await restoreLocalDraft(true);
 if(state.rows===null)await regenerate();
 for(const id of ['record-search','record-filter','record-year','record-aircraft'])$(id).value=id==='record-search'?'':'all';
 if(typeof renderRecords==='function')renderRecords();
}
const backupBar=document.createElement('div');backupBar.className='backup-bar';
backupBar.innerHTML='<span id="visible-save" role="status" aria-live="polite"></span><div><button type="button" class="secondary-button" id="backup-download">下载完整备份</button><button type="button" class="secondary-button" id="backup-import">恢复备份</button><button type="button" class="text-button" id="backup-recovery">找回替换前副本</button></div><input type="file" id="backup-file" accept=".json,application/json" hidden><span id="backup-message" role="status" aria-live="polite"></span>';
document.querySelector('.workspace-status').append(backupBar);
const mirrorSave=()=>{const node=$('visible-save');node.textContent=draftStatus.textContent;node.classList.toggle('storage-error',draftStatus.classList.contains('storage-error'));};
new MutationObserver(mirrorSave).observe(draftStatus,{childList:true,characterData:true,subtree:true,attributes:true});mirrorSave();
$('backup-download').onclick=()=>downloadBackup();
$('backup-import').onclick=()=>$('backup-file').click();
$('backup-recovery').onclick=async()=>{try{const db=await draftDB;const snapshot=await new Promise((resolve,reject)=>{const req=db.transaction('drafts').objectStore('drafts').get(draftKey+':recovery');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});if(!snapshot)throw Error('当前账号还没有替换前副本。');downloadBackup(snapshot);$('backup-message').textContent='已下载替换前副本，可通过“恢复备份”导入。';}catch(e){$('backup-message').textContent=e.message;}};
$('backup-file').onchange=async e=>{
 const file=e.target.files[0];if(!file)return;
 let locked=false;try{await draftRestoreReady;await accountQueue;await importQueue;if(accountBusy)throw Error('账号操作进行中，请稍后重试。');accountLock(true);locked=true;if(file.size>20*1024*1024)throw Error('备份超过 20 MB。');const value=JSON.parse(await file.text());if(value.format!=='flight-atlas-backup'||value.version!==1||!validBackup(value.draft))throw Error('无法识别此备份，本机记录未改动。');if(!confirm('用备份中的 '+snapshotRows(value.draft).length+' 条记录及图片设置替换当前数据？替换前会保存本机副本。'))return;document.querySelector('main').inert=true;await applyBackup(value.draft);$('backup-message').textContent='备份已恢复；云端记录未改变，需要时请手动保存到云端。';}catch(err){$('backup-message').textContent=err.message;}finally{if(locked)accountLock(false);e.target.value='';}
};
