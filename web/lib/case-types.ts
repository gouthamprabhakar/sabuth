/** Case labels supplied by the firm. Numeric segments are identifiers, not validated calendar years. */
export const CASE_TYPES = [
 ['AA', 'Arbitration Application'], ['A.C.', 'Arbitration Cases'],
 ['A.P.', 'Arbitration Petition'], ['A.S.', 'Arbitration Suits'],
 ['C.C.', 'CRIMINAL CASES'], ['Com.A.A.', 'Commercial Dispute Arbitration Application'],
 ['Com.A.P.', 'Commercial Arbitration Petition'], ['Com.A.S.', 'Commercial Arbitration Suits'],
 ['Com.EX.', 'Commercial Dispute Execution Petition Under Order'],
 ['Com.FDP', 'Commercial Final Decree Proceedings'], ['Com.I.C.', 'Commercial Insolvency Cases'],
 ['Com.M.A', 'Commercial Miscellaneous Appeals'], ['Com.Misc.', 'Commercial Dispute Miscellaneous Cases'],
 ['Com.O.S.', 'Commercial Dispute Original Suit'], ['COM.REV', 'Commercial Review Petition'],
 ['Cr', 'Crime Case'], ['CRL.A', 'CRIMINAL APPEAL'], ['Crl.Misc.', 'CRIMINAL MISC.CASES'],
 ['CRL.R.P.', 'CRIMINAL REVISION PETITIONS'], ['ELEC.C', 'ELECTION PETITIONS'],
 ['EX', 'Execution Petition Under Order'], ['FDP', 'Final Decree Proceedings'],
 ['G and WC', 'Appointment Of Guardian, Other'], ['I.C.', 'Insolvency Cases'],
 ['L.A.C.', 'Land Acquisition Cases'], ['LAC - APPL', 'LAND ACQUISITION APPEAL'],
 ['M.A.', 'Miscellaneous, Appeals'], ['MA - EAT', 'Appeal Under Education Act'],
 ['M.C.', 'MATRIMONIAL CASES'], ['Misc', 'Miscellaneous Cases'],
 ['M.V.C.', 'ACCIDENT CLAIM CASES UNDER MOTOR VEHICLES ACT'], ['O.S.', 'Original Suit'],
 ['P and SC', 'Probate and Succession Cases'], ['P.C.R.', 'PRIVATE COMPLAINTS'],
 ['P.MIS.', 'Petition Filed Indigent Person'], ['R.A.', 'Regular Appeals'],
 ['R.C. -E', 'cbi'], ['REV', 'Revision Petitions'], ['Review Petition', ''],
 ['SC', 'SESSION CASES'], ['SPL.C', 'SPECIAL CASES'],
] as const;
export function buildCaseNumber(type: string, number: string, suffix: string) {
 return CASE_TYPES.some(([value]) => value === type) && /^\d+$/.test(number) && /^\d+$/.test(suffix)
   ? `${type} ${number}/${suffix}` : '';
}
export function digitsOnly(value: string) { return value.replace(/[^0-9]/g, ''); }
export function validCaseNumber(value: string) {
 return CASE_TYPES.some(([type]) => value.startsWith(type+' ') && /^\d+\/\d+$/.test(value.slice(type.length+1)));
}
