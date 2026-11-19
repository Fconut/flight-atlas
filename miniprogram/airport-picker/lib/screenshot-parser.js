const AirportSearch = require('./airport-search');
function cleanScreenshotAirport(value){return AirportSearch.clean(value);}
function screenshotAircraft(line){
 const text=String(line||'').normalize('NFKC').trim();
 const label=text.match(/(?:机型|AIRCRAFT(?: TYPE)?)\s*[:：]?\s*(.+)$/i);if(label)return label[1].trim().slice(0,100);
 const brand=text.match(/(?:巴航|空客|波音|庞巴迪)\s*([A-Z0-9][A-Z0-9 ()-]{1,50})/i);if(brand)return brand[1].trim();
 return /^(?:(?:AIRBUS|BOEING|EMBRAER|BOMBARDIER)\s+)?(?:CRJ[ -]?(?:700|900|1000)|CRJ[79]|E(?:170|175|190|195)(?:[ -]?E2|[ -]?(?:LONG|SHORT) WING|[ -]?(?:长翼|短翼)|[（(](?:长翼|短翼)[）)])?|E75[LS]|E(?:290|295)|B(?:73[3-9]|38M|39M)|(?:B?737)[ -]?(?:[3-9]00(?:ER)?|MAX[ -]?[89])|A(?:3[12345][0-9]|19N|20N|21N|35K)|A3[12345]0[ -]?(?:[123689]00|1000)(?:NEO)?|ATR[ -]?(?:42|72)(?:[ -]?600)?)$/i.test(text)?text:'';
}
function parseScreenshotDetail(text){
 const lines=String(text).normalize('NFKC').split(/\r?\n/).map(s=>s.trim()).filter(Boolean),planIndex=lines.findIndex(l=>/计划/.test(l)&&/20\d{2}[-/.年]/.test(l));
 if(planIndex<0)return null;
 const top=lines.slice(0,planIndex+2).join('\n'),flight=top.toUpperCase().match(/(?:^|[^A-Z0-9])([A-Z][A-Z0-9]|[0-9][A-Z])\s*(\d{2,4})\b/),route=top.match(/([\u3400-\u9fff][\u3400-\u9fff \t·]{1,30}(?:[ \t]+[A-Z])?)\s*[-–—→]\s*([\u3400-\u9fff][\u3400-\u9fff \t·]{1,30}(?:[ \t]+[A-Z])?)/),date=lines[planIndex].match(/(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})/),time=lines[planIndex].match(/([0-2]\d)[:：]([0-5]\d)/);
 if(!flight||!route||!date)return null;
 const model=lines.slice(0,planIndex+2).map(screenshotAircraft).find(Boolean)||'';
 return {date:date[1]+'-'+date[2].padStart(2,'0')+'-'+date[3].padStart(2,'0'),airline:flight[1],flight:flight[2],from:cleanScreenshotAirport(route[1]),to:cleanScreenshotAirport(route[2]),rawFrom:route[1].trim(),rawTo:route[2].trim(),departureTime:time?time[1]+':'+time[2]:'',aircraft:model,rawAircraft:model};
}
// Order itineraries place each departure before the flight number, unlike history lists.
function parseOrderItinerary(text){
 const normalized=String(text).normalize('NFKC').replace(/([\u3400-\u9fff])[ \t]+(?=[\u3400-\u9fff])/g,'$1');
 if(!/订单|中转/.test(normalized))return null;
 const lines=normalized.split(/\r?\n/).map(s=>s.trim()).filter(Boolean),rows=[];
 const date=normalized.match(/(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})/);
 let departure=null,active=null;
 for(let i=0;i<lines.length;i++){
  const line=lines[i],time=line.match(/^(\d{1,2})\s*:\s*([0-5]\d)(?=\s|[^0-9]|$)/);
  if(time){
   const raw=line.slice(time[0].length).trim()||lines[i+1]||'';
   if(/机场/.test(raw)){
    const airport=cleanScreenshotAirport(raw.replace(/\s*T\d+.*$/i,''));
    if(active){active.to=airport;active.rawTo=raw;active=null;departure=null}
    else departure={from:airport,rawFrom:raw,departureTime:time[1].padStart(2,'0')+':'+time[2]};
   }
  }
  const flight=line.match(/(?:^|[^A-Z0-9])([A-Z][A-Z0-9]|[0-9][A-Z])\s*(\d{2,4})\b/i);
  if(flight&&departure){
   const model=line.match(/波音\s*(737)(?![0-9-])|\b(C919)\b/i);
   active={...departure,date:date?date[1]+'-'+date[2].padStart(2,'0')+'-'+date[3].padStart(2,'0'):'',dateIssue:!date&&/\d{1,2}月\d{1,2}日/.test(normalized)?'missing-year':'',airline:flight[1].toUpperCase(),flight:flight[2],to:'',aircraft:model?(model[2]||'BOEING 737'):'',rawAircraft:model?model[0]:''};rows.push(active);
  }
 }
 return rows.length?rows:null;
}
function parseFlightScreenshot(text){
 text=String(text).normalize('NFKC').replace(/(\d)[ \t]*([年月日])[ \t]*/g,'$1$2');
 const order=parseOrderItinerary(text);if(order)return order;
 const detail=parseScreenshotDetail(text);if(detail)return [detail];
 const lines=String(text).normalize('NFKC').split(/\r?\n/).map(s=>s.trim()).filter(Boolean),rows=[];let pendingDate='',pendingYear='',active=null;
 for(const line of lines){
  const aircraft=screenshotAircraft(line);if(aircraft){if(active){active.aircraft=aircraft;active.rawAircraft=aircraft}continue;}
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
 let lastDate='';return rows.map(({_monthDay,...row})=>{if(row.date)lastDate=row.date;else if(!_monthDay&&lastDate)row.date=lastDate;else if(_monthDay){lastDate='';row.dateIssue='missing-year';}return row;});
}

module.exports = { parseFlightScreenshot };

