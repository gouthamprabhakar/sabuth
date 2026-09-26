import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const exported={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/client-options.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:exported});
const clients=[
 {id:'PL-2026-001',name:'Goutham Rao'},
 {id:'PL-2026-002',name:'Goutam Reddy'},
 {id:'PL-2026-003',name:'Goutami Shah'},
];

test('client search returns all matching sample clients and supports ID lookup',()=>{
 assert.deepEqual(exported.matchingClients(clients,'gout').map(client=>client.id),clients.map(client=>client.id));
 assert.equal(exported.matchingClients(clients,'003')[0].name,'Goutami Shah');
 assert.equal(exported.clientById(clients,'PL-2026-002').name,'Goutam Reddy');
});

test('new-client choice appears only when the typed name is not an existing client',()=>{
 assert.equal(exported.hasExactClientName(clients,' goutham rao '),true);
 assert.equal(exported.hasExactClientName(clients,'Goutham New Client'),false);
});
