import http from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import './build-pages.js';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../dist');
const prefix='/ballot-argument-access/',port=Number(process.env.PORT||8788);
http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/'){res.writeHead(302,{location:prefix});res.end();return;}
 if(!url.pathname.startsWith(prefix)){res.writeHead(404);res.end('Not found');return;}
 const name=url.pathname.slice(prefix.length)||'index.html';
 if(!/^[a-zA-Z0-9.-]+$/.test(name)){res.writeHead(404);res.end('Not found');return;}
 try{const contents=readFileSync(resolve(root,name));res.writeHead(200,{'content-type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'})[extname(name)]||'text/plain','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(contents);}catch{res.writeHead(404);res.end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log(`Pages preview: http://127.0.0.1:${port}${prefix}`));
