const test = require('node:test'), assert = require('node:assert/strict');
const { createHandler } = require('../cloudfunctions/atlas-ocr/service');
function harness() {
  const records = new Map(), deleted = [];
  let identity = { APPID: 'wx31f3f3739a7a1743', OPENID: 'test-openid-alice' }, runs = 0;
  const db = { collection() { return { doc(id) { return {
    async get() { return { data: records.get(id) }; },
    async set({ data }) { records.set(id, data); },
    async update({ data }) { records.set(id, { ...records.get(id), ...data }); },
    async remove() { records.delete(id); }
  }; } }; }, async runTransaction(fn) { return fn(db); } };
  const cloud = { getWXContext: () => identity, database: () => db,
    downloadFile: async () => ({ fileContent: Buffer.from([255,216,255,192,0,9,8,0,1,0,1,1,0]) }),
    deleteFile: async ({ fileList }) => deleted.push(...fileList) };
  const handler = createHandler({ cloud, recognize: async () => { runs++; return 'MU5358'; } });
  return { handler, records, deleted, cloud, setIdentity: value => identity = value, runs: () => runs };
}
const fileID = path => 'cloud://cloud1-d5g931htr9ee8f18c.bucket/' + path;
test('OCR jobs use trusted identity, single-use tickets and delete temporary images', async () => {
  const h=harness(), request=await h.handler({action:'prepare'});
  assert(request.ok); const image=fileID(request.path);
  const result=await h.handler({action:'recognize',token:request.token,fileID:image});
  assert.equal(result.text,'MU5358'); assert.deepEqual(h.deleted,[image]);
  assert.equal((await h.handler({action:'recognize',token:request.token,fileID:image})).ok,false);
  assert.equal(h.runs(),1);
});
test('OCR rejects other identities and foreign storage without reading or deleting their images',async()=>{
  const h=harness(), request=await h.handler({action:'prepare'});
  h.setIdentity({ APPID:'wx31f3f3739a7a1743', OPENID:'test-openid-bob' });
  assert.equal((await h.handler({action:'recognize',token:request.token,fileID:fileID(request.path)})).ok,false);
  assert.equal(h.runs(),0); assert.equal(h.deleted.length,0);
  h.setIdentity({APPID:'other',OPENID:'test-openid-alice'});
  assert.equal((await h.handler({action:'prepare'})).code,'UNAUTHORIZED');
});
test('failed recognition releases image and rate limits are bounded',async()=>{
  const h=harness(), request=await h.handler({action:'prepare'});
  h.cloud.downloadFile=async()=>{throw Error('network')};
  assert.equal((await h.handler({action:'recognize',token:request.token,fileID:fileID(request.path)})).ok,false);
  assert.deepEqual(h.deleted,[fileID(request.path)]);
  for(let i=1;i<20;i++) assert.equal((await h.handler({action:'prepare'})).ok,true);
  assert.equal((await h.handler({action:'prepare'})).code,'RATE_LIMIT');
});
test('image review blocks invalid fields, retains ambiguous airports and accepts selected candidates',()=>{
  const previousPage=global.Page; global.Page=()=>{};
  const {validate}=require('../miniprogram/airport-picker/pages/image-import'); global.Page=previousPage;
  const Search=require('../miniprogram/airport-picker/lib/airport-search');
  const index=Search.create({SHA:{name:'Hongqiao',city:'Shanghai'},PVG:{name:'Pudong',city:'Shanghai'}},{SHA:'上海虹桥',PVG:'上海浦东'});
  const row={date:'2026-02-30',airline:'MU',flight:'5358',from:'Shanghai',to:'PVG',departureTime:'25:00'};
  assert.deepEqual(Object.keys(validate(row,index).errors),['date','from','departureTime']);
  row.date='2026-10-25';row.from='SHA';row.departureTime='20:30';
  assert.deepEqual(validate(row,index).errors,{});
  row.to='SHA';assert.match(validate(row,index).errors.to,/相同/);
});

test('cloud OCR rejects over-limit text without returning an incomplete prefix',async()=>{
 const h=harness();const handler=createHandler({cloud:h.cloud,recognize:async()=>'x'.repeat(60001)}),request=await handler({action:'prepare'});
 const result=await handler({action:'recognize',token:request.token,fileID:fileID(request.path)});assert.equal(result.code,'TEXT_TOO_LONG');assert.equal(result.text,undefined);assert.equal(h.deleted.length,1);
});
