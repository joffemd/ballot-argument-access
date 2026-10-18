import http from 'node:http';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { Store, hash, token } from './store.js';
import { Service, Problem } from './service.js';
import { practiceMeasures } from '../public/orange-county.js';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export function createApp({store=new Store(),demo=false,adminToken=token(),officials=[],baseUrl='http://127.0.0.1:8787',now,webhook='',webhookToken=''}={}) {
  const service=new Service(store,{demo,baseUrl,now});
  const principals=[{id:'state-administrator',tokenHash:hash(adminToken),jurisdictions:'*'},...officials];
  const rates=new Map();let delivering=false;
  async function deliver(){service.tick();if(delivering||!webhook)return;delivering=true;try {
    const pending=store.all('outbox').filter(x=>x.status==='pending'&&x.nextAttempt<=service.time()).sort((a,b)=>Number(b.id.startsWith('opposition:'))-Number(a.id.startsWith('opposition:'))).slice(0,50);
    await Promise.all(pending.map(async item=>{
      item.attempts++;
      try{const r=await fetch(webhook,{method:'POST',headers:{'content-type':'application/json','authorization':'Bearer '+webhookToken,'idempotency-key':item.id},body:JSON.stringify({id:item.id,to:item.to,subject:item.subject,body:item.body}),signal:AbortSignal.timeout(10000),redirect:'error'});if(!r.ok)throw Error('Delivery HTTP '+r.status);item.status='delivered';item.deliveredAt=service.time();item.error=null;}
      catch(e){item.error=String(e.message).slice(0,200);item.nextAttempt=new Date(Date.parse(service.time())+Math.min(300000,1000*2**Math.min(item.attempts,8))).toISOString();}
      store.put('outbox',item);
    }));
  }finally{delivering=false;}}
  const server=http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Cache-Control','no-store');res.setHeader('X-Frame-Options','DENY');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    const send=(status,obj)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8'});res.end(JSON.stringify(obj));};
    try{
      const expected=new URL(baseUrl);if(req.headers.host!==expected.host)throw new Problem('Unexpected Host header',403);
      const url=new URL(req.url,baseUrl),path=url.pathname;
      if(req.method==='GET'&&['/','/app.js','/style.css','/runtime.js','/orange-county.js'].includes(path)){const name=path==='/'?'index.html':path.slice(1);res.writeHead(200,{'content-type':name.endsWith('.js')?'text/javascript; charset=utf-8':name.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8'});res.end(readFileSync(resolve(root,'public',name)));return;}
      if(!path.startsWith('/api/'))throw new Problem('Not found',404);
      const key=req.headers.authorization?.replace(/^Bearer /,'')||'';
      const official=principals.find(o=>o.tokenHash===hash(key));
      if(path.startsWith('/api/admin/')){if(!official)throw new Problem('Official access key required',401);}
      let body={};
      if(req.method==='POST'){
        if(req.headers.origin&&req.headers.origin!==expected.origin)throw new Problem('Cross-origin request refused',403);
        if(!req.headers['content-type']?.startsWith('application/json'))throw new Problem('JSON required',415);
        const ip=req.socket.remoteAddress;const minute=Math.floor(Date.now()/60000);if(rates.size>10000)rates.clear();const rate=rates.get(ip);const current=rate?.minute===minute?rate:{minute,count:0};current.count++;rates.set(ip,current);if(current.count>300)throw new Problem('Too many requests',429);
        let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>4000000)throw new Problem('Request too large',413);}try{body=JSON.parse(raw);}catch{throw new Problem('Invalid JSON');}
        if(!body||Array.isArray(body)||typeof body!=='object')throw new Problem('JSON object required');
      }
      service.tick();let out;
      if(req.method==='GET'&&path==='/api/config')out={demo,signing:'ECDSA P-256 / SHA-256',certified:false};
      else if(req.method==='GET'&&path==='/api/public')out=service.publicRecords();
      else if(req.method==='GET'&&path==='/api/references')out={imports:store.all('import'),count:store.all('reference').length};
      else if(req.method==='POST'&&path==='/api/count'){if(typeof body.text!=='string'||body.text.length>20000)throw new Problem('Invalid text');out=service.count(body.text,service.find('measure',body.measureId),(body.properNouns||[]).map(text=>({text,status:'pending'})));}
      else if(req.method==='POST'&&path==='/api/drafts')out=service.draft(body);
      else if(/^\/api\/filings\/[^/]+$/.test(path)&&req.method==='GET')out=service.ownerView(path.split('/')[3],key);
      else if(/^\/api\/filings\/[^/]+\/submit$/.test(path)&&req.method==='POST')out=service.submit(path.split('/')[3],key);
      else if(/^\/api\/sign\/[^/]+$/.test(path)&&req.method==='GET')out=service.signingView(path.split('/')[3],key);
      else if(/^\/api\/sign\/[^/]+$/.test(path)&&req.method==='POST')out=service.sign(path.split('/')[3],key,body);
      else if(req.method==='GET'&&path==='/api/admin/state')out=service.officialView(official);
      else if(req.method==='POST'&&path==='/api/admin/measures')out=service.measure(body,official);
      else if(req.method==='POST'&&path==='/api/admin/references')out=service.importReferences(body,official);
      else if(req.method==='POST'&&path==='/api/admin/documents')out=service.document(body,official);
      else if(req.method==='POST'&&path==='/api/admin/review')out=service.review(body.filingId,body,official);
      else if(req.method==='POST'&&path==='/api/admin/selections')out=service.selection(body,official);
      else if(req.method==='POST'&&path==='/api/admin/retry'){if(official.jurisdictions!=='*')throw new Problem('Statewide administrator required',403);const x=service.find('outbox',body.id);x.status='pending';x.nextAttempt=service.time();store.put('outbox',x);out={queued:true};}
      else throw new Problem('Not found',404);
      send(200,out);void deliver();
    }catch(e){if(!(e instanceof Problem))console.error(e);send(e instanceof Problem?e.status:500,{error:e instanceof Problem?e.message:'Internal error'});}
  });
  const timer=setInterval(()=>void deliver().catch(console.error),1000);timer.unref();server.on('close',()=>clearInterval(timer));
  return {server,service,deliver,adminToken};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const demo=process.argv.includes('--demo'),port=Number(process.env.PORT||8787),baseUrl=process.env.BASE_URL||`http://127.0.0.1:${port}`;
  const adminToken=process.env.ADMIN_TOKEN||(demo?token():'');
  if(adminToken.length<32)throw Error('Set ADMIN_TOKEN to a random secret of at least 32 characters, or use npm run demo.');
  const webhook=process.env.NOTIFY_WEBHOOK||'';
  if(!demo){if(!baseUrl.startsWith('https://'))throw Error('Production requires HTTPS BASE_URL behind a TLS reverse proxy.');if(!webhook.startsWith('https://')||!process.env.NOTIFY_TOKEN)throw Error('Production requires HTTPS NOTIFY_WEBHOOK and NOTIFY_TOKEN.');if(process.env.SIGNATURE_POLICY_APPROVED!=='yes')throw Error('Agency signature policy approval required; see docs/DEPLOYMENT.md.');}
  mkdirSync(resolve(root,'data'),{recursive:true});const store=new Store(process.env.DB_PATH||resolve(root,'data',demo?'demo.sqlite':'ballot.sqlite'));
  const officials=process.env.OFFICIALS_FILE?JSON.parse(readFileSync(process.env.OFFICIALS_FILE,'utf8')):[];
  const app=createApp({store,demo,adminToken,officials,baseUrl,webhook,webhookToken:process.env.NOTIFY_TOKEN||''});
  if(demo){for(const m of practiceMeasures()){if(!store.get('measure',m.id))store.put('measure',m);}}
  app.server.listen(port,process.env.HOST||'127.0.0.1',()=>{console.log(`Ballot Argument Access: ${baseUrl}`);if(demo)console.log(`DEMO ONLY — official access key: ${adminToken}`);});
}
