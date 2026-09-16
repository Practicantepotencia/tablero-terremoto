const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const P=require('../web/priorizacion.js'),H=require('../web/presion_salud.js');
const raw=fs.readFileSync('index.html','utf8').match(/const DATA=([\s\S]*?);<\/script>/);
assert.ok(raw);const data=JSON.parse(raw[1]),reference={...data,healthPressure:null};
const baseline=P.models(reference),scenario=P.models(data);
const output={base_commit:data.healthPressure.base_commit,mode:data.healthPressure.mode,capture:data.latest,capacity:data.healthPressure.audit,scopes:{}};
for(const scope of ['decree','all']){
 const state={scope,date:data.latest,dept:''};
 for(const mode of ['absolute','percapita']){
   assert.deepEqual(scenario[mode].compute(state),baseline[mode].compute(state),'Los modelos previos no cambian: '+mode);
 }
 const old=baseline.sectorial.compute(state),now=scenario.sectorial.compute(state);
 assert.equal(now.referenceN,old.referenceN);
 const original=new Map(old.all.map(r=>[r.geo,r]));
 for(const r of now.all){
   const a=original.get(r.geo);assert.ok(a);assert.equal(r.fieldCount,14);
   assert.equal(r.sectors.length,5);
   assert.equal(r.recovery,a.recovery);assert.equal(r.vulnerability,a.vulnerability);
   for(let i=0;i<5;i++)if(r.sectors[i].id!=='salud')assert.deepEqual(r.sectors[i],a.sectors[i],'Solo cambia Salud: '+r.code);
   const s=r.sectors.find(s=>s.id==='salud');assert.equal(s.fields.length,1);
   assert.equal(s.fields[0].id,H.ID);
   const f=s.fields[0];
   if(f.score!=null){
     assert.equal(f.row.original_id,'3is_heridos');assert.equal(f.denominator.status,'observed_historical');
     assert.ok(Math.abs(f.rate-f.row.v/f.denominator.value)<1e-10);
     assert.ok(Math.abs(f.score-(f.rate===0?0:100*f.rate/f.anchor))<1e-8);
   }
   assert.ok(Math.abs(r.damageLower-r.sectors.reduce((n,s)=>n+s.lower,0)/5)<1e-8);
   assert.ok(r.lower>=0&&r.upper<=100+1e-8&&r.lower<=r.upper);
 }
 const select=scenario.sectorial.selection({...state,matrixSearch:'Pereira'});
 assert.deepEqual(select.calibrations,now.calibrations,'Búsqueda no altera anclas');
 const scored=now.items.filter(r=>r.sectors.find(s=>s.id==='salud').coverage>0);
 const health=r=>{const f=r.sectors.find(s=>s.id==='salud').fields[0];return {code:r.code,name:r.m,department:r.d,numerator:f.row?.v??null,denominator:f.denominator?.value??null,ratio:f.rate,anchor:f.anchor,health:f.score,global:r.lower,rank:now.items.find(x=>x.geo===r.geo)?.rank??null,reason:f.reason};};
 output.scopes[scope]={reference:now.referenceN,health_with_data:scored.length,health_positive:scored.filter(r=>r.sectors.find(s=>s.id==='salud').lower>0).length,
 missing_health:now.all.length-scored.length,calibration:now.calibrations.find(r=>r.id===H.ID),
 top_health:scored.slice().sort((a,b)=>b.sectors[2].lower-a.sectors[2].lower).slice(0,10).map(health),
 examples:now.all.filter(r=>['27050','27660','66001','76828','27001','76001'].includes(r.code)).map(health),
 top_global:now.items.slice(0,10).map(health),rank_changes:now.items.slice(0,10).map(r=>({code:r.code,new_rank:r.rank,previous_rank:old.items.find(x=>x.geo===r.geo)?.rank??null}))};
}
fs.writeFileSync('docs/verificacion_presion_salud.json',JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify(output,null,2));
