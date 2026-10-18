import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoApi } from '../public/demo-api.js';
import { orangeCountyMeasures, practiceMeasures } from '../public/orange-county.js';
function storage(){const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};}
const memory=()=>createDemoApi(storage(),()=>new Date('2026-10-16T12:00:00Z'));
test('OC source fixture contains exactly A–O, verified PDFs, and real election date',()=>{
 assert.equal(orangeCountyMeasures.length,15);assert.equal(orangeCountyMeasures.map(m=>m.letter).join(''),'ABCDEFGHIJKLMNO');assert.equal(new Set(orangeCountyMeasures.map(m=>m.id)).size,15);
 for(const m of orangeCountyMeasures){assert.equal(m.electionDate,'2026-11-03');assert.ok(m.sourcePdf.startsWith('https://ocvote.gov/sites/default/files/'));assert.ok(m.sourcePdf.endsWith('.pdf'));}
 assert.equal(orangeCountyMeasures[10].jurisdiction,'City of Orange');for(const m of practiceMeasures())assert.match(m.deadlineNote,/not Orange County/);
});
test('Pages runtime exposes no real filing status and resets only its own store',async()=>{
 const store=storage();store.setItem('other-app','preserve');const api=createDemoApi(store);
 const p=await api('public');assert.equal(p.measures.length,15);assert.equal(p.practice,true);assert.equal((await api('config')).staticDemo,true);
 await api('demo/reset',{});assert.equal(store.getItem('other-app'),'preserve');
});
async function packet(api,side='for'){
 const d=await api('drafts',{measureId:'oc-2026-a',kind:'argument',side,text:'Practice text for Laguna Beach Unified School District.',authors:[{name:'Practice Author',email:'practice@example.org'}],properNouns:['Laguna Beach Unified School District']});
 const view=await api('sign/'+d.id,undefined,d.invitations[0].token);const keys=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);const bytes=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},keys.privateKey,new TextEncoder().encode(view.canonical));
 const input={consent:true,publicKey:await crypto.subtle.exportKey('jwk',keys.publicKey),signature:Buffer.from(bytes).toString('base64')};
 await assert.rejects(api('sign/'+d.id,{...input,signature:Buffer.alloc(64).toString('base64')},d.invitations[0].token),/verification/);
 await api('sign/'+d.id,input,d.invitations[0].token);await api('filings/'+d.id+'/submit',{},d.owner);return d;
}
test('Pages practice signing, publication, opposition, selection, noun review and receipt persist',async()=>{
 const api=memory();const a=await packet(api),b=await packet(api,'against');const r=await api('filings/'+a.id,undefined,a.owner);assert.equal(r.receipt.status,'practice-only');assert.equal((await api('public')).filings.length,0);
 await api('admin/review',{filingId:a.id,claimId:r.claims[0].id,status:'approved',reason:'Practice approval'},'demo');const revised=await api('filings/'+a.id,undefined,a.owner);assert.ok(revised.wordCount.adjusted<r.wordCount.adjusted);assert.deepEqual(revised.receipt,r.receipt);
 await api('admin/close',{measureId:'oc-2026-a'},'demo');assert.equal((await api('public')).filings.length,2);let admin=await api('admin/state',undefined,'demo');assert.equal(admin.outbox.length,2);assert.equal(admin.outbox[0].body.arguments.length,1);
 await api('admin/selections',{measureId:'oc-2026-a',side:'for',selectedId:a.id,basis:'Practice only',provision:'9166'},'demo');admin=await api('admin/state',undefined,'demo');assert.equal(admin.outbox.length,4);assert.ok(admin.outbox.every(o=>o.status.includes('not sent')));
 assert.ok(!JSON.stringify(await api('public')).includes('practice@example.org'));await assert.rejects(api('admin/state',undefined,'wrong'),/demo/);
});
