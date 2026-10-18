import { countWords } from '../src/count.js';
import { practiceMeasures, orangeCountyMeasures, orangeCountySource } from './orange-county.js';
export const storageKey='ballot-access:oc-2026:v1';
const id=()=>crypto.randomUUID();
const secret=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
const digest=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),b=>b.toString(16).padStart(2,'0')).join('');
const check=(ok,msg)=>{if(!ok)throw Error(msg);};
const text=(v,label,max=20000)=>{check(typeof v==='string'&&v.trim()&&v.length<=max,'Invalid '+label);return v.trim();};
export function createDemoApi(storage=localStorage,clock=()=>new Date()) {
 const now=()=>clock().toISOString();
 function initial(){return {measures:practiceMeasures(clock().getTime()),filings:[],documents:[],selections:[],outbox:[],imports:[],references:[],audit:[]};}
 function load(){const raw=storage.getItem(storageKey);if(!raw)return initial();try{return JSON.parse(raw);}catch{throw Error('Practice data could not be read. Use Reset practice data in the demo toolbar.');}}
 const save=s=>storage.setItem(storageKey,JSON.stringify(s));
 const count=(s,f)=>countWords(f.payload.text,s.references,f.claims,2026);
 function notice(s,key,to,subject,body){if(!s.outbox.some(o=>o.id===key))s.outbox.push({id:key,to,subject,body,status:'demo only — not sent',attempts:0,createdAt:now()});}
 function publicFiling(s,f){return {id:f.id,...f.payload,authors:f.payload.authors.map(a=>({name:a.name,title:a.title})),filedAt:f.receipt.filedAt,wordCount:count(s,f),practice:true};}
 function tick(s){for(const m of s.measures){if(now()<m.deadlines.argument)continue;const fs=s.filings.filter(f=>f.receipt&&f.payload.measureId===m.id&&f.payload.kind==='argument');for(const f of fs)for(const a of f.payload.authors)notice(s,'opposition:'+f.id+':'+a.id,a.email,'Practice opposing arguments',{arguments:fs.filter(o=>o.payload.side!==f.payload.side).map(o=>publicFiling(s,o)),deadline:m.deadlines.rebuttal});}}
 async function dispatch(path,body,key='') {
  if(path==='demo/reset'){storage.removeItem(storageKey);return {reset:true};}
  const s=load();tick(s);let result;
  const measure=mid=>{const m=s.measures.find(m=>m.id===mid);check(m,'Measure not found');return m;};
  const find=fid=>{const f=s.filings.find(f=>f.id===fid);check(f,'Packet not found in this browser. Practice links work only in the browser profile where they were created.');return f;};
  const owner=f=>check(key===f.owner,'Invalid practice packet key');
  if(path.startsWith('admin/'))check(key==='demo','Use the key demo for this local practice workspace.');
  if(path==='config')result={demo:true,staticDemo:true,certified:false};
  else if(path==='public')result={generatedAt:now(),practice:true,measures:s.measures,filings:s.filings.filter(f=>f.receipt&&now()>=measure(f.payload.measureId).deadlines[f.payload.kind]).map(f=>publicFiling(s,f)),documents:s.documents.filter(d=>d.kind==='analysis'||now()>=measure(d.measureId).deadlines[d.kind]),selections:s.selections};
  else if(path==='references')result={imports:s.imports,count:s.references.length};
  else if(path==='count')result=countWords(text(body.text,'text'),s.references,(body.properNouns||[]).map(text=>({text,status:'pending'})),2026);
  else if(path==='drafts'){
   const m=measure(body.measureId);check(['argument','rebuttal'].includes(body.kind),'Invalid kind');check(['for','against'].includes(body.side),'Invalid side');check(now()<m.deadlines[body.kind],'Practice filing period is closed. Reset practice data to reopen it.');
   check(Array.isArray(body.authors)&&body.authors.length>0&&body.authors.length<=5,'Provide 1–5 authors');
   const authors=body.authors.map(a=>({id:id(),name:text(a.name,'author',200),email:text(a.email,'email',254).toLowerCase(),title:a.title||''}));
   check(authors.every(a=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email)),'Invalid email');check(new Set(authors.map(a=>a.email)).size===authors.length,'Use a different example email for each author');
   const argument=text(body.text,'argument');check(Array.isArray(body.properNouns||[])&&(body.properNouns||[]).length<=100,'Invalid names');const claims=[...new Set(body.properNouns||[])].map(n=>{text(n,'proper name',300);check(argument.includes(n),'Claim must occur in text');return {id:id(),text:n,status:'pending'};});
   const fid=id(),payload={version:1,id:fid,measureId:m.id,jurisdiction:m.jurisdiction,measureTitle:m.title,kind:body.kind,side:body.side,text:argument,statement:m.declaration,authors,properNouns:claims.map(c=>c.text),practice:true};
   const canonical=JSON.stringify(payload),f={id:fid,payload,canonical,digest:await digest(canonical),owner:secret(),claims,signatures:[],receipt:null,invitations:authors.map(a=>({authorId:a.id,name:a.name,token:secret()}))};
   s.filings.push(f);result={id:fid,owner:f.owner,invitations:f.invitations,wordCount:count(s,f)};
  }
  else if(path.startsWith('sign/')){
   const f=find(path.split('/')[1]),invite=f.invitations.find(i=>i.token===key);check(invite,'Invalid practice signing link');check(!f.receipt,'Already submitted');
   if(!body)result={canonical:f.canonical,payload:f.payload,authorId:invite.authorId,signed:f.signatures.some(x=>x.authorId===invite.authorId)};
   else{check(now()<measure(f.payload.measureId).deadlines[f.payload.kind],'Practice filing period closed');check(!f.signatures.some(x=>x.authorId===invite.authorId),'Already signed');check(body.consent===true,'Consent required');check(body.publicKey?.kty==='EC'&&body.publicKey?.crv==='P-256'&&!body.publicKey.d,'P-256 public key required');const pk=await crypto.subtle.importKey('jwk',body.publicKey,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);check(await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},pk,Uint8Array.from(atob(body.signature),c=>c.charCodeAt(0)),new TextEncoder().encode(f.canonical)),'Signature verification failed');f.signatures.push({authorId:invite.authorId,publicKey:body.publicKey,signature:body.signature,signedAt:now()});result={signed:true};}
  }
  else if(path.startsWith('filings/')){
   const f=find(path.split('/')[1]);owner(f);const m=measure(f.payload.measureId);
   if(path.endsWith('/submit')){if(!f.receipt){check(now()<m.deadlines[f.payload.kind],'Practice filing period closed');check(f.signatures.length===f.payload.authors.length,'Every author must sign');f.receipt={id:id(),filingId:f.id,filedAt:now(),timezone:'UTC',jurisdiction:m.jurisdiction,measureId:m.id,digest:f.digest,wordCount:count(s,f),limit:m.limits[f.payload.kind],status:'practice-only',practice:true,fee:0,notice:'LOCAL PRACTICE RECEIPT. Nothing was filed with an elections official.'};}result=f.receipt;}
   else result={...f,wordCount:count(s,f),limit:m.limits[f.payload.kind]};
  }
  else if(path==='admin/state')result={...s,filings:s.filings.filter(f=>f.receipt).map(f=>({...f,wordCount:count(s,f)}))};
  else if(path==='admin/close'){const m=measure(body.measureId);m.deadlines.argument=now();m.deadlines.rebuttal=now();m.deadlines.tax=now();tick(s);result={closed:true};}
  else if(path==='admin/review'){const f=find(body.filingId),c=f.claims.find(c=>c.id===body.claimId);check(c,'Unknown claim');check(['approved','rejected'].includes(body.status),'Invalid decision');Object.assign(c,{status:body.status,reason:text(body.reason,'reason'),reviewedAt:now()});result=count(s,f);}
  else if(path==='admin/documents'){measure(body.measureId);check(['analysis','tax'].includes(body.kind),'Invalid document type');result={id:id(),measureId:body.measureId,kind:body.kind,title:text(body.title,'title'),text:text(body.text,'text'),filedAt:now(),practice:true};s.documents.push(result);}
  else if(path==='admin/selections'){const m=measure(body.measureId),f=find(body.selectedId);check(now()>=m.deadlines.argument,'Close the practice filing period first');check(f.receipt&&f.payload.measureId===m.id&&f.payload.side===body.side&&f.payload.kind==='argument','Select a submitted argument on the correct side');result={id:id(),...body,basis:text(body.basis,'basis'),provision:text(body.provision,'provision'),at:now(),practice:true};s.selections.push(result);for(const other of s.filings.filter(f=>f.receipt&&f.payload.measureId===m.id))for(const a of other.payload.authors)notice(s,'selection:'+result.id+':'+a.id,a.email,'Practice selection determination',result);}
  else if(path==='admin/references'){
   check(['controller','sos-business','sos-nonprofit','gnis','dictionary','abbreviation'].includes(body.source),'Invalid source');check(Array.isArray(body.names)&&body.names.length>0&&body.names.length<=50000,'Invalid name list');check(/^https:\/\//.test(body.sourceUrl),'HTTPS source URL required');check(Number.isFinite(Date.parse(body.retrievedAt)),'Retrieval date required');if(body.source==='dictionary')check(Number.isInteger(body.year)&&body.year>=1900,'Dictionary year required');
   const batch=id();for(const n of body.names)s.references.push({name:text(n,'name',300),source:body.source,kind:body.source==='dictionary'?'hyphen':body.source==='abbreviation'?'abbreviation':'proper',year:body.year});s.imports.push({id:batch,...body,names:undefined,count:body.names.length});result={batch,count:body.names.length};
  }
  else if(path==='admin/measures')throw Error('This Pages showcase uses the 15 verified Orange County measures. Run the server edition to configure additional measures.');
  else if(path==='admin/retry')throw Error('GitHub Pages does not send notices. These are local practice messages only.');
  else throw Error('Unsupported practice action');
  save(s);return structuredClone(result);
 }
 // One same-origin lock prevents simultaneous tabs from overwriting signatures.
 return (path,body,key)=>globalThis.navigator?.locks?navigator.locks.request(storageKey,()=>dispatch(path,body,key)):dispatch(path,body,key);
}
