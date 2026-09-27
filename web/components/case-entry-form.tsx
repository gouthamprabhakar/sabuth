'use client';
import {useState,useMemo,useRef} from 'react';
import {DateInput} from '@/components/date-input';
import {Check,Loader2,ArrowRight,AlertCircle} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {NativeSelect,NativeSelectOption} from '@/components/ui/native-select';
import {AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel,AlertDialogAction} from '@/components/ui/alert-dialog';
import {type Workspace,type Matter,displayDate,validDate} from '@/lib/domain';
import {candidates,type CaseIndexEntry} from '@/lib/case-matching';
import {CASE_TYPES,buildCaseNumber,digitsOnly} from '@/lib/case-types';
import {clientById,hasExactClientName,matchingClients} from '@/lib/client-options';
export type EntryPayload={date:string;listingDate:string;key:string;version:string;nextDate:string;stage:string;client:string;clientId:string;matter:string;court:string;mode:'evening'|'adhoc';requestId:string};
type Props={data:Workspace;seed?:Matter;date:string;evening:boolean;requestId:string;onSave:(action:'create'|'update',payload:EntryPayload)=>Promise<void>;busy:boolean};
export function CaseEntryForm({data,seed,date,evening,requestId,onSave,busy}:Props){
 const clients=useMemo(()=>Array.from(new Map([...data.matters.map(m=>({id:m.id,name:m.client})),...(data.clients||[])].map(c=>[c.id,{...c,label:c.name+' — '+c.id}])).values()).sort((a,b)=>a.name.localeCompare(b.name)),[data.matters,data.clients]);
 const [clientId,setClientId]=useState(seed?.id||'');
 const [newClient,setNewClient]=useState(false);
 const [clientName,setClientName]=useState('');
 const [clientSearch,setClientSearch]=useState(seed?.client||'');
 const [clientOpen,setClientOpen]=useState(false);
 const clientPicker=useRef<HTMLDivElement>(null);
 const [attempted,setAttempted]=useState(false);
 const [selected,setSelected]=useState(seed);
 const [caseType,setCaseType]=useState('');
 const [number,setNumber]=useState('');
 const [suffix,setSuffix]=useState('');
 const [previousDate,setPreviousDate]=useState(date);
 const [reportedDate,setReportedDate]=useState('');
 const [stage,setStage]=useState(seed?.stage||'');
 const [court,setCourt]=useState(seed?.court||'');
 const [error,setError]=useState('');
 const [popup,setPopup]=useState(false);
 const [review,setReview]=useState(false);
 const currentClient=clients.find(c=>c.id===clientId);
 const caseText=buildCaseNumber(caseType,number,suffix);
 const index:CaseIndexEntry[]=data.caseIndex||data.matters.map(m=>({id:m.id,client:m.client,caseNo:m.caseNo,key:m.key,source:'register'}));
 const matches=clientId&&caseText?candidates(caseText,clientId,index):[];
 const ownCases=data.matters.filter(m=>m.id===clientId&&(!evening||data.snapshot?.some(r=>r.key===m.key)));
 function resetCase(){setSelected(undefined);setCaseType('');setNumber('');setSuffix('');setStage('');setCourt('');setReview(false);setError('')}
 const filteredClients=matchingClients(clients,clientSearch);
 const exactClient=hasExactClientName(clients,clientSearch);
 const invalid={client:!currentClient&&!newClient||newClient&&!clientName.trim(),type:!selected&&!caseType,number:!selected&&!number,suffix:!selected&&!suffix,previous:!!previousDate&&!validDate(previousDate),reported:!validDate(reportedDate),stage:!evening&&!stage.trim()};
 function chooseNewClient(name:string){name=name.trim();if(!name)return;setClientId('');setClientName(name);setClientSearch(name);setNewClient(true);setClientOpen(false);setError('');resetCase()}
 function chooseClient(id:string){const client=clientById(clients,id);if(!client)return;setClientId(id);setClientSearch(client.name);setClientOpen(false);setNewClient(false);resetCase()}
 function selectExistingMatter(key:string){
  const m=data.matters.find(m=>m.key===key);
  if(!m){setError('This case appears in Daily Court List but has no matching Case Register entry. Review both tabs before updating.');setPopup(false);return}
  if(evening&&!data.snapshot?.some(r=>r.key===key)){setError('This case was not on the locked morning list.');setPopup(false);return}
  setSelected(m);setStage(m.stage);setCourt(m.court);setPopup(false);setReview(false);setError('');
 }
 async function submit(e:React.FormEvent){
  e.preventDefault();setError('');setAttempted(true);
  if(Object.values(invalid).some(Boolean)){setReview(false);setError('Please fill in all required fields');return}
  if(!newClient&&!currentClient){setError('Choose a client first.');return}
  if(!selected){
   if(evening){setError('Choose an existing case from the morning list.');return}
   if(!caseText){setError('Choose a case type and fill both number fields.');return}
   // Existing clients are matched automatically; new clients need no separate case-check step.
   if(!newClient&&matches.length){setPopup(true);return}
  }
  if(previousDate&&!validDate(previousDate)){setError('Choose a valid Previous Date or select N/A.');return}
  if(!validDate(reportedDate)){setError('Choose the Next Hearing Date.');return}
  if(previousDate&&reportedDate<previousDate){setError('Next Hearing Date must be on or after Previous Date.');return}
  if(newClient){
   const normalized=clientName.replace(/[^a-z0-9]/gi,'').toLowerCase();
   if(!normalized){setError('Enter the client’s name.');return}
   if(clients.some(c=>c.name.replace(/[^a-z0-9]/gi,'').toLowerCase()===normalized)){setError('This client already exists. Choose their client ID.');return}
  }
  if(!review){setReview(true);return}
  // Keep the existing bridge mapping: date is the prior hearing; nextDate is the newly assigned date.
  try{await onSave(selected?'update':'create',{date:previousDate,listingDate:date,key:selected?.key||'',version:selected?.version||'',nextDate:reportedDate,stage,client:selected?.client||(newClient?clientName:currentClient?.name)||'',clientId:selected?.id||(newClient?'':clientId),matter:selected?.matter||caseText,court,mode:evening?'evening':'adhoc',requestId});}catch(e){setError((e as Error).message)}
 }
 return <><form noValidate onSubmit={submit} className="update-form">
  {error&&<p role="alert" className="inline-error"><AlertCircle size={16}/>{error}</p>}
  <div className="input-step"><span>1</span><strong>Choose the client</strong></div>
  <div className="client-picker" ref={clientPicker} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node|null))setClientOpen(false)}}><label htmlFor="client-search">Client Name *</label>
   <div className={attempted&&invalid.client?'client-combobox invalid':'client-combobox'}>
    <Input id="client-search" role="combobox" aria-autocomplete="list" aria-controls="client-options" aria-label="Client Name" aria-expanded={clientOpen} aria-invalid={attempted&&invalid.client} autoComplete="off" placeholder="Search client name or ID" value={clientSearch} disabled={busy} onFocus={()=>setClientOpen(true)} onChange={event=>{setClientSearch(event.target.value);setClientOpen(true);setClientId('');setClientName('');setNewClient(false);resetCase()}} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setClientOpen(false)}}}/>
    {clientOpen&&<div id="client-options" role="listbox" aria-label="Matching clients" className="client-options">
     {filteredClients.length?filteredClients.map(c=><button type="button" role="option" aria-selected={clientId===c.id} key={c.id} onMouseDown={event=>event.preventDefault()} onClick={()=>chooseClient(c.id)}><span>{c.name}</span><span className="client-option-id">{c.id}</span></button>):<span className="client-empty">No matching client.</span>}
     {clientSearch.trim()&&!exactClient&&<Button type="button" variant="outline" className="add-client-option" onMouseDown={event=>event.preventDefault()} onClick={()=>chooseNewClient(clientSearch)}>{`Use “${clientSearch.trim()}” as a new client`}</Button>}
    </div>}
   </div>
  </div>
  {currentClient&&<div className="selected-matter"><span>Selected client · {currentClient.id}</span><strong>{currentClient.name}</strong></div>}
  {newClient&&<div className="selected-matter"><span>New client</span><strong>{clientName}</strong><span>The client will be added when this case is saved.</span></div>}
  <div className="input-step"><span>2</span><strong>{newClient?'Enter the case details':'Choose or add the case'}</strong></div>
  {ownCases.length>0&&!selected&&<div className="existing-cases"><span>Existing cases for {currentClient?.name}</span>{ownCases.map(m=><button type="button" key={m.key} onClick={()=>selectExistingMatter(m.key)}>{m.caseNo}<ArrowRight size={13}/></button>)}</div>}
  {selected?<div className="selected-matter"><span>Updating an existing case</span><strong>{selected.caseNo} · {selected.client}</strong><span>Current recorded hearing: {displayDate(selected.nextDate)}</span><button type="button" className="text-link" onClick={resetCase}>Choose a different case</button></div>:!evening&&<>
   <div className="structured-case-fields">
    <label>Case type<NativeSelect aria-invalid={attempted&&invalid.type} aria-label="Case type" value={caseType} onChange={e=>{setCaseType(e.target.value);setReview(false)}} required disabled={!newClient&&!currentClient}>
     <NativeSelectOption value="" disabled>Choose case type</NativeSelectOption>
     {CASE_TYPES.map(([value,description])=><NativeSelectOption key={value} value={value}>{value}{description?` (${description})`:''}</NativeSelectOption>)}
    </NativeSelect></label>
    <div><span className="case-number-label">Case number</span><div className="case-number-segments">
     <Input aria-invalid={attempted&&invalid.number} aria-label="Case number before slash" inputMode="numeric" pattern="[0-9]+" placeholder="123" value={number} onChange={e=>{setNumber(digitsOnly(e.target.value));setReview(false)}} required disabled={!newClient&&!currentClient}/>
     <span aria-hidden="true">/</span>
     <Input aria-invalid={attempted&&invalid.suffix} aria-label="Case number after slash" inputMode="numeric" pattern="[0-9]+" placeholder="07" value={suffix} onChange={e=>{setSuffix(digitsOnly(e.target.value));setReview(false)}} required disabled={!newClient&&!currentClient}/>
    </div></div>
   </div>
   {caseText&&<div className="selected-matter" aria-live="polite"><span>Case number</span><strong>{caseText}</strong></div>}
  </>}
  <div className="input-step"><span>3</span><strong>Confirm the hearing details</strong></div>
  <div className="form-grid">
   <div><label>Previous Date (optional)</label><DateInput label="Previous Date" value={previousDate} disabled={evening} invalid={attempted&&invalid.previous} onChange={value=>{setPreviousDate(value);setReview(false)}}/><Button type="button" variant="outline" size="sm" disabled={evening} onClick={()=>{setPreviousDate('');setReview(false)}}>N/A</Button></div>
   <div><label>Next Hearing Date *</label><DateInput label="Next Hearing Date" value={reportedDate} invalid={attempted&&invalid.reported} onChange={value=>{setReportedDate(value);setReview(false)}}/></div>
  </div>
  {!evening&&<>
   <label>Stage / purpose *<Input aria-invalid={attempted&&invalid.stage} value={stage} onChange={e=>{setStage(e.target.value);setReview(false)}} placeholder="Type the stage or purpose" maxLength={200}/></label>
   {!selected&&<label>Court hall (optional)<Input value={court} onChange={e=>{setCourt(e.target.value);setReview(false)}} placeholder="Leave blank if unconfirmed" maxLength={100}/></label>}
  </>}
  {review&&<div className="save-review"><strong>Review before saving</strong><p>{selected?.client||currentClient?.name||clientName} · {selected?.caseNo||caseText}</p><p>Previous Date: {previousDate?displayDate(previousDate):'N/A'}</p><p>Next Hearing Date: {displayDate(reportedDate)}</p>{!evening&&<p>Stage: {stage||'Not specified'}</p>}</div>}
  <Button type="submit" disabled={busy}>{busy?<Loader2 className="spin"/>:<Check/>}{busy?'Saving…':review?'Confirm and save':'Review update'}</Button>
 </form>
 <AlertDialog open={popup} onOpenChange={setPopup}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{matches.length===1?'This case already exists':'Choose the existing case'}</AlertDialogTitle><AlertDialogDescription>{matches.length===1?`${matches[0].caseNo} already exists for ${currentClient?.name}. Do you want to update it?`:`More than one existing record matches ${caseText}. Choose the correct case.`}</AlertDialogDescription></AlertDialogHeader>
  {matches.length>1&&<div className="duplicate-options">{matches.map(m=><Button key={m.key} variant="outline" onClick={()=>selectExistingMatter(m.key)}>{m.caseNo} · {m.source==='register'?'Case Register':'Daily Court List'}</Button>)}</div>}
  <AlertDialogFooter><AlertDialogCancel>Keep editing</AlertDialogCancel>{matches.length===1&&<AlertDialogAction onClick={()=>selectExistingMatter(matches[0].key)}>Update existing case</AlertDialogAction>}</AlertDialogFooter>
 </AlertDialogContent></AlertDialog></>
}
