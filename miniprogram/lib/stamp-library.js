const catalog=require('./stamp-catalog'),plan=require('./stamp-rewards'),account=require('./account-state'),local=require('./local-state'),store=require('./checkin-store');
const byId=new Map(catalog.items.map(x=>[x.id,x]));
const days=new Map(plan.map(x=>[x.itemId,x.day]));
const CAPACITY=6;
function item(id){return byId.get(id)}
function snapshot(){
 const scope=account.activeScope(),unlocked=store.stampIds(scope),owned=x=>!!x&&(x.free||unlocked.has(x.id));
 const active=local.read(scope).prefs.posterStamp;
 const activeId=owned(item(active))?active:null;
 const saved=wx.getStorageSync(scope+'-poster-stamps');
 const selected=new Set((Array.isArray(saved)?saved:[]).filter(id=>owned(item(id))));
 if(activeId)selected.add(activeId);
 if(selected.size>CAPACITY){const keep=[...selected].filter(id=>id!==activeId).slice(0,CAPACITY-(activeId?1:0));selected.clear();keep.forEach(id=>selected.add(id));if(activeId)selected.add(activeId);wx.setStorageSync(scope+'-poster-stamps',[...selected])}
 const decorate=x=>({...x,owned:owned(x),included:selected.has(x.id),active:activeId===x.id,full:selected.size>=CAPACITY,source:days.has(x.id)?'来源：累计签到 '+days.get(x.id)+' 天奖励':'获取方式待开放'});
 return {scope,owned,activeId,selected,decorate};
}
function setIncluded(id,included){const x=item(id),s=snapshot();if(!s.owned(x))throw Error('这枚印章尚未解锁');if(!included&&s.activeId===id)throw Error('请先在首页切换印章，再移除这枚印章');if(included&&!s.selected.has(id)&&s.selected.size>=CAPACITY)throw Error('海报印章最多添加6枚，请先移除一枚');if(s.selected.has(id)===!!included)return x;if(included)s.selected.add(id);else s.selected.delete(id);wx.setStorageSync(s.scope+'-poster-stamps',[...s.selected]);return x}
function candidates(){const s=snapshot();return catalog.items.filter(x=>s.selected.has(x.id))}
function ownedItems(){const s=snapshot();return catalog.items.filter(s.owned)}
function series(filter='all'){const s=snapshot();return catalog.series.map(v=>{const members=catalog.items.filter(x=>x.seriesId===v.id),count=members.filter(s.owned).length;return {...v,cover:members[0],ownedCount:count,total:members.length,locked:!count}}).filter(v=>filter!=='owned'||v.ownedCount)}
module.exports={catalog,CAPACITY,item,snapshot,setIncluded,candidates,ownedItems,series,rewardPlan:()=>plan.map(r=>({...r,type:'stamp'}))};
