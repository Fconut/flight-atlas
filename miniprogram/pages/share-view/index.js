const {callShare}=require('../../lib/share-api');
const {renderMedia}=require('../../lib/share-media');
Page({
  data:{loading:true,message:''},
  onLoad(options){try{this.id=options.id||decodeURIComponent(options.scene||'')}catch(_){this.id=''}},
  async onReady(){await this.loadShare()},
  onShow(){if(this.loaded)this.loadShare()},
  onUnload(){this.disposed=true},
  async loadShare(){
    if(this.busy||this.disposed)return;this.busy=true;
    try{
      if(!/^[a-f0-9]{32}$/.test(this.id||''))throw Error('这份分享暂不可用，请稍后重试');
      const result=await callShare('get',{id:this.id});
      if(this.disposed)return;
      if(!this.data.posterPath){const media=await renderMedia(this,result.snapshot);if(this.disposed)return;this.setData({...media,summary:result.snapshot.summary})}
      this.loaded=true;this.setData({active:true,message:''});
    }catch(error){this.loaded=true;if(!this.disposed)this.setData({active:false,posterPath:'',cardPath:'',message:error.message||'暂时无法读取分享'})}
    finally{this.busy=false;if(!this.disposed)this.setData({loading:false})}
  },
  onShareAppMessage(){return this.data.active&&this.data.cardPath?{title:'看看这份飞行足迹',path:'/pages/share-view/index?id='+this.id,imageUrl:this.data.cardPath}:{title:'Flight Atlas · 飞行足迹',path:'/pages/index/index'}},
  preview(){if(this.data.posterPath)wx.previewImage({urls:[this.data.posterPath]})},
  makeMine(){wx.switchTab({url:'/pages/index/index'})}
});
