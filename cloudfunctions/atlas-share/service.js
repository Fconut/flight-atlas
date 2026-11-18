const { createHash, randomBytes } = require('crypto');
const APPID = 'wx31f3f3739a7a1743', COLLECTION = 'mini_atlas_drafts';
// Database and cloud calls may reorder object fields; share identity depends on content.
const canonical = value => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map(key => [key,item[key]])) : item);
const fail = (code,message) => { const error=Error(message);error.code=code;throw error; };
async function read(ref) {
  try { const data=(await ref.get()).data;if(!data)return null;const {_id,...value}=data;return value; }
  catch (error) { if (/DOCUMENT_NOT_FOUND|document.*(?:not exist|not found|不存在)/i.test(error.message||error.errMsg||'')) return null; throw error; }
}
function createHandler({ cloud, buildSnapshot, buildBadgeSnapshot, buildCollectionSnapshot, now = Date.now }) {
  return async(event={}) => {
    try {
      const identity = cloud.getWXContext();
      if (identity.APPID !== APPID) fail('UNAUTHORIZED','请从当前小程序访问分享');
      const owner = typeof identity.OPENID === 'string' && /^[\w-]{8,128}$/.test(identity.OPENID) ? createHash('sha256').update(APPID+'\0'+identity.OPENID).digest('hex') : null;
      const db=cloud.database(), collection=db.collection(COLLECTION);
      if (event.action === 'get') {
        if (!/^[a-f0-9]{32}$/.test(event.id||'')) fail('UNAVAILABLE','这份分享不存在或暂不可用');
        const record=await read(collection.doc('share-'+event.id));
        if (!record) fail('UNAVAILABLE','这份分享不存在或暂不可用');
        return {ok:true,id:event.id,snapshot:record.snapshot,createdAt:record.createdAt,isOwner:owner===record.owner};
      }
      if (!owner) fail('UNAUTHORIZED','微信身份暂不可用，请重新进入小程序');
      if (event.action === 'create') {
        const privateRecord=await read(collection.doc(owner));
        if (!privateRecord || privateRecord._openid!==identity.OPENID || privateRecord.appId!==APPID) fail('NO_DRAFT','航班尚未同步，请联网后重试');
        let snapshot;
        try {snapshot=event.kind==='collection'?buildCollectionSnapshot(privateRecord.payload,new Date(now()+8*3600000).toISOString().slice(0,10)):event.kind==='badge'?buildBadgeSnapshot(privateRecord.payload,new Date(now()+8*3600000).toISOString().slice(0,10),event.badgeId,event.selected):buildSnapshot(privateRecord.payload,new Date(now()+8*3600000).toISOString().slice(0,10));}
        catch (_) {fail('INVALID_DRAFT',event.kind==='collection'?'还没有可分享的已解锁徽章':event.kind==='badge'?'这枚徽章的记录已更新，请重新打开分享页面':'至少需要一条有效的已飞行程，请核对航班记录后重试');}
        if(snapshot.kind==='badge'&&(!Array.isArray(event.expected)||event.expected.length!==snapshot.records.length||snapshot.records.some((record,index)=>['date','from','to','airline','flight','departureTime'].some(key=>String(record[key]??'')!==String(event.expected[index]?.[key]??'')))))fail('CHANGED','航班记录已更新，请返回后重新选择');
        if(Buffer.byteLength(JSON.stringify(snapshot),'utf8')>500*1024)fail('TOO_LARGE','足迹数据过多，暂时无法生成分享');
        let id=randomBytes(16).toString('hex'),createdAt=now();
        const digest=createHash('sha256').update(canonical(snapshot)).digest('hex');
        await db.runTransaction(async tx=>{
          const refs=tx.collection(COLLECTION);
          const keyId='share-key-'+createHash('sha256').update(owner+digest).digest('hex');const keyed=await read(refs.doc(keyId));
          if(keyed?.id){const old=await read(refs.doc('share-'+keyed.id));if(old?.owner===owner&&createHash('sha256').update(canonical(old.snapshot)).digest('hex')===digest){id=keyed.id;createdAt=old.createdAt;return}}
          const current=await read(refs.doc(owner)),index=await read(refs.doc('share-owner-'+owner));
          if (!current || current.revision!==privateRecord.revision) fail('CHANGED','航班刚刚更新，请重新生成分享');
          if(index?.latestHash===digest&&/^[a-f0-9]{32}$/.test(index.latestId||'')){
            const existing=await read(refs.doc('share-'+index.latestId));
            if(existing&&existing.owner===owner&&createHash('sha256').update(canonical(existing.snapshot)).digest('hex')===digest){id=index.latestId;createdAt=existing.createdAt;return}
          }
          if(index?.busyUntil>now())fail('BUSY','分享正在准备中，请稍后重试');
          if(index?.lastActivity!=null&&now()-index.lastActivity<30000)fail('RATE_LIMIT','请在 '+Math.ceil((30000-now()+index.lastActivity)/1000)+' 秒后再生成新的分享');
          await refs.doc(keyId).set({data:{id}});
          await refs.doc('share-'+id).set({data:{owner,snapshot,createdAt}});
          await refs.doc('share-owner-'+owner).set({data:{...index,latestId:id,latestHash:digest,lastActivity:now()}});
        });
        return {ok:true,id,snapshot,createdAt};
      }
      if (!/^[a-f0-9]{32}$/.test(event.id||'')) fail('INVALID_REQUEST','分享编号无效');
      if (event.action === 'code') {
        const record=await read(collection.doc('share-'+event.id));
        if(!record||record.owner!==owner)fail('UNAVAILABLE','分享暂不可用');
        const version=['develop','trial','release'].includes(event.envVersion)?event.envVersion:'release';
        const cacheId='share-code-'+event.id+'-'+version,lease=randomBytes(16).toString('hex');let image;
        await db.runTransaction(async tx=>{
          const refs=tx.collection(COLLECTION),cached=await read(refs.doc(cacheId));
          if(cached?.image){image=cached.image;return}
          if(cached?.until>now())fail('BUSY','小程序码正在生成，请稍后重试');
          const index=await read(refs.doc('share-owner-'+owner));
          if(index?.busyUntil>now())fail('BUSY','分享正在准备中，请稍后重试');
          if(index?.latestId!==event.id&&index?.lastActivity!=null&&now()-index.lastActivity<30000)fail('RATE_LIMIT','操作较快，请稍后再生成小程序码');
          await refs.doc(cacheId).set({data:{lease,until:now()+30000}});
          await refs.doc('share-owner-'+owner).set({data:{...index,codeLease:lease,busyUntil:now()+30000}});
        });
        if(image)return {ok:true,image};
        try {
          const result=await cloud.openapi.wxacode.getUnlimited({scene:event.id,page:record.snapshot.kind==='collection'?'pages/collection-share/index':record.snapshot.kind==='badge'?'pages/badge-share/index':'pages/share-view/index',checkPath:false,envVersion:version,width:430});
          image=result.buffer.toString('base64');
          await db.runTransaction(async tx=>{const refs=tx.collection(COLLECTION),cached=await read(refs.doc(cacheId)),index=await read(refs.doc('share-owner-'+owner));if(cached?.lease!==lease||index?.codeLease!==lease)fail('BUSY','生成状态已变化，请重试');await refs.doc(cacheId).set({data:{image}});await refs.doc('share-owner-'+owner).set({data:{...index,codeLease:'',busyUntil:0,lastActivity:now()}})});
          return {ok:true,image};
        } catch (_) {
          await db.runTransaction(async tx=>{const refs=tx.collection(COLLECTION),cached=await read(refs.doc(cacheId)),index=await read(refs.doc('share-owner-'+owner));if(cached?.lease===lease)await refs.doc(cacheId).set({data:{}});if(index?.codeLease===lease)await refs.doc('share-owner-'+owner).set({data:{...index,codeLease:'',busyUntil:0}})});
          fail('CODE_UNAVAILABLE','小程序码暂不可用，请重试；已生成的图片和卡片会保留');
        }
      }
      fail('INVALID_REQUEST','不支持的分享操作');
    } catch(error) {
      const known=['UNAUTHORIZED','UNAVAILABLE','INVALID_REQUEST','NO_DRAFT','INVALID_DRAFT','TOO_LARGE','CHANGED','RATE_LIMIT','BUSY','CODE_UNAVAILABLE'].includes(error.code);
      return {ok:false,code:known?error.code:'SHARE_FAILED',message:known?error.message:'分享服务暂不可用，请稍后重试'};
    }
  };
}
module.exports={createHandler};
