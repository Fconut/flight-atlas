const test=require('node:test'),assert=require('node:assert/strict');
test('render cache isolates accounts and content, and discards expired image paths',()=>{
 const cache=require('../miniprogram/lib/share-render-cache');let exists=true;
 global.wx={getFileSystemManager:()=>({accessSync(){if(!exists)throw Error('expired')}})};
 cache.put('alice',{total:1},{cardPath:'card.png'});assert.equal(cache.get('alice',{total:1}).cardPath,'card.png');assert.equal(cache.get('bob',{total:1}).cardPath,undefined);assert.equal(cache.get('alice',{total:2}).cardPath,undefined);
 exists=false;assert.equal(cache.get('alice',{total:1}).cardPath,undefined);delete global.wx;
});
