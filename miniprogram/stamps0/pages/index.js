const library=require('../../lib/stamp-library');
const updateView=require('../../lib/view-state');
Page({
 data:{series:[],seriesId:'',seriesName:'',items:[],ownedCount:0,filter:'all',total:100,capacity:library.CAPACITY,selected:null,error:''},
 onLoad(options={}){const series=library.catalog.series.find(s=>s.id===options.series);this.setData({seriesId:series?.id||'',seriesName:series?.name||'',filter:options.filter==='owned'?'owned':'all'})},
 onShow(){this.disposed=false;this.refresh();require('../../lib/checkin').status(false,{passive:true}).then(()=>{if(!this.disposed)this.refresh()}).catch(()=>{})},
 onHide(){this.disposed=true},onUnload(){this.disposed=true},
 refresh(){try{const s=library.snapshot();updateView(this,{ownedCount:library.ownedItems().length,series:this.data.seriesId?[]:library.series(this.data.filter),items:library.catalog.items.filter(x=>x.seriesId===this.data.seriesId&&(this.data.filter!=='owned'||s.owned(x))).map(s.decorate),selected:this.data.selected?s.decorate(library.item(this.data.selected.id)):null,error:''})}catch(e){this.setData({error:e.message})}},
 filter(e){const filter=e.currentTarget.dataset.filter;if(!['all','owned'].includes(filter)||filter===this.data.filter)return;this.setData({filter});this.refresh()},
 series(e){const id=e.currentTarget.dataset.id;if(this.opening||!library.catalog.series.some(s=>s.id===id))return;this.opening=true;wx.navigateTo({url:'/stamps0/pages/index?series='+encodeURIComponent(id)+'&filter='+this.data.filter,complete:()=>{this.opening=false}})},
 backToSeries(){wx.navigateBack()},
 open(e){const x=library.item(e.currentTarget.dataset.id);if(x)this.setData({selected:library.snapshot().decorate(x),detailLoading:true,error:''})},
 detailReady(e){if(e.currentTarget.dataset.id===this.data.selected?.id)this.setData({detailLoading:false,error:''})},
 detailError(e){if(e.currentTarget.dataset.id===this.data.selected?.id)this.setData({detailLoading:false,error:'印章图片加载失败，请关闭后重试'})},
 close(){this.setData({selected:null,error:'',detailLoading:false})},stop(){},
 toggleIncluded(){if(!this.data.selected)return;try{const x=this.data.selected;library.setIncluded(x.id,!x.included);this.refresh();wx.showToast({title:x.included?'已移除':'已添加',icon:'success'})}catch(e){this.setData({error:e.message})}}
});
