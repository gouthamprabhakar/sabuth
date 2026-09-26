import {validCaseNumber} from './case-types';
/** Formatting-only matching. No fuzzy name/number guesses and no generated case IDs. */
export type CaseParts={prefix:string;numbers:string[];uncertain:boolean};
export function parseCase(value:string):CaseParts{
 const uncertain=/verify|unclear|confirmation|\?/i.test(value);
 const clean=value.normalize('NFKC').replace(/\[[^\]]*\]/g,'').replace(/\b(?:number|no)\b\.?/gi,'').trim().toUpperCase();
 const at=clean.search(/\d/);if(at<0)return{prefix:clean.replace(/[^A-Z]/g,''),numbers:[],uncertain};
 let prefix=clean.slice(0,at).replace(/[^A-Z]/g,'');
 const aliases:Record<string,string>={ORIGINALSUIT:'OS',WRITPETITION:'WP',CRIMINALPETITION:'CRLPET',CRLPETITION:'CRLPET',CRLP:'CRLPET',CRIMINALAPPEAL:'CRLA',CRIMINALMISCELLANEOUS:'CRLMISC',COMMERCIALOS:'COMOS'};
 prefix=aliases[prefix]||prefix;
 return{prefix,numbers:(clean.slice(at).match(/\d+/g)||[]).map((n,i,a)=>i===a.length-1&&a.length>1&&n.length===2?n:n.replace(/^0+(?=\d)/,'')),uncertain};
}
export function caseKey(value:string){const p=parseCase(value);return p.prefix+'|'+p.numbers.join('/')}
function numberEqual(a:string,b:string,last:boolean){return a===b||(last&&((a.length===2&&b.length===4&&b.endsWith(a))||(b.length===2&&a.length===4&&a.endsWith(b))))}
export function compareCases(input:string,stored:string):'exact'|'possible'|null{
 const a=parseCase(input),b=parseCase(stored);if(!a.prefix||a.prefix!==b.prefix||!a.numbers.length||!b.numbers.length)return null;
 if(a.numbers.length===b.numbers.length&&a.numbers.every((n,i)=>numberEqual(n,b.numbers[i],i===a.numbers.length-1)))return 'exact';
 if(a.numbers.length<b.numbers.length&&a.numbers.every((n,i)=>n===b.numbers[i]))return 'possible';return null;
}
export const validNewCase=validCaseNumber;
export type CaseIndexEntry={id:string;client:string;caseNo:string;source:'register'|'daily';key:string;date?:string};
export function candidates(input:string,clientId:string,index:CaseIndexEntry[]){
 const map=new Map<string,CaseIndexEntry & {match:'exact'|'possible'}>();
 for(const row of index){if(row.id!==clientId)continue;const match=compareCases(input,row.caseNo);if(!match)continue;const key=caseKey(row.caseNo);const existing=map.get(key);if(!existing||row.source==='register')map.set(key,{...row,match});}
 return [...map.values()];
}
