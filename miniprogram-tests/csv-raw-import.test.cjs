const test=require('node:test'),assert=require('node:assert/strict');
const XLSX=require('../miniprogram/file-tools/xlsx'),{parseSheet,dateValue}=require('../miniprogram/lib/flights');
test('CSV imports preserve model names, leading flight zeros and time without date guessing',()=>{
 const text='Date,Departure Time,From,To,Airline,Flight,Aircraft Type Name\n2025-01-06,11:30,BUD,PVG,FM,0870,Boeing 787-9\n2024-09-10,15:10,FUK,DLC,CA,0954,McDonnell Douglas MD-88';
 const book=XLSX.read(new Uint8Array(Buffer.from(text)),{type:'array',raw:true,cellDates:true,codepage:65001});
 const parsed=parseSheet(XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]],{header:1,defval:'',raw:true}),'Flights');
 assert.equal(parsed.rows.length,2);assert.equal(parsed.rows[0].flight,'0870');assert.equal(parsed.rows[0].aircraft,'Boeing 787-9');assert.equal(parsed.rows[1].aircraft,'McDonnell Douglas MD-88');assert.equal(parsed.rows[0].departureTime,'11:30');assert.equal(dateValue(parsed.rows[0].date),'2025-01-06');
});
test('raw CSV option still preserves real Excel numeric dates and text model cells',()=>{
 const source=XLSX.utils.book_new();XLSX.utils.book_append_sheet(source,XLSX.utils.aoa_to_sheet([['Date','From','To','Aircraft Type Name'],[45663,'BUD','PVG','Boeing 787-8']]),'Flights');
 const book=XLSX.read(XLSX.write(source,{type:'array',bookType:'xlsx'}),{type:'array',raw:true,cellDates:true,codepage:65001});
 const row=parseSheet(XLSX.utils.sheet_to_json(book.Sheets.Flights,{header:1,defval:'',raw:true}),'Flights').rows[0];assert.equal(row.aircraft,'Boeing 787-8');assert.match(dateValue(row.date),/^2025-/);
});
