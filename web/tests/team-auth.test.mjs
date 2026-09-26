import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {webcrypto} from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function harness() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(fs.readFileSync('drizzle/0000_late_the_spike.sql', 'utf8').replaceAll('--> statement-breakpoint', ''));
  const db = {prepare(sql) {return {bind(...args) {return {first: async () => sqlite.prepare(sql).get(...args) || null, run: async () => sqlite.prepare(sql).run(...args)}}}}, async batch(statements) {sqlite.exec('BEGIN');try {const results = [];for (const s of statements) results.push(await s.run());sqlite.exec('COMMIT');return results;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
  const env = {DB: db}; const modules = {}; let bridgeCalls = [];
  function load(path) {
    if(modules[path]) return modules[path];
    const exports = {};
    const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText;
    vm.runInNewContext(code, {exports, crypto:webcrypto, TextEncoder, Request, Response, URL, AbortSignal, console,
      fetch:async (_, options)=>{bridgeCalls.push(JSON.parse(JSON.parse(options.body).text));return Response.json({ok:true,data:{connected:true}})},
      require(name) {if(name==='cloudflare:workers')return {env};if(name==='./team-crypto')return load('lib/team-crypto.ts');if(name.startsWith('@/'))return load(name.slice(2)+'.ts');if(name==='./case-matching')return {};throw Error(name);}
    });
    modules[path] = exports;return exports;
  }
  const crypto = load('lib/team-crypto.ts');
  const session = load('app/api/session/route.ts');
  const workspace = load('app/api/workspace/route.ts');
  const request = (method, body, cookie, origin='https://sabuth.test') => new Request('https://sabuth.test/api/session', {method,headers:{origin,...(cookie?{cookie}:{})}, ...(body ? {body:JSON.stringify(body)} : {})});
  async function configure() {const accounts = {};for(const name of crypto.teamNames)accounts[name] = {salt:'a'.repeat(32),hash:await crypto.passwordHash('test-password', 'a'.repeat(32))};env.SABUTH_TEAM_CREDENTIALS=JSON.stringify(accounts);}
  async function login(username='Prabhakar', password='test-password') {return session.POST(request('POST', {username,password}));}
  return {sqlite,env,crypto,session,workspace,request,configure,login,bridgeCalls};
}

test('all five accounts can sign in, use secure cookies, and sign out with server revocation', async()=>{
  const h=harness();await h.configure();
  for(const username of h.crypto.teamNames){
    const response=await h.login(username);assert.equal(response.status,200);
    const cookie=response.headers.get('set-cookie');assert.match(cookie,/HttpOnly; SameSite=Strict/);assert.match(cookie,/; Secure$/);
    const session=await h.session.GET(h.request('GET',null,cookie));assert.equal((await session.json()).user.username,username);
    assert.equal((await h.session.DELETE(h.request('DELETE',null,cookie))).status,200);
    assert.equal((await (await h.session.GET(h.request('GET',null,cookie))).json()).user,null);
  }
});
test('wrong passwords, unknown users, and cross-origin logins are rejected',async()=>{
  const h=harness();await h.configure();assert.equal((await h.login('Prabhakar','wrong')).status,401);assert.equal((await h.login('Stranger')).status,401);
  assert.equal((await h.session.POST(h.request('POST',{username:'Prabhakar',password:'test-password'},null,'https://other.test'))).status,403);
});
test('five failed attempts block the sixth and the account unlocks after the window',async()=>{
  const h=harness();await h.configure();for(let i=0;i<5;i++)assert.equal((await h.login('Raghu','wrong')).status,401);
  assert.equal((await h.login('Raghu')).status,429);
  h.sqlite.exec("UPDATE team_login_limits SET window_start = 0");assert.equal((await h.login('Raghu')).status,200);
});
test('successful logins do not consume the failed-attempt allowance',async()=>{
  const h=harness();await h.configure();for(let i=0;i<6;i++)assert.equal((await h.login()).status,200);
});
test('expired, forged and revoked credential sessions cannot open case records',async()=>{
  const h=harness();await h.configure();const response=await h.login();const cookie=response.headers.get('set-cookie');
  assert.equal((await h.workspace.GET(h.request('GET',null,'sabuth_session='+'0'.repeat(64)))).status,401);
  h.sqlite.exec('UPDATE team_sessions SET expires_at=0');assert.equal((await h.workspace.GET(h.request('GET',null,cookie))).status,401);
  const second=await h.login();const accounts=JSON.parse(h.env.SABUTH_TEAM_CREDENTIALS);accounts.Prabhakar.hash='b'.repeat(64);h.env.SABUTH_TEAM_CREDENTIALS=JSON.stringify(accounts);
  assert.equal((await h.workspace.GET(h.request('GET',null,second.headers.get('set-cookie')))).status,401);
});
test('all workspace reads and mutations reject anonymous requests, including ChatGPT identity headers',async()=>{
  const h=harness();await h.configure();
  const anonymous = new Request('https://sabuth.test/api/workspace', {headers:{'oai-authenticated-user-id':'spoofed','oai-authenticated-user-email':'someone@example.com'}});
  assert.equal((await h.workspace.GET(anonymous)).status,401);
  for(const action of ['update','create','prepareMorning','sendMorning','sendEvening','configureSchedule'])assert.equal((await h.workspace.POST(h.request('POST',{action,payload:{}}))).status,401);
  assert.equal(h.bridgeCalls.length,0);
});
test('authenticated updates use the session identity and reject cross-origin writes',async()=>{
  const h=harness();await h.configure();const cookie=(await h.login('Preetham')).headers.get('set-cookie');
  h.env.GOOGLE_SCRIPT_URL='https://script.google.com/macros/s/test/exec';h.env.GOOGLE_SCRIPT_SECRET='test-bridge-key';
  assert.equal((await h.workspace.POST(h.request('POST',{action:'update',actor:'Prabhakar',payload:{date:'2026-09-25'}},cookie))).status,200);
  assert.equal(h.bridgeCalls[0].actor,'Preetham');
  assert.equal((await h.workspace.POST(h.request('POST',{action:'update',payload:{}},cookie,'https://other.test'))).status,403);
  assert.equal(h.bridgeCalls.length,1);
});
test('username normalization does not change password case sensitivity',async()=>{
  const h=harness();await h.configure();assert.equal((await h.login(' prabhakar ')).status,200);assert.equal((await h.login('Prabhakar','TEST-PASSWORD')).status,401);
});
