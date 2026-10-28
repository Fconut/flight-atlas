'use strict';
state.colors=atlasColors(null);
const colorPanel=document.createElement('section');colorPanel.className='panel colors-panel';
colorPanel.innerHTML=`<div class="section-heading"><span class="step">04</span><h2>图片配色</h2></div><p class="label-intro">选择一套图片配色。</p><div class="color-presets" role="group" aria-label="配色预设"></div><p id="color-note" class="micro" role="status"></p><button type="button" id="colors-reset" class="text-button">恢复默认配色</button>`;
document.querySelector('.settings').insertBefore(colorPanel,document.querySelector('.settings .help'));
const colorPresets=[['深蓝金','#101c2a','#e8bf79'],['暖白蓝','#f3efe7','#28659c'],['松绿金','#122e2b','#e0b778'],['暮紫粉','#261d35','#ed9eae'],['曜石银','#181b20','#cbd5e1'],['海盐青','#edf5f1','#267f82'],['沙丘棕','#efe4d3','#8a563b'],['午夜蓝','#0d233c','#77c9ed'],['酒红金','#351d29','#e4c58a'],['雾灰橙','#e9edf0','#aa4d26']];
for(const [name,background,route] of colorPresets){const b=document.createElement('button');b.type='button';b.className='color-preset';b.textContent=name;b.dataset.background=background;b.dataset.route=route;b.style.setProperty('--swatch-bg',background);b.style.setProperty('--swatch-route',route);b.addEventListener('click',()=>setAtlasColors({background,route}));colorPanel.querySelector('.color-presets').append(b);}
function syncAtlasColorControls(){state.colors=atlasColors(state.colors);colorPanel.querySelectorAll('.color-preset').forEach(b=>{const selected=b.dataset.background===state.colors.background&&b.dataset.route===state.colors.route;b.setAttribute('aria-pressed',String(selected));});$('color-note').textContent=atlasContrast(state.colors.background,state.colors.route)<2?'当前航线与背景比较接近，建议加大明暗差，航线会更清晰。':'颜色自动保存，并同步到高清图片。';}
function setAtlasColors(value){state.colors=atlasColors(value);syncAtlasColorControls();regenerate();}
$('colors-reset').addEventListener('click',()=>setAtlasColors(null));syncAtlasColorControls();
