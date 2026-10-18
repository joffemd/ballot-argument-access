import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import http from 'node:http';
import { Store } from '../src/store.js';
import { Service } from '../src/service.js';
import { createApp } from '../src/server.js';
import { countWords } from '../src/count.js';
const admin={id:'test-official',jurisdictions:'*'};
function setup(store=new Store()){
  let now=new Date('2028-07-01T12:00:00Z');const s=new Service(store,{demo:true,now:()=>now});
  const m=s.measure({title:'Measure A',jurisdiction:'Test County',electionDate:'2028-11-07',deadlines:{argument:'2028-08-01T00:00:00Z',rebuttal:'2028-08-11T00:00:00Z',analysis:'2028-07-25T00:00:00Z',tax:'2028-08-01T00:00:00Z'},declaration:'This argument is true and correct to the best of my knowledge and belief.'},admin);
  return {s,m,store,setTime:x=>now=new Date(x)};
}
function draft(s,m,side='for',text='A responsible proposal.',authors=[{name:'Example Author',email:'author@example.org'}],kind='argument',properNouns=[]){return s.draft({measureId:m.id,side,text,authors,kind,properNouns});}
function signature(canonical){const {publicKey,privateKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});return {publicKey:publicKey.export({format:'jwk'}),signature:sign('sha256',Buffer.from(canonical),{key:privateKey,dsaEncoding:'ieee-p1363'}).toString('base64'),consent:true};}
function signed(s,m,side='for',text='A responsible proposal.',authors,kind,properNouns){const d=draft(s,m,side,text,authors,kind,properNouns);for(const i of d.invitations)s.sign(d.id,i.token,signature(s.signingView(d.id,i.token).canonical));return d;}
test('Section 9 numeric, dates, phone, proper nouns, URLs, punctuation, hyphens, and abbreviations',()=>{
  const refs=[{name:'City and County of San Francisco',kind:'proper',source:'controller'},{name:'cost-effective',kind:'hyphen',source:'Dictionary 2020',year:2020}];
  for(const [text,want] of [['City and County of San Francisco',1],['November 7, 2028',2],['7 November 2028',2],['11/07/2028',1],['1-800-555-0123',1],['(415) 555-0123',1],['https://example.org/a-b',1],['cost-effective',1],['newly-invented-term',3],['U.S.A.',1],['$1,234.50',1],['one hundred',2],['— ... !',0],['hello,world',2],['voters’ choice',2]]) {
    const r=countWords(text,refs,[],2028);assert.equal(r.adjusted,want,text);assert.equal(r.unadjusted+r.adjustments.reduce((n,a)=>n+a.delta,0),r.adjusted,'itemization must balance for '+text);
  }
});
test('Dictionary dates, longest proper name, repeated spans, and pending claims',()=>{
  const refs=[{name:'San Francisco',source:'gnis'},{name:'City and County of San Francisco',source:'controller'},{name:'cost-effective',kind:'hyphen',year:2017}];
  assert.equal(countWords('City and County of San Francisco San Francisco',refs,[],2028).adjusted,2);
  assert.equal(countWords('cost-effective',refs,[],2028).adjusted,2);
  assert.equal(countWords('cost-effective',[{name:'cost-effective',kind:'hyphen',year:2028}],[],2028).adjusted,2);
  assert.equal(countWords('Jane Doe',[],[{text:'Jane Doe',status:'pending'}]).adjusted,2);
  assert.equal(countWords('Jane Doe',[],[{text:'Jane Doe',status:'approved'}]).adjusted,1);
});
test('Each author signs immutable text; receipt is immediate, durable and idempotent',()=>{
  const {s,m,store}=setup();const d=draft(s,m,'for','Test text',[{name:'One',email:'one@example.org'},{name:'Two',email:'two@example.org'}]);
  assert.throws(()=>s.submit(d.id,d.owner),/Every author/);
  const v=s.signingView(d.id,d.invitations[0].token);assert.throws(()=>s.sign(d.id,d.invitations[0].token,signature(v.canonical+'tamper')),/verification failed/);
  for(const i of d.invitations)s.sign(d.id,i.token,signature(s.signingView(d.id,i.token).canonical));
  const r=s.submit(d.id,d.owner);assert.equal(r.filedAt,s.time());assert.equal(r.status,'filed');assert.equal(r.fee,0);assert.deepEqual(s.submit(d.id,d.owner),r);assert.equal(store.all('outbox').filter(o=>o.id.startsWith('receipt:')).length,2);
  assert.throws(()=>s.signingView(d.id,d.invitations[0].token),/Already filed/);store.close();
});
test('Deadline boundary rejects late filing and unpublished drafts never appear',()=>{
  const {s,m,setTime,store}=setup();const d=signed(s,m);assert.equal(s.publicRecords().filings.length,0);setTime(m.deadlines.argument);assert.throws(()=>s.submit(d.id,d.owner),/closed/);assert.throws(()=>draft(s,m),/closed/);assert.equal(s.publicRecords().filings.length,0);store.close();
});
test('All filed arguments publish at close, rebuttals at their own deadline, private emails stay private',()=>{
  const {s,m,setTime,store}=setup();for(const side of ['for','against','against']){const d=signed(s,m,side);s.submit(d.id,d.owner);}const r=signed(s,m,'for','Rebuttal',undefined,'rebuttal');s.submit(r.id,r.owner);
  s.document({measureId:m.id,kind:'analysis',title:'Analysis',text:'Analysis text'},admin);s.document({measureId:m.id,kind:'tax',title:'Tax',text:'Tax text'},admin);
  assert.equal(s.publicRecords().documents.length,1);assert.equal(s.publicRecords().filings.length,0);setTime(m.deadlines.argument);const p=s.publicRecords();assert.equal(p.filings.length,3);assert.equal(p.documents.length,2);assert.ok(!JSON.stringify(p).includes('author@example.org'));assert.ok(!JSON.stringify(p).includes('ownerHash'));setTime(m.deadlines.rebuttal);assert.equal(s.publicRecords().filings.length,4);store.close();
});
test('Opposition delivery contains EVERY opposing argument for EVERY author, once across repeated ticks',()=>{
  const {s,m,setTime,store}=setup();const a=signed(s,m,'for','Support',[{name:'One',email:'one@example.org'},{name:'Two',email:'two@example.org'}]);s.submit(a.id,a.owner);
  for(const text of ['Opposition one','Opposition two']){const b=signed(s,m,'against',text);s.submit(b.id,b.owner);}s.tick();assert.equal(store.all('outbox').filter(o=>o.id.startsWith('opposition:')).length,0);
  setTime(m.deadlines.argument);s.tick();s.tick();const mails=store.all('outbox').filter(o=>o.id.startsWith('opposition:'));assert.equal(mails.length,4);for(const item of mails.filter(o=>o.id.includes(a.id)))assert.equal(item.body.arguments.length,2);store.close();
});
test('Selection validates jurisdiction and measure, persists reasons, and notifies every filer',()=>{
  const {s,m,setTime,store}=setup();const a=signed(s,m);s.submit(a.id,a.owner);const b=signed(s,m,'against');s.submit(b.id,b.owner);const input={measureId:m.id,side:'for',selectedId:a.id,basis:'Priority under the applicable statute',provision:'9166'};
  assert.throws(()=>s.selection(input,admin),/period to close/);setTime(m.deadlines.argument);assert.throws(()=>s.selection(input,{id:'wrong',jurisdictions:['Other County']}),/jurisdiction/);assert.throws(()=>s.selection({...input,side:'against'},admin),/Selected filing/);s.selection(input,admin);assert.equal(store.all('outbox').filter(o=>o.id.startsWith('selection:')).length,2);assert.equal(s.publicRecords().selections[0].basis,input.basis);store.close();
});
test('Proper-name review is scoped and preserves signed payload and original receipt count',()=>{
  const {s,m,store}=setup();const d=signed(s,m,'for','Jane Doe',undefined,undefined,['Jane Doe']);const r=s.submit(d.id,d.owner),f=store.get('filing',d.id);assert.equal(r.wordCount.adjusted,2);
  s.review(d.id,{claimId:f.claims[0].id,status:'approved',reason:'Verified full name'},admin);const view=s.ownerView(d.id,d.owner);assert.equal(view.wordCount.adjusted,1);assert.equal(view.receipt.wordCount.adjusted,2);assert.equal(store.get('filing',d.id).canonical,f.canonical);store.close();
});
test('Reference import records provenance for all required sources and rolls back invalid batches',()=>{
  const {s,store}=setup();for(const source of ['controller','sos-business','sos-nonprofit','gnis'])s.importReferences({source,sourceUrl:'https://example.org/source',retrievedAt:'2026-10-16',names:['Example Name']},admin);
  assert.equal(store.all('import').length,4);assert.throws(()=>s.importReferences({source:'gnis',sourceUrl:'https://example.org',retrievedAt:'2026-10-16',names:['Another Name','']},admin),/Invalid/);assert.equal(s.refs().length,4);store.close();
});
test('Over-limit filing is receipted for review, rather than silently lost',()=>{const {s,m,store}=setup();const d=signed(s,m,'for','word '.repeat(301));assert.equal(s.submit(d.id,d.owner).wordLimitExceeded,true);store.close();});
test('Owner and invitation capabilities cannot cross access roles',()=>{const {s,m,store}=setup();const d=draft(s,m);assert.throws(()=>s.ownerView(d.id,d.invitations[0].token),/Invalid access/);assert.throws(()=>s.signingView(d.id,d.owner),/Invalid signing/);assert.throws(()=>s.ownerView(d.id,'bogus'),/Invalid access/);store.close();});
test('Persistence survives reopening SQLite database',()=>{
  const dir=mkdtempSync(join(tmpdir(),'ballot-test-'));const path=join(dir,'test.sqlite');try{let store=new Store(path);const {s,m}=setup(store);const d=signed(s,m);const r=s.submit(d.id,d.owner);store.close();store=new Store(path);assert.equal(store.get('filing',d.id).receipt.id,r.id);assert.ok(store.all('outbox').length);store.close();}finally{rmSync(dir,{recursive:true,force:true});}
});
test('HTTP rejects unauthorized admin access, hostile origins, HTML payloads and host spoofing',async()=>{
  const store=new Store();const app=createApp({store,adminToken:'a'.repeat(64),baseUrl:'http://127.0.0.1:18789'});await new Promise(r=>app.server.listen(18789,'127.0.0.1',r));try{
    assert.equal((await fetch('http://127.0.0.1:18789/api/admin/state')).status,401);
    assert.equal((await fetch('http://127.0.0.1:18789/api/drafts',{method:'POST',headers:{'content-type':'application/json',Origin:'https://evil.example'},body:'{}'})).status,403);
    assert.equal((await fetch('http://127.0.0.1:18789/api/drafts',{method:'POST',body:'<html>'})).status,415);
    const spoofed=await new Promise((resolve,reject)=>{const req=http.get('http://127.0.0.1:18789/api/public',{headers:{Host:'evil.example'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);});assert.equal(spoofed,403);
    const r=await fetch('http://127.0.0.1:18789/');assert.equal(r.status,200);assert.match(r.headers.get('content-security-policy'),/frame-ancestors 'none'/);
  }finally{await new Promise(r=>app.server.close(r));store.close();}
});
test('Failed delivery remains retryable; duplicate worker calls do not lose notices',async()=>{
  const store=new Store();const app=createApp({store,webhook:'http://127.0.0.1:1/unavailable'});app.service.queue('test','test@example.org','Test',{text:'body'});await app.deliver();const o=store.get('outbox','test');assert.equal(o.status,'pending');assert.equal(o.attempts,1);assert.ok(o.error);assert.ok(o.nextAttempt>o.createdAt);await app.deliver();assert.equal(store.get('outbox','test').attempts,1);app.server.emit('close');store.close();
});
