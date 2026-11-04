'use strict';
const workspaceViewKey='flight-atlas:last-workspace';
function validWorkspaceView(view){return ['map','fleet','records'].includes(view)?view:'map';}
function readWorkspaceView(storage){try{return validWorkspaceView(storage.getItem(workspaceViewKey));}catch{return 'map';}}
function writeWorkspaceView(storage,view){try{storage.setItem(workspaceViewKey,validWorkspaceView(view));}catch{/* Navigation remains available if storage is blocked. */}}
let workspaceStorage;try{workspaceStorage=window.localStorage;}catch{}
const workspaceViews={
 map:{element:workspace,title:'把旅程，绘成一幅地图。',description:'调整配色与标注，定制属于你的飞行足迹。',enter:()=>requestAnimationFrame(resizePoster)},
 fleet:{element:fleetPage,title:'每一种飞机，一段新的记忆。',description:'从历史行程中收集你乘坐过的机型。',enter:()=>renderFleet()},
 records:{element:records,title:'每一班，都有迹可循。',description:'搜索、添加或修改航班，地图与统计会同步更新。'}
};
function showWorkspace(view){
 const selected=validWorkspaceView(view),config=workspaceViews[selected];
 for(const [key,entry]of Object.entries(workspaceViews))entry.element.hidden=key!==selected;
 statusBar.hidden=selected!=='map';heading.querySelector('.studio-export').hidden=selected!=='map';
 $('workspace-title').textContent=config.title;$('workspace-description').textContent=config.description;
 document.querySelectorAll('[data-view]').forEach(button=>{if(button.dataset.view===selected)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');});
 writeWorkspaceView(workspaceStorage,selected);config.enter?.();
}
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>showWorkspace(button.dataset.view)));
showWorkspace(readWorkspaceView(workspaceStorage));

