'use client';

import {Fragment,useEffect,useState,useRef} from 'react';
import {DateInput} from '@/components/date-input';
import {TeamLogin} from '@/components/team-login';
import {CalendarDays,FolderOpen,History,Settings2,Plus,ArrowUpRight,ShieldCheck,Search,ListChecks,ChevronLeft,ChevronRight,ChevronDown,RefreshCw,Check,AlertCircle,Smartphone,FileText,Link2,Clock,Download,Loader2} from 'lucide-react';
import {SidebarProvider,Sidebar,SidebarHeader,SidebarContent,SidebarFooter,SidebarInset,SidebarTrigger,useSidebar} from '@/components/ui/sidebar';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Sheet,SheetContent,SheetHeader,SheetTitle,SheetDescription} from '@/components/ui/sheet';
import {Table,TableHeader,TableBody,TableHead,TableRow,TableCell} from '@/components/ui/table';
import {Tabs,TabsList,TabsTrigger} from '@/components/ui/tabs';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select';
import {Input} from '@/components/ui/input';
import {Skeleton} from '@/components/ui/skeleton';
import {Empty,EmptyHeader,EmptyTitle,EmptyDescription} from '@/components/ui/empty';
import {Toaster,toast} from 'sonner';
import {type Matter,type Listing,type Workspace,blankWorkspace,istToday,displayDate,displayTimestamp,exportDate,shiftDate,validDate,SHEET_URL} from '@/lib/domain';
import {CaseEntryForm,type EntryPayload} from '@/components/case-entry-form';

type View='diary'|'register'|'review'|'activity'|'settings';

type CnrCandidate={
  cnr:string;
  caseType:string;
  registrationNumber:string;
  courtCode:string;
  courtName:string;
  caseStatus:string;
  nextHearingDate:string|null;
  petitioners:string[];
  respondents:string[];
  petitionerAdvocates:string[];
  respondentAdvocates:string[];
};

const names:Record<View,string>={
  diary:'Court diary',
  register:'Case register',
  review:'Needs review',
  activity:'Activity',
  settings:'Workspace settings'
};

function safeLink(s:string,kind:'doc'|'folder'){
  try{
    const u=new URL(s);
    return u.protocol==='https:'&&(kind==='doc'?u.hostname==='docs.google.com':u.hostname==='drive.google.com')?s:undefined;
  }catch{
    return undefined;
  }
}

function App(){
  const{setOpenMobile}=useSidebar();

  const[view,setView]=useState<View>('diary');
  const[date,setDate]=useState(istToday);
  const[data,setData]=useState<Workspace>(()=>blankWorkspace(istToday()));

  const[busy,setBusy]=useState(false);
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState('');
  const[search,setSearch]=useState('');

  const[edit,setEdit]=useState(false);
  const[newMatter,setNewMatter]=useState(false);
  const[detail,setDetail]=useState<Matter|null>(null);
  const[install,setInstall]=useState(false);

  const[cnrSearching,setCnrSearching]=useState(false);
  const[cnrError,setCnrError]=useState('');
  const[cnrCandidates,setCnrCandidates]=useState<CnrCandidate[]>([]);

  const[selected,setSelected]=useState('');
  const[nextDate,setNextDate]=useState('');
  const[sourceDate,setSourceDate]=useState(istToday);
  const[stage,setStage]=useState('');
  const[client,setClient]=useState('');
  const[matter,setMatter]=useState('');
  const[court,setCourt]=useState('');
  const[clientId,setClientId]=useState('new');
  const[requestId,setRequestId]=useState('');

  const[installPrompt,setInstallPrompt]=useState<any>(null);
  const[expandedClients,setExpandedClients]=useState<Set<string>>(()=>new Set());

  const[inlineEdit,setInlineEdit]=useState<{
    key:string;
    nextDate:string;
    stage:string;
    notes:string;
    court:string;
  }|null>(null);

  const loadSequence=useRef(0);

  async function load(d=date,quiet=false){
    const seq=++loadSequence.current;
    if(!quiet){
      setLoading(true);
      setError('');
    }

    try{
      const r=await fetch('/api/workspace?date='+d,{cache:'no-store'});
      const j=await r.json() as Workspace;

      if(r.status===401){
        window.dispatchEvent(new Event('sabuth-session-expired'));
      }

      if(!r.ok)throw new Error(j.error);

      if(seq===loadSequence.current)setData(j);
    }catch(e){
      if(seq===loadSequence.current&&!quiet)setError((e as Error).message);
    }finally{
      if(seq===loadSequence.current)setLoading(false);
    }
  }

  useEffect(()=>{
    void load(date);
    return()=>{loadSequence.current++};
  },[date]);

  useEffect(()=>{
    const timer=setInterval(()=>{
      if(!document.hidden&&!busy&&!edit)void load(date,true);
    },60000);
    return()=>clearInterval(timer);
  },[date,busy,edit]);

  useEffect(()=>{
    if('serviceWorker'in navigator)void navigator.serviceWorker.register('/sw.js');

    const listener=(e:Event)=>{
      e.preventDefault();
      setInstallPrompt(e);
    };

    window.addEventListener('beforeinstallprompt',listener);
    return()=>window.removeEventListener('beforeinstallprompt',listener);
  },[]);

  function navigate(v:View){
    setView(v);
    setSearch('');
    setOpenMobile(false);
  }

  const listings=data.listings;
  const missingCutoff=shiftDate(istToday(),-2);
  const missing:Listing[]=data.matters
    .filter(m=>validDate(m.nextDate)&&m.nextDate<=missingCutoff)
    .map(m=>({
      key:m.key,
      date:m.nextDate,
      previousDate:m.previousDate||'',
      court:m.court,
      caseNo:m.caseNo,
      client:m.client,
      stage:m.stage,
      id:m.id,
      nextDate:m.nextDate,
      notes:'',
      doc:m.doc,
      missing:true
    }));
  const review=data.matters.filter(m=>m.issues.length&&m.reviewStatus!=='reviewed');
  const courtSync=data.courtSync||[];

  const filteredMatters=data.matters.filter(m=>
    [m.client,m.matter,m.id,m.court]
      .join(' ')
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const filteredListings=listings.filter(m=>
    [m.client,m.caseNo,m.id,m.court]
      .join(' ')
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const uniqueClients=Array.from(
    new Map(data.matters.map(m=>[m.id,{id:m.id,client:m.client}])).values()
  );

  const chosen=data.matters.find(m=>m.key===selected);
  const evening=false;

  async function request(name:string,payload:unknown){
    const r=await fetch('/api/workspace',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({action:name,payload})
    });

    const j=await r.json() as {
      error?:string;
      date?:string;
      workspace?:Workspace;
      refreshWarning?:string;
    };

    if(r.status===401){
      window.dispatchEvent(new Event('sabuth-session-expired'));
    }

    if(!r.ok){
      throw new Error(j.error||'Unable to save. Please try again.');
    }

    return j;
  }

  async function action(name:string,payload:unknown){
    setBusy(true);
    setError('');

    try{
      const j=await request(name,payload);
      await load();
      return j;
    }catch(e){
      const m=(e as Error).message;
      setError(m);
      toast.error(m);
      throw e;
    }finally{
      setBusy(false);
    }
  }

  function startUpdate(m?:Matter){
    if(loading||!data.connected)return;

    setNewMatter(false);
    setSelected(m?.key||'');
    setNextDate('');
    setSourceDate(date);
    setStage(m?.stage||'');
    setRequestId(crypto.randomUUID());
    setEdit(true);
  }

  function startNew(){
    setSelected('');
    setNewMatter(true);
    setClientId('new');
    setClient('');
    setMatter('');
    setCourt('');
    setStage('');
    setSourceDate(date);
    setNextDate('');
    setRequestId(crypto.randomUUID());
    setEdit(true);
  }

  async function saveEntry(kind:'create'|'update',payload:EntryPayload){
    setBusy(true);
    setError('');

    try{
      const result=await request(kind,payload);
      loadSequence.current++;

      const savedDate=result.date||payload.date;
      setDate(savedDate);

      if(result.workspace)setData(result.workspace);
      else void load(savedDate);

      setLoading(false);
      navigate('diary');
      setEdit(false);
      toast.success('Case update saved.');

      if(result.refreshWarning){
        toast.info('Saved. The court list is refreshing.');
      }
    }finally{
      setBusy(false);
    }
  }

  async function markReviewed(m:Matter){
    setBusy(true);
    setError('');

    try{
      const result=await request('markReviewed',{
        key:m.key,
        date,
        requestId:crypto.randomUUID()
      });

      if(result.workspace)setData(result.workspace);
      else await load(date,true);

      toast.success('Reviewed by the signed-in user.');
    }catch(e){
      const message=(e as Error).message;
      setError(message);
      toast.error(message);
    }finally{
      setBusy(false);
    }
  }

  async function reviewCourtSync(id:string,type:'updated'|'unchanged'|'error'){
    setBusy(true);
    setError('');

    try{
      const result=await request('reviewCourtSync',{id,date});
      if(result.workspace)setData(result.workspace);
      else await load(date,true);
      toast.success(type==='error'?'Issue dismissed.':'Court change approved.');
    }catch(e){
      const message=(e as Error).message;
      setError(message);
      toast.error(message);
    }finally{
      setBusy(false);
    }
  }

  async function findCnr(m:Matter){
    setCnrSearching(true);
    setCnrError('');
    setCnrCandidates([]);

    try{
      const r=await fetch('/api/court/find-cnr',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          caseNumber:m.matter,
          court:m.court
        })
      });

      const j=await r.json() as {
        error?:string;
        candidates?:CnrCandidate[];
      };

      if(r.status===401){
        window.dispatchEvent(new Event('sabuth-session-expired'));
      }

      if(!r.ok){
        throw new Error(j.error||'CNR search failed.');
      }

      const candidates=j.candidates||[];
      setCnrCandidates(candidates);

      if(!candidates.length){
        setCnrError('No matching CNR found.');
      }
    }catch(e){
      setCnrError((e as Error).message);
    }finally{
      setCnrSearching(false);
    }
  }

  async function confirmCnr(m:Matter,candidate:CnrCandidate){
    setBusy(true);
    setCnrError('');

    try{
      const result=await request('setCnr',{
        key:m.key,
        version:m.version,
        cnr:candidate.cnr,
        date
      });

      if(result.workspace){
        setData(result.workspace);
        const saved=result.workspace.matters.find(item=>item.key===m.key);
        if(saved)setDetail(saved);
      }else{
        await load(date,true);
        setDetail(null);
      }

      setCnrCandidates([]);
      toast.success('CNR linked to this matter.');
    }catch(e){
      const message=(e as Error).message;
      setCnrError(message);
      toast.error(message);
    }finally{
      setBusy(false);
    }
  }

  async function saveInline(r:Listing){
    const m=data.matters.find(m=>m.key===r.key);
    if(!m||!inlineEdit)return;

    setBusy(true);

    try{
      await request('update',{
        date,
        listingDate:date,
        key:m.key,
        version:m.version,
        nextDate:inlineEdit.nextDate,
        stage:inlineEdit.stage,
        notes:inlineEdit.notes,
        court:inlineEdit.court,
        client:m.client,
        clientId:m.id,
        matter:m.matter,
        mode:'adhoc',
        requestId:crypto.randomUUID()
      });

      setInlineEdit(null);
      await load(date,true);
      toast.success('Case update saved.');
    }catch(e){
      toast.error((e as Error).message);
    }finally{
      setBusy(false);
    }
  }

  useEffect(()=>{
    const context=(document as any).modelContext;
    if(!context?.registerTool)return;

    const lifecycle=new AbortController();

    try{
      Promise.resolve(context.registerTool({
        name:'read_court_list',
        title:'Read court list',
        description:'Read the court list currently visible in LawPal. Does not change records.',
        inputSchema:{
          type:'object',
          properties:{},
          additionalProperties:false
        },
        annotations:{
          readOnlyHint:true,
          untrustedContentHint:true
        },
        execute(input:unknown){
          if(!input||typeof input!=='object'||Object.keys(input).length){
            throw new Error('No input fields are supported.');
          }

          return{
            date,
            mode:'live',
            rows:listings.map(r=>({
              client:r.client,
              matter:r.caseNo,
              court:r.court,
              nextDate:r.nextDate
            }))
          };
        }
      },{signal:lifecycle.signal})).catch(()=>{});
    }catch{}

    return()=>lifecycle.abort();
  },[date,listings]);

  function renderTable(rows:Listing[]){
    const groups=Array.from(
      rows.reduce((map,row)=>{
        const current=map.get(row.id)||[];
        current.push(row);
        map.set(row.id,current);
        return map;
      },new Map<string,Listing[]>()).values()
    );

    return <Table className="case-table">
      <TableHeader>
        <TableRow>
          <TableHead>Court hall</TableHead>
          <TableHead>Client / case details</TableHead>
          <TableHead>Previous date</TableHead>
          <TableHead>Next hearing</TableHead>
          <TableHead>Stage / purpose</TableHead>
          <TableHead>Notes</TableHead>
          <TableHead><span className="sr-only">Actions</span></TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {groups.map(cases=>{
          const first=cases[0];
          const multiple=cases.length>1;
          const expanded=expandedClients.has(first.id);
          const editing=!multiple&&inlineEdit?.key===first.key;

          return <Fragment key={first.id}>
            <TableRow className={editing?'editing-row':''}>
              <TableCell>
                {editing?
                  <Input
                    aria-label="Court hall"
                    value={inlineEdit.court}
                    onChange={e=>setInlineEdit({...inlineEdit,court:e.target.value})}
                  />
                  :
                  <span className="court-badge">
                    {multiple?'Multiple':first.court||'Unconfirmed'}
                  </span>
                }
              </TableCell>

              <TableCell>
                <div className="client-row-title">
                  {multiple&&<button
                    className="expand-row"
                    aria-label={(expanded?'Collapse ':'Expand ')+first.client}
                    onClick={()=>setExpandedClients(old=>{
                      const next=new Set(old);
                      expanded?next.delete(first.id):next.add(first.id);
                      return next;
                    })}
                  >
                    {expanded?<ChevronDown size={16}/>:<ChevronRight size={16}/>}
                  </button>}
                  <strong>{first.client}</strong>
                </div>

                <div className="case-meta">
                  {multiple?
                    `${cases.length} cases on ${displayDate(date)}`
                    :
                    <>
                      {first.caseNo} <span>· {first.id}</span>
                    </>
                  }
                </div>
              </TableCell>

              <TableCell>
                {multiple?'—':first.previousDate?displayDate(first.previousDate):'N/A'}
              </TableCell>

              <TableCell>
                {editing?
                  <DateInput
                    label="Next Hearing Date"
                    value={inlineEdit.nextDate}
                    onChange={nextDate=>setInlineEdit({...inlineEdit,nextDate})}
                  />
                  :
                  displayDate(first.nextDate)
                }
              </TableCell>

              <TableCell>
                {editing?
                  <Input
                    aria-label="Stage or purpose"
                    value={inlineEdit.stage}
                    onChange={e=>setInlineEdit({...inlineEdit,stage:e.target.value})}
                  />
                  :
                  multiple?
                    `${cases.length} matters`
                    :
                    <span className="stage-pill">{first.stage||'Not specified'}</span>
                }
              </TableCell>

              <TableCell className="notes-cell">
                {editing?
                  <textarea
                    aria-label="Notes or updates"
                    value={inlineEdit.notes}
                    onChange={e=>setInlineEdit({...inlineEdit,notes:e.target.value})}
                  />
                  :
                  multiple?'Expand to see each case':first.notes||'—'
                }
              </TableCell>

              <TableCell>
                {editing?
                  <div className="inline-actions">
                    <Button
                      size="sm"
                      disabled={busy||!validDate(inlineEdit.nextDate)||!inlineEdit.stage.trim()}
                      onClick={()=>void saveInline(first)}
                    >
                      {busy?<Loader2 className="spin"/>:<Check/>}
                      Save
                    </Button>
                    <button onClick={()=>setInlineEdit(null)}>Cancel</button>
                  </div>
                  :
                  !multiple&&
                  <Button
                    variant="outline"
                    size="sm"
                    className="row-update"
                    aria-label={'Update '+first.client+' '+first.caseNo}
                    onClick={()=>setInlineEdit({
                      key:first.key,
                      nextDate:first.nextDate,
                      stage:first.stage,
                      notes:first.notes||'',
                      court:first.court||''
                    })}
                  >
                    Update
                  </Button>
                }
              </TableCell>
            </TableRow>

            {expanded&&cases.map(r=>{
              const m=data.matters.find(m=>m.key===r.key);

              return <TableRow className="case-subrow" key={'sub:'+r.key}>
                <TableCell>{r.court||'Unconfirmed'}</TableCell>
                <TableCell><div className="case-meta">{r.caseNo}</div></TableCell>
                <TableCell>{r.previousDate?displayDate(r.previousDate):'N/A'}</TableCell>
                <TableCell>{displayDate(r.nextDate)}</TableCell>
                <TableCell>{r.stage||'—'}</TableCell>
                <TableCell>{r.notes||'—'}</TableCell>
                <TableCell>
                  {m&&
                    <Button variant="outline" size="sm" onClick={()=>startUpdate(m)}>
                      Update
                    </Button>
                  }
                </TableCell>
              </TableRow>;
            })}
          </Fragment>;
        })}
      </TableBody>
    </Table>;
  }

  return <>
    <Sidebar>
      <SidebarHeader>
        <div className="brand">
          <span className="brand-mark">L</span>
          <span>LawPal<span className="brand-period">.</span></span>
        </div>
        <div className="firm">Prabhakar Law Group</div>
      </SidebarHeader>

      <SidebarContent>
        <nav className="nav-list" aria-label="Workspace">
          {([
            ['diary',CalendarDays],
            ['register',FolderOpen],
            ['review',ListChecks],
            ['activity',History]
          ] as const).map(([v,Icon])=>
            <button
              key={v}
              onClick={()=>navigate(v)}
              className={view===v?'active':''}
              aria-current={view===v?'page':undefined}
            >
              <Icon/>
              {names[v]}
              {v==='review'&&(review.length+missing.length+courtSync.length)>0&&
                <span className="nav-count">{review.length+missing.length+courtSync.length}</span>
              }
            </button>
          )}
        </nav>

        <div className="sidebar-note">
          <ShieldCheck size={16}/>
          <span>One matter at a time.<br/>Every change accounted for.</span>
        </div>
      </SidebarContent>

      <SidebarFooter>
        <button className="settings-link" onClick={()=>navigate('settings')}>
          <Settings2/>Workspace settings
        </button>

        <button className="settings-link" onClick={()=>setInstall(true)}>
          <Smartphone/>Use on your phone
        </button>

        <div className="profile">
          <span>PL</span>
          <div>
            Prabhakar Law Group
            <small>Private workspace</small>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>

    <SidebarInset>
      <header className="topbar">
        <div>
          <SidebarTrigger/>
          <span>Workspace / <strong>{names[view]}</strong></span>
        </div>
        <span className="timezone">India Standard Time <Clock size={13}/></span>
      </header>

      <div className="workspace">
        <div className="heading">
          <div>
            <p className="eyebrow">
              {view==='diary'?'YOUR DAILY PRACTICE':'PRABHAKAR LAW GROUP'}
            </p>
            <h1>{names[view]}</h1>
            <p>
              {view==='diary'?'Every matter. Every next date.':
               view==='register'?'A clear view of every matter.':
               view==='review'?'Uncertainty stays visible until it’s resolved.':
               view==='activity'?'A record of what changed, and why.':
               'Your records. Your workspace.'}
            </p>
          </div>

          {view!=='settings'&&
            <Button onClick={()=>startUpdate()} disabled={loading||!data.connected} className="primary-button">
              <Plus/>Add update
            </Button>
          }
        </div>

        {!data.connected&&!loading&&
          <div className="connection-banner">
            <div>
              <ShieldCheck/>
              <span>Connect prabhakarlawgroup@gmail.com to load your real records.</span>
            </div>
            <a
              href="https://script.google.com/u/1/home/projects/12L1GN_WYCZW199e-BATJx2YYriKpJadwcUAgFAgLmPl_mC9qcRhqhrRq/edit"
              target="_blank"
              rel="noreferrer"
            >
              Authorize Google connection <ArrowUpRight size={16}/>
            </a>
          </div>
        }

        {error&&
          <div className="error-banner" role="alert">
            <AlertCircle size={18}/>
            <span>{error}</span>
            <button onClick={()=>load()}>Retry</button>
          </div>
        }

        {view==='diary'&&<>
          <div className="stats">
            <div>
              <span>Listed on this date</span>
              <strong>{data.connected?data.listings.length:'—'}</strong>
              <small>From your daily court list</small>
            </div>
            <div>
              <span>Saved for this date</span>
              <strong>{data.connected?data.listings.length:'—'}</strong>
              <small>Live from Google Sheets</small>
            </div>
            <div>
              <span>Needs review</span>
              <strong className={review.length+missing.length+courtSync.length?'attention':''}>
                {data.connected?review.length+missing.length+courtSync.length:'—'}
              </strong>
              <small>Unconfirmed details stay flagged</small>
            </div>
          </div>

          <div className="diary-toolbar">
            <div className="date-picker">
              <button aria-label="Previous day" onClick={()=>setDate(shiftDate(date,-1))}>
                <ChevronLeft size={16}/>
              </button>

              <DateInput
                label="Court listing date"
                value={date}
                onChange={value=>{
                  if(validDate(value))setDate(value);
                }}
              />

              <button aria-label="Next day" onClick={()=>setDate(shiftDate(date,1))}>
                <ChevronRight size={16}/>
              </button>

              <button className="today-button" onClick={()=>setDate(istToday())}>
                Today
              </button>
            </div>
          </div>

          <div className="diary-panel">
            <div className="panel-title">
              <h2>Daily court list</h2>
              <div className="panel-actions">
                <span>
                  {loading?'Checking…':data.connected?`${listings.length} matters`:'Not connected'}
                </span>
                <button
                  aria-label="Refresh court list"
                  onClick={()=>load()}
                  disabled={loading}
                >
                  <RefreshCw size={15} className={loading?'spin':''}/>
                </button>
              </div>
            </div>

            {loading?
              <div className="skeleton-list">
                {[1,2,3].map(i=><Skeleton key={i} className="h-16 w-full"/>)}
              </div>
              :
              !data.connected?
                <div className="empty-state">
                  <div className="empty-icon"><CalendarDays/></div>
                  <h2>A calmer day in court.</h2>
                  <p>
                    Connect your existing register to see hearings,<br/>
                    record next dates, and keep every matter together.
                  </p>
                  <Button onClick={()=>navigate('settings')}>
                    Connect Google Sheets <ArrowUpRight/>
                  </Button>
                </div>
                :
                listings.length===0?
                  <Empty>
                    <EmptyHeader>
                      <EmptyTitle>No hearings listed</EmptyTitle>
                      <EmptyDescription>
                        {displayDate(date)} has no listed matters.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                  :
                  <>
                    <div className="table-search">
                      <Search size={16}/>
                      <input
                        aria-label="Search court list"
                        placeholder="Find a client, case or court…"
                        value={search}
                        onChange={e=>setSearch(e.target.value)}
                      />
                    </div>

                    {filteredListings.length?
                      renderTable(filteredListings)
                      :
                      <div className="no-results">No matching matters.</div>
                    }
                  </>
            }
          </div>
        </>}

        {view==='register'&&
          <section className="content-panel">
            <div className="panel-title">
              <h2>All matters <span className="count-label">{data.matters.length}</span></h2>
              <Button
                variant="outline"
                size="sm"
                disabled={!data.connected}
                onClick={startNew}
              >
                <Plus/>New matter
              </Button>
            </div>

            <div className="table-search">
              <Search size={16}/>
              <input
                aria-label="Search case register"
                placeholder="Search by client, matter or internal ID…"
                value={search}
                onChange={e=>setSearch(e.target.value)}
              />
            </div>

            {!data.connected?
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>Connect your case register</EmptyTitle>
                  <EmptyDescription>
                    Your existing clients and matters will appear here.
                  </EmptyDescription>
                </EmptyHeader>
                <Button onClick={()=>navigate('settings')}>Open settings</Button>
              </Empty>
              :
              filteredMatters.length?
                <Table className="case-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client / matter</TableHead>
                      <TableHead>CNR</TableHead>
                      <TableHead>Court hall</TableHead>
                      <TableHead>Next hearing</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {filteredMatters.map(m=>
                      <TableRow key={m.key}>
                        <TableCell>
                          <button
                            className="case-name"
                            onClick={()=>{
                              setCnrError('');
                              setCnrCandidates([]);
                              setDetail(m);
                            }}
                          >
                            {m.client}
                          </button>

                          <div className="case-meta">
                            {m.matter}<span> · {m.id}</span>
                          </div>
                        </TableCell>

                        <TableCell>
                          {m.cnr?
                            <span className="case-meta">{m.cnr}</span>
                            :
                            <button
                              className="pending-date"
                              onClick={()=>{
                                setCnrError('');
                                setCnrCandidates([]);
                                setDetail(m);
                              }}
                            >
                              Not linked
                            </button>
                          }
                        </TableCell>

                        <TableCell>{m.court||'Unconfirmed'}</TableCell>
                        <TableCell>{displayDate(m.nextDate)}</TableCell>
                        <TableCell>{m.stage||'—'}</TableCell>

                        <TableCell>
                          {m.reviewStatus==='reviewed'?
                            <span className="subtle-status">
                              <Check size={13}/>Reviewed
                            </span>
                            :
                            m.issues.length?
                              <button
                                className="pending-date"
                                onClick={()=>{
                                  setCnrError('');
                                  setCnrCandidates([]);
                                  setDetail(m);
                                }}
                              >
                                Needs review
                              </button>
                              :
                              <span className="subtle-status">
                                <Check size={13}/>Recorded
                              </span>
                          }
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                :
                <div className="no-results">No matching matters.</div>
            }
          </section>
        }

        {view==='review'&&
          <section className="content-panel">
            <div className="panel-title">
              <h2>Items to resolve</h2>
              <span>{review.length+missing.length} items</span>
            </div>

            {!data.connected?
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>Checks begin after connection</EmptyTitle>
                  <EmptyDescription>
                    LawPal checks matter identity, confirmed details, and missing next dates.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
              :
              review.length+missing.length===0?
                <Empty>
                  <EmptyHeader>
                    <EmptyTitle>Nothing waiting for review</EmptyTitle>
                    <EmptyDescription>All current checks are clear.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
                :
                <div className="review-list">
                  {missing.map(r=>
                    <div key={'missing'+r.key} className="review-row">
                      <div className="review-icon"><CalendarDays size={19}/></div>
                      <div>
                        <h3>{r.client}</h3>
                        <p>{r.caseNo} · Hearing date {displayDate(r.nextDate)} passed at least two days ago and has not been moved.</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={()=>startUpdate(data.matters.find(m=>m.key===r.key))}
                      >
                        Add date
                      </Button>
                    </div>
                  )}

                  {review.map(m=>
                    <div key={m.key} className="review-row">
                      <div className="review-icon"><AlertCircle size={19}/></div>
                      <div>
                        <h3>{m.client}</h3>
                        <p>{m.matter} · {m.issues.join(' · ')}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={()=>void markReviewed(m)}
                      >
                        <Check/>Mark as Reviewed
                      </Button>
                    </div>
                  )}
                </div>
            }
          </section>
        }

        {view==='review'&&data.connected&&
          <section className="content-panel">
            <div className="panel-title">
              <div>
                <h2>AI changes</h2>
                <p className="case-meta">Automatic eCourts checks. This process does not use AI credits.</p>
              </div>
              <span>{courtSync.length} items</span>
            </div>

            {courtSync.length?
              <div className="review-list">
                {courtSync.map(change=>{
                  const linked=data.matters.find(m=>m.key===change.key);
                  return <div className="review-row" key={change.id}>
                    <div className="review-icon">
                      {change.type==='error'?<AlertCircle size={19}/>:<RefreshCw size={19}/>}
                    </div>
                    <div>
                      <h3>{change.client||'eCourts sync issue'}</h3>
                      <p>
                        {change.matter&&`${change.matter} · `}
                        {change.type==='updated'?
                          `Next hearing ${displayDate(change.previousDate)} → ${displayDate(change.nextDate)}`
                          :change.error||change.notes||'No LawPal record was changed.'
                        }
                      </p>
                      {change.cnr&&<small>CNR {change.cnr} · {displayTimestamp(change.time)}</small>}
                    </div>
                    <div className="inline-actions">
                      {linked&&
                        <Button variant="outline" size="sm" onClick={()=>setDetail(linked)}>
                          View case
                        </Button>
                      }
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={()=>void reviewCourtSync(change.id,change.type)}
                      >
                        <Check/>{change.type==='error'?'Dismiss':'Approve change'}
                      </Button>
                    </div>
                  </div>;
                })}
              </div>
              :
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>No automatic court changes yet</EmptyTitle>
                  <EmptyDescription>Changes and eCourts connection problems will appear here after the daily check.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            }
          </section>
        }

        {view==='activity'&&
          <section className="content-panel">
            <div className="panel-title">
              <h2>Update history</h2>
              <span>Latest first</span>
            </div>

            {data.activity.length?
              <div className="review-list">
                {data.activity.map(a=>
                  <div className="review-row" key={a.id}>
                    <div className="activity-icon"><History size={18}/></div>
                    <div>
                      <h3>
                        {a.client||'Workspace'} <span className="case-meta">{a.matter}</span>
                      </h3>
                      <p>{a.description}</p>
                      <small>{displayTimestamp(a.time)}</small>
                    </div>
                    <span className="stage-pill">{a.status}</span>
                  </div>
                )}
              </div>
              :
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>Your history starts here.</EmptyTitle>
                  <EmptyDescription>
                    Verified changes appear with their source, time, and completion status.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            }
          </section>
        }

        {view==='settings'&&
          <div className="settings-grid">
            <section className="settings-card">
              <div className="section-icon"><Link2/></div>
              <h2>Google workspace</h2>
              <p>Use your existing master register and client folders.</p>

              <div className="setting-row">
                <span>Master register</span>
                <a href={SHEET_URL} target="_blank" rel="noreferrer">
                  Open sheet <ArrowUpRight size={14}/>
                </a>
              </div>

              <div className="setting-row">
                <span>Account</span>
                <strong>prabhakarlawgroup@gmail.com</strong>
              </div>

              <div className="setting-row">
                <span>Connection</span>
                <strong>{data.connected?'Connected':'Setup required'}</strong>
              </div>

              {!data.connected?
                <div className="setup-box">
                  <h3>One-time Google authorization</h3>
                  <p>
                    Your LawPal Google project is ready under prabhakarlawgroup@gmail.com.
                    Open it, select setupLawPal, then choose Run → Review permissions.
                    If the consent window does not open here, open the project link in
                    Chrome or Safari and sign in with the firm’s account. Authorization
                    is followed by deployment and a connection check before records can load.
                  </p>

                  <a href="/setup/SETUP.md" download className="setup-download">
                    <Download size={16}/>Connection instructions
                  </a>

                  <a href="/setup/Code.gs" download className="setup-download">
                    <FileText size={16}/>Google connection script
                  </a>

                  <a href="/setup/appsscript.json" download className="setup-download">
                    <FileText size={16}/>Google permission manifest
                  </a>

                  <a
                    href="https://script.google.com/u/1/home/projects/12L1GN_WYCZW199e-BATJx2YYriKpJadwcUAgFAgLmPl_mC9qcRhqhrRq/edit"
                    target="_blank"
                    rel="noreferrer"
                    className="text-link"
                  >
                    Open LawPal Google project ↗
                  </a>
                </div>
                :
                <Button variant="outline" onClick={()=>load()} disabled={loading}>
                  <RefreshCw/>Check connection
                </Button>
              }
            </section>

            <section className="settings-card">
              <div className="section-icon"><Smartphone/></div>
              <h2>At your desk. In court.</h2>
              <p>
                Use the same workspace in your browser or add LawPal to the home
                screen on iPhone and Android.
              </p>
              <Button variant="outline" onClick={()=>setInstall(true)}>
                Install on your phone <ArrowUpRight/>
              </Button>
            </section>

            <section className="settings-card">
              <div className="section-icon"><ShieldCheck/></div>
              <h2>Simple by design</h2>
              <p>
                Structured updates use no AI credits. Dates are entered explicitly,
                uncertain details stay flagged, and the evening list keeps the morning’s order.
              </p>
            </section>
          </div>
        }

        <footer className="page-footer">
          <ShieldCheck size={15}/>
          {data.connected?'Connected to Google Sheets':'Private by design'}
          <span>
            {data.checkedAt?
              'Last checked '+new Date(data.checkedAt).toLocaleTimeString('en-IN',{
                timeZone:'Asia/Kolkata',
                hour:'2-digit',
                minute:'2-digit'
              })+' IST'
              :
              'Ready for updates'
            }
          </span>
        </footer>
      </div>
    </SidebarInset>

    <Dialog
      open={edit}
      onOpenChange={v=>{
        if(!busy)setEdit(v);
      }}
    >
      <DialogContent
        className="update-dialog"
        onOpenAutoFocus={event=>event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>
            {newMatter?'Add a new matter':'Add a hearing update'}
          </DialogTitle>
          <DialogDescription>
            {newMatter?
              'Create a matter under an existing client or add a new client.'
              :
              'Choose the exact matter and confirm its next hearing date.'
            }
          </DialogDescription>
        </DialogHeader>

        <CaseEntryForm
          key={requestId}
          data={data}
          seed={chosen}
          date={date}
          evening={false}
          requestId={requestId}
          onSave={saveEntry}
          busy={busy}
        />
      </DialogContent>
    </Dialog>

    <Sheet
      open={!!detail}
      onOpenChange={v=>{
        if(!v){
          setDetail(null);
          setCnrError('');
          setCnrCandidates([]);
        }
      }}
    >
      <SheetContent className="detail-sheet">
        <SheetHeader>
          <SheetTitle>{detail?.client}</SheetTitle>
          <SheetDescription>{detail?.matter}</SheetDescription>
        </SheetHeader>

        {detail&&
          <div className="detail-body">
            <span className="id-label">{detail.id}</span>

            <div className="hearing-card">
              <span>Next hearing</span>
              <strong>{displayDate(detail.nextDate)}</strong>
              <p>{detail.stage||'Stage not recorded'}</p>
            </div>

            <div className="setting-row">
              <span>Court hall</span>
              <strong>{detail.court||'Unconfirmed'}</strong>
            </div>

            <div className="setting-row">
              <span>Advocate</span>
              <strong>{detail.advocate||'Not assigned'}</strong>
            </div>

            <div className="setting-row">
              <span>Last updated</span>
              <strong>{displayTimestamp(detail.updated)||'Not recorded'}</strong>
            </div>

            <div className="setting-row">
              <span>CNR</span>
              <strong>{detail.cnr||'Not linked'}</strong>
            </div>

            {!detail.cnr&&
              <Button
                variant="outline"
                disabled={cnrSearching}
                onClick={()=>void findCnr(detail)}
              >
                {cnrSearching?
                  <Loader2 className="spin"/>
                  :
                  <Search/>
                }
                {cnrSearching?'Searching court records…':'Find CNR'}
              </Button>
            }

            {cnrError&&
              <div className="detail-warning">
                <AlertCircle size={17}/>
                <span>{cnrError}</span>
              </div>
            }

            {cnrCandidates.map(candidate=>
              <div className="selected-matter" key={candidate.cnr}>
                <span>
                  <strong>CNR MATCH FOUND</strong>
                  <br/>
                  {candidate.caseType} {candidate.registrationNumber}
                  <br/>
                  {candidate.petitioners?.join(', ')||'Petitioner not listed'}
                  <br/>
                  {candidate.courtName||'Court not listed'}
                </span>

                <strong>{candidate.cnr}</strong>

                <div className="inline-actions">
                  <Button
                    variant="outline"
                    onClick={()=>setCnrCandidates([])}
                  >
                    Not this case
                  </Button>

                  <Button
                    disabled={busy}
                    onClick={()=>void confirmCnr(detail,candidate)}
                  >
                    Confirm CNR
                  </Button>
                </div>
              </div>
            )}

            {detail.reviewStatus==='reviewed'?
              <div className="selected-matter">
                <span>Reviewed by {detail.reviewedBy}</span>
                <strong>{displayTimestamp(detail.reviewedAt||'')}</strong>
              </div>
              :
              detail.issues.length>0&&
              <div className="detail-warning">
                <AlertCircle size={17}/>
                <span>{detail.issues.join(' · ')}</span>
              </div>
            }

            <div className="detail-links">
              {safeLink(detail.doc,'doc')&&
                <a href={detail.doc} target="_blank" rel="noreferrer">
                  <FileText/>Current status document <ArrowUpRight/>
                </a>
              }

              {safeLink(detail.folder,'folder')&&
                <a href={detail.folder} target="_blank" rel="noreferrer">
                  <FolderOpen/>Client folder <ArrowUpRight/>
                </a>
              }

              <a href={SHEET_URL} target="_blank" rel="noreferrer">
                <ArrowUpRight/>Open master register
              </a>
            </div>

            {detail.reviewStatus!=='reviewed'&&detail.issues.length>0&&
              <Button
                variant="outline"
                disabled={busy}
                onClick={async()=>{
                  await markReviewed(detail);
                  setDetail(null);
                }}
              >
                <Check/>Mark as Reviewed
              </Button>
            }

            <Button
              onClick={()=>{
                setDetail(null);
                startUpdate(detail);
              }}
            >
              Add hearing update <Plus/>
            </Button>
          </div>
        }
      </SheetContent>
    </Sheet>

    <Dialog open={install} onOpenChange={setInstall}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>LawPal, on your phone.</DialogTitle>
          <DialogDescription>
            The same private workspace, one tap from your home screen.
          </DialogDescription>
        </DialogHeader>

        <div className="install-instructions">
          <h3>iPhone / iPad</h3>
          <p>Open this app in Safari. Tap Share, then Add to Home Screen.</p>

          <h3>Android</h3>
          <p>Open this app in Chrome. Tap the menu, then Install app or Add to Home screen.</p>

          <p className="settings-help">
            An internet connection is required for current case records. This version
            is installed from the browser, rather than the App Store or Play Store.
          </p>

          {installPrompt&&
            <Button
              onClick={async()=>{
                await installPrompt.prompt();
                setInstallPrompt(null);
              }}
            >
              <Download/>Install LawPal
            </Button>
          }
        </div>
      </DialogContent>
    </Dialog>

    <Toaster position="bottom-right" richColors/>
  </>;
}

export default function Home(){
  return <TeamLogin>
    <SidebarProvider>
      <App/>
    </SidebarProvider>
  </TeamLogin>;
}
