'use strict';
function parseFlightScreenshot(text){
 const lines=String(text).normalize('NFKC').split(/\r?\n/).map(s=>s.trim()).filter(Boolean),rows=[];let pendingDate='',pendingYear='',active=null;
 for(const line of lines){
  const compact=line.replace(/\s+/g,'').replace(/[‐‑‒–—−]/g,'-'),full=compact.match(/\b(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})/),md=compact.match(/(?:^|[^\d])(\d{1,2})[-/.月](\d{1,2})(?:日)?(?!\d)/),year=compact.match(/(?:^|[^\d])(20\d{2})(?:年)?(?!\d)/);
  if(full){pendingYear=full[1];pendingDate=full[2].padStart(2,'0')+'-'+full[3].padStart(2,'0');}
  else if(md){pendingDate=md[1].padStart(2,'0')+'-'+md[2].padStart(2,'0');pendingYear='';}
  if(year)pendingYear=year[1];
  if(year&&!pendingDate&&active&&!active.date&&!active.departureTime&&active._monthDay){active.date=pendingYear+'-'+active._monthDay;pendingYear='';}
  const flight=line.toUpperCase().match(/\b([A-Z][A-Z0-9]|[0-9][A-Z])\s*(\d{2,4})\b/);
  if(flight){active={_monthDay:pendingDate,date:pendingYear&&pendingDate?pendingYear+'-'+pendingDate:'',airline:flight[1],flight:flight[2],from:'',to:'',departureTime:'',aircraft:''};rows.push(active);pendingDate='';pendingYear='';}
  const time=line.match(/\b([0-2]?\d)\s*[:：]\s*([0-5]\d)/);
  if(active&&time){const airport=line.slice(time.index+time[0].length).replace(/^\s*\+\s*\d+/,'').replace(/\s*T\s*\d+.*$/i,'').replace(/\s+/g,'').trim();if(!active.departureTime){active.departureTime=time[1].padStart(2,'0')+':'+time[2];active.from=airport;}else if(!active.to)active.to=airport;}
 }
 return rows.map(({_monthDay,...row})=>row);
}
function screenshotAirport(value){const clean=String(value).replace(/\s+/g,'').replace(/机场$/,'');const direct=resolveAirport(clean);if(direct)return direct;const matches=Object.keys(editorAirports).filter(code=>String(editorNames[code]||'').replace(/机场$/,'')===clean);return matches.length===1?matches[0]:value;}
let screenshotLibrary;
function loadScreenshotOCR(){if(window.Tesseract)return Promise.resolve(window.Tesseract);if(!screenshotLibrary)screenshotLibrary=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';script.onload=()=>resolve(window.Tesseract);script.onerror=()=>{script.remove();screenshotLibrary=null;reject(Error('识别组件加载失败，请检查网络后重试。'));};document.head.append(script);});return screenshotLibrary;}
async function reviewScreenshot(file){
 if(file.size>20*1024*1024)throw Error('图片超过 20 MB，请减小后重试。');
 if(typeof draftRestoreReady!=='undefined')await draftRestoreReady;
 const scope=typeof draftEpoch==='undefined'?null:draftEpoch;
 const dialog=document.createElement('dialog');dialog.className='flight-dialog screenshot-dialog';
 const header=document.createElement('div');header.className='dialog-heading';const title=document.createElement('h2');title.textContent='识别航班图片';const close=document.createElement('button');close.type='button';close.className='dialog-close';close.textContent='×';close.setAttribute('aria-label','取消图片导入');header.append(title,close);
 const message=document.createElement('p');message.setAttribute('role','status');message.textContent='正在加载识别组件…首次使用需要下载语言包。';
 const preview=document.createElement('img');preview.alt='待识别的航班截图';preview.style.cssText='max-width:100%;max-height:240px;object-fit:contain;display:block;margin:12px auto';const url=URL.createObjectURL(file);preview.src=url;
 const list=document.createElement('div'),actions=document.createElement('div');actions.className='screenshot-actions';const cancel=document.createElement('button');cancel.type='button';cancel.textContent='取消';const save=document.createElement('button');save.type='button';save.className='primary';save.textContent='确认导入';save.disabled=true;actions.append(cancel,save);dialog.append(header,message,preview,list,actions);document.body.append(dialog);dialog.showModal();
 let worker,closed=false;const done=new Promise(resolve=>{dialog.addEventListener('close',()=>{closed=true;worker?.terminate();URL.revokeObjectURL(url);dialog.remove();resolve();},{once:true});});close.onclick=cancel.onclick=()=>dialog.close();dismissOnBackdrop(dialog);
 try{
  const lib=await loadScreenshotOCR();if(closed)return;
  worker=await lib.createWorker('chi_sim+eng',1,{logger:event=>{if(!closed)message.textContent=event.status==='recognizing text'?'正在识别 '+Math.round(event.progress*100)+'%…':'正在准备文字识别…';}});
  if(closed){await worker.terminate();return;}
  const result=await worker.recognize(file);await worker.terminate();worker=null;if(closed)return;
  const rows=parseFlightScreenshot(result.data.text),fields=[['date','日期','date'],['airline','航司','text'],['flight','航班号','text'],['from','出发机场','text'],['to','到达机场','text'],['departureTime','起飞时间','time'],['aircraft','机型（选填）','text']],entries=[];
  message.textContent=rows.length?'请核对识别结果。缺失日期或机场须补齐；未显示的机型留空。取消勾选可跳过不完整行程。':'未找到航班，可核对下方识别文字，或换一张更清晰的截图。';
  for(const [i,row]of rows.entries()){
   row.from=screenshotAirport(row.from);row.to=screenshotAirport(row.to);
   const section=document.createElement('fieldset');section.className='screenshot-row';const legend=document.createElement('legend'),selected=document.createElement('input');selected.type='checkbox';selected.checked=true;legend.append(selected,document.createTextNode(' 第 '+(i+1)+' 条航班'));section.append(legend);const inputs={};
   for(const [key,label,type]of fields){const wrap=document.createElement('label');wrap.textContent=label;const input=document.createElement('input');input.type=type;input.value=row[key]||'';if(key==='from'||key==='to')input.setAttribute('list','airport-options');wrap.append(input);section.append(wrap);inputs[key]=input;}list.append(section);entries.push({selected,inputs});
  }
  const details=document.createElement('details'),summary=document.createElement('summary'),raw=document.createElement('pre');summary.textContent='查看识别文字';raw.textContent=result.data.text;raw.style.cssText='white-space:pre-wrap;max-height:220px;overflow:auto';details.append(summary,raw);list.append(details);save.disabled=!rows.length;
  save.onclick=async()=>{
   if(scope!==null&&scope!==draftEpoch){message.textContent='账号或记录已切换，请关闭后重新上传。';save.disabled=true;return;}
   const selected=entries.filter(e=>e.selected.checked).map(e=>Object.fromEntries(fields.map(([key])=>[key,e.inputs[key].value.trim()])));
   if(!selected.length){message.textContent='请至少选择一条航班。';return;}
   for(const row of selected){row.from=resolveAirport(row.from);row.to=resolveAirport(row.to);row.airline=normalizeAirlineCode(row.airline);if(!validDate(row.date)||!row.from||!row.to||row.from===row.to||!row.airline||!/^\d{1,4}$/.test(row.flight)){message.textContent='请补齐有效日期、航司、航班号和不同的起降机场。';return;}}
   save.disabled=true;
   const csv=d3.csvFormat(selected.map(r=>({Date:r.date,Airline:r.airline,Flight:r.flight,From:r.from,To:r.to,'Departure Time':r.departureTime,'Aircraft Type Name':r.aircraft})));
   await importFlightFile(new File([csv],file.name.replace(/\.[^.]+$/,'')+'-识别.csv',{type:'text/csv'}));dialog.close();
  };
 }catch(e){if(!closed){message.textContent='图片识别失败：'+e.message;save.disabled=true;}}
 await done;
}
