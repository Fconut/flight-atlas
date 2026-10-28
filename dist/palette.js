'use strict';
const atlasDefaultColors={background:'#101c2a',route:'#e8bf79'};
function atlasColors(value){const valid=c=>typeof c==='string'&&/^#[0-9a-f]{6}$/i.test(c);return Object.fromEntries(Object.entries(atlasDefaultColors).map(([k,v])=>[k,valid(value?.[k])?value[k].toLowerCase():v]));}
function atlasMix(a,b,t){const rgb=c=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16));return '#'+rgb(a).map((v,i)=>Math.round(v*(1-t)+rgb(b)[i]*t).toString(16).padStart(2,'0')).join('');}
function atlasLuminance(c){const v=[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return v[0]*.2126+v[1]*.7152+v[2]*.0722;}
function atlasContrast(a,b){const x=atlasLuminance(a),y=atlasLuminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
function atlasReadable(color,bg,min=4.5){const target=atlasContrast('#ffffff',bg)>atlasContrast('#101820',bg)?'#ffffff':'#101820';for(let i=0;i<=20;i++){const c=atlasMix(color,target,i/20);if(atlasContrast(c,bg)>=min)return c;}return target;}
function applyAtlasTheme(value){
 const c=atlasColors(value),bg=c.background,light=atlasLuminance(bg)>.4;
 const text=atlasReadable(light?'#172b3a':'#eef3f5',bg,7),muted=atlasReadable(atlasMix(bg,text,.6),bg),land=atlasMix(bg,text,light?.10:.14),panel=atlasMix(bg,text,.035),accent=atlasReadable(c.route,panel),line=atlasMix(panel,text,.22);
 const css=`body{background:${bg};color:${text}}#poster{background:radial-gradient(ellipse at 56% 24%,${atlasMix(bg,text,.065)} 0%,${bg} 85%)}.land{fill:${land};stroke:${atlasMix(land,text,.13)}}.graticule{stroke:${muted}}.route,.route-glow{stroke:${c.route}}.airport{fill:${atlasReadable(c.route,land,3)};stroke:${bg}}.airport-label{fill:${text};stroke:${bg}}.airport-leader{stroke:${muted}}.region{fill:${muted}}.extreme-ring{stroke:${atlasReadable(c.route,land,3)}}.eyebrow{color:${muted}}.records{background:linear-gradient(140deg,${panel},${bg});border-top-color:${accent};border-bottom-color:${line}}.records-title,.distance,.record-main span{color:${accent}}.record-main{color:${text}}.record-label,.coord,.overview .record-main small,.distance small{color:${muted}}.overview,#distances,.distance-record+.distance-record{border-color:${line}}`;
 let style=document.getElementById('atlas-theme');if(!style){style=document.createElement('style');style.id='atlas-theme';document.head.append(style);}style.textContent=css;
}
