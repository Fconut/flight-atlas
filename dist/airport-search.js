'use strict';
const AirportSearch=(()=>{
 const variants={'奧':'奥','陸':'陆','凱':'凯','維':'维','爾':'尔','蘭':'兰','樂':'乐','國':'国','際':'际','場':'场','機':'机','東':'东','橋':'桥','寶':'宝','灣':'湾','臺':'台','島':'岛','廣':'广','龍':'龙','門':'门','羅':'罗','馬':'马','倫':'伦','漢':'汉','長':'长','慶':'庆'};
 function clean(value){return String(value||'').normalize('NFKC').replace(/[\p{Cf}\uFFFD]/gu,'').replace(/^[\p{P}\p{S}\s]+|[\p{P}\p{S}\s]+$/gu,'').replace(/[奧陸凱維爾蘭樂國際場機東橋寶灣臺島廣龍門羅馬倫漢長慶]/g,c=>variants[c]).replace(/[“”‘’"'「」『』]/g,'').replace(/^[\s,，.。+＋_\-\d]+/,'').replace(/\s*(?:航站楼|TERMINAL\s*\w*|MAIN|T\s*\d+)\s*$/i,'').replace(/([\u3400-\u9fff])\s*[A-Z]$/i,'$1').trim();}
 function key(value){return clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/国际机场|国际|机场|international|airport|aerodrome/g,'').replace(/[\p{P}\p{S}\s]/gu,'');}
 function distance(a,b,limit){if(Math.abs(a.length-b.length)>limit)return limit+1;let prev=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let next=[i];for(let j=1;j<=b.length;j++)next[j]=Math.min(next[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));if(Math.min(...next)>limit)return limit+1;prev=next;}return prev[b.length];}
 function create(airports,names={},metadata={}){
  const entries=[],exact=new Map(),cities=new Map(),codes=new Map();
  const add=(map,k,entry)=>{if(!k)return;if(!map.has(k))map.set(k,new Set());map.get(k).add(entry);};
  for(const [code,a]of Object.entries(airports)){const m=metadata[code]||{},city=m.cityZh||'',label=m.aliases?.[0]||names[code]||a.name||code;const entry={code,icao:m.icao||'',label,city:city||a.city||'',country:a.country||'',terms:[],cityTerms:[]};
   for(const value of [a.name,names[code],...(m.aliases||[])]){const term=key(value);if(term){if(!entry.terms.includes(term))entry.terms.push(term);add(exact,term,entry);}}
   for(const value of [city,a.city]){const term=key(value);if(term){if(!entry.cityTerms.includes(term))entry.cityTerms.push(term);add(cities,term,entry);}}
   // Old Chinese labels may be city abbreviations. Treat them as cities if shared.
   codes.set(code.toUpperCase(),entry);if(m.icao)codes.set(m.icao.toUpperCase(),entry);entries.push(entry);
  }
  const translatedCities=new Map(),cityMembers=new Map();for(const e of entries){const english=key(airports[e.code].city),zh=metadata[e.code]?.cityZh;if(english){add(cityMembers,english,e);if(zh)translatedCities.set(english,zh);}}
  for(const [english,zh]of translatedCities)for(const e of cityMembers.get(english)||[])add(cities,key(zh),e);
  // A city-only label must not silently win over other airports serving the city.
  for(const entry of entries){const label=key(names[entry.code]);if(entry.cityTerms.includes(label))add(cities,label,entry);}
  function search(value,limit){
   const text=clean(value),q=key(value),code=codes.get(text.toUpperCase());if(code)return [{...code,kind:'code',score:0}];if(!q)return [];
   const citySet=cities.get(q),nameSet=exact.get(q);
   if(citySet?.size>1){const all=new Set([...(citySet||[]),...(nameSet||[])]);return [...all].sort((a,b)=>a.code.localeCompare(b.code)).slice(0,limit).map(e=>({...e,kind:'city',score:20}));}
   if(nameSet?.size)return [...nameSet].sort((a,b)=>a.code.localeCompare(b.code)).slice(0,limit).map(e=>({...e,kind:nameSet.size===1?'exact':'ambiguous',score:1}));
   if(citySet?.size)return [...citySet].slice(0,limit).map(e=>({...e,kind:'city',score:20}));
   if(q.length<2)return [];
   const hits=[];for(const e of entries){let best=Infinity,kind='partial';for(const t of [...e.terms,...e.cityTerms]){
    if(t.includes(q)){const score=30+(t.length-q.length)/100;if(score<best){best=score;kind='partial';}continue;}
    if(q.includes(t)&&t.length>=2){const score=35+(q.length-t.length)/100;if(score<best){best=score;kind='partial';}}
    if(q.length>=2&&t.length>=2){const max=q.length>=7?2:1,d=distance(q,t,max);if(d<=max&&40+d<best){best=40+d;kind='fuzzy';}}
   }if(Number.isFinite(best))hits.push({...e,score:best,kind});}
   return hits.sort((a,b)=>a.score-b.score||a.code.localeCompare(b.code)).slice(0,limit);
  }
  const queryCache=new Map();
  function query(value,limit=6){
   const text=String(value||'').trim(),count=Math.max(1,Math.min(20,Number(limit)||6)),cacheKey=text+'|'+count;
   if(queryCache.has(cacheKey))return queryCache.get(cacheKey);
   const hits=text.length>256?[]:search(text,count);
   if(queryCache.size>=100)queryCache.delete(queryCache.keys().next().value);
   queryCache.set(cacheKey,hits);return hits;
  }
  function resolve(value){const hits=query(value,2);return hits.length&&['code','exact'].includes(hits[0].kind)&&(!hits[1]||hits[1].score>hits[0].score)?hits[0].code:null;}
  return {query,resolve,entries};
 }
 function suggestions(input,container,getIndex,onSelect){function render(){container.replaceChildren();const index=getIndex();if(!index)return;const value=input.value.trim(),hits=index.query(value);if(hits[0]?.kind==='code')return;if(value&&!hits.length){const hint=document.createElement('span');hint.className='airport-search-empty';hint.textContent='暂无候选，可输入城市、机场名、IATA 或 ICAO 代码继续搜索';container.append(hint);}for(const item of hits){const button=document.createElement('button');button.type='button';button.className='airport-candidate';button.textContent=item.label+' '+item.code+(item.kind==='fuzzy'?' · 相近名称':item.kind==='city'?' · 城市候选':'');button.addEventListener('click',()=>{input.value=item.code;input.dispatchEvent(new Event('input',{bubbles:true}));onSelect?.(item);});container.append(button);}}input.addEventListener('input',render);input.addEventListener('focus',render);render();return render;}
 return {clean,key,create,suggestions};
})();
let airportSearchCache;
function getAirportSearch(){if(!airportSearchCache||airportSearchCache.airports!==editorAirports||airportSearchCache.names!==editorNames){airportSearchCache={airports:editorAirports,names:editorNames,index:AirportSearch.create(editorAirports,editorNames,typeof airportSearchMetadata==='undefined'?{}:airportSearchMetadata)};}return airportSearchCache.index;}
