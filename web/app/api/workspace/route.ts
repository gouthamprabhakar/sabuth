import {getTeamUser} from '@/lib/team-auth';
import {blankWorkspace,istToday,validDate} from '@/lib/domain';
import {env} from 'cloudflare:workers';
export const dynamic='force-dynamic';
function config(){const e=env as unknown as Record<string,string>;return{endpoint:e.GOOGLE_SCRIPT_URL,secret:e.GOOGLE_SCRIPT_SECRET}}
function reply(value:unknown,status=200){return Response.json(value,{status,headers:{'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff'}})}
async function callBridge(action:string,payload:unknown,actor:string){
 const{endpoint,secret}=config();if(!endpoint||!secret)throw new Error('Google connection is not configured. Open Workspace settings.');
 const u=new URL(endpoint);if(u.origin!=='https://script.google.com'||!/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(u.pathname))throw new Error('Google connection URL is invalid.');
 const text=JSON.stringify({action,payload,actor,timestamp:Date.now(),nonce:crypto.randomUUID()});
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const sig=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(text));
 const signature=Array.from(new Uint8Array(sig),b=>b.toString(16).padStart(2,'0')).join('');
 const r=await fetch(endpoint,{method:'POST',body:JSON.stringify({text,signature}),headers:{'Content-Type':'application/json'},redirect:'follow',signal:AbortSignal.timeout(55000)});
 if(!r.ok)throw new Error('Google is unavailable. Your update has not been confirmed.');
 let data;try{data=await r.json() as {ok:boolean;data?:unknown;error?:string}}catch{throw new Error('Google connection needs authorization or redeployment.')}
 if(!data.ok)throw new Error(data.error||'Google could not complete the request.');return data.data;
}
export async function GET(req:Request){
 try{
 const date=new URL(req.url).searchParams.get('date')||istToday();if(!validDate(date))return reply({error:'Choose a valid date.'},400);
 const user=await getTeamUser(req);if(!user)return reply({error:'Sign in to open this workspace.'},401);
 if(!config().endpoint||!config().secret)return reply(blankWorkspace(date));
 try{return reply(await callBridge('read',{date},user.username))}catch(e){return reply({error:(e as Error).message},502)}
 }catch{return reply({error:'Team sign-in is temporarily unavailable.'},503)}
}
export async function POST(req:Request){
 try{
 const user=await getTeamUser(req);if(!user)return reply({error:'Sign in to update this workspace.'},401);
 const origin=req.headers.get('origin');if(!origin||origin!==new URL(req.url).origin)return reply({error:'Request origin is not allowed.'},403);
 try{
  const body=await req.text();if(body.length>30000)return reply({error:'Update is too large.'},413);
  const {action,payload}=JSON.parse(body);if(!['addClient','update','create','markReviewed','prepareMorning','sendMorning','sendEvening','configureSchedule'].includes(action))return reply({error:'Unknown action.'},400);
  const savedPayload=(action==='create'||action==='update')&&payload&&typeof payload==='object'&&!Array.isArray(payload)?{...payload,source:user.username}:payload;
  return reply(await callBridge(action,savedPayload,user.username));
 }catch(e){return reply({error:(e as Error).message||'The update could not be confirmed.'},400)}
 }catch{return reply({error:'Team sign-in is temporarily unavailable.'},503)}
}
