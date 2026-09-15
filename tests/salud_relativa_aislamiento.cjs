'use strict';
// node tests/salud_relativa_aislamiento.cjs
// Recompute all views on all existing captures; no network or writes.
const fs=require('node:fs'),path=require('node:path');
const rootPath=path.resolve(__dirname,'..'),P=require('../web/priorizacion.js');
const html=fs.readFileSync(path.join(rootPath,'index.html'),'utf8');
const marker='<script>const DATA=',start=html.indexOf(marker)+marker.length,end=html.indexOf(';</script>',start);
if(start<marker.length||end<start)throw Error('Payload ausente');
const current=JSON.parse(html.slice(start,end)),baseline=JSON.parse(JSON.stringify(current));
const kind=baseline.denominators.health_variant.kind;
baseline.denominators.rows=baseline.denominators.rows.filter(r=>r.kind!==kind);
delete baseline.denominators.health_variant;delete baseline.denominators.sources.reps_capacity_2022;

function verifyIsolation(root,base,variants,dates){
 const out=[];
 for(const date of dates)for(const scope of ['all','decree'])for(const severity of ['total','grave']){
  const state={date,scope,severity},old=root.Priorizacion.models(base);
  const expected=Object.fromEntries(['absolute','percapita','sectorial'].map(k=>[k,old[k].compute(state)]));
  for(const v of variants){
   const mm=root.Priorizacion.models(v.payload);
   for(const mode of ['absolute','percapita']){
    if(JSON.stringify(mm[mode].compute(state))!==JSON.stringify(expected[mode]))throw Error(v.config.id+' changed '+mode);
    out.push({variant:v.config.id,mode,date,scope,severity,pass:true});
   }
   const r=mm.sectorial.compute(state),bm=new Map(expected.sectorial.all.map(x=>[x.geo,x]));
   for(const x of r.all)for(const sector of x.sectors.filter(s=>s.id!=='salud'))
    if(JSON.stringify(sector)!==JSON.stringify(bm.get(x.geo).sectors.find(s=>s.id===sector.id)))throw Error('changed sector '+sector.id);
   out.push({variant:v.config.id,mode:'sectorial_non_health_unchanged',date,scope,severity,pass:true});
  }
 }
 return out;
}
const checks=verifyIsolation({Priorizacion:P},baseline,[{config:current.denominators.health_variant,payload:current}],current.dates);
process.stdout.write(checks.length+' comprobaciones de aislamiento aprobadas.\n');
