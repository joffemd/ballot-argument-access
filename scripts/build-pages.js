import { mkdirSync, copyFileSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { orangeCountyMeasures, orangeCountySource } from '../public/orange-county.js';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),out=resolve(root,'dist');
mkdirSync(out,{recursive:true});
// Explicit allowlist: never package the server DB, credentials or live submissions.
const allowed=['index.html','app.js','style.css','orange-county.js','demo-api.js'];
for(const file of allowed)copyFileSync(resolve(root,'public',file),resolve(out,file));
copyFileSync(resolve(root,'src/count.js'),resolve(out,'count.js'));
writeFileSync(resolve(out,'demo-api.js'),readFileSync(resolve(out,'demo-api.js'),'utf8').replace("'../src/count.js'","'./count.js'"));
writeFileSync(resolve(out,'runtime.js'),'export const staticDemo = true;\n');
writeFileSync(resolve(out,'.nojekyll'),'');
writeFileSync(resolve(out,'measures.json'),JSON.stringify({source:orangeCountySource,checked:'2026-10-16',electionDate:'2026-11-03',measures:orangeCountyMeasures},null,2)+'\n');
// Never deploy an unexpectedly contaminated output directory.
const expected=new Set([...allowed,'count.js','runtime.js','.nojekyll','measures.json']);
for(const name of readdirSync(out))if(!expected.has(name))throw Error(`Unexpected dist entry: ${name}. Inspect it and rebuild in a clean directory.`);
console.log(`Built ${expected.size} static files for GitHub Pages in ${out}`);
