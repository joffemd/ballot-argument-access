// Short display titles summarize the official index; linked PDFs are authoritative.
export const orangeCountySource = 'https://ocvote.gov/elections/assigned-measure-letters-november-3-2026';
export const orangeCountyMeasures = [
  ['A','Laguna Beach Unified School District','School facilities bond','2026-09/A-LBUSD - LAYOUT (1).pdf'],
  ['B','Westminster School District','Classroom repairs and school safety','2026-09/B-Westminster SD - LAYOUT (1).pdf'],
  ['C','City of Costa Mesa','Business license reform','2026-09/C-CMES - LAYOUT (1).pdf'],
  ['D','City of Irvine','Ranked-choice voting','2026-09/D-IRVI - LAYOUT (2).pdf'],
  ['E','City of Laguna Beach','City Council term limits','2026-09/E-LBEA - LAYOUT (1).pdf'],
  ['F','City of Lake Forest','Election reform and voter choice','2026-09/F-LFOR - LAYOUT (1).pdf'],
  ['G','City of Los Alamitos','Hotel tax','2026-09/G-LALA - LAYOUT (2).pdf'],
  ['H','City of Newport Beach','General Plan amendment','2026-09/H-NBEA - LAYOUT (1).pdf'],
  ['I','City of Orange','Public safety and essential services','2026-09/I-ORAN Sales Tax - LAYOUT (1).pdf'],
  ['J','City of Orange','Hotel guest tax modification','2026-09/J-ORAN TOT - LAYOUT (1).pdf'],
  ['K','City of Orange','Proposed city charter','2026-10/Orange Charter - Layout.pdf'],
  ['L','City of Placentia','Hotel tax','2026-09/L-PLAC - LAYOUT (1).pdf'],
  ['M','City of San Clemente','Natural hazards sales tax initiative','2026-09/M-SCLE - LAYOUT (1).pdf'],
  ['N','City of Santa Ana','Streets, public safety and city services','2026-09/N-SANA - LAYOUT (1).pdf'],
  ['O','City of Westminster','City services','2026-09/O-WEST - LAYOUT (1).pdf']
].map(([letter,jurisdiction,summary,pdf])=>({
  id:'oc-2026-'+letter.toLowerCase(),letter,jurisdiction,title:`Measure ${letter} · ${summary}`,
  electionDate:'2026-11-03',county:'Orange County',sourceUrl:orangeCountySource,
  sourcePdf:'https://ocvote.gov/sites/default/files/'+pdf.split('/').map(encodeURIComponent).join('/'),
  sourceChecked:'2026-10-16',example:true
}));
export function practiceMeasures(now=Date.now()) {
  const at=days=>new Date(now+days*86400000).toISOString();
  return orangeCountyMeasures.map(m=>({...m,deadlines:{argument:at(7),rebuttal:at(17),analysis:at(0),tax:at(7)},
    deadlineNote:'Practice deadlines only; these are not Orange County filing deadlines.',
    limits:{argument:300,rebuttal:250},
    declaration:'DEMONSTRATION ONLY. The undersigned author(s) of this practice argument state that such argument is true and correct to the best of their knowledge and belief.'
  }));
}
