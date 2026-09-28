
const test=require('node:test'),assert=require('node:assert/strict'),P=require('../web/priorizacion.js');
const date='2026-09-16',state={scope:'all',date},codes=['27050','27660'],modes=['absolute','percapita','sectorial'];
const row=(code,id,v)=>({geo:'municipal:'+code,code,lv:'municipal',m:code,d:'Chocó',date,id,f:id.startsWith('pnud_')?'PNUD':'3iS-Sheets',u:'Número',dim:'Vivienda',i:id,v});
function fixture(){
 return {rows:[row(codes[0],'pnud_vd',10),row(codes[0],'pnud_va',2),row(codes[1],'pnud_vd',2),row(codes[1],'pnud_va',10)],
 latest:date,dates:[date],baseline:{rows:[]},population:{rows:codes.map(code=>({code,population:1000,year:2026}))},
 healthPressure:{enabled:false,source_cascade:{enabled:true},housing_weight_policy:{enabled:true,destroyed:2,damaged:1}},
 denominators:{event_date:'2026-08-10',sources:{official:{url:'https://www.dane.gov.co/',published:'2025-12-24',sha256:'a'.repeat(64)}},
 rows:codes.map(code=>({code,kind:'hogares',value:100,year:2026,unit:'Hogares',source:'official',reference_date:'2026-06-30',area:'Total',status:'verified'}))}};
}
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,a+' != '+b);
test('destruidas tienen doble peso en los tres modelos; el sector sigue pesando 1/5',()=>{
 for(const mode of modes){
  const r=P.models(fixture())[mode].compute(state),a=r.all.find(r=>r.code===codes[0]),b=r.all.find(r=>r.code===codes[1]);
  assert.deepEqual(a.sectors[1].fields.map(f=>f.share),[2/3,1/3]);
  close(a.sectors[1].lower,(2*100+20)/3);close(b.sectors[1].lower,(2*20+100)/3);
  close(a.damageLower,a.sectors[1].lower/5);close(a.sectors[1].fields.reduce((s,f)=>s+f.contribution,0),a.damageLower);
 }
});
test('no cambia filas, tasas, puntajes individuales, anclas ni otros sectores',()=>{
 const d=fixture(),old=structuredClone(d);old.healthPressure.housing_weight_policy.enabled=false;
 for(const mode of modes){
  const a=P.models(d)[mode].compute(state),b=P.models(old)[mode].compute(state);
  for(const r of a.all){const before=b.all.find(x=>x.geo===r.geo);
   for(const s of r.sectors){
    const prev=before.sectors.find(x=>x.id===s.id);
    if(s.id!=='vivienda'){assert.deepEqual(s,prev);continue;}
    s.fields.forEach((f,i)=>{const {share,contribution,...rest}=f,{share:oldShare,contribution:oldContribution,...oldRest}=prev.fields[i];assert.deepEqual(rest,oldRest);});
   }
  }
 }
});
test('sin destruidas conserva su peso desconocido y no eleva el peso de averiadas',()=>{
 const d=fixture();d.rows=d.rows.filter(r=>!(r.code===codes[0]&&r.id==='pnud_vd'));
 for(const mode of modes){const s=P.models(d)[mode].compute(state).all.find(r=>r.code===codes[0]).sectors[1];
  assert.equal(s.fields[0].score,null);close(s.lower,20/3);close(s.upper,20/3+200/3);close(s.coverage,1/3);
 }
});
test('cero PNUD es cero y 3iS solo completa faltantes con el mismo peso',()=>{
 const d=fixture();d.rows[0].v=0;d.rows.push(row(codes[0],'3is_vivdestruidas',99));
 const a=P.models(d).absolute.compute(state).all.find(r=>r.code===codes[0]).sectors[1].fields[0];
 assert.equal(a.row.f,'PNUD');assert.equal(a.score,0);assert.equal(a.share,2/3);
 const fallback={...d,rows:d.rows.filter(r=>!(r.code===codes[0]&&r.id==='pnud_vd'))};
 const b=P.models(fallback).absolute.compute(state).all.find(r=>r.code===codes[0]).sectors[1].fields[0];
 assert.equal(b.row.f,'3iS-Sheets');assert.equal(b.share,2/3);
});
test('sin cascada los pesos totales por tipo siguen siendo 2/3 y 1/3',()=>{
 const d=fixture();d.healthPressure.source_cascade.enabled=false;
 const fields=P.models(d).absolute.compute(state).definitions.find(s=>s.id==='vivienda').fields;
 assert.deepEqual(fields.map(f=>f.share),[1/3,1/6,1/3,1/6]);close(fields.reduce((s,f)=>s+f.share,0),1);
});
test('sin política se conserva el reparto histórico; rechaza pesos inválidos',()=>{
 const d=fixture();delete d.healthPressure.housing_weight_policy;
 assert.deepEqual(P.models(d).absolute.compute(state).definitions[1].fields.map(f=>f.share),[.5,.5]);
 for(const bad of [0,-1,NaN,Infinity,'2']){
  const invalid=fixture();invalid.healthPressure.housing_weight_policy.destroyed=bad;
  assert.throws(()=>P.models(invalid),/positivos y finitos/);
 }
});
