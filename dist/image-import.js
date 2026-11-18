'use strict';
function cleanScreenshotAirport(value){return AirportSearch.clean(value);}
function parseScreenshotDetail(text){
 const lines=String(text).normalize('NFKC').split(/\r?\n/).map(s=>s.trim()).filter(Boolean),planIndex=lines.findIndex(l=>/计划/.test(l)&&/20\d{2}[-/.年]/.test(l));
 if(planIndex<0)return null;
 const top=lines.slice(0,planIndex+2).join('\n'),flight=top.toUpperCase().match(/(?:^|[^A-Z0-9])([A-Z][A-Z0-9]|[0-9][A-Z])\s*(\d{2,4})\b/),route=top.match(/([\u3400-\u9fff][\u3400-\u9fff \t·]{1,30}(?:[ \t]+[A-Z])?)\s*[-–—→]\s*([\u3400-\u9fff][\u3400-\u9fff \t·]{1,30}(?:[ \t]+[A-Z])?)/),date=lines[planIndex].match(/(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})/),time=lines[planIndex].match(/([0-2]\d)[:：]([0-5]\d)/);
 if(!flight||!route||!date)return null;
 const model=top.match(/(?:巴航|空客|波音|机型)\s*([A-Z][A-Z0-9 -]{1,15}(?:\([A-Z]+\))?)/i);
 return {date:date[1]+'-'+date[2].padStart(2,'0')+'-'+date[3].padStart(2,'0'),airline:flight[1],flight:flight[2],from:cleanScreenshotAirport(route[1]),to:cleanScreenshotAirport(route[2]),rawFrom:route[1].trim(),rawTo:route[2].trim(),departureTime:time?time[1]+':'+time[2]:'',aircraft:model?model[1].trim():''};
}
function parseFlightScreenshot(text){
 const detail=parseScreenshotDetail(text);if(detail)return [detail];
 const lines=String(text).normalize('NFKC').split(/\r?\n/).map(s=>s.trim()).filter(Boolean),rows=[];let pendingDate='',pendingYear='',active=null;
 for(const line of lines){
  const compact=line.replace(/\s+/g,'').replace(/[‐‑‒–—−]/g,'-'),full=compact.match(/\b(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})/),md=compact.match(/(?:^|[^\d])(\d{1,2})[-/.月](\d{1,2})(?:日)?(?!\d)/),year=compact.match(/(?:^|[^\d])(20\d{2})(?:年)?(?!\d)/);
  if(full){pendingYear=full[1];pendingDate=full[2].padStart(2,'0')+'-'+full[3].padStart(2,'0');}
  else if(md){pendingDate=md[1].padStart(2,'0')+'-'+md[2].padStart(2,'0');pendingYear='';}
  if(year)pendingYear=year[1];
  if(year&&!pendingDate&&active&&!active.date&&!active.departureTime&&active._monthDay){active.date=pendingYear+'-'+active._monthDay;pendingYear='';}
  const flight=line.toUpperCase().match(/(?:^|[^A-Z0-9])([A-Z][A-Z0-9]|[0-9][A-Z])\s*(\d{2,4})\b/);
  if(flight){active={_monthDay:pendingDate,date:pendingYear&&pendingDate?pendingYear+'-'+pendingDate:'',airline:flight[1],flight:flight[2],from:'',to:'',departureTime:'',aircraft:''};rows.push(active);pendingDate='';pendingYear='';}
  const time=line.match(/\b([0-2]?\d)\s*[:：]\s*([0-5]\d)/);
  if(active&&time){const airport=cleanScreenshotAirport(line.slice(time.index+time[0].length));if(!active.departureTime){active.departureTime=time[1].padStart(2,'0')+':'+time[2];active.from=airport;active.rawFrom=line.slice(time.index+time[0].length).trim();}else if(!active.to){active.to=airport;active.rawTo=line.slice(time.index+time[0].length).trim();}}
 }
 let lastDate='';return rows.map(({_monthDay,...row})=>{if(row.date)lastDate=row.date;else if(!_monthDay&&lastDate)row.date=lastDate;else if(_monthDay)lastDate='';return row;});
}
function screenshotAirport(value){return getAirportSearch().resolve(value)||cleanScreenshotAirport(value);}
function validateScreenshotFlight(row){
 const value={...row,from:getAirportSearch().resolve(row.from),to:getAirportSearch().resolve(row.to),airline:normalizeAirlineCode(row.airline)},errors={};
 if(!validDate(row.date))errors.date='请填写有效日期';
 if(!value.airline)errors.airline='请填写航司代码';
 if(!/^\d{1,4}$/.test(row.flight))errors.flight='请填写 1–4 位航班数字';
 if(!value.from)errors.from=row.from?'未匹配到机场，请选择机场三字码':'请填写出发机场';
 if(!value.to)errors.to=row.to?'未匹配到机场，请选择机场三字码':'请填写到达机场';
 if(value.from&&value.to&&value.from===value.to)errors.to='到达机场不能与出发机场相同';
 return {value,errors};
}
async function releaseScreenshotWorker(owner){
 const worker=owner.current;owner.current=null;
 if(worker){try{await worker.terminate();}catch{/* The worker may already have stopped after an OCR error. */}}
}
let screenshotLibrary;
function loadScreenshotOCR(){if(window.Tesseract)return Promise.resolve(window.Tesseract);if(!screenshotLibrary)screenshotLibrary=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';script.onload=()=>resolve(window.Tesseract);script.onerror=()=>{script.remove();screenshotLibrary=null;reject(Error('识别组件加载失败，请检查网络后重试。'));};document.head.append(script);});return screenshotLibrary;}
async function reviewScreenshot(file){
 if(file.size>20*1024*1024)throw Error('图片超过 20 MB，请减小后重试。');
 if(typeof draftRestoreReady!=='undefined')await draftRestoreReady;
 const scope=typeof draftEpoch==='undefined'?null:draftEpoch;
 const dialog=document.createElement('dialog');dialog.className='flight-dialog screenshot-dialog';
 const header=document.createElement('div');header.className='dialog-heading';const title=document.createElement('h2');title.textContent='识别航班图片';const close=document.createElement('button');close.type='button';close.className='dialog-close';close.textContent='×';close.setAttribute('aria-label','取消图片导入');const headingCopy=document.createElement('div');const eyebrow=document.createElement('p');eyebrow.className='screenshot-eyebrow';eyebrow.textContent='IMPORT FLIGHTS';headingCopy.append(eyebrow,title);header.append(headingCopy,close);
 const message=document.createElement('p');message.className='screenshot-status';message.setAttribute('role','status');message.textContent='正在加载识别组件…首次使用需要下载语言包。';
 const preview=document.createElement('img');preview.alt='待识别的航班截图';preview.className='screenshot-preview';const url=URL.createObjectURL(file);preview.src=url;
 const list=document.createElement('div'),actions=document.createElement('div');list.className='screenshot-list';actions.className='screenshot-actions';const cancel=document.createElement('button');cancel.type='button';cancel.textContent='取消';const save=document.createElement('button');save.type='button';save.className='primary';save.textContent='确认导入';save.disabled=true;const selectionCount=document.createElement('span');selectionCount.className='screenshot-selection-count';selectionCount.textContent='等待识别结果';const actionButtons=document.createElement('div');actionButtons.append(cancel,save);actions.append(selectionCount,actionButtons);const body=document.createElement('div');body.className='screenshot-body';const source=document.createElement('details');source.className='screenshot-source';source.open=window.matchMedia('(min-width: 800px)').matches;const sourceTitle=document.createElement('summary');sourceTitle.textContent='原始截图';const filename=document.createElement('p');filename.className='screenshot-filename';filename.textContent=file.name;source.append(sourceTitle,preview,filename);const review=document.createElement('div');review.className='screenshot-review';review.append(message,list);body.append(source,review);dialog.append(header,body,actions);document.body.append(dialog);dialog.showModal();
 const workerOwner={current:null};let closed=false;const done=new Promise(resolve=>{dialog.addEventListener('close',()=>{closed=true;void releaseScreenshotWorker(workerOwner);URL.revokeObjectURL(url);dialog.remove();resolve();},{once:true});});close.onclick=cancel.onclick=()=>dialog.close();dismissOnBackdrop(dialog);
 try{
  const lib=await loadScreenshotOCR();if(closed)return;
  workerOwner.current=await lib.createWorker('chi_sim+eng',1,{logger:event=>{if(!closed)message.textContent=event.status==='recognizing text'?'正在识别 '+Math.round(event.progress*100)+'%…':'正在准备文字识别…';}});
  if(closed){await releaseScreenshotWorker(workerOwner);return;}
  const result=await workerOwner.current.recognize(file);await releaseScreenshotWorker(workerOwner);if(closed)return;
  const rows=parseFlightScreenshot(result.data.text),fields=[['date','日期','date'],['airline','航司','text'],['flight','航班号','text'],['departureTime','起飞时间','time'],['from','出发机场','text'],['to','到达机场','text'],['aircraft','机型（选填）','text']],entries=[];
  message.textContent=rows.length?'请核对识别结果。缺失日期或机场须补齐；未显示的机型留空。取消勾选可跳过不完整行程。':'未找到航班，可核对下方识别文字，或换一张更清晰的截图。';
  for(const [i,row]of rows.entries()){
   row.from=screenshotAirport(row.from);row.to=screenshotAirport(row.to);
   const section=document.createElement('fieldset');section.className='screenshot-row';const legend=document.createElement('legend'),selected=document.createElement('input');selected.type='checkbox';selected.checked=true;const selectionLabel=document.createElement('label');selectionLabel.append(selected,document.createTextNode('航班 '+String(i+1).padStart(2,'0')));legend.append(selectionLabel);section.append(legend);const inputs={},errorNodes={};
   for(const [key,label,type]of fields){const wrap=document.createElement('div');wrap.className='screenshot-field';wrap.dataset.field=key;const caption=document.createElement('label');caption.textContent=label;const input=document.createElement('input');input.id='screenshot-input-'+i+'-'+key;caption.htmlFor=input.id;input.type=type;input.value=row[key]||'';if(key==='from'||key==='to'){input.autocomplete='off';input.placeholder='机场名称 / IATA / ICAO';}const suggestions=document.createElement('span');suggestions.className='airport-candidates';if(key==='from'||key==='to')AirportSearch.suggestions(input,suggestions,getAirportSearch);const note=document.createElement('small');note.className='screenshot-field-error';note.id='screenshot-error-'+i+'-'+key;input.setAttribute('aria-describedby',note.id);const original=document.createElement('small');original.className='screenshot-original';original.textContent=(key==='from'&&row.rawFrom?'原文：'+row.rawFrom:key==='to'&&row.rawTo?'原文：'+row.rawTo:'');wrap.append(caption,input,original,note,suggestions);section.append(wrap);inputs[key]=input;errorNodes[key]=note;}list.append(section);const entry={selected,inputs,errorNodes};const validate=()=>{const row=Object.fromEntries(fields.map(([key])=>[key,inputs[key].value.trim()])),result=validateScreenshotFlight(row);for(const [key]of fields){const error=selected.checked?result.errors[key]||'':'';errorNodes[key].textContent=error;inputs[key].setAttribute('aria-invalid',String(!!error));}const count=entries.filter(e=>e.selected.checked).length;selectionCount.textContent='已选择 '+count+' / '+rows.length+' 条航班';save.textContent='导入 '+count+' 条航班';return result;};entry.validate=validate;for(const input of Object.values(inputs))input.addEventListener('input',validate);selected.addEventListener('change',validate);entries.push(entry);validate();
  }
  const details=document.createElement('details'),summary=document.createElement('summary'),raw=document.createElement('pre');summary.textContent='查看识别文字';raw.textContent=result.data.text;raw.style.cssText='white-space:pre-wrap;max-height:220px;overflow:auto';details.className='screenshot-raw';details.append(summary,raw);list.append(details);save.disabled=!rows.length;
  save.onclick=async()=>{
   if(scope!==null&&scope!==draftEpoch){message.textContent='账号或记录已切换，请关闭后重新上传。';save.disabled=true;return;}
   const chosen=entries.filter(e=>e.selected.checked);
   if(!chosen.length){message.textContent='请至少选择一条航班。';return;}
   const results=chosen.map(e=>e.validate()),bad=results.findIndex(r=>Object.keys(r.errors).length);
   if(bad>=0){message.textContent='无法导入：请修改红字标出的字段，或取消勾选对应航班。';const key=Object.keys(results[bad].errors)[0];chosen[bad].inputs[key].focus();chosen[bad].inputs[key].scrollIntoView({block:'center',behavior:'smooth'});return;}
   const selected=results.map(r=>r.value);
   save.disabled=true;
   const csv=d3.csvFormat(selected.map(r=>({Date:r.date,Airline:r.airline,Flight:r.flight,From:r.from,To:r.to,'Departure Time':r.departureTime,'Aircraft Type Name':r.aircraft})));
   await importFlightFile(new File([csv],file.name.replace(/\.[^.]+$/,'')+'-识别.csv',{type:'text/csv'}));dialog.close();
  };
 }catch(e){if(!closed){message.textContent='图片识别失败：'+e.message;save.disabled=true;}}finally{await releaseScreenshotWorker(workerOwner);}
 await done;
}
