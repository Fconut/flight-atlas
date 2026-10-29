const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
function harness() {
 const persistence = fs.readFileSync(path.join(__dirname, '../dist/persistence.js'), 'utf8');
 const backup = fs.readFileSync(path.join(__dirname, '../dist/backup.js'), 'utf8');
 const writes = [];
 const context = vm.createContext({
  validDate: value => /^\d{4}-\d{2}-\d{2}$/.test(value),
  draftWrites: Promise.resolve(), draftDB: Promise.resolve({}), draftKey: 'user:a', draftEpoch: 0,
  state: {rows: [{flight:'local'}], sheets: []}, localSnapshot: () => ({local: true}),
  draftTransaction: async (db, mode, operation) => operation({put: (value, key) => writes.push({value, key})}),
  restoreLocalDraft: async () => {}, regenerate: async () => {}, $: () => ({value: ''})
 });
 vm.runInContext(persistence.slice(persistence.indexOf('function validSnapshot'), persistence.indexOf('async function restoreLocalDraft')) + backup.slice(backup.indexOf('function snapshotRows'), backup.indexOf('const backupBar')), context);
 return {context, writes};
}
const draft = () => ({version:1,sheets:[{name:'records',rows:[{date:'2026-01-01',from:'SHA',to:'NRT',flight:'123'}]}],activeSheet:0,rows:null,layout:'portrait',cutoff:'2026-10-29',colors:{background:'#122e2b',route:'#e0b778'},labelSelection:['SHA'],includeFuture:true});
test('reject malformed rows, sheet indices, labels and unsupported versions', () => {
 const {context} = harness();assert.ok(context.validBackup(draft()));
 for(const invalid of [null,{...draft(),version:2},{...draft(),activeSheet:3},{...draft(),sheets:[{name:'x',rows:[null]}]},{...draft(),rows:[null]},{...draft(),labelSelection:[{}]}])assert.ok(!context.validBackup(invalid));
});
test('save recovery and complete replacement in one account-scoped transaction', async () => {
 const {context,writes}=harness();const snapshot=draft();await context.applyBackup(snapshot);
 assert.equal(writes[0].key,'user:a:recovery');assert.deepEqual(writes[0].value,{local:true});assert.equal(writes[1].key,'user:a');assert.deepEqual(writes[1].value,snapshot);
});
test('storage failure aborts restore and keeps current memory', async () => {
 const {context}=harness();context.draftTransaction=async()=>{throw Error('quota');};await assert.rejects(context.applyBackup(draft()),/quota/);assert.equal(context.state.rows[0].flight,'local');
});
test('account switch while opening storage prevents writing to another account', async () => {
 const {context,writes}=harness();context.draftDB={then(resolve){context.draftKey='user:b';resolve({});}};await assert.rejects(context.applyBackup(draft()),/账号已切换/);assert.equal(writes.length,0);
});
