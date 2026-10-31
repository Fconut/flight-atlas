'use strict';
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../dist/app.js'),'utf8');
const context=vm.createContext({normalizeAirlineCode:v=>String(v||'').trim().toUpperCase()});
vm.runInContext(source.slice(source.indexOf('const alias='),source.indexOf('function normalizeFlightStore')),context);
const run=code=>vm.runInContext(code,context);
run(`var sheet=parseSheet([
 ['Date','Airline','Flight','From','To','Gate Departure (Actual)','Gate Departure (Scheduled)','Take off (Scheduled)'],
 ['2026-10-30','MU','1','SHA','PEK','2026-10-30T10:30','2026-10-30T09:00',''],
 ['2026-10-30','MU','2','PEK','SHA','','2026-10-30T18:00',''],
 ['2026-10-30','MU','3','SHA','CAN','2026-10-30T12:30','',''],
 ['2026-10-30','MU','4','CAN','SHA','','','2026-10-30T15:00'],
 ['2026-10-30','MU','5','SHA','SZX','','','']
 ],'Flighty');`);
assert.equal(run('sheet.rows[0].departureTime'),'09:00');
assert.equal(run('sheet.rows[2].departureTime'),'12:30');
assert.equal(run('sheet.rows[3].departureTime'),'15:00');
assert.equal(run("sheet.rows.slice().sort(compareFlightDeparture).map(r=>r.flight).join(',')"),'2,4,3,1,5');
run("var old=sheet.rows.map(r=>({...r,departureTime:''}));var merged=uniqueFlightRows([...old,...sheet.rows],true).rows;");
assert.equal(run('merged.length'),5);
assert.equal(run("merged.sort(compareFlightDeparture).map(r=>r.flight).join(',')"),'2,4,3,1,5');
assert.equal(run("parseSheet([['Date','From','To','Departure Time','Gate Departure (Scheduled)'],['2026-10-30','SHA','PEK','','2026-10-30T08:00']],'fallback').rows[0].departureTime"),'08:00');
assert.equal(run("parseSheet([['Date','From','To','Departure Time'],['2026-10-30','SHA','PEK',0.5]],'Excel').rows[0].departureTime"),'12:00');
assert.equal(run("parseSheet([['Date','From','To'],['2026-10-30T21:20','SHA','PEK']],'embedded').rows[0].departureTime"),'21:20');
console.log('PASS Flighty time columns, blank fallback, scheduled priority, reimport merge, sorting, Excel and embedded timestamps');
