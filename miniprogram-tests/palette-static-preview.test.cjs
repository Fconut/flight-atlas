const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../miniprogram'),catalog=require('../miniprogram/lib/collection-catalog');
test('all 100 palettes have local HD preview assets and each preview subpackage stays below 2MB',()=>{
 const sizes=new Map();
 catalog.items.forEach(item=>{
  const asset=item.previewAsset,file=path.join(root,asset.path.slice(1)),data=fs.readFileSync(file);
  assert.equal(data[0],255);assert.equal(data[1],216);
  let position=2,dimensions;
  while(position<data.length){
   assert.equal(data[position++],255);
   const marker=data[position++],length=data.readUInt16BE(position);
   if(marker===0xc0||marker===0xc2){dimensions={height:data.readUInt16BE(position+3),width:data.readUInt16BE(position+5)};break;}
   position+=length;
  }
  assert.deepEqual(dimensions,{width:2160,height:asset.height},item.id);
  sizes.set(asset.package,(sizes.get(asset.package)||0)+data.length);
 });
 assert.equal(sizes.size,10);
 assert([...sizes.values()].every(size=>size>0&&size<1900000));
 const template=fs.readFileSync(path.join(root,'pages/collection/palettes.wxml'),'utf8');assert(!template.includes('<canvas'));assert(!template.includes('getImageData'));
});
