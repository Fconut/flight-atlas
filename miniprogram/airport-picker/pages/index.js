const airports=require('../airports'),names=require('../../lib/names'),metadata=require('../search-metadata'),Search=require('../lib/airport-search'),account=require('../../lib/account-state'),local=require('../../lib/local-state');
Page({data:{results:[],query:'',frequent:[]},
 onLoad(options){this.searchIndex=Search.create(airports,names,metadata);wx.setNavigationBarTitle({title:options.key==='to'?'选择到达机场':'选择出发机场'});const counts=new Map();for(const r of local.read(account.activeScope()).rows)for(const code of [r.from,r.to])if(airports[code])counts.set(code,(counts.get(code)||0)+1);this.setData({frequent:[...counts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,8).map(([code])=>({code,label:names[code]||airports[code].name||code}))})},
 search(e){const query=e.detail.value.trim();this.setData({query,results:this.searchIndex.query(query,40)})},
 choose(e){const code=e.currentTarget.dataset.code;if(!airports[code])return;this.getOpenerEventChannel().emit('airportSelected',{code});wx.navigateBack()}
});
