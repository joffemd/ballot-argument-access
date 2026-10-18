// Section 9: deterministic spans, nonoverlapping adjustments, auditable references.
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const rawCount = s => (s.match(/\S+/gu) || []).length;
const lexicalCount = s => (s.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) || []).length;
export function countWords(text, references = [], claims = [], electionYear = new Date().getUTCFullYear()) {
  const spans = [];
  function add(start, end, count, rule, source = '') {
    if (spans.some(s => start < s.end && end > s.start)) return;
    spans.push({start, end, text: text.slice(start, end), count, rule, source});
  }
  function scan(re, count, rule) { for (const m of text.matchAll(re)) add(m.index, m.index + m[0].length, count, rule); }
  // Specific compound tokens precede general noun matching.
  scan(/\b(?:https?:\/\/|www\.)[^\s<>]+|\b[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*\.[\p{L}]{2,63}\b(?:\/[^\s<>]*)?/giu, 1, '9(a)(9) website');
  scan(/(?<!\d)(?:\+?1[ .-]?)?(?:\(\d{3}\)|\d{3})[ .-]?\d{3}[ .-]\d{4}(?!\d)/gu, 1, '9(a)(8) telephone');
  const month = '(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan\\.?|Feb\\.?|Mar\\.?|Apr\\.?|Jun\\.?|Jul\\.?|Aug\\.?|Sep\\.?|Sept\\.?|Oct\\.?|Nov\\.?|Dec\\.?)';
  scan(new RegExp('\\b' + month + '\\s+\\d{1,2}(?:st|nd|rd|th)?(?:,?\\s+\\d{4})?\\b|\\b\\d{1,2}(?:st|nd|rd|th)?\\s+' + month + '(?:\\s+\\d{4})?\\b|\\b' + month + '\\s+\\d{4}\\b','giu'), 2, '9(a)(6) date with words');
  scan(/\b\d{1,4}[/-]\d{1,2}[/-]\d{1,4}\b/gu, 1, '9(a)(6) numeric date');
  const approved = [...references, ...claims.filter(c => c.status === 'approved').map(c => ({name:c.text, source:'official review', kind:'proper'}))];
  approved.sort((a,b) => b.name.length-a.name.length);
  for (const r of approved) {
    if (r.kind === 'hyphen' && !(r.year >= electionYear - 10 && r.year < electionYear)) continue;
    const re = new RegExp('(?<![\\p{L}\\p{N}])' + esc(r.name).replace(/\s+/g,'\\s+') + '(?![\\p{L}\\p{N}])', 'giu');
    for (const m of text.matchAll(re)) add(m.index,m.index+m[0].length,1,r.kind === 'hyphen' ? '9(a)(5) dictionary hyphenation' : r.kind === 'abbreviation' ? '9(a)(4) abbreviation' : '9(a)(3) proper noun',r.source);
  }
  scan(/\b(?:[\p{L}]\.)+[\p{L}]\.?/gu, 1, '9(a)(4) abbreviation');
  scan(/(?<![\p{L}\p{N}])[$£€]?\d+(?:[,.]\d+)*(?:%|st|nd|rd|th)?(?![\p{L}\p{N}])/gu, 1, '9(a)(7) number');
  for (const m of text.matchAll(/\S+/gu)) {
    let start = m.index;
    const end = start + m[0].length;
    const occupied = spans.filter(s => s.start < end && s.end > start).sort((a,b)=>a.start-b.start);
    for (const s of occupied) { if (s.start > start) add(start,s.start,lexicalCount(text.slice(start,s.start)),'9(a)(1),(2),(5) punctuation / words / unlisted hyphenation'); start = Math.max(start,s.end); }
    if(start < end) add(start,end,lexicalCount(text.slice(start,end)),'9(a)(1),(2),(5) punctuation / words / unlisted hyphenation');
  }
  spans.sort((a,b)=>a.start-b.start);
  // Base counts are allocated by token START so split punctuation still balances exactly.
  const starts = [...text.matchAll(/\S+/gu)].map(m=>m.index);
  const adjustments = spans.map(s => ({...s, unadjusted: starts.filter(i=>i>=s.start && i<s.end).length})).map(s=>({...s,delta:s.count-s.unadjusted}));
  return {unadjusted:rawCount(text),adjusted:spans.reduce((n,s)=>n+s.count,0),adjustments:adjustments.filter(s=>s.delta !== 0 || /proper noun|abbreviation|dictionary|date|telephone|website/.test(s.rule)),pending:claims.filter(c=>!c.status || c.status==='pending'),policy:'Unadjusted = whitespace-separated tokens. Pending noun claims do not reduce the count. Counts are subject to official review.'};
}
