/** Case labels supplied by the firm. Numeric segments are identifiers, not validated calendar years. */
export const CASE_TYPES = [
 ['O.S. No.', 'Original Suit'], ['W.P.', 'Writ Petition'], ['C.C.', 'Commercial Case'],
 ['Pet.', 'Petition'], ['Ex.', 'Execution'], ['Crl.', 'Criminal'],
 ['Criminal Petition', ''], ['Criminal Revision', ''], ['PCR', 'Police Complaint Report'],
 ['Misc.', 'Miscellaneous'], ['Rev', 'Revision'], ['Com.AA', 'Commercial Arbitration Application'],
 ['Com.FDP', 'Commercial Flexible Dispute Protocol'], ['Com.AP', 'Commercial Arbitration Petition'],
 ['Com.O.S.', 'Commercial Original Suit'], ['LCC(G)', 'Large Commercial Court - Group'],
 ['RFA', 'Regular First Appeal'], ['FDP', 'Flexible Dispute Protocol'], ['Crl.A.', 'Criminal Appeal'],
 ['Crl.Misc.', 'Criminal Miscellaneous'], ['CMP', 'Commercial Misc. Petition'],
 ['ComPet', 'Commercial Petition'], ['MVC', 'Motor Vehicle Case'], ['PIM', 'Petition in Matter'],
 ['PE TO', 'Petition'],
] as const;
export function buildCaseNumber(type: string, number: string, suffix: string) {
 return CASE_TYPES.some(([value]) => value === type) && /^\d+$/.test(number) && /^\d+$/.test(suffix)
   ? `${type} ${number}/${suffix}` : '';
}
export function digitsOnly(value: string) { return value.replace(/[^0-9]/g, ''); }
export function validCaseNumber(value: string) {
 return CASE_TYPES.some(([type]) => value.startsWith(type+' ') && /^\d+\/\d+$/.test(value.slice(type.length+1)));
}
