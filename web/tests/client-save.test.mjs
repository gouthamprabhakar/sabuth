import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
function setup(){
 const sheets=new Map();
 class Sheet{
  constructor(name,headers){this.name=name;this.cells=[headers]}
  getName(){return this.name} getLastRow(){return this.cells.length} getLastColumn(){return Math.max(...this.cells.map(r=>r.length))}
  appendRow(row){this.cells.push([...row]);return this}
  getRange(row,col,rows=1,cols=1){const cells=this.cells;return {
   getDisplayValues(){return Array.from({length:rows},(_,r)=>Array.from({length:cols},(_,c)=>String(cells[row+r-1]?.[col+c-1]??'')))},
   getDisplayValue(){return this.getDisplayValues()[0][0]},getFormula(){return ''},getRichTextValue(){return null},setNumberFormat(){return this},
   setValue(v){return this.setValues([[v]])},setValues(values){values.forEach((v,r)=>v.forEach((x,c)=>{cells[row+r-1]??=[];cells[row+r-1][col+c-1]=x}));return this}
  }}
 }
 const h={console,Date,Map,SpreadsheetApp:{flush(){}},PropertiesService:{getScriptProperties:()=>({getProperty:()=> 'false'})},Utilities:{DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(_,t)=>[...crypto.createHash('sha256').update(t).digest()],formatDate(d,tz,format){const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:tz,year:'numeric',month:'short',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).formatToParts(d).map(p=>[p.type,p.value]));if(format==='yyyy-MM-dd')return new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).format(d);return `${parts.day}-${parts.month.slice(0,3)}-${parts.year}`+(format.includes('HH')?` ${parts.hour}:${parts.minute}:${parts.second}`:'')}},DocumentApp:{openById(){throw Error('Document unavailable')},create(){throw Error('Document unavailable')}}};
 vm.createContext(h);vm.runInContext(fs.readFileSync('../google-apps-script/Code.gs','utf8'),h);
 for(const [name,variable,extras] of [['Case Register','REGISTER_HEADERS',['Previous Date','Created Date','Source/Confirmation']],['Daily Court List','DAILY_HEADERS',['Last Updated','Created Date']],['Sabuth Activity','JOURNAL_HEADERS',[]],['Sabuth Morning Lists','SNAP_HEADERS',[]],['Sabuth Runs','RUN_HEADERS',[]],['Clients','CLIENT_HEADERS',[]],['Sabuth Documents','DOCUMENT_HEADERS',[]]])sheets.set(name,new Sheet(name,[...vm.runInContext(variable,h),...extras]));
 const book={getSheetByName:n=>sheets.get(n)};return {h,book,sheets};
}
function payload(client){return {client:client.name,clientId:client.id,matter:'O.S. No. 00123/767',court:'',stage:'Orders',date:'2026-09-20',nextDate:'2026-10-05',mode:'adhoc',source:'',requestId:'new-case-12345'}}
test('standalone client is saved immediately in the eight-column table, selected by stable ID, and retries do not duplicate',()=>{const {h,book,sheets}=setup();const p={name:'Example Client',requestId:'client-12345'};const first=h.addClient_(book,p,'Raghu');assert.ok(first.client.id);assert.equal(sheets.get('Case Register').getLastRow(),1);assert.equal(sheets.get('Clients').cells[1].length,8);assert.match(sheets.get('Clients').cells[1][6],/^\d{2}-[A-Z][a-z]{2}-\d{4} \d{2}:\d{2}:\d{2} IST$/);assert.equal(h.addClient_(book,p,'Raghu').client.id,first.client.id);assert.equal(sheets.get('Clients').getLastRow(),2);assert.throws(()=>h.addClient_(book,{...p,name:'Other'},'Raghu'))});
test('case save with optional fields blank succeeds without documents and returns the refreshed correct-date court list',()=>{const {h,book,sheets}=setup();const client=h.addClient_(book,{name:'Example Client',requestId:'client-12345'},'Raghu').client;const p=payload(client),result=h.create_(book,p,'Raghu');assert.equal(result.status,'Complete');assert.equal(result.workspace.listings.length,1);assert.equal(result.workspace.date,p.date);assert.equal(result.workspace.listings[0].previousDate,p.date);assert.equal(result.workspace.listings[0].nextDate,p.nextDate);const row=sheets.get('Case Register').cells[1];assert.equal(row[14],'20-Sep-2026');assert.notEqual(row[11],row[14]);assert.match(row[11],/ IST$/);assert.equal(row[13],'');assert.equal(sheets.get('Sabuth Documents').cells[1][2],'Pending');assert.equal(sheets.get('Clients').cells[1][3],'20-Sep-2026');assert.equal(h.create_(book,p,'Raghu').repeated,true);assert.equal(sheets.get('Case Register').getLastRow(),2);assert.equal(sheets.get('Daily Court List').getLastRow(),2)});
test('missing stage or previous date stops writes',()=>{const {h,book,sheets}=setup();const client=h.addClient_(book,{name:'Example Client',requestId:'client-12345'},'Raghu').client;for(const bad of [{stage:''},{date:''}])assert.throws(()=>h.create_(book,{...payload(client),...bad},'Raghu'));assert.equal(sheets.get('Case Register').getLastRow(),1);assert.equal(sheets.get('Daily Court List').getLastRow(),1)});
test('ad-hoc update preserves creation time while updating previous date, stage, and save time',()=>{const {h,book,sheets}=setup();const client=h.addClient_(book,{name:'Example Client',requestId:'client-12345'},'Raghu').client;h.create_(book,payload(client),'Raghu');const m=h.matters_(book)[0],created=sheets.get('Case Register').cells[1][15];const p={...payload(client),key:m.key,version:m.version,date:'2026-10-05',nextDate:'2026-11-01',stage:'Evidence',requestId:'update-12345'};const result=h.update_(book,p,'Raghu');assert.equal(result.workspace.listings.length,1);assert.equal(result.workspace.listings[0].previousDate,p.date);assert.equal(sheets.get('Case Register').cells[1][15],created);assert.equal(sheets.get('Case Register').cells[1][14],'05-Oct-2026')});
test('three sample clients and matters keep the client table aligned and refresh the daily list immediately',()=>{
 const {h,book,sheets}=setup();
 const samples=[
  {name:'Goutham Rao',matter:'O.S. No. 123/767',stage:'Evidence',court:'CH 1',source:'Confirmed by Raghu',nextDate:'2026-10-05'},
  {name:'Goutam Reddy',matter:'W.P. 456/2026',stage:'Arguments',court:'CH 2',source:'Court slip',nextDate:'2026-10-12'},
  {name:'Goutami Shah',matter:'C.C. 789/2026',stage:'Orders',court:'CH 3',source:'Online cause list',nextDate:'2026-10-19'},
 ];
 samples.forEach((sample,index)=>{
  const client=h.addClient_(book,{name:sample.name,requestId:`sample-client-${index+1}`},'Raghu').client;
  const result=h.create_(book,{client:sample.name,clientId:client.id,matter:sample.matter,court:sample.court,stage:sample.stage,date:'2026-09-26',nextDate:sample.nextDate,mode:'adhoc',source:sample.source,requestId:`sample-matter-${index+1}`},'Raghu');
  assert.equal(result.workspace.listings.length,index+1);
  assert.ok(result.workspace.listings.some(row=>row.client===sample.name&&row.caseNo===sample.matter));
 });
 assert.deepEqual(sheets.get('Clients').cells[0],['Client ID','Client Name','Stage/Purpose','Previous Date','Source/Confirmation','CourtHall','Created Date','Last Updated']);
 assert.equal(sheets.get('Clients').getLastRow(),4);assert.equal(sheets.get('Case Register').getLastRow(),4);assert.equal(sheets.get('Daily Court List').getLastRow(),4);
 for(const row of sheets.get('Clients').cells.slice(1)){assert.equal(row.length,8);assert.equal(row[3],'26-Sep-2026');assert.match(row[6],/^\d{2}-[A-Z][a-z]{2}-\d{4} /);assert.match(row[7],/^\d{2}-[A-Z][a-z]{2}-\d{4} /)}
 for(const row of sheets.get('Daily Court List').cells.slice(1)){assert.equal(row[0],'26-Sep-2026');assert.equal(row[1],'26-Sep-2026');assert.match(row[14],/^\d{2}-[A-Z][a-z]{2}-\d{4} /)}
});
