import { randomUUID, createPublicKey, verify } from 'node:crypto';
import { token, hash } from './store.js';
import { countWords } from './count.js';
export class Problem extends Error { constructor(message,status=400){super(message);this.status=status;} }
const need = (ok,message,status) => {if(!ok) throw new Problem(message,status);};
const str = (v,name,max=20000) => {need(typeof v==='string' && v.trim() && v.length<=max,`Invalid ${name}`); return v.trim();};
const email = v => {v=str(v,'email',254).toLowerCase();need(/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(v),'Invalid email');return v;};
export class Service {
  constructor(store,{now=()=>new Date(),demo=false,baseUrl='http://127.0.0.1:8787'}={}) {this.store=store;this.now=now;this.demo=demo;this.baseUrl=baseUrl;}
  time(){return this.now().toISOString();}
  find(kind,id){const r=this.store.get(kind,id);need(r,`${kind} not found`,404);return r;}
  auth(row,secret){need(typeof secret==='string' && hash(secret)===row.ownerHash,'Invalid access key',403);}
  scope(official,measure){need(official.jurisdictions==='*' || official.jurisdictions.includes(measure.jurisdiction),'Outside official jurisdiction',403);}
  queue(id,to,subject,body){if(this.store.get('outbox',id))return;this.store.put('outbox',{id,to,subject,body,createdAt:this.time(),attempts:0,status:'pending',nextAttempt:this.time()});}
  measure(input,official){
    const jurisdiction=str(input.jurisdiction,'jurisdiction',200);this.scope(official,{jurisdiction});
    const deadlines={};for(const k of ['argument','rebuttal','analysis','tax']) {const v=input.deadlines?.[k];need(typeof v==='string' && /(?:Z|[+-]\d\d:\d\d)$/.test(v) && Number.isFinite(Date.parse(v)),`Deadline ${k} must include UTC offset`);deadlines[k]=new Date(v).toISOString();}
    need(deadlines.argument<=deadlines.rebuttal,'Rebuttal deadline precedes argument deadline');
    need(/^\d{4}-\d{2}-\d{2}$/.test(input.electionDate) && Number.isFinite(Date.parse(input.electionDate)),'Invalid election date');
    const m={id:randomUUID(),jurisdiction,title:str(input.title,'title',300),electionDate:input.electionDate,deadlines,limits:{argument:input.limits?.argument??300,rebuttal:input.limits?.rebuttal??250},declaration:str(input.declaration,'Section 9600 declaration',3000),createdAt:this.time()};
    for(const v of Object.values(m.limits))need(Number.isInteger(v)&&v>0&&v<=10000,'Invalid word limit');
    return this.store.transaction(()=>{this.store.put('measure',m);this.store.audit(official.id,'create measure',m.id,this.time());return m;});
  }
  refs(){return this.store.all('reference');}
  count(text,measure,claims=[]){return countWords(text,this.refs(),claims,Number(measure.electionDate.slice(0,4)));}
  importReferences(input,official){
    need(official.jurisdictions==='*','Statewide administrator required',403);
    need(['controller','sos-business','sos-nonprofit','gnis','dictionary','abbreviation'].includes(input.source),'Invalid source');
    need(Array.isArray(input.names)&&input.names.length>0&&input.names.length<=50000,'Supply 1–50,000 names');
    const sourceUrl=str(input.sourceUrl,'source URL',2000);need(/^https:\/\//.test(sourceUrl),'HTTPS source URL required');
    need(Number.isFinite(Date.parse(input.retrievedAt)),'Retrieval date required');
    const batch=randomUUID();
    return this.store.transaction(()=>{for(const name of input.names){const n=str(name,'reference name',300);const kind=input.source==='dictionary'?'hyphen':input.source==='abbreviation'?'abbreviation':'proper';
      if(kind==='hyphen')need(Number.isInteger(input.year)&&input.year>=1900,'Dictionary publication year required');
      this.store.put('reference',{id:hash(input.source+'|'+n+'|'+(input.year||'')),name:n,kind,source:input.source,sourceUrl,retrievedAt:input.retrievedAt,year:input.year,batch});}
      this.store.put('import',{id:batch,source:input.source,sourceUrl,retrievedAt:input.retrievedAt,count:input.names.length,at:this.time(),actor:official.id});this.store.audit(official.id,'import reference batch',batch,this.time());return {batch,count:input.names.length};});
  }
  draft(input){
    const m=this.find('measure',input.measureId);need(['argument','rebuttal'].includes(input.kind),'Invalid filing kind');need(['for','against'].includes(input.side),'Invalid side');
    need(this.time()<m.deadlines[input.kind],'Filing period is closed',409);
    const text=str(input.text,'argument text');need(Array.isArray(input.authors)&&input.authors.length>=1&&input.authors.length<=5,'Provide 1–5 authors');
    const authors=input.authors.map(a=>({id:randomUUID(),name:str(a.name,'author name',200),email:email(a.email),title:typeof a.title==='string'?a.title.slice(0,200):''}));
    need(new Set(authors.map(a=>a.email)).size===authors.length,'Each author needs a separate email address');
    const claims=(input.properNouns||[]);need(Array.isArray(claims)&&claims.length<=100,'Invalid noun claims');
    const nouns=[...new Set(claims.map(c=>str(c,'proper noun',300)))].map(text=>{need(input.text.includes(text),'Claim must occur in the text');return {id:randomUUID(),text,status:'pending'};});
    const owner=token(), id=randomUUID();
    const payload={version:1,id,measureId:m.id,jurisdiction:m.jurisdiction,measureTitle:m.title,kind:input.kind,side:input.side,text,statement:m.declaration,authors,properNouns:nouns.map(n=>n.text)};
    const canonical=JSON.stringify(payload);const invitations=authors.map(a=>({authorId:a.id,token:token()}));
    const d={id,payload,canonical,digest:hash(canonical),claims:nouns,ownerHash:hash(owner),invitations:invitations.map(i=>({authorId:i.authorId,tokenHash:hash(i.token)})),signatures:[],createdAt:this.time(),receipt:null};
    this.store.transaction(()=>{this.store.put('filing',d);for(const i of invitations){const a=authors.find(a=>a.id===i.authorId);this.queue('invite:'+id+':'+a.id,a.email,'Review and sign a ballot argument',{type:'invitation',url:this.baseUrl+'/#sign/'+id+'/'+i.token,measure:m.title,author:a.name});}this.store.audit('filer','create draft',id,this.time());});
    return {id,owner,wordCount:this.count(text,m,nouns),invitations:this.demo?invitations.map(i=>({...i,name:authors.find(a=>a.id===i.authorId).name})):undefined};
  }
  ownerView(id,key){const f=this.find('filing',id);this.auth(f,key);const m=this.find('measure',f.payload.measureId);return {id,payload:f.payload,signatures:f.signatures.map(s=>({authorId:s.authorId,signedAt:s.signedAt})),receipt:f.receipt,claims:f.claims,wordCount:this.count(f.payload.text,m,f.claims),limit:m.limits[f.payload.kind]};}
  signingView(id,key){const f=this.find('filing',id);const invite=f.invitations.find(i=>i.tokenHash===hash(key||''));need(invite,'Invalid signing link',403);need(!f.receipt,'Already filed',409);return {canonical:f.canonical,payload:f.payload,authorId:invite.authorId,signed:f.signatures.some(s=>s.authorId===invite.authorId)};}
  sign(id,key,input){
    const view=this.signingView(id,key);const f=this.find('filing',id);const m=this.find('measure',f.payload.measureId);need(this.time()<m.deadlines[f.payload.kind],'Filing period is closed',409);need(!view.signed,'Author already signed',409);need(input.consent===true,'Explicit signing consent required');
    let valid=false;try {need(input.publicKey?.kty==='EC'&&input.publicKey?.crv==='P-256'&&!input.publicKey.d,'P-256 public key required');const pk=createPublicKey({key:input.publicKey,format:'jwk'});valid=verify('sha256',Buffer.from(f.canonical),{key:pk,dsaEncoding:'ieee-p1363'},Buffer.from(input.signature,'base64'));}catch{}need(valid,'Signature verification failed',422);
    f.signatures.push({authorId:view.authorId,publicKey:{kty:input.publicKey.kty,crv:input.publicKey.crv,x:input.publicKey.x,y:input.publicKey.y},signature:input.signature,signedAt:this.time(),consent:true,digest:f.digest});
    this.store.transaction(()=>{this.store.put('filing',f);this.store.audit(view.authorId,'digitally sign',id,this.time());});return {signed:true};
  }
  submit(id,key){return this.store.transaction(()=>{
    const f=this.find('filing',id);this.auth(f,key);if(f.receipt)return f.receipt;
    const m=this.find('measure',f.payload.measureId);const at=this.time();need(at<m.deadlines[f.payload.kind],'Filing period is closed',409);need(f.signatures.length===f.payload.authors.length,'Every author must sign before filing',409);
    for(const s of f.signatures)need(verify('sha256',Buffer.from(f.canonical),{key:createPublicKey({key:s.publicKey,format:'jwk'}),dsaEncoding:'ieee-p1363'},Buffer.from(s.signature,'base64')),'Stored signature failed verification',422);
    const wordCount=this.count(f.payload.text,m,f.claims);
    f.receipt={id:randomUUID(),filingId:id,filedAt:at,timezone:'UTC',jurisdiction:m.jurisdiction,measureId:m.id,digest:f.digest,wordCount,limit:m.limits[f.payload.kind],wordLimitExceeded:wordCount.adjusted>m.limits[f.payload.kind],status:'filed',fee:0};
    // Over-limit filings receive a receipt; review must not silently discard them.
    this.store.put('filing',f);for(const a of f.payload.authors)this.queue('receipt:'+id+':'+a.id,a.email,'Ballot argument filing receipt',f.receipt);this.store.audit('filer','submit filing',id,at);return f.receipt;
  });}
  document(input,official){const m=this.find('measure',input.measureId);this.scope(official,m);need(['analysis','tax'].includes(input.kind),'Invalid document kind');const d={id:randomUUID(),measureId:m.id,kind:input.kind,title:str(input.title,'title',300),text:str(input.text,'document',200000),filedAt:this.time()};return this.store.transaction(()=>{this.store.put('document',d);this.store.audit(official.id,'file official document',d.id,this.time());return d;});}
  review(id,input,official){const f=this.find('filing',id);const m=this.find('measure',f.payload.measureId);this.scope(official,m);const c=f.claims.find(c=>c.id===input.claimId);need(c,'Unknown claim');need(['approved','rejected'].includes(input.status),'Invalid decision');c.status=input.status;c.reason=str(input.reason,'review reason',2000);c.reviewedBy=official.id;c.reviewedAt=this.time();return this.store.transaction(()=>{this.store.put('filing',f);this.store.audit(official.id,'review noun '+c.status,id,this.time());return this.count(f.payload.text,m,f.claims);});}
  selection(input,official){const m=this.find('measure',input.measureId);this.scope(official,m);need(this.time()>=m.deadlines.argument,'Selections require the argument filing period to close',409);need(['for','against'].includes(input.side),'Invalid side');const f=this.find('filing',input.selectedId);need(f.receipt&&f.payload.measureId===m.id&&f.payload.side===input.side&&f.payload.kind==='argument','Selected filing must be an argument on this side of this measure');const d={id:randomUUID(),measureId:m.id,side:input.side,selectedId:f.id,basis:str(input.basis,'selection basis',5000),provision:str(input.provision,'legal provision',300),at:this.time(),official:official.id};
    return this.store.transaction(()=>{this.store.put('selection',d);for(const other of this.store.all('filing').filter(x=>x.receipt&&x.payload.measureId===m.id)){for(const a of other.payload.authors)this.queue('selection:'+d.id+':'+other.id+':'+a.id,a.email,'Argument selection determination',d);}this.store.audit(official.id,'record selection',d.id,this.time());return d;});}
  publicFiling(f){return {id:f.id,measureId:f.payload.measureId,kind:f.payload.kind,side:f.payload.side,text:f.payload.text,statement:f.payload.statement,authors:f.payload.authors.map(a=>({name:a.name,title:a.title})),filedAt:f.receipt.filedAt,digest:f.digest,wordCount:this.count(f.payload.text,this.find('measure',f.payload.measureId),f.claims),receiptId:f.receipt.id};}
  publicRecords(){const now=this.time();return {generatedAt:now,license:'Publicly accessible at no charge; source software MIT',measures:this.store.all('measure'),filings:this.store.all('filing').filter(f=>f.receipt&&now>=this.find('measure',f.payload.measureId).deadlines[f.payload.kind]).map(f=>this.publicFiling(f)),documents:this.store.all('document').filter(d=>d.kind==='analysis'||now>=this.find('measure',d.measureId).deadlines[d.kind]),selections:this.store.all('selection')};}
  tick(){this.store.transaction(()=>{for(const m of this.store.all('measure')){
    if(this.time()<m.deadlines.argument)continue;
    const filings=this.store.all('filing').filter(f=>f.receipt&&f.payload.measureId===m.id&&f.payload.kind==='argument');
    for(const f of filings)for(const a of f.payload.authors)this.queue('opposition:'+f.id+':'+a.id,a.email,'Opposing arguments for rebuttal preparation',{measureId:m.id,deadline:m.deadlines.rebuttal,arguments:filings.filter(o=>o.payload.side!==f.payload.side).map(o=>this.publicFiling(o))});
  }});}
  officialView(official){const measures=this.store.all('measure').filter(m=>official.jurisdictions==='*'||official.jurisdictions.includes(m.jurisdiction));const ids=new Set(measures.map(m=>m.id));return {measures,filings:this.store.all('filing').filter(f=>f.receipt&&ids.has(f.payload.measureId)).map(f=>({id:f.id,payload:f.payload,claims:f.claims,receipt:f.receipt,signatures:f.signatures,canonical:f.canonical,wordCount:this.count(f.payload.text,this.find('measure',f.payload.measureId),f.claims)})),imports:this.store.all('import'),selections:this.store.all('selection').filter(s=>ids.has(s.measureId)),outbox:official.jurisdictions==='*'?this.store.all('outbox'):[],audit:official.jurisdictions==='*'?this.store.db.prepare('SELECT * FROM audit ORDER BY seq DESC LIMIT 100').all():[]};}
}

