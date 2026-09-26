import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exported={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/case-types.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:exported});
const bridge={};vm.createContext(bridge);vm.runInContext(fs.readFileSync('google-apps-script/Code.gs','utf8'),bridge);
test('all 25 types build the exact supplied punctuation and preserve numeric segments',()=>{
 assert.equal(exported.CASE_TYPES.length,25);
 for(const [type] of exported.CASE_TYPES)for(const [number,suffix] of [['842','07'],['123','767'],['1','1'],['0001','0007'],['12345678901234567890','87778989']]){
  const value=exported.buildCaseNumber(type,number,suffix);
  assert.equal(value,`${type} ${number}/${suffix}`);assert.ok(exported.validCaseNumber(value));assert.ok(bridge.validCaseNumber_(value));
 }
});
test('missing segments, extra slashes, and manually typed prefixes cannot form a new case',()=>{
 for(const value of ['OS No 123/767','O...S No 123//767','O.S. No. /07','O.S. No. 123/','O.S. No. 12/3/07','O.S. No. 1/x']){assert.equal(exported.validCaseNumber(value),false);assert.equal(bridge.validCaseNumber_(value),false)}
 assert.equal(exported.buildCaseNumber('OS','123','07'),'');assert.equal(exported.digitsOnly('12//x.3'),'123');
});
test('long identifiers never collapse through JavaScript numeric rounding',()=>{
 assert.notEqual(bridge.caseKey_('O.S. No. 12345678901234567890/07'),bridge.caseKey_('O.S. No. 12345678901234567891/07'));
});
