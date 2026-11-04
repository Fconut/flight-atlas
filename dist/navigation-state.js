'use strict';
const workspaceViewKey='flight-atlas:last-workspace';
function validWorkspaceView(view){return ['map','fleet','records'].includes(view)?view:'map';}
function readWorkspaceView(storage){try{return validWorkspaceView(storage.getItem(workspaceViewKey));}catch{return 'map';}}
function writeWorkspaceView(storage,view){try{storage.setItem(workspaceViewKey,validWorkspaceView(view));}catch{/* Navigation works even when browser storage is unavailable. */}}
(function(){
 let storage;try{storage=window.localStorage;}catch{}
 const renderWorkspace=showWorkspace;
 showWorkspace=function(view){const selected=validWorkspaceView(view);renderWorkspace(selected);writeWorkspaceView(storage,selected);};
 showWorkspace(readWorkspaceView(storage));
})();
