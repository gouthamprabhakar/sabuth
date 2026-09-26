import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const exported={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/domain.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:exported,Intl,Date});

test('three sample dates use dd/mm/yyyy in the app and DD-Mmm-YYYY for exports',()=>{
 for(const [iso,display,exportedDate] of [['2026-09-26','26/09/2026','26-Sep-2026'],['2026-11-15','15/11/2026','15-Nov-2026'],['2027-01-05','05/01/2027','05-Jan-2027']]){
  assert.equal(exported.displayDate(iso),display);
  assert.equal(exported.parseDisplayDate(display),iso);
  assert.equal(exported.exportDate(iso),exportedDate);
 }
});

test('invalid display dates are rejected',()=>{for(const value of ['09/26/2026','31/02/2026','1/1/2027','2026-09-26'])assert.equal(exported.parseDisplayDate(value),'')});
