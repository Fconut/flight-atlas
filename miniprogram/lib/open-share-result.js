function openShareResult(snapshot,id,scope){
 return new Promise((resolve,reject)=>wx.navigateTo({url:'/pages/share-result/index',success:result=>{result.eventChannel.emit('share',{snapshot,id,scope});resolve()},fail:()=>reject(Error('无法打开分享预览，请重试'))}));
}
module.exports={openShareResult};
