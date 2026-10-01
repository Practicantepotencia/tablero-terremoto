const test=require('node:test'),assert=require('node:assert/strict');
const P=require('../web/priorizacion.js'),T=require('../web/modelo.js'),E=require('../web/educacion.js');
const dates=['2026-09-20','2026-09-21','2026-09-28'];
const state=date=>({date,scope:'all',dept:''});
function fixture(){
 const rows=dates.flatMap(date=>['66001','66170'].map((code,i)=>({geo:'municipal:'+code,code,lv:'municipal',d:'Risaralda',m:code,f:'PNUD',id:'pnud_cedu',i:'Centros',dim:'Educación',u:'Número',v:i?10:8,date})));
 return {rows,dates,baseline:{rows:[]},population:{rows:['66001','66170'].map(code=>({code,population:1000,year:2026}))},
  healthPressure:{source_cascade:{enabled:true},human_impact_policy:{families_informational_only:true}},
  education:{enabled:true,effective_from:'2026-09-21',report_date:'2026-09-21',critical_share:.5,version:'MEN-20260921.1',
   roster:[{code:'66001',d:'Risaralda',m:'Pereira'},{code:'66170',d:'Risaralda',m:'Dosquebradas'},{code:'66075',d:'Risaralda',m:'Balboa'}],
   municipalities:[{code:'66170',d:'Risaralda',m:'Dosquebradas',reported_sites:10,critical_sites:1,critical_enrollment:30,service_no_sites:0,unclassified_sites:0,missing_critical_enrollment:0}]}};
}
const edu=(r,code='66001')=>r.all.find(r=>r.code===code).sectors.find(s=>s.id==='educacion');
test('antes del corte: misma configuración y resultados que sin entrega MEN, en tres modos',()=>{
 const d=fixture(),old={...d,education:null};
 for(const mode of ['absolute','percapita','sectorial'])assert.deepEqual(P.models(d)[mode].compute(state(dates[0])),P.models(old)[mode].compute(state(dates[0])));
});
test('cambio de versión explícito: 80 antes; 40–90 después si MEN falta, sin reponderar disponibles',()=>{
 const m=P.models(fixture()).absolute,before=m.compute(state(dates[0])),after=m.compute(state(dates[1]));
 assert.equal(before.modelVersion,'1.2-RS');assert.equal(after.modelVersion,'1.2-RS+MEN-20260921');
 assert.deepEqual([edu(before).lower,edu(before).upper],[80,80]);
 assert.deepEqual([edu(after).lower,edu(after).upper],[40,90]);
 assert.deepEqual(edu(after).fields.map(f=>f.share),[.5,.5]);assert.equal(after.all[0].fieldCount,10);
});
test('MEN conserva fecha de archivo; no inventa inspecciones ni una serie diaria',()=>{
 const d=fixture(),t=T.create(d),rows=t.visible(state(dates[2])).filter(r=>r.f==='MEN');
 assert.ok(rows.length);assert.ok(rows.every(r=>r.source_date===dates[1]&&r.observed_at===null&&r.date===dates[2]));
 assert.equal(t.visible(state(dates[0])).some(r=>r.f==='MEN'),false);
 assert.equal(t.history(state(dates[2]),T.cohort(rows[0])).reason,'single_delivery');
});
test('servicio y fuentes contextuales no alteran el puntaje de matrícula crítica',()=>{
 const d=fixture(),changed=structuredClone(d);changed.education.municipalities[0].service_no_sites=10;
 changed.educationContext={sources:[{value:999999999}]};
 for(const mode of ['absolute','percapita','sectorial']){
  const a=P.models(d)[mode].compute(state(dates[1])),b=P.models(changed)[mode].compute(state(dates[1]));
  assert.deepEqual(a.all.map(r=>[r.code,r.lower,r.upper]),b.all.map(r=>[r.code,r.lower,r.upper]));
 }
});
test('matrícula crítica relativa usa población; sin población no fabrica tasa ni cero',()=>{
 const d=fixture();let f=edu(P.models(d).sectorial.compute(state(dates[1])),'66170').fields[1];
 assert.equal(f.rate,300);assert.equal(f.anchor,300);assert.equal(f.score,100);
 d.population.rows=[];f=edu(P.create(d,undefined,{mode:'sectorial'}).compute(state(dates[1])),'66170').fields[1];
 assert.equal(f.row.v,30);assert.equal(f.rate,null);assert.equal(f.score,null);
});
test('cero reportado es conocido; duplicados o daño desconocido no se completan',()=>{
 for(const variant of ['zero','duplicate','unknown']){
  const d=fixture(),r=d.education.municipalities[0];
  if(variant==='zero')r.critical_enrollment=0;
  if(variant==='duplicate')d.education.municipalities.push({...r});
  if(variant==='unknown')r.unclassified_sites=1;
  const f=edu(P.models(d).absolute.compute(state(dates[1])),'66170').fields[1];
  assert.equal(f.score,variant==='zero'?0:null);
 }
});
test('universo de cinco departamentos conserva municipios sin reporte y sin puesto fabricado',()=>{
 const d=fixture(),result=P.models(d).absolute.compute({...state(dates[1]),scope:'five'});
 assert.equal(result.referenceN,3);const missing=result.all.find(r=>r.code==='66075');
 assert.equal(missing.coverage,0);assert.ok(result.missing.some(r=>r.code==='66075'));
 assert.ok(edu(result,'66075').fields.every(f=>f.row===null));
});
