/** Sabuth Google bridge. All case and workflow records remain in the master spreadsheet.
 * Install as the firm's Google account. Run setupSabuth once, then deploy as a web app.
 * Requests require a timestamped HMAC; never put the secret in browser code.
 */
const BOOK_ID='1VgPwvFufx8UBz5JKMpZDWjJ9Z6FVoR9H73R9eDEC1u0';
const ACTIVE_FOLDER='1M-SD8-d1QELDOwtsiv77OfkxV3u0LKQt';
const RECIPIENT='prabhakarlawgroup@gmail.com';
const TZ='Asia/Kolkata';
const REGISTER_HEADERS=['Internal Case ID','Client','Case / Matter','Court','Court Case No.','Case Type','Responsible Advocate','Next Hearing','Purpose','Readiness','Pending Action','Last Updated','Case Folder','Current Status'];
const DAILY_HEADERS=['Date','Previous Date','Court Hall','Court Case No.','Client / Case','Stage / Purpose','Responsible Advocate','Internal Case ID','Morning Status','Hearing Outcome','Next Date','Next Stage / Purpose','Status Updated?','Notes'];
const JOURNAL_HEADERS=['Request ID','Timestamp','Actor','Action','Status','Plan','Error'];
const SNAP_HEADERS=['Date','Position','Matter Key','Morning Row','Next Date'];
const CLIENT_HEADERS=['Client ID','Client Name','Stage/Purpose','Previous Date','Source/Confirmation','CourtHall','Created Date','Last Updated'];
const DOCUMENT_HEADERS=['Request ID','Matter Key','Status','Error','Last Updated'];
const REVIEW_HEADERS=['Matter Key','Issue Fingerprint','Reviewed By','Reviewed At','Status'];
const RUN_HEADERS=['Date','Morning State','Evening State','Morning Fingerprint','Error'];
function setupSabuth(){
 firmAccount_();
 const book=SpreadsheetApp.openById(BOOK_ID);schema_(book);DriveApp.getFolderById(ACTIVE_FOLDER).getName();
 operational_(book,'Sabuth Activity',JOURNAL_HEADERS);operational_(book,'Sabuth Morning Lists',SNAP_HEADERS);operational_(book,'Sabuth Runs',RUN_HEADERS);operational_(book,'Sabuth Reviews',REVIEW_HEADERS);
 const props=PropertiesService.getScriptProperties();if(!props.getProperty('SABUTH_SECRET'))props.setProperty('SABUTH_SECRET',Utilities.getUuid()+Utilities.getUuid());
 if(!props.getProperty('AUTOMATION'))props.setProperty('AUTOMATION','false');
 ensureDocumentSchedule_();
 console.log('Setup complete. Copy SABUTH_SECRET from Project Settings > Script Properties into the private Site secret GOOGLE_SCRIPT_SECRET. Deploy the web app and set GOOGLE_SCRIPT_URL. Status-document work is scheduled for 11 PM IST.');
}
function doGet(){return json_({ok:false,error:'Sabuth requires authenticated POST requests.'})}
function doPost(e){let lock;try{
 firmAccount_();
 const envelope=JSON.parse(e.postData.contents),secret=PropertiesService.getScriptProperties().getProperty('SABUTH_SECRET');
 if(!secret||typeof envelope.text!=='string'||envelope.text.length>40000)throw Error('Invalid request.');
 const sig=Utilities.computeHmacSha256Signature(envelope.text,secret).map(b=>('0'+(b&255).toString(16)).slice(-2)).join('');
 if(!constantEqual_(sig,envelope.signature))throw Error('Request authentication failed.');
 const req=JSON.parse(envelope.text);if(Math.abs(Date.now()-req.timestamp)>120000||!req.nonce)throw Error('Request expired. Retry from the app.');
 const cache=CacheService.getScriptCache();if(cache.get(req.nonce))throw Error('Request already received.');cache.put(req.nonce,'1',240);
 lock=LockService.getScriptLock();if(!lock.tryLock(10000))throw Error('Another update is in progress. Try again.');
 const book=SpreadsheetApp.openById(BOOK_ID);schema_(book);requireOperational_(book);let result;
 switch(req.action){case'addClient':result=addClient_(book,req.payload,req.actor);break;case'read':result=read_(book,req.payload.date);break;case'update':result=update_(book,req.payload,req.actor);break;case'create':result=create_(book,req.payload,req.actor);break;case'markReviewed':result=markReviewed_(book,req.payload,req.actor);break;case'prepareMorning':result=prepare_(book,req.payload.date,req.actor);break;case'sendMorning':result=send_(book,req.payload.date,'morning',req.actor);break;case'sendEvening':result=send_(book,req.payload.date,'evening',req.actor);break;case'configureSchedule':result=schedule_(!!req.payload.enabled);break;default:throw Error('Unknown action.');}
 if(req.action==='create'||req.action==='update')try{ensureDocumentSchedule_()}catch(scheduleError){console.warn('Document schedule needs authorization: '+scheduleError.message)}
 return json_({ok:true,data:result});
 }catch(err){return json_({ok:false,error:String(err.message||err)})}finally{if(lock)lock.releaseLock()}}
function json_(value){return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON)}
function constantEqual_(a,b){if(typeof b!=='string'||a.length!==b.length)return false;let v=0;for(let i=0;i<a.length;i++)v|=a.charCodeAt(i)^b.charCodeAt(i);return v===0}
function normal_(s){return String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'')}
function parseCase_(value){
 const uncertain=/verify|unclear|confirmation|\?/i.test(value);
 const clean=String(value||'').normalize('NFKC').replace(/\[[^\]]*\]/g,'').replace(/\b(?:number|no)\b\.?/gi,'').trim().toUpperCase();
 const at=clean.search(/\d/);if(at<0)return{prefix:clean.replace(/[^A-Z]/g,''),numbers:[],uncertain};
 let prefix=clean.slice(0,at).replace(/[^A-Z]/g,'');const aliases={ORIGINALSUIT:'OS',WRITPETITION:'WP',CRIMINALPETITION:'CRLPET',CRLPETITION:'CRLPET',CRLP:'CRLPET',CRIMINALAPPEAL:'CRLA',CRIMINALMISCELLANEOUS:'CRLMISC',COMMERCIALOS:'COMOS'};
 prefix=aliases[prefix]||prefix;return{prefix,numbers:(clean.slice(at).match(/\d+/g)||[]).map((n,i,a)=>i===a.length-1&&a.length>1&&n.length===2?n:n.replace(/^0+(?=\d)/,'')),uncertain};
}
function caseKey_(value){const p=parseCase_(value);return p.prefix+'|'+p.numbers.join('/')}
function caseMatch_(input,stored){const a=parseCase_(input),b=parseCase_(stored);if(!a.prefix||a.prefix!==b.prefix||!a.numbers.length||!b.numbers.length)return null;const eq=(x,y,last)=>x===y||(last&&((x.length===2&&y.length===4&&y.endsWith(x))||(y.length===2&&x.length===4&&x.endsWith(y))));if(a.numbers.length===b.numbers.length&&a.numbers.every((n,i)=>eq(n,b.numbers[i],i===a.numbers.length-1)))return'exact';if(a.numbers.length<b.numbers.length&&a.numbers.every((n,i)=>n===b.numbers[i]))return'possible';return null}
function key_(id,matter){return String(id).trim()+'|'+caseKey_(matter)}
function caseIndex_(book,ms){return ms.map(m=>({id:m.id,client:m.client,caseNo:m.caseNo,key:m.key,source:'register'})).concat(rows_(book.getSheetByName('Daily Court List'),14).filter(r=>r.v[7]&&r.v[3]).map(r=>{const match=ms.filter(m=>m.id===r.v[7]&&caseMatch_(r.v[3],m.caseNo)==='exact');return{id:r.v[7],client:r.v[4],caseNo:r.v[3],source:'daily',key:match.length===1?match[0].key:key_(r.v[7],r.v[3]),date:iso_(r.v[0])}}))}
function firmAccount_(){if(Session.getEffectiveUser().getEmail().toLowerCase()!==RECIPIENT)throw Error('Install and authorize Sabuth with prabhakarlawgroup@gmail.com. The current Google account is different.')}

function today_(){return Utilities.formatDate(new Date(),TZ,'yyyy-MM-dd')}
function iso_(s){if(s instanceof Date)return Utilities.formatDate(s,TZ,'yyyy-MM-dd');s=String(s||'').trim();if(!s)return'';let y,m,d;if(/^\d{4}-\d{2}-\d{2}$/.test(s)){[y,m,d]=s.split('-').map(Number)}else{const numeric=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);const named=s.match(/^(\d{1,2})[ -]([A-Za-z]{3,9})[ ,\-]+(\d{4})$/);if(numeric){d=+numeric[1];m=+numeric[2];y=+numeric[3]}else if(named){d=+named[1];m=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(named[2].slice(0,3).toLowerCase())+1;y=+named[3]}else return''}const date=new Date(Date.UTC(y,m-1,d));return date.getUTCFullYear()===y&&date.getUTCMonth()===m-1&&date.getUTCDate()===d?`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`:''}
function needDate_(date){if(!date||iso_(date)!==date)throw Error('A full, valid YYYY-MM-DD date is required.');return date}
function dateText_(date,padded){return Utilities.formatDate(new Date(needDate_(date)+'T12:00:00Z'),'UTC','dd-MMM-yyyy')}
function fingerprint_(value){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,JSON.stringify(value)).map(b=>('0'+(b&255).toString(16)).slice(-2)).join('')}
function schema_(book){[['Case Register',REGISTER_HEADERS],['Daily Court List',DAILY_HEADERS]].forEach(([name,headers])=>{const s=book.getSheetByName(name);if(!s)throw Error('Missing sheet: '+name);const current=s.getRange(1,1,1,headers.length).getDisplayValues()[0];if(JSON.stringify(current)!==JSON.stringify(headers))throw Error(name+' headers changed. Review the mapping before making updates.')})}
function operational_(book,name,headers){let s=book.getSheetByName(name);if(!s){s=book.insertSheet(name);s.getRange(1,1,s.getMaxRows(),headers.length).setNumberFormat('@');s.getRange(1,1,1,headers.length).setValues([headers]);s.setFrozenRows(1)}else if(JSON.stringify(s.getRange(1,1,1,headers.length).getDisplayValues()[0])!==JSON.stringify(headers))throw Error(name+' has unexpected columns.');return s}
function requireOperational_(book){['Sabuth Activity','Sabuth Morning Lists','Sabuth Runs'].forEach(n=>{if(!book.getSheetByName(n))throw Error('Run setupSabuth in Google Apps Script first.')})}
function rows_(s,n){return s.getLastRow()<2?[]:s.getRange(2,1,s.getLastRow()-1,n).getDisplayValues().map((r,i)=>({row:i+2,v:r}))}
function richLink_(s,row,col,value){const rich=s.getRange(row,col).getRichTextValue();const formula=s.getRange(row,col).getFormula();const link=rich&&rich.getLinkUrl();if(link)return link;const match=formula.match(/^=HYPERLINK\("([^"]+)"/i);return match?match[1]:value}
function matters_(book){const s=book.getSheetByName('Case Register');const headers=s.getRange(1,1,1,s.getLastColumn()).getDisplayValues()[0];const result=rows_(s,s.getLastColumn()).filter(r=>r.v[0]||r.v[1]).map(r=>{const v=r.v,doc=richLink_(s,r.row,14,v[13]),folder=richLink_(s,r.row,13,v[12]);const issues=[];if(!v[0]||!v[2])issues.push('Matter identity is incomplete');if(/[?]|verify|unclear|confirmation|unconfirmed/i.test(v[1]+' '+v[3]+' '+v[4])||!v[3])issues.push('Details need confirmation');if(v[7]&&!iso_(v[7]))issues.push('Next hearing date is unclear');const previousDate=v[headers.indexOf('Previous Date')],created=v[headers.indexOf('Created Date')];return{previousDate:iso_(previousDate),created:timestampISO_(created)||created,row:r.row,key:key_(v[0],v[4]||v[2]),id:v[0],client:v[1],matter:v[2],court:v[3],caseNo:v[4]||v[2],advocate:v[6],nextDate:iso_(v[7]),stage:v[8],updated:timestampISO_(v[11])||v[11],folder,doc,version:fingerprint_(v),issues,raw:v}});const counts={};result.forEach(m=>counts[m.key]=(counts[m.key]||0)+1);result.forEach(m=>{if(counts[m.key]>1)m.issues.push('Duplicate matter identity — update blocked')});return result}
function daily_(book,date,matters){return rows_(book.getSheetByName('Daily Court List'),14).filter(r=>iso_(r.v[0])===date).map(r=>{const v=r.v,matches=matters.filter(m=>m.id===v[7]&&caseMatch_(v[3],m.caseNo)==='exact'),m=matches.length===1?matches[0]:null,key=m?m.key:key_(v[7],v[3]);return{row:r.row,key,date,previousDate:iso_(v[1])||v[1],court:v[2],caseNo:v[3],client:v[4],stage:v[5],id:v[7],nextDate:iso_(v[10]),notes:v[13],doc:m?m.doc:'',raw:v}})}
function snapshots_(book,date){return rows_(book.getSheetByName('Sabuth Morning Lists'),5).filter(r=>iso_(r.v[0])===date).sort((a,b)=>+a.v[1]- +b.v[1]).map(r=>({...JSON.parse(r.v[3]),nextDate:iso_(r.v[4]),snapshotRow:r.row}))}
function run_(book,date){const s=book.getSheetByName('Sabuth Runs');const r=rows_(s,5).find(r=>iso_(r.v[0])===date);return r||null}
function ensureRun_(book,date){let r=run_(book,date);if(!r){const s=book.getSheetByName('Sabuth Runs');s.appendRow([dateText_(date),'Not prepared','Not sent','','']);r=run_(book,date)}return r}
function publicMatter_(m){const{row,raw,...rest}=m;return rest}
function publicList_(r){const{row,raw,snapshotRow,...rest}=r;return rest}
function reviews_(book){const s=book.getSheetByName('Sabuth Reviews');if(!s)return{};return rows_(s,REVIEW_HEADERS.length).reduce((result,r)=>{result[r.v[0]]={row:r.row,issueFingerprint:r.v[1],reviewedBy:r.v[2],reviewedAt:timestampISO_(r.v[3])||r.v[3],status:r.v[4]};return result},{})}
function reviewedMatter_(m,reviews){const review=reviews[m.key],matches=review&&review.status==='Reviewed'&&review.issueFingerprint===fingerprint_(m.issues);return{...m,reviewStatus:matches?'reviewed':m.issues.length?'needs_review':'clear',reviewedBy:matches?review.reviewedBy:'',reviewedAt:matches?review.reviewedAt:''}}
function read_(book,date){needDate_(date);const ms=matters_(book),reviewMap=reviews_(book),run=run_(book,date);return{connected:true,date,clients:clients_(book),caseIndex:caseIndex_(book,ms),matters:ms.map(m=>publicMatter_(reviewedMatter_(m,reviewMap))),listings:daily_(book,date,ms).map(publicList_),snapshot:run&&['Prepared','Sending','Sent','Send uncertain'].includes(run.v[1])?snapshots_(book,date).map(publicList_):null,activity:rows_(book.getSheetByName('Sabuth Activity'),7).slice(-100).reverse().map(r=>{let p={};try{p=JSON.parse(r.v[5])}catch{}return{id:r.v[0],time:timestampISO_(r.v[1])||r.v[1],actor:r.v[2],client:p.client||'',matter:p.matter||'',description:r.v[6]||p.description||r.v[3],status:r.v[4]}}),morningState:run?run.v[1]:'Not prepared',eveningState:run?run.v[2]:'Not sent',checkedAt:new Date().toISOString(),recipient:RECIPIENT,automation:PropertiesService.getScriptProperties().getProperty('AUTOMATION')==='true'}}
function markReviewed_(book,p,actor){needDate_(p.date);const matter=uniqueMatter_(book,clean_(p.key,500));if(!matter.issues.length)return{workspace:read_(book,p.date),alreadyClear:true};const s=operational_(book,'Sabuth Reviews',REVIEW_HEADERS),stamp=timestampText_(new Date()),fingerprint=fingerprint_(matter.issues),existing=rows_(s,REVIEW_HEADERS.length).find(r=>r.v[0]===matter.key);if(existing)s.getRange(existing.row,1,1,5).setValues([[matter.key,fingerprint,cell_(actor),stamp,'Reviewed']]);else s.appendRow([matter.key,fingerprint,cell_(actor),stamp,'Reviewed']);SpreadsheetApp.flush();return{workspace:read_(book,p.date),reviewedBy:actor,reviewedAt:timestampISO_(stamp)||stamp}}
function docId_(link){const m=String(link).match(/^https:\/\/docs\.google\.com\/document\/d\/([A-Za-z0-9_-]+)/);return m?m[1]:''}
function verifyDoc_(m){const id=docId_(m.doc);if(!id)throw Error(m.client+': Current Status document is missing.');const doc=DocumentApp.openById(id);const text=normal_(doc.getName()+' '+doc.getBody().getText());const number=normal_(m.caseNo||m.matter).replace(/^osno/,'os');if(!number||(!text.includes(number)&&!text.replace(/osno/g,'os').includes(number)))throw Error(m.client+': status document does not identify '+m.matter+'. Confirm the link in the register.');return doc}
function clean_(v,max){const s=String(v||'').trim();if(s.length>max)throw Error('A field exceeds its allowed length.');return s}
function cell_(v){return /^[=+@-]/.test(String(v))?"'"+v:v}
function journal_(book,id){return rows_(book.getSheetByName('Sabuth Activity'),7).find(r=>r.v[0]===id)}
function startJournal_(book,id,actor,action,plan){if(!/^[A-Za-z0-9:_-]{5,150}$/.test(id))throw Error('A valid update ID is required.');book.getSheetByName('Sabuth Activity').appendRow([id,timestampText_(new Date()),cell_(actor),action,'Pending',JSON.stringify(plan),'']);SpreadsheetApp.flush();return journal_(book,id)}
function journalState_(book,j,status,error){book.getSheetByName('Sabuth Activity').getRange(j.row,5).setValue(status);book.getSheetByName('Sabuth Activity').getRange(j.row,7).setValue(cell_(error||''));SpreadsheetApp.flush()}
function uniqueMatter_(book,key){const found=matters_(book).filter(m=>m.key===key);if(found.length!==1)throw Error('Matter is missing or ambiguous. Resolve its identity in the register.');return found[0]}
function checkSource_(p){needDate_(p.date);needDate_(p.nextDate);if(p.nextDate<p.date)throw Error('Reported Hearing Date must be on or after Previous Date.');clean_(p.source,3000);if(p.mode!=='evening'&&!clean_(p.stage,200))throw Error('Please fill in all required fields');if(p.mode==='evening'&&p.date!==p.listingDate)throw Error('Evening updates must use the original listing date.')}
function update_(book,p,actor){
 checkSource_(p);let j=journal_(book,p.requestId),plan;
 if(j){plan=JSON.parse(j.v[5]);if(plan.inputHash!==fingerprint_(p))throw Error('This update ID was already used for different data.');if(j.v[4]==='Complete'){queueDocument_(book,j);return savedResult_(book,plan,true)}}else{
 const m=uniqueMatter_(book,p.key);if(p.clientId!==m.id||p.client!==m.client)throw Error('Client ID and client name do not match the selected case.');if(m.version!==p.version)throw Error('This matter changed since you opened it. Refresh and review the new values.');
 const list=daily_(book,p.date,matters_(book)).filter(r=>r.key===m.key);if(list.length>1)throw Error('Duplicate entries in the daily list. Resolve them first.');
 const run=run_(book,p.date),snapshot=snapshots_(book,p.date),frozen=run&&['Prepared','Sending','Sent','Send uncertain'].includes(run.v[1]);
 if(p.mode==='evening'&&(!frozen||!snapshot.some(r=>r.key===m.key)))throw Error('Evening updates must match the locked morning list.');
 if(p.mode!=='evening'&&frozen)throw Error('The morning list is locked. Use Evening to change only the next date.');
 if(p.mode==='evening'&&run&&run.v[2]!=='Not sent')throw Error('The evening email has already started sending. Review corrections separately.');
 plan={...p,id:m.id,inputHash:fingerprint_(p),client:m.client,matter:m.matter,oldDate:m.nextDate,oldStage:m.stage,doc:m.doc,savedAt:new Date().toISOString(),description:'Reported hearing → '+dateText_(p.nextDate)};
 j=startJournal_(book,p.requestId,actor,'Hearing update',plan);
 }
 try{
 const m=uniqueMatter_(book,plan.key);if(m.nextDate!==plan.oldDate&&m.nextDate!==plan.nextDate)throw Error('A conflicting next date was found. Manual review required.');
 const s=book.getSheetByName('Case Register'),lists=daily_(book,plan.date,matters_(book)).filter(r=>r.key===plan.key);
 if(lists.length>1)throw Error('Duplicate daily listing.');
 if(plan.mode==='evening'&&lists.length!==1)throw Error('The original daily row is missing. Restore it before retrying.');
 const snap=snapshots_(book,plan.date).filter(r=>r.key===plan.key);if(plan.mode==='evening'&&snap.length!==1)throw Error('The morning snapshot is ambiguous.');
 const stamp=timestampText_(plan.savedAt||j.v[1]);
 s.getRange(m.row,8).setNumberFormat('@').setValue(dateText_(plan.nextDate));
 s.getRange(m.row,12).setNumberFormat('@').setValue(stamp);
 if(plan.mode!=='evening'){
  setExtra_(s,m.row,'Previous Date',dateText_(plan.date));setExtra_(s,m.row,'Source/Confirmation',cell_(plan.source||''));
  s.getRange(m.row,9).setValue(cell_(plan.stage));
 }
 const daily=book.getSheetByName('Daily Court List');let dailyRow;
 if(lists.length){dailyRow=lists[0].row;daily.getRange(dailyRow,11).setNumberFormat('@').setValue(dateText_(plan.nextDate));if(plan.mode!=='evening'){daily.getRange(dailyRow,2).setNumberFormat('@').setValue(dateText_(plan.date));daily.getRange(dailyRow,6).setValue(cell_(plan.stage));daily.getRange(dailyRow,14).setValue(cell_(plan.source||''))}}
 else{daily.appendRow([dateText_(plan.date),dateText_(plan.date),m.court,m.caseNo,m.client,plan.stage,m.advocate,m.id,'','',dateText_(plan.nextDate),'','',plan.source||''].map(cell_));dailyRow=daily.getLastRow();setExtra_(daily,dailyRow,'Created Date',stamp)}
 setExtra_(daily,dailyRow,'Last Updated',stamp);
 if(plan.mode==='evening')book.getSheetByName('Sabuth Morning Lists').getRange(snap[0].snapshotRow,5).setNumberFormat('@').setValue(dateText_(plan.nextDate));
 updateClientSummary_(book,plan.id||m.id,m.client,plan,stamp);
 SpreadsheetApp.flush();const checked=uniqueMatter_(book,plan.key),updated=daily_(book,plan.date,matters_(book)).filter(r=>r.key===plan.key);
 if(checked.nextDate!==plan.nextDate||updated.length!==1||updated[0].nextDate!==plan.nextDate)throw Error('Read-back verification failed. Retry this same update.');
 if(plan.mode!=='evening'&&checked.previousDate!==plan.date)throw Error('Previous Date verification failed. Retry this same update.');
 journalState_(book,j,'Complete','');queueDocument_(book,j);return savedResult_(book,plan,false);
 }catch(e){journalState_(book,j,'Needs review',e.message);throw e}
}
function folder_(parent,name){const it=parent.getFoldersByName(name),found=[];while(it.hasNext())found.push(it.next());if(found.length>1)throw Error('Multiple folders match '+name+'. Review before creating records.');return found[0]||parent.createFolder(name)}
function validCaseNumber_(value){const types=['O.S. No.','W.P.','C.C.','Pet.','Ex.','Crl.','Criminal Petition','Criminal Revision','PCR','Misc.','Rev','Com.AA','Com.FDP','Com.AP','Com.O.S.','LCC(G)','RFA','FDP','Crl.A.','Crl.Misc.','CMP','ComPet','MVC','PIM','PE TO'];return types.some(type=>value.startsWith(type+' ')&&/^\d+\/\d+$/.test(value.slice(type.length+1)))}
function create_(book,p,actor){
 checkSource_(p);const client=clean_(p.client,160),matter=clean_(p.matter,160),court=clean_(p.court,100),stage=clean_(p.stage,200);if(!client||!matter)throw Error('Please fill in all required fields');
 if(p.mode==='evening')throw Error('New matters cannot be created in the evening list.');
 if(!validCaseNumber_(matter))throw Error('Choose a case type and fill both number fields.');
 let j=journal_(book,p.requestId),plan;
 if(j){plan=JSON.parse(j.v[5]);if(plan.inputHash!==fingerprint_(p))throw Error('This request ID has different data.');if(j.v[4]==='Complete'){queueDocument_(book,j);return savedResult_(book,plan,true)}}else{
 const run=run_(book,p.date);if(run&&run.v[1]!=='Not prepared')throw Error('This daily list is already locked. Add the matter for another listing date.');
 const ms=matters_(book),all=clients_(book);let id=p.clientId;
 if(id){const match=all.filter(c=>c.id===id);if(match.length!==1||normal_(match[0].name)!==normal_(client))throw Error('Existing client does not match.')}
 else{const existing=all.filter(c=>normal_(c.name)===normal_(client));if(existing.length)throw Error('This client already exists. Choose the existing client.');id=nextClientId_(book)}
 const key=key_(id,matter),duplicates=caseIndex_(book,ms).filter(m=>m.id===id&&(caseMatch_(matter,m.caseNo)||caseMatch_(m.caseNo,matter)));if(duplicates.length)throw Error(duplicates[0].caseNo+' already exists for '+client+'. Update the existing case instead.');
 plan={...p,id,key,client,matter,court,stage,inputHash:fingerprint_(p),savedAt:new Date().toISOString(),description:'Created matter '+matter};j=startJournal_(book,p.requestId,actor,'New matter',plan);
 }
 try{
 const s=book.getSheetByName('Case Register'),stamp=timestampText_(plan.savedAt||j.v[1]);
 if(!matters_(book).some(m=>m.key===plan.key)){
  s.appendRow([plan.id,plan.client,plan.matter,plan.court,plan.matter,plan.matter.slice(0,plan.matter.lastIndexOf(' ')),'',dateText_(plan.nextDate),plan.stage,'','',stamp,'',''].map(cell_));
 }
 const m=uniqueMatter_(book,plan.key);setExtra_(s,m.row,'Previous Date',dateText_(plan.date));setExtra_(s,m.row,'Source/Confirmation',cell_(plan.source||''));if(!extraValue_(s,m.row,'Created Date'))setExtra_(s,m.row,'Created Date',stamp);
 const daily=book.getSheetByName('Daily Court List');if(!daily_(book,plan.date,matters_(book)).some(r=>r.key===plan.key)){
  daily.appendRow([dateText_(plan.date),dateText_(plan.date),plan.court,plan.matter,plan.client,plan.stage,'',plan.id,'','',dateText_(plan.nextDate),'','',plan.source||''].map(cell_));setExtra_(daily,daily.getLastRow(),'Created Date',stamp);setExtra_(daily,daily.getLastRow(),'Last Updated',stamp);
 }
 updateClientSummary_(book,plan.id,plan.client,plan,stamp);
 SpreadsheetApp.flush();const checked=uniqueMatter_(book,plan.key),list=daily_(book,plan.date,matters_(book)).filter(r=>r.key===plan.key);
 if(checked.nextDate!==plan.nextDate||checked.previousDate!==plan.date||list.length!==1||list[0].nextDate!==plan.nextDate)throw Error('New matter verification failed. Retry this same update.');
 journalState_(book,j,'Complete','');queueDocument_(book,j);return savedResult_(book,plan,false);
 }catch(e){journalState_(book,j,'Needs review',e.message);throw e}
}
function prepare_(book,date,actor){
 needDate_(date);let run=ensureRun_(book,date);if(['Prepared','Sending','Sent','Send uncertain'].includes(run.v[1]))return{status:run.v[1],alreadyPrepared:true};
 const pending=rows_(book.getSheetByName('Sabuth Activity'),7).filter(r=>['Hearing update','New matter'].includes(r.v[3])&&r.v[4]!=='Complete');if(pending.length)throw Error('Resolve incomplete operations in Activity before locking a list.');
 const ms=matters_(book);let list=daily_(book,date,ms);const seen={};list.forEach(r=>{if(seen[r.key])throw Error('Duplicate matter in daily list: '+r.client);seen[r.key]=true;const matches=ms.filter(m=>m.key===r.key);if(matches.length!==1)throw Error(r.client+': daily entry needs a unique register match.');});
 const added=ms.filter(m=>m.nextDate===date&&!seen[m.key]);added.forEach(m=>{if(ms.filter(x=>x.key===m.key).length!==1)throw Error('Duplicate register identity: '+m.client);});
 added.forEach(m=>{book.getSheetByName('Daily Court List').appendRow([dateText_(date),m.previousDate?dateText_(m.previousDate):'',m.court,m.caseNo,m.client,m.stage,m.advocate,m.id,'','','','','','Missed from Daily Court List — added from Next Date check.'].map(cell_))});SpreadsheetApp.flush();list=daily_(book,date,matters_(book));
 const snapSheet=book.getSheetByName('Sabuth Morning Lists'),prior=snapshots_(book,date);
 // Partial snapshots are resumed only if their locked contents match the fresh list.
 prior.forEach((r,i)=>{if(!list[i]||r.key!==list[i].key||fingerprint_(publicList_({...r,nextDate:''}))!==fingerprint_(publicList_({...list[i],nextDate:''})))throw Error('Partial snapshot differs from the daily list. Review before retrying.')});
 for(let i=prior.length;i<list.length;i++)snapSheet.appendRow([dateText_(date),i+1,list[i].key,JSON.stringify(publicList_({...list[i],nextDate:''})),list[i].nextDate?dateText_(list[i].nextDate):'']);
 const rows=snapshots_(book,date);if(rows.length!==list.length)throw Error('Morning snapshot is incomplete.');
 const s=book.getSheetByName('Sabuth Runs');s.getRange(run.row,2).setValue('Prepared');s.getRange(run.row,4).setValue(fingerprint_(rows.map(r=>publicList_({...r,nextDate:''}))));s.getRange(run.row,5).clearContent();SpreadsheetApp.flush();return{status:'Prepared',added:added.length};
}
function escape_(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function send_(book,date,period,actor){
 needDate_(date);const run=run_(book,date);if(!run||!['Prepared','Sent'].includes(run.v[1]))throw Error('Prepare the morning list and resolve any uncertain send before emailing.');
 const column=period==='morning'?2:3,state=run.v[column-1];if(state==='Sent')return{status:'Sent',repeated:true};if(state==='Sending'||state==='Send uncertain')throw Error('The previous send has an uncertain result. Check Sent mail before retrying.');
 if(period==='evening'&&run.v[1]!=='Sent')throw Error('The morning email must be sent before the evening email.');
 const pending=rows_(book.getSheetByName('Sabuth Activity'),7).filter(r=>['Hearing update','New matter'].includes(r.v[3])&&r.v[4]!=='Complete');if(pending.length)throw Error('Resolve incomplete operations in Activity before sending.');
 const rows=snapshots_(book,date),ms=matters_(book),daily=daily_(book,date,ms);
 if(fingerprint_(rows.map(r=>publicList_({...r,nextDate:''})))!==run.v[3])throw Error('The locked morning list changed. Sending is blocked.');
 rows.forEach(r=>{const m=ms.filter(m=>m.key===r.key);if(m.length!==1)throw Error('Register match is missing or ambiguous: '+r.client);const d=daily.filter(d=>d.key===r.key);if(d.length!==1)throw Error('Daily row is missing or duplicated: '+r.client);if(period==='evening'&&r.nextDate&&(m[0].nextDate!==r.nextDate||d[0].nextDate!==r.nextDate))throw Error('Next dates disagree for '+r.client);});
 const cols=['Court Hall','Client / Case Details','Stage'].concat(period==='evening'?['Next Date']:[]).concat(['Notes']);
 const table='<table style="border-collapse:collapse;width:100%;font:14px Arial">'+'<tr>'+cols.map(c=>'<th style="text-align:left;padding:12px;border:1px solid #ddd;background:#f5f6f8">'+c+'</th>').join('')+'</tr>'+rows.map(r=>{const values=[r.court||'Unconfirmed',r.client+' — '+r.caseNo+' ('+r.id+')',r.stage];if(period==='evening')values.push(r.nextDate?dateText_(r.nextDate):'Not received — follow-up required');values.push(r.notes||'');return'<tr>'+values.map(v=>'<td style="padding:12px;border:1px solid #ddd">'+escape_(v)+'</td>').join('')+'</tr>'}).join('')+'</table>';
 const subject=period==='morning'?'Court Daily Listing for '+dateText_(date):'Updates for '+dateText_(date,true)+' Court Listing';
 const runSheet=book.getSheetByName('Sabuth Runs');runSheet.getRange(run.row,column).setValue('Sending');SpreadsheetApp.flush();
 try{MailApp.sendEmail({to:RECIPIENT,subject,body:subject+'\n\n'+rows.map(r=>[r.court,r.client,r.caseNo,r.stage,period==='evening'?(r.nextDate?dateText_(r.nextDate):'Not received — follow-up required'):'',r.notes].join(' | ')).join('\n'),htmlBody:'<div style="font:15px Arial;color:#202329"><h2>'+escape_(subject)+'</h2>'+table+'<p style="color:#888">Prabhakar Law Group · Sabuth</p></div>',name:'Prabhakar Law Group'});runSheet.getRange(run.row,column).setValue('Sent');runSheet.getRange(run.row,5).clearContent();SpreadsheetApp.flush();return{status:'Sent'};
 }catch(e){runSheet.getRange(run.row,column).setValue('Send uncertain');runSheet.getRange(run.row,5).setValue('Check Sent mail before any resend: '+e.message);throw Error('Email send could not be confirmed. Check Sent mail before any resend.')}
}
function schedule_(enabled){const props=PropertiesService.getScriptProperties();ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='sabuthTick').forEach(t=>ScriptApp.deleteTrigger(t));if(enabled)ScriptApp.newTrigger('sabuthTick').timeBased().everyMinutes(5).create();props.setProperty('AUTOMATION',String(enabled));return{enabled}}
function sabuthTick(){if(PropertiesService.getScriptProperties().getProperty('AUTOMATION')!=='true')return;const date=today_(),hour=+Utilities.formatDate(new Date(),TZ,'H'),minute=+Utilities.formatDate(new Date(),TZ,'m');if(!((hour===7||hour===19)&&minute<15))return;const lock=LockService.getScriptLock();if(!lock.tryLock(1000))return;let book;try{book=SpreadsheetApp.openById(BOOK_ID);schema_(book);requireOperational_(book);const r=ensureRun_(book,date);if(r.v[4])return;if(hour===7){prepare_(book,date,'Scheduled workflow');send_(book,date,'morning','Scheduled workflow')}else send_(book,date,'evening','Scheduled workflow');}catch(e){if(book){const r=ensureRun_(book,date);book.getSheetByName('Sabuth Runs').getRange(r.row,5).setValue(String(e.message));const id='schedule:'+date+':'+hour;if(!journal_(book,id)){const j=startJournal_(book,id,'Schedule','Email workflow',{description:'Daily email blocked'});journalState_(book,j,'Needs review',String(e.message))}}}finally{lock.releaseLock()}}

// Client records and date columns are independent of case rows and optional documents.
function timestampISO_(value){
 if(value instanceof Date)return value.toISOString();const s=String(value||'').trim();
 if(/^\d{4}-\d{2}-\d{2}T/.test(s)&&!isNaN(new Date(s).valueOf()))return new Date(s).toISOString();
 const m=s.match(/^(\d{2}-[A-Za-z]{3}-\d{4}) (\d{2}:\d{2}:\d{2}) IST$/);return m&&iso_(m[1])?new Date(iso_(m[1])+'T'+m[2]+'+05:30').toISOString():'';
}
function timestampText_(value){const iso=timestampISO_(value);return iso?Utilities.formatDate(new Date(iso),TZ,'dd-MMM-yyyy HH:mm:ss')+' IST':String(value||'')}
function extraColumn_(sheet,name){const headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getDisplayValues()[0];const col=headers.indexOf(name)+1;if(!col)throw Error('Run migrateSabuth to add '+name+' to '+sheet.getName()+'.');return col}
function extraValue_(sheet,row,name){return sheet.getRange(row,extraColumn_(sheet,name)).getDisplayValue()}
function setExtra_(sheet,row,name,value){sheet.getRange(row,extraColumn_(sheet,name)).setNumberFormat('@').setValue(value)}
function ensureColumns_(sheet,names){names.forEach(name=>{const headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getDisplayValues()[0];if(headers.includes(name))return;const col=sheet.getLastColumn()+1;if(col>sheet.getMaxColumns())sheet.insertColumnsAfter(sheet.getMaxColumns(),col-sheet.getMaxColumns());sheet.getRange(1,col).setValue(name);sheet.setColumnWidth(col,180)})}
function clients_(book){
 const result=new Map();const s=book.getSheetByName('Clients');
 if(s)rows_(s,8).filter(r=>r.v[0]&&r.v[1]).forEach(r=>result.set(r.v[0],{id:r.v[0],name:r.v[1],stage:r.v[2],previousDate:iso_(r.v[3]),source:r.v[4],court:r.v[5],created:timestampISO_(r.v[6])||r.v[6],updated:timestampISO_(r.v[7])||r.v[7]}));
 rows_(book.getSheetByName('Case Register'),14).filter(r=>r.v[0]&&r.v[1]).forEach(r=>{if(!result.has(r.v[0]))result.set(r.v[0],{id:r.v[0],name:r.v[1],stage:r.v[8],previousDate:'',source:'',court:r.v[3],created:'',updated:timestampISO_(r.v[11])||r.v[11]})});
 return Array.from(result.values()).sort((a,b)=>a.name.localeCompare(b.name));
}
function nextClientId_(book){const prefix='PL-'+today_().slice(0,4)+'-';return prefix+String(clients_(book).reduce((max,c)=>c.id.startsWith(prefix)?Math.max(max,Number(c.id.slice(prefix.length))||0):max,0)+1).padStart(3,'0')}
function clientSheet_(book){const s=book.getSheetByName('Clients');if(!s)throw Error('Run migrateSabuth once to enable client records.');return s}
function addClient_(book,p,actor){
 const name=clean_(p.name,160);if(!name)throw Error('Please enter the client name.');
 let j=journal_(book,p.requestId),plan;
 if(j){plan=JSON.parse(j.v[5]);if(plan.inputHash!==fingerprint_(p))throw Error('This client request ID was used for different data.');}
 else{const matches=clients_(book).filter(c=>normal_(c.name)===normal_(name));if(matches.length>1)throw Error('More than one existing client has this name. Select their client ID.');if(matches.length===1)return{client:matches[0],existing:true};plan={id:nextClientId_(book),client:name,inputHash:fingerprint_(p),savedAt:new Date().toISOString(),description:'Added client '+name};j=startJournal_(book,p.requestId,actor,'New client',plan)}
 const sheet=clientSheet_(book);if(!rows_(sheet,8).some(r=>r.v[0]===plan.id))sheet.appendRow([plan.id,plan.client,'','','','',timestampText_(plan.savedAt),timestampText_(plan.savedAt)].map(cell_));
 SpreadsheetApp.flush();const client=clients_(book).find(c=>c.id===plan.id);if(!client)throw Error('Client save could not be verified. Retry adding this same client.');journalState_(book,j,'Complete','');return{client};
}
function updateClientSummary_(book,id,name,plan,stamp){
 const s=clientSheet_(book),r=rows_(s,8).find(r=>r.v[0]===id);let row;
 if(r){row=r.row;}else{s.appendRow([id,name,'','','','',stamp,stamp].map(cell_));row=s.getLastRow()}
 // Evening changes do not rewrite the previous hearing details.
 if(plan.mode!=='evening'){s.getRange(row,3,1,4).setNumberFormat('@').setValues([[cell_(plan.stage||''),dateText_(plan.date),cell_(plan.source||''),cell_(plan.court||'')]])}
 s.getRange(row,8).setNumberFormat('@').setValue(stamp);
}
function savedResult_(book,plan,repeated){return{status:'Complete',repeated,documentPending:true,date:plan.date}}
function queueDocument_(book,j){
 try{const plan=JSON.parse(j.v[5]),s=book.getSheetByName('Sabuth Documents');if(!s)return;const prior=rows_(s,5).find(r=>r.v[0]===j.v[0]);if(!prior)s.appendRow([j.v[0],plan.key,'Pending','',timestampText_(new Date())]);}
 catch(e){console.warn('Document work will be recovered from the saved journal.');}
}
function documentForMatter_(book,m){
 if(m.doc){if(!docId_(m.doc))throw Error('The stored document link needs review.');return verifyDoc_(m)}
 let parent;const match=String(m.folder||'').match(/\/folders\/([A-Za-z0-9_-]+)/);
 if(m.folder&&!match)throw Error('The stored client folder link needs review.');
 parent=match?DriveApp.getFolderById(match[1]):folder_(DriveApp.getFolderById(ACTIVE_FOLDER),m.id+' - '+m.client);
 const current=folder_(parent,'Current Status'),name=m.matter.replace(/[\\/]/g,'-')+' - Status History',files=current.getFilesByName(name),found=[];
 while(files.hasNext())found.push(files.next());if(found.length>1)throw Error('More than one status document matches this matter.');
 let doc;
 if(found.length){doc=DocumentApp.openById(found[0].getId());verifyDoc_({...m,doc:doc.getUrl()})}
 else{doc=DocumentApp.create(name);DriveApp.getFileById(doc.getId()).moveTo(current);doc.getBody().appendParagraph(m.client+' — '+m.matter);doc.getBody().appendParagraph('Internal Client ID: '+m.id);doc.saveAndClose();doc=DocumentApp.openById(doc.getId())}
 const sheet=book.getSheetByName('Case Register');sheet.getRange(m.row,13,1,2).setValues([[parent.getUrl(),doc.getUrl()]]);SpreadsheetApp.flush();return doc;
}
function sabuthDocumentTick(){
 const lock=LockService.getScriptLock();if(!lock.tryLock(1000))return;
 try{firmAccount_();const book=SpreadsheetApp.openById(BOOK_ID);schema_(book);const sheet=book.getSheetByName('Sabuth Documents');if(!sheet)return;
 const journals=rows_(book.getSheetByName('Sabuth Activity'),7).filter(j=>['Hearing update','New matter'].includes(j.v[3])&&j.v[4]==='Complete');journals.forEach(j=>queueDocument_(book,j));
 const errors=[];rows_(sheet,5).filter(r=>r.v[2]==='Pending').slice(0,20).forEach(r=>{
  try{const j=journals.find(j=>j.v[0]===r.v[0]);if(!j)throw Error('The saved operation is not available.');const p=JSON.parse(j.v[5]),m=uniqueMatter_(book,p.key),doc=documentForMatter_(book,m),marker='[Sabuth update '+j.v[0]+']';
   if(!doc.getBody().getText().includes(marker)){doc.getBody().appendParagraph('Previous Date: '+dateText_(p.date)+'. Reported Hearing Date: '+dateText_(p.nextDate)+'.');if(p.stage)doc.getBody().appendParagraph('Stage / purpose: '+p.stage);if(p.source)doc.getBody().appendParagraph('Source: '+p.source);doc.getBody().appendParagraph(marker);doc.saveAndClose()}
   sheet.getRange(r.row,3,1,3).setValues([['Complete','',timestampText_(new Date())]]);
  }catch(e){const message=String(e.message||e);errors.push(message);sheet.getRange(r.row,3,1,3).setValues([['Needs review',cell_(message),timestampText_(new Date())]])}
 });
 if(errors.length)try{MailApp.sendEmail({to:RECIPIENT,subject:'Sabuth document processing needs review',body:errors.join('\n')})}catch(mailError){console.warn('Document error email could not be sent: '+mailError.message)}
 }finally{lock.releaseLock()}
}
function ensureDocumentSchedule_(){const props=PropertiesService.getScriptProperties();if(props.getProperty('SABUTH_DOCUMENT_SCHEDULE_VERSION')==='2'&&ScriptApp.getProjectTriggers().some(t=>t.getHandlerFunction()==='sabuthDocumentTick'))return;ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='sabuthDocumentTick').forEach(t=>ScriptApp.deleteTrigger(t));ScriptApp.newTrigger('sabuthDocumentTick').timeBased().atHour(23).everyDays(1).inTimezone(TZ).create();props.setProperty('SABUTH_DOCUMENT_SCHEDULE_VERSION','2')}
function migrateSabuth(){
 firmAccount_();const lock=LockService.getScriptLock();lock.waitLock(20000);
 try{
 const props=PropertiesService.getScriptProperties(),book=SpreadsheetApp.openById(BOOK_ID);schema_(book);
 ensureDocumentSchedule_();if(props.getProperty('SABUTH_DATA_FIX_VERSION')==='1'){console.log('Data fixes already installed.');return}
 if(!props.getProperty('SABUTH_DATA_FIX_BACKUP')){const backup=DriveApp.getFileById(BOOK_ID).makeCopy('Sabuth backup before client/date fixes '+today_());props.setProperty('SABUTH_DATA_FIX_BACKUP',backup.getId())}
 const register=book.getSheetByName('Case Register'),daily=book.getSheetByName('Daily Court List');
 ensureColumns_(register,['Previous Date','Created Date','Source/Confirmation']);ensureColumns_(daily,['Last Updated','Created Date']);
 const clients=operational_(book,'Clients',CLIENT_HEADERS),documents=operational_(book,'Sabuth Documents',DOCUMENT_HEADERS);
 const existing=clients_(book);existing.forEach(c=>{if(!rows_(clients,8).some(r=>r.v[0]===c.id))clients.appendRow([c.id,c.name,c.stage,'','',c.court,'',c.updated?timestampText_(c.updated):''].map(cell_))});
 // Repair only journal-backed dates; do not invent creation/modification times for legacy imports.
 const journals=rows_(book.getSheetByName('Sabuth Activity'),7).filter(j=>['Hearing update','New matter'].includes(j.v[3]));
 journals.forEach(j=>{try{const p=JSON.parse(j.v[5]);if(!p.key||!iso_(p.date)||!iso_(p.nextDate))return;const found=matters_(book).filter(m=>m.key===p.key);if(found.length!==1)return;const m=found[0],list=daily_(book,p.date,[m]).filter(r=>r.key===p.key);if(m.nextDate!==p.nextDate||list.length!==1||list[0].nextDate!==p.nextDate||m.client!==p.client||(p.mode!=='evening'&&m.stage!==p.stage))return;
  if(j.v[4]!=='Complete'&&!/document|status|doc/i.test(j.v[6]))return;
  const stamp=timestampText_(p.savedAt||j.v[1]);setExtra_(register,m.row,'Previous Date',dateText_(p.date));register.getRange(m.row,12).setNumberFormat('@').setValue(stamp);setExtra_(register,m.row,'Source/Confirmation',cell_(p.source||''));
  if(j.v[3]==='New matter'&&!extraValue_(register,m.row,'Created Date'))setExtra_(register,m.row,'Created Date',stamp);
  daily.getRange(list[0].row,2).setNumberFormat('@').setValue(dateText_(p.date));setExtra_(daily,list[0].row,'Last Updated',stamp);if(j.v[3]==='New matter'&&!extraValue_(daily,list[0].row,'Created Date'))setExtra_(daily,list[0].row,'Created Date',stamp);
  updateClientSummary_(book,m.id,m.client,p,stamp);
  if(j.v[4]!=='Complete')journalState_(book,j,'Complete','Core case records verified; document synchronization queued.');queueDocument_(book,j);
 }catch(e){console.warn('A historical entry was left unchanged for manual review.')}});
 [[register,[8,12,extraColumn_(register,'Previous Date'),extraColumn_(register,'Created Date')]],[daily,[1,2,11,extraColumn_(daily,'Last Updated'),extraColumn_(daily,'Created Date')]],[clients,[4,7,8]]].forEach(([sheet,columns])=>{
  columns.forEach(col=>{if(sheet.getLastRow()<2)return;const range=sheet.getRange(2,col,sheet.getLastRow()-1,1),values=range.getValues(),formulas=range.getFormulas();values.forEach((row,i)=>{if(formulas[i][0]||!row[0])return;const header=sheet.getRange(1,col).getDisplayValue(),isTimestamp=['Last Updated','Created Date'].includes(header),timestamp=isTimestamp&&(!(row[0] instanceof Date)||/:/.test(range.getDisplayValues()[i][0]))?timestampISO_(row[0]):'',date=iso_(row[0]);if(timestamp||date)sheet.getRange(i+2,col).setNumberFormat('@').setValue(timestamp?timestampText_(timestamp):dateText_(date))})});
 });
 clients.getRange(1,1,1,8).setFontWeight('bold').setBackground('#233a50').setFontColor('#ffffff');clients.setColumnWidth(1,150);clients.setColumnWidth(2,220);clients.setColumnWidths(3,6,190);clients.setFrozenRows(1);
 if(!clients.getFilter())clients.getRange(1,1,Math.max(2,clients.getLastRow()),8).createFilter();
 documents.setFrozenRows(1);
 SpreadsheetApp.flush();props.setProperty('SABUTH_DATA_FIX_VERSION','1');console.log('Client and date fixes installed. Backup file ID: '+props.getProperty('SABUTH_DATA_FIX_BACKUP'));
 }finally{lock.releaseLock()}
}
