'use strict';
const accountBox=document.createElement('div');accountBox.className='account-box';accountBox.innerHTML='<button type="button" class="secondary-button" id="account-open">我的账号</button>';document.querySelector('.workspace-nav').append(accountBox);
const accountDialog=document.createElement('dialog');accountDialog.className='flight-dialog account-dialog';accountDialog.innerHTML=`<div class="dialog-heading"><h2>我的账号</h2><button type="button" class="dialog-close" id="account-close" aria-label="关闭">×</button></div><div id="account-guest"><form id="account-login"><label for="account-email">邮箱</label><input id="account-email" type="email" required autocomplete="email" placeholder="你的邮箱"><button type="submit" class="primary" id="account-send">登录</button></form><p>首次注册需要验证邮箱，之后可直接使用密码登录。</p></div><div id="account-user" hidden><p id="account-email-label"></p><div class="account-actions"><button type="button" class="secondary-button" id="account-pull">从云端恢复</button><button type="button" class="primary" id="account-push">保存到云端</button><button type="button" class="secondary-button" id="account-merge">导入本机游客记录</button><button type="button" class="text-button" id="account-signout">退出登录</button></div><p>当前账号的记录在本机自动保存。保存到云端会上传本机内容；从云端恢复会替换本机内容，两者都会先请你确认。</p></div><p id="account-message" role="status" aria-live="polite"></p>`;document.body.append(accountDialog);
const cloudBackup=document.createElement('section');cloudBackup.className='account-backup';cloudBackup.setAttribute('aria-labelledby','cloud-backup-title');cloudBackup.innerHTML='<h3 id="cloud-backup-title">云端备份</h3><p>保存到账号，方便在其他设备恢复。需要先登录，修改后请手动保存。</p>';accountDialog.insertBefore(cloudBackup,$('account-message'));cloudBackup.append($('account-guest'),$('account-user'));
const localBackup=$('local-backup');localBackup.hidden=false;accountDialog.insertBefore(localBackup,$('account-message'));
let atlasClient=null,accountId=null,cloudRevision=null,accountBusy=false,accountQueue=Promise.resolve();
const accountMessage=(text,bad=false)=>{$('account-message').textContent=text;$('account-message').style.color=bad?'#a55241':'#617e76';};
function accountLock(busy){accountBusy=busy;document.querySelector('main').inert=busy;accountDialog.querySelectorAll('button').forEach(b=>b.disabled=busy);}
async function accountAction(task){if(accountBusy)return;accountLock(true);try{await task();}catch(e){accountMessage(e.code==='invalid_credentials'?'邮箱或密码不正确。':e.code==='email_not_confirmed'?'请先点击邮箱中的验证链接。':e.code==='over_email_send_rate_limit'?'邮件发送已达限额，请稍后重试。':e.message||'操作失败，请稍后重试。',true);}finally{accountLock(false);}}
async function readDraftKey(key){const db=await draftDB;return new Promise((resolve,reject)=>{const r=db.transaction('drafts').objectStore('drafts').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function loadAccountDraft(key){await draftWrites;draftEpoch++;draftKey=key;draftTouched=false;state.rows=null;state.sheets=[];state.fileName='';state.colors=atlasColors(null);state.labelSelection=null;$('future').checked=false;syncAtlasColorControls();$('record-search').value='';$('record-filter').value='all';$('record-year').value='all';$('record-aircraft').value='all';await restoreLocalDraft();if(state.rows===null)await regenerate();}
async function onAccountSession(session){await draftRestoreReady;await importQueue;const id=session?.user?.id||null;if(id===accountId)return;accountLock(true);try{await loadAccountDraft(id?'user:'+id:'current');accountId=id;$('backup-message').textContent='';cloudRevision=null;cloudInfo=undefined;localChangedAt=null;$('cloud-conflict').hidden=true;$('account-guest').hidden=!!id;$('account-user').hidden=!id;$('account-open').textContent='我的账号';$('account-email-label').textContent=session?.user?.email||'';clearAccountPasswords();if(!id){passwordForm.querySelector('details').open=false;accountMode='login';passwordConfirm.hidden=true;passwordConfirm.required=false;passwordInput.autocomplete='current-password';$('account-send').textContent='登录';$('account-mode').textContent='注册新账号';}$('account-user').querySelector('.account-actions').hidden=false;if(id){try{await refreshCloudInfo();}catch(e){$('cloud-sync-status').textContent='暂时无法读取云端状态，请稍后重试。';}}accountMessage(id?'已登录。可从云端恢复记录，或导入本机游客记录。':'已退出，当前显示游客记录。');}catch(e){accountMessage('切换账号失败，请刷新页面后重试。',true);}finally{accountLock(false);}}
function cloudError(error){if(error.code==='40001')return Error('另一台设备已更新云端记录，本机修改仍保留。请先在“我的账号 → 本地备份”中导出备份文件，再恢复云端；恢复前也会自动保存本机副本。');if(['42P01','PGRST202','PGRST205'].includes(error.code))return Error('云端数据库尚未完成配置，请先运行 Supabase 数据库脚本。');return Error(error.message||'云端操作失败，请检查网络后重试。');}
async function fetchCloud(){const {data,error}=await atlasClient.from('atlas_drafts').select('payload,revision,updated_at').eq('user_id',accountId).maybeSingle();if(error)throw cloudError(error);return data;}
$('account-open').addEventListener('click',()=>{accountDialog.showModal();accountMessage('');if(accountId)accountAction(async()=>{try{await refreshCloudInfo();}catch(e){cloudInfo=undefined;$('cloud-conflict').hidden=true;renderCloudInfo();throw e;}});});$('account-close').addEventListener('click',()=>accountDialog.close());
let accountMode='login';
const passwordInput=document.createElement('input');passwordInput.id='account-password';passwordInput.type='password';passwordInput.autocomplete='current-password';passwordInput.required=true;passwordInput.minLength=8;passwordInput.placeholder='密码（至少 8 位）';passwordInput.setAttribute('aria-label','密码');$('account-send').before(passwordInput);
const passwordConfirm=document.createElement('input');passwordConfirm.id='account-password-confirm';passwordConfirm.type='password';passwordConfirm.autocomplete='new-password';passwordConfirm.placeholder='再次输入密码';passwordConfirm.setAttribute('aria-label','确认密码');passwordConfirm.hidden=true;$('account-send').before(passwordConfirm);
const modeActions=document.createElement('div');modeActions.className='account-actions';modeActions.innerHTML='<button type="button" class="text-button" id="account-mode">注册新账号</button><button type="button" class="text-button" id="account-forgot">忘记密码</button>';$('account-login').after(modeActions);

const passwordForm=document.createElement('form');passwordForm.id='account-set-password';passwordForm.innerHTML='<details id="account-password-details"><summary>设置 / 修改密码</summary><input type="password" id="account-new-password" autocomplete="new-password" minlength="8" required placeholder="新密码（至少 8 位）" aria-label="新密码"><input type="password" id="account-new-confirm" autocomplete="new-password" minlength="8" required placeholder="再次输入新密码" aria-label="确认新密码"><button type="submit" class="secondary-button">保存密码</button></details>';$('account-user').append(passwordForm);
function clearAccountPasswords(){accountDialog.querySelectorAll('input[type=password]').forEach(input=>input.value='');}
$('account-mode').addEventListener('click',()=>{accountMode=accountMode==='login'?'signup':'login';passwordConfirm.hidden=accountMode!=='signup';passwordConfirm.required=accountMode==='signup';passwordInput.autocomplete=accountMode==='signup'?'new-password':'current-password';$('account-send').textContent=accountMode==='signup'?'注册并验证邮箱':'登录';$('account-mode').textContent=accountMode==='signup'?'返回登录':'注册新账号';clearAccountPasswords();accountMessage('');});
$('account-login').addEventListener('submit',e=>{e.preventDefault();accountAction(async()=>{if(!atlasClient)throw Error('登录服务尚未加载，请刷新后重试。');const credentials={email:$('account-email').value.trim(),password:passwordInput.value};if(accountMode==='signup'&&credentials.password!==passwordConfirm.value)throw Error('两次输入的密码不一致。');const {data,error}=accountMode==='signup'?await atlasClient.auth.signUp({...credentials,options:{emailRedirectTo:location.origin+location.pathname}}):await atlasClient.auth.signInWithPassword(credentials);if(error)throw error;clearAccountPasswords();accountMessage(accountMode==='signup'?'注册申请已提交，请查看邮箱并点击验证链接；已注册用户请返回登录。':'登录成功。');});});
$('account-forgot').addEventListener('click',()=>accountAction(async()=>{const email=$('account-email');if(!email.value||!email.reportValidity())throw Error('请先填写有效邮箱。');if(!atlasClient)throw Error('登录服务尚未加载，请刷新后重试。');const {error}=await atlasClient.auth.resetPasswordForEmail(email.value.trim(),{redirectTo:location.origin+location.pathname});if(error)throw error;accountMessage('如果该邮箱已注册，你将收到重置密码邮件，请打开邮件链接。');}));
passwordForm.addEventListener('submit',e=>{e.preventDefault();accountAction(async()=>{const password=$('account-new-password').value;if(password!==$('account-new-confirm').value)throw Error('两次输入的新密码不一致。');const {error}=await atlasClient.auth.updateUser({password});if(error)throw error;clearAccountPasswords();passwordForm.querySelector('details').open=false;$('account-user').querySelector('.account-actions').hidden=false;accountMessage('密码已保存，下次可直接使用邮箱和密码登录。');});});

$('account-pull').addEventListener('click',()=>accountAction(async()=>{const who=accountId,key=draftKey,epoch=draftEpoch;const cloud=await fetchCloud();assertBackupScope(who,key,epoch,accountId,draftKey,draftEpoch);if(!cloud){cloudInfo=null;cloudRevision=0;renderCloudInfo();accountMessage('账号还没有云端记录，可以保存当前记录。');return;}if(!validBackup(cloud.payload))throw Error('云端记录格式无法读取，本机数据未改动。');if(!confirm('用云端记录替换当前账号在本机的记录与配色？替换前会自动保存本机副本，可通过“找回替换前副本”下载。建议先在“我的账号 → 本地备份”中导出备份文件。'))return;assertBackupScope(who,key,epoch,accountId,draftKey,draftEpoch);await applyBackup(cloud.payload,()=>assertBackupScope(who,key,epoch,accountId,draftKey,draftEpoch));assertBackupScope(who,key,epoch,accountId,draftKey,draftEpoch);cloudRevision=cloud.revision;cloudInfo=cloud;localChangedAt=cloud.payload.savedAt||null;$('cloud-conflict').hidden=true;renderCloudInfo();accountMessage('云端记录已恢复。');}));
async function saveAccountCloud(){
 await draftWrites;const who=accountId,key=draftKey,epoch=draftEpoch,snapshot=localSnapshot();
 const ensureAccount=()=>{if(!who||who!==accountId||key!==draftKey||epoch!==draftEpoch)throw Error('账号已切换，请重新保存。');};
 try{
 const result=await saveReviewedCloud({snapshot,
 readCloud:async()=>{const cloud=await fetchCloud();ensureAccount();if(cloud&&!validBackup(cloud.payload))throw Error('云端备份格式无法读取，请先下载备份再处理。');cloudInfo=cloud||null;renderCloudInfo();return cloud;},
 confirmSave:cloud=>{ensureAccount();const local=cloudBackupSummary(snapshot),remote=cloudBackupSummary(cloud?.payload);if(cloud)showCloudConflict();return confirm(cloud?'将本机 '+local.count+' 条记录和图片设置保存到云端，替换云端的 '+remote.count+' 条记录（'+cloudTime(cloud.updated_at||remote.savedAt)+'）？替换前会自动保留云端旧版，可通过“下载上次被替换的云端备份”找回。':'将本机 '+local.count+' 条记录和图片设置保存到云端？');},
 keepPrevious:async cloud=>{ensureAccount();const db=await draftDB;ensureAccount();await draftTransaction(db,'readwrite',store=>store.put(cloud.payload,key+':cloud-recovery'));},
 writeCloud:async(draft,revision)=>{ensureAccount();const {data,error}=await atlasClient.rpc('save_atlas_draft',{draft,expected_revision:revision});if(error)throw error;ensureAccount();return data;}
 });
 ensureAccount();if(result.status==='canceled'){accountMessage('已取消保存，本机与云端均未改动。');return;}
 cloudInfo=result.cloud;cloudRevision=result.cloud.revision;$('cloud-conflict').hidden=true;renderCloudInfo();accountMessage(result.status==='unchanged'?'本机内容已与云端一致，无需重复保存。':'已将本机记录保存到云端。');
 }catch(e){if(e.code==='40001'){try{await refreshCloudInfo();}catch{}showCloudConflict();throw Error('保存期间云端被另一台设备更新，本次未覆盖。请查看最新数量与时间，再选择保存本机或恢复云端。');}throw e;}
}
$('account-push').addEventListener('click',()=>accountAction(saveAccountCloud));
$('account-merge').addEventListener('click',()=>accountAction(async()=>{const guest=await readDraftKey('current');if(!guest||!validSnapshot(guest)){accountMessage('本机没有可导入的游客记录。');return;}const rows=guest.sheets.length?guest.sheets.flatMap(s=>s.rows):guest.rows||[];if(!confirm(`将 ${rows.length} 条游客记录合并到当前账号？游客原始记录会保留。`))return;const old=state.rows?.length||0;state.rows=uniqueFlightRows([...(state.rows||[]),...rows]).rows;state.sheets=[{name:'航班记录',rows:state.rows}];await regenerate();await draftWrites;accountMessage(`已合并新增 ${state.rows.length-old} 条记录，请保存到云端。`);}));
$('account-signout').addEventListener('click',()=>accountAction(async()=>{await draftWrites;const {error}=await atlasClient.auth.signOut({scope:'local'});if(error)throw error;}));
async function startAtlasAccount(){try{if(!window.supabase)throw Error('登录组件加载失败，游客模式仍可使用。');atlasClient=window.supabase.createClient(ATLAS_AUTH_CONFIG.url,ATLAS_AUTH_CONFIG.publishableKey);atlasClient.auth.onAuthStateChange((event,session)=>{if(['INITIAL_SESSION','SIGNED_IN','SIGNED_OUT','PASSWORD_RECOVERY'].includes(event)){accountQueue=accountQueue.then(async()=>{await onAccountSession(session);if(event==='PASSWORD_RECOVERY'){$('account-user').querySelector('.account-actions').hidden=true;passwordForm.querySelector('details').open=true;accountDialog.showModal();accountMessage('请设置新密码。');}}).catch(()=>accountMessage('账号状态更新失败，请刷新后重试。',true));}});}catch(e){accountMessage(e.message,true);}}

let cloudInfo=undefined,localChangedAt=null;
const cloudStatus=document.createElement('div');cloudStatus.className='cloud-sync-info';cloudStatus.innerHTML='<p id="cloud-last-backup"></p><p id="cloud-sync-status" role="status" aria-live="polite"></p><section id="cloud-conflict" hidden><h4>本机与云端版本不同</h4><p id="cloud-local-summary"></p><p id="cloud-remote-summary"></p><button type="button" class="secondary-button" id="cloud-download-local">下载本机备份</button><button type="button" class="primary" id="cloud-use-local">用本机保存到云端</button><button type="button" class="secondary-button" id="cloud-use-remote">用云端恢复到本机</button><p>请选择保留哪一份；确认前不会替换任何记录。</p></section>';$('account-email-label').after(cloudStatus);
function cloudTime(value){if(!value)return '暂无';const date=new Date(value);return Number.isNaN(date.getTime())?'未知':date.toLocaleString('zh-CN',{hour12:false});}
function renderCloudInfo(){
 if(!accountId)return;
 $('cloud-last-backup').textContent=cloudInfo===undefined?'上次云端备份：尚未读取':cloudInfo===null?'上次云端备份：暂无':'上次云端备份：'+cloudTime(cloudInfo.updated_at||cloudInfo.payload?.savedAt);
 $('cloud-sync-status').textContent=cloudInfo===undefined?'云端状态尚未确认':cloudInfo===null?'本机记录尚未备份到云端':backupContentKey(localSnapshot())===backupContentKey(cloudInfo.payload)?'本机内容与云端备份一致':'本机与云端内容不同，尚未同步';
 if(!$('cloud-conflict').hidden)showCloudConflict();
}
async function refreshCloudInfo(){
 const id=accountId;if(!id)return;const cloud=await fetchCloud();if(id!==accountId)return;
 if(cloud&&!validBackup(cloud.payload))throw Error('云端备份格式无法读取，本机记录未改动。');cloudInfo=cloud||null;
 if(cloud&&validBackup(cloud.payload)&&backupContentKey(localSnapshot())===backupContentKey(cloud.payload))cloudRevision=cloud.revision;
 if(cloudRevision===null&&!cloud)cloudRevision=0;
 const local=await readDraftKey(draftKey);if(id!==accountId)return;
 localChangedAt=local?.savedAt||localChangedAt;renderCloudInfo();
}
function showCloudConflict(){
 $('cloud-conflict').hidden=false;
 const local=cloudBackupSummary(localSnapshot()),remote=cloudBackupSummary(cloudInfo?.payload);
 $('cloud-local-summary').textContent='本机：'+local.count+' 条记录 · 本机保存时间 '+cloudTime(localChangedAt);
 $('cloud-remote-summary').textContent='云端：'+remote.count+' 条记录 · 备份时间 '+cloudTime(cloudInfo?.updated_at||remote.savedAt);
}
$('cloud-download-local').onclick=()=>downloadBackup();
$('cloud-use-local').onclick=()=>accountAction(saveAccountCloud);
$('cloud-use-remote').onclick=()=>$('account-pull').click();
const previousCloudButton=document.createElement('button');previousCloudButton.type='button';previousCloudButton.className='text-button';previousCloudButton.textContent='下载上次被替换的云端备份';cloudStatus.append(previousCloudButton);
previousCloudButton.onclick=()=>accountAction(async()=>{const previous=await readDraftKey(draftKey+':cloud-recovery');if(!previous)throw Error('还没有被替换的云端备份。');downloadBackup(previous);accountMessage('已下载上次被替换的云端备份。');});

window.addEventListener('atlas:backup-restored',()=>{localChangedAt=new Date().toISOString();renderCloudInfo();});
window.addEventListener('atlas:rows',()=>{localChangedAt=new Date().toISOString();if(accountId)renderCloudInfo();});
for(const id of ['future'])$(id).addEventListener('change',()=>{localChangedAt=new Date().toISOString();renderCloudInfo();});

startAtlasAccount();
accountDialog.addEventListener('close',clearAccountPasswords);

dismissOnBackdrop(accountDialog,()=>!accountBusy);
