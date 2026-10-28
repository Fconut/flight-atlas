'use strict';
// Reuse the live controls so drafts, editor actions and export keep their handlers.
const main=document.querySelector('main'),workspace=document.querySelector('.workspace'),settings=document.querySelector('.settings'),preview=document.querySelector('.preview-section'),records=document.querySelector('.records-manager');
document.querySelector('.intro').remove();
document.querySelector('.local-badge').innerHTML='<i></i><span id="workspace-save">自动保存在此浏览器</span>';
const navigation=document.createElement('nav');navigation.className='workspace-nav';navigation.setAttribute('aria-label','工作区');navigation.innerHTML='<div class="view-links"><button type="button" data-view="map" aria-current="page">地图工作台</button><button type="button" data-view="records">航班记录 <span id="nav-record-count">0</span></button></div><div class="nav-hint">每次起降，都值得被记住。</div>';main.prepend(navigation);
const heading=document.createElement('div');heading.className='studio-heading';heading.innerHTML='<div><p class="eyebrow">YOUR PERSONAL FLIGHT ATLAS</p><h1 id="workspace-title">把旅程，绘成一幅地图。</h1><p id="workspace-description">导入或添加航班，再用喜欢的配色与标注，定制你的飞行足迹。</p></div><div class="studio-export"></div>';navigation.after(heading);
heading.querySelector('.studio-export').append($('download'),$('export-note'));
const tabs=document.createElement('div');tabs.className='settings-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','地图设置');settings.prepend(tabs);
const panels={data:[document.querySelector('.upload-panel'),[...settings.querySelectorAll('.panel')].find(p=>p.querySelector('#cutoff')),document.querySelector('.help')],colors:[document.querySelector('.colors-panel')],labels:[document.querySelector('.labels-panel')]};
for(const [key,label] of [['data','航班数据'],['colors','图片配色'],['labels','航点标注']]){const button=document.createElement('button');button.type='button';button.id='tab-'+key;button.textContent=label;button.setAttribute('role','tab');button.setAttribute('aria-controls','settings-'+key);button.setAttribute('aria-selected',String(key==='data'));button.tabIndex=key==='data'?0:-1;button.dataset.setting=key;tabs.append(button);const panel=document.createElement('div');panel.id='settings-'+key;panel.className='settings-page';panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',button.id);panel.hidden=key!=='data';panel.append(...panels[key]);settings.append(panel);button.addEventListener('click',()=>showSetting(key));button.addEventListener('keydown',e=>{if(!['ArrowRight','ArrowLeft','Home','End'].includes(e.key))return;e.preventDefault();const buttons=[...tabs.children],index=buttons.indexOf(button),next=e.key==='Home'?0:e.key==='End'?buttons.length-1:(index+(e.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;showSetting(buttons[next].dataset.setting);buttons[next].focus();});}
function showSetting(key){for(const b of tabs.children){const active=b.dataset.setting===key;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;$('settings-'+b.dataset.setting).hidden=!active;}}
settings.querySelectorAll('.step').forEach(n=>n.remove());document.querySelector('.upload-panel h2').textContent='你的航班记录';panels.data[1].querySelector('h2').textContent='统计范围';
const dataLink=document.createElement('button');dataLink.type='button';dataLink.className='manage-link';dataLink.textContent='查看与编辑全部航班 →';dataLink.addEventListener('click',()=>showWorkspace('records'));document.querySelector('.upload-panel').append(dataLink);
document.querySelector('.preview-heading h2').textContent='地图预览';document.querySelector('.preview-heading .eyebrow').textContent='LIVE PREVIEW';document.querySelector('.preview-footer>span').textContent='配色与标注实时更新 · 导出高清 PNG';
preview.insertBefore($('summary'),document.querySelector('.preview-well'));
const statusBar=document.createElement('div');statusBar.className='workspace-status';statusBar.append($('status'));heading.after(statusBar);
const emptyActions=document.createElement('div');emptyActions.className='empty-actions';emptyActions.innerHTML='<button type="button" id="empty-import">导入航班文件</button><button type="button" id="empty-add">＋ 手动添加</button>';document.querySelector('.empty-copy').append(emptyActions);$('empty-import').addEventListener('click',()=>{showSetting('data');$('file').click();});$('empty-add').addEventListener('click',()=>$('manual-start').click());
const mobilePreview=document.createElement('button');mobilePreview.type='button';mobilePreview.className='mobile-preview';mobilePreview.textContent='↓ 查看地图预览';mobilePreview.addEventListener('click',()=>preview.scrollIntoView({behavior:'smooth',block:'start'}));tabs.after(mobilePreview);
records.querySelector('h2').textContent='管理每一段旅程';records.querySelector('.eyebrow').textContent='YOUR FLIGHT LOG';
function showWorkspace(view){const isMap=view==='map';workspace.hidden=!isMap;records.hidden=isMap;heading.querySelector('.studio-export').hidden=!isMap;document.querySelectorAll('[data-view]').forEach(b=>{if(b.dataset.view===view)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});$('workspace-title').textContent=isMap?'把旅程，绘成一幅地图。':'每一班，都有迹可循。';$('workspace-description').textContent=isMap?'调整配色与标注，定制属于你的飞行足迹。':'搜索、添加或修改航班，地图与统计会同步更新。';if(isMap)requestAnimationFrame(resizePoster);}
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>showWorkspace(b.dataset.view)));
const updateWorkspace=()=>{$('nav-record-count').textContent=String(state.rows?.length||0);$('empty-add').disabled=$('manual-start').disabled;};window.addEventListener('atlas:rows',updateWorkspace);new MutationObserver(updateWorkspace).observe($('manual-start'),{attributes:true,attributeFilter:['disabled']});
new MutationObserver(()=>{$('workspace-save').textContent=$('draft-status').textContent;$('workspace-save').classList.toggle('save-error',$('draft-status').classList.contains('storage-error'));}).observe($('draft-status'),{childList:true,characterData:true,subtree:true,attributes:true});
showWorkspace('map');updateWorkspace();

// Remove only the requested notes; retain the established workspace layout.
document.querySelector('.brand-icon')?.remove();
document.querySelector('.local-badge').hidden=true;
document.querySelector('.editor-local-note')?.remove();
for(const note of document.querySelectorAll('.micro'))if(note.textContent.includes('四个方位极值与少数区域节点'))note.remove();
document.querySelector('.preview-footer>span').remove();
$('diagnostics').hidden=true;

document.querySelector('.topbar').hidden=true;
$('summary').hidden=true;
const deleteAll=$('clear-draft');deleteAll.textContent='删除全部航班';deleteAll.className='secondary-button delete-all';deleteAll.hidden=false;document.querySelector('.records-actions').prepend(deleteAll);
document.querySelector('.draft-storage').hidden=true;
const updateDeleteAll=()=>{deleteAll.disabled=!(state.rows?.length||state.sheets.some(s=>s.rows.length));};window.addEventListener('atlas:rows',updateDeleteAll);updateDeleteAll();
deleteAll.addEventListener('click',async()=>{
 const count=state.sheets.length?state.sheets.reduce((n,s)=>n+s.rows.length,0):(state.rows?.length||0);
 if(!count||!confirm(`删除全部 ${count} 条航班记录？所有工作表中的航班都会删除，配色和标注设置会保留。`))return;
 state.rows=[];state.sheets=[];state.fileName='';$('file').value='';$('sheet').replaceChildren();$('sheet-wrap').hidden=true;$('file-info').textContent='支持 Flighty 导出及常见中文列名；导入会新增航班，并自动跳过重复记录。';$('record-search').value='';$('record-filter').value='all';await regenerate();await draftWrites;updateDeleteAll();
});
