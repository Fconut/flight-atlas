const account=require('../../lib/account-state');
const local=require('../../lib/local-state');
const drafts=require('../../lib/draft-state');
const autoSave=require('../../lib/auto-save');
const {localDay}=require('../../lib/day');
const {buildSnapshot}=require('../../lib/share-snapshot');
const {callShare}=require('../../lib/share-api');
const {renderMedia}=require('../../lib/share-media');
Page({
  data:{loading:true,ready:false,message:''},
  ensureOwner(){
    const active=account.activeScope(),claims=wx.getStorageSync('atlas-mini-auto-migrated-sources')||{};
    if(this.ownerScope!==active&&claims[this.ownerScope]!==active)throw Error('微信账号已切换，请重新打开分享页面');
  },
  async onReady(){
    try{
      await autoSave.start();this.ownerScope=account.activeScope();
      this.snapshot=buildSnapshot(drafts.snapshot(local.read(this.ownerScope)),localDay());
      const media=await renderMedia(this,this.snapshot);
      this.ensureOwner();
      if(!this.disposed)this.setData({...media,summary:this.snapshot.summary});
    }catch(error){if(!this.disposed)this.setData({message:'暂时无法准备分享：'+error.message})}
    finally{if(!this.disposed)this.setData({loading:false})}
  },
  onShow(){
    if(this.ownerScope&&this.ownerScope!==account.activeScope()){
      const claims=wx.getStorageSync('atlas-mini-auto-migrated-sources')||{};
      if(claims[this.ownerScope]===account.activeScope())this.ownerScope=account.activeScope();
      else{this.readyShare=null;this.snapshot=null;this.setData({ready:false,posterPath:'',cardPath:'',message:'微信账号已切换，请重新打开分享页面'})}
    }
  },
  onUnload(){this.disposed=true},
  async createShare(){
    if(this.data.busy||!this.snapshot)return;
    this.setData({busy:true,message:'正在准备分享卡片…'});let created;
    try{
      await autoSave.ensureSaved();
      if(this.disposed)return;
      const state=autoSave.getState();
      if(state.phase!=='saved'||!state.session)throw Error('航班尚未同步，请联网后重试');
      const claims=wx.getStorageSync('atlas-mini-auto-migrated-sources')||{};
      if(state.scope!==this.ownerScope&&claims[this.ownerScope]!==state.scope)throw Error('微信账号已切换，请重新打开分享页面');
      this.ownerScope=state.scope;
      if(this.disposed)return;
      created=await callShare('create');
      this.ensureOwner();
      if(this.disposed)return
      let code,codeMessage='';
      try{code=(await callShare('code',{id:created.id,envVersion:wx.getAccountInfoSync?.().miniProgram.envVersion||'release'})).image}catch(_){codeMessage='小程序码暂不可用，仍可发送分享卡片。'}
      if(this.disposed)return;
      const media=await renderMedia(this,created.snapshot,code);
      this.ensureOwner();
      if(this.disposed)return;
      this.snapshot=created.snapshot;this.readyShare=created;
      this.setData({...media,summary:created.snapshot.summary,ready:true,message:codeMessage});
    }catch(error){
      if(!this.disposed)this.setData({message:error.message||'准备分享失败，请稍后重试'});
    }finally{if(!this.disposed)this.setData({busy:false})}
  },
  onShareAppMessage(){
    if(!this.data.ready||!this.readyShare||this.ownerScope!==account.activeScope())return{title:'Flight Atlas · 飞行足迹',path:'/pages/index/index'};
    const summary=this.snapshot.summary;
    return{title:'我的 '+summary.total+' 次飞行，累计 '+Math.round(summary.km).toLocaleString('en-US')+' 公里',path:'/pages/share-view/index?id='+this.readyShare.id,imageUrl:this.data.cardPath};
  },
  shareImage(){
    if(!this.data.ready||this.data.busy||!this.data.posterPath)return;
    try{this.ensureOwner()}catch(error){this.setData({message:error.message});return}
    if(typeof wx.showShareImageMenu!=='function'){wx.previewImage({urls:[this.data.posterPath]});this.setData({message:'当前微信暂不支持直接分享图片，可在预览中长按图片发送。'});return}
    wx.showShareImageMenu({path:this.data.posterPath,fail:error=>{if(!this.disposed&&!/cancel/i.test(error.errMsg||''))this.setData({message:'暂时无法分享图片，请重试或选择分享卡片。'})}});
  },
  preview(){if(this.data.posterPath)wx.previewImage({urls:[this.data.posterPath]})},
});
