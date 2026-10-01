import type {CaseIndexEntry} from './case-matching';
export type Client={id:string;name:string;stage?:string;previousDate?:string;source?:string;court?:string;created?:string;updated?:string};
export type Matter={key:string;id:string;client:string;matter:string;court:string;caseNo:string;nextDate:string;stage:string;updated:string;folder:string;doc:string;advocate:string;version:string;issues:string[];previousDate?:string;created?:string;cnr?:string;reviewStatus?:'clear'|'needs_review'|'reviewed';reviewedBy?:string;reviewedAt?:string};
export type Listing={key:string;date:string;previousDate:string;court:string;caseNo:string;client:string;stage:string;id:string;nextDate:string;notes:string;doc:string;missing?:boolean};
export type Activity={id:string;time:string;client:string;matter:string;description:string;status:string};
export type CourtSyncEvent={id:string;time:string;key:string;client:string;matter:string;cnr:string;type:'updated'|'unchanged'|'error';previousDate:string;nextDate:string;notes:string;error:string};
export type Workspace={connected:boolean;clients?:Client[];caseIndex?:CaseIndexEntry[];date:string;matters:Matter[];listings:Listing[];snapshot:Listing[]|null;activity:Activity[];courtSync:CourtSyncEvent[];morningState:string;eveningState:string;checkedAt:string;recipient:string;automation:boolean;error?:string};
export const SHEET_URL='https://docs.google.com/spreadsheets/d/1VgPwvFufx8UBz5JKMpZDWjJ9Z6FVoR9H73R9eDEC1u0/edit';
export function istToday(now=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(now)}
export function validDate(s:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+'T12:00:00Z');return !isNaN(d.valueOf())&&d.toISOString().slice(0,10)===s}
export function displayDate(s:string){if(!validDate(s))return s||'Not received';return s.slice(8,10)+'/'+s.slice(5,7)+'/'+s.slice(0,4)}
export function parseDisplayDate(value:string){const match=value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);if(!match)return '';const iso=match[3]+'-'+match[2]+'-'+match[1];return validDate(iso)?iso:''}
export function exportDate(value:string){if(!validDate(value))return value;const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];return value.slice(8,10)+'-'+months[Number(value.slice(5,7))-1]+'-'+value.slice(0,4)}
export function displayTimestamp(value:string){if(validDate(value))return displayDate(value);const d=new Date(value);if(!value||isNaN(d.valueOf()))return value||'Not recorded';return new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kolkata',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(d)+' IST'}
export function shiftDate(s:string,days:number){const d=new Date(s+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)}
export function blankWorkspace(date:string):Workspace{return{connected:false,date,matters:[],listings:[],snapshot:null,activity:[],courtSync:[],morningState:'Not prepared',eveningState:'Not sent',checkedAt:'',recipient:'prabhakarlawgroup@gmail.com',automation:false}}
