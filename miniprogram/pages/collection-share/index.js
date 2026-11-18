const account=require('../../lib/account-state'),local=require('../../lib/local-state'),drafts=require('../../lib/draft-state'),auto=require('../../lib/auto-save'),{localDay}=require('../../lib/day'),{buildCollectionSnapshot}=require('../../lib/collection-share'),{callShare}=require('../../lib/share-api');
const {openShareResult}=require('../../lib/open-share-result');
Page({
 data:{loading:true,message:'',makerIndex:0,visibleBadges:[]},
 onLoad(o){this.id=o.id||o.scene;this.public=!!this.id},
 selectMaker(e){const index=Number(e.currentTarget.dataset.index);if(index<0||index>2)return;this.updateBadges(this.data.snapshot,index)},
 updateBadges(snapshot,index=this.data.makerIndex){if(!snapshot)return;const maker=['Boeing','Airbus','Other'][index];this.setData({makerIndex:index,visibleBadges:snapshot.badges.filter(b=>(b.manufacturer==='Boeing'?'Boeing':b.manufacturer==='Airbus'?'Airbus':'Other')===maker).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name))})},
 onReady(){return this.load()},
 onUnload(){this.disposed=true},
 onShow(){if(this.scope&&this.scope!==account.activeScope()){this.id=null;this.setData({snapshot:null,ready:false,cardPath:'',message:'微信账号已切换，请重新打开分享页面'})}},
 async load(){if(this.working||this.disposed)return;this.working=true;this.setData({loading:true,loadError:false,message:''});try{
 let snapshot;if(this.public){const r=await callShare('get',{id:this.id});if(r.snapshot.kind!=='collection')throw Error('分享类型不正确');snapshot=r.snapshot}
 else{await auto.start();if(this.disposed)return;this.scope=account.activeScope();snapshot=buildCollectionSnapshot(drafts.snapshot(local.read(this.scope)),localDay())}
 if(this.disposed)return;this.setData({snapshot,public:this.public});this.updateBadges(snapshot);

 }catch(e){if(!this.disposed)this.setData({loadError:true,message:e.message})}finally{this.working=false;if(!this.disposed)this.setData({loading:false})}},
 async prepare(){if(this.data.busy||this.data.loading||!this.data.snapshot)return;this.setData({busy:true,message:''});try{
 await auto.ensureSaved();if(this.disposed)return;const state=auto.getState();if(state.phase!=='saved'||state.scope!==this.scope)throw Error('航班尚未同步，请联网后重试');
 const r=await callShare('create',{kind:'collection'});if(this.disposed)return;if(this.scope!==account.activeScope())throw Error('微信账号已切换，请重新打开此页面');
 this.setData({snapshot:r.snapshot});this.updateBadges(r.snapshot);await openShareResult(r.snapshot,r.id,this.scope);
 }catch(e){if(!this.disposed)this.setData({message:e.message})}finally{if(!this.disposed)this.setData({busy:false})}},
 onShareAppMessage(){return this.id&&(this.public||this.scope===account.activeScope())?{title:'我的机型收藏册 · 已解锁 '+this.data.snapshot.summary.unlocked+' 枚徽章',path:'/pages/collection-share/index?id='+this.id,imageUrl:this.data.cardPath}:{title:'Flight Atlas · 机型收藏册',path:'/pages/fleet/index'}},
 makeMine(){wx.switchTab({url:'/pages/fleet/index'})}
});
