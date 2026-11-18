// Public app entry only: never include private records, rewards or poster state.
const HOME='/pages/index/index';
const TITLE='Flight Atlas · 把旅程，绘成一幅地图。';
module.exports={
 onLoad(options={}){
  wx.showShareMenu?.({menus:['shareAppMessage','shareTimeline']});
  if(options.appEntry==='1'&&this.route!=='pages/index/index')wx.switchTab({url:HOME});
 },
 onShareAppMessage(){return {title:TITLE,path:HOME}},
 onShareTimeline(){return {title:TITLE,query:'appEntry=1'}}
};
