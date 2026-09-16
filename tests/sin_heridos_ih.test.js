const test=require('node:test'),assert=require('node:assert/strict');
const P=require('../web/priorizacion.js'),H=require('../web/presion_salud.js');
const date='2026-09-16',state={scope:'all',date},codes=['27050','27660'];
function fixture(mode='urgencias'){
 const kind=mode==='urgencias'?'consultorios_urgencias_reps':'camas_hospitalizacion_general_reps',unit=mode==='urgencias'?'Consultorios de urgencias':'Camas generales';
 const rows=codes.flatMap((code,i)=>['familias','fallecidos','desaparecidos','heridos'].map((id,j)=>({
 geo:'municipal:'+code,code,lv:'municipal',m:code,d:'Chocó',date,id:'3is_'+id,f:'3iS-Sheets',u:'Número',dim:'Personas',i:id,v:(i+1)*(j+1)
 })));
 return {rows,dates:[date],latest:date,baseline:{rows:codes.map(code=>({code,v:25}))},population:{rows:codes.map(code=>({code,year:2026,population:1000}))},
 denominators:{event_date:'2026-08-10',sources:{official:{url:'https://www.dane.gov.co/',sha256:'a'.repeat(64)}},rows:codes.map(code=>({code,kind:'poblacion',value:1000,year:2026,unit:'Habitantes',source:'official',reference_date:'2026-06-30',area:'Total',status:'verified'}))},
 healthPressure:{enabled:true,mode,event_date:'2026-08-10',capacity:{kind,unit,label:unit,source:{url:'https://www.datos.gov.co/resource/s2ru-bqt6.json',sha256:'a'.repeat(64)},rows:codes.map(code=>({code,kind,unit,value:2,year:2022,reference_date:'2022-11-05',status:'observed_historical'}))}}};
}
test('heridos queda fuera de Impacto humano en los tres modos y ambos escenarios',()=>{
 for(const scenario of ['urgencias','hospitalizacion']){
  const d=fixture(scenario);
  for(const mode of ['absolute','percapita','sectorial']){
   const r=P.models(d)[mode].compute(state).all[0],s=r.sectors[0];
   assert.deepEqual(s.fields.map(f=>f.id),['3is_familias','3is_fallecidos','3is_desaparecidos']);
   assert.ok(s.fields.every(f=>f.share===1/3));
   assert.equal(r.fieldCount,mode==='sectorial'?13:14);
   const expected=s.fields.reduce((n,f)=>n+(f.score??0)/3,0);
   assert.ok(Math.abs(s.lower-expected)<1e-10);
  }
  const before=P.models(d).sectorial.compute(state);
  const changed=structuredClone(d);changed.rows.find(r=>r.code==='27050'&&r.id==='3is_heridos').v=0;
  const after=P.models(changed).sectorial.compute(state);
  for(const r of before.all){
   const other=after.all.find(x=>x.code===r.code);
   for(let i=0;i<5;i++)if(i!==2)assert.deepEqual(r.sectors[i],other.sectors[i]);
  }
  const health=after.all.find(r=>r.code==='27050').sectors[2].fields[0];
  assert.equal(health.id,H.ID);assert.equal(health.score,0);assert.equal(health.share,1);
  // Place metadata retains the original last raw observation, including v.
  // Compare every calculated output while excluding only that raw metadata value.
  const scores=result=>({...result,...Object.fromEntries(['items','all','missing'].map(k=>[k,result[k].map(({v,...r})=>r)]))});
  for(const mode of ['absolute','percapita'])assert.deepEqual(scores(P.models(d)[mode].compute(state)),scores(P.models(changed)[mode].compute(state)));
 }
});
test('un reporte solo de heridos no crea evidencia en Impacto humano',()=>{
 const d=fixture();d.rows=d.rows.filter(r=>r.id==='3is_heridos');
 for(const mode of ['absolute','percapita','sectorial']){
  const result=P.models(d)[mode].compute(state);
  for(const r of result.all){assert.equal(r.sectors[0].coverage,0);assert.equal(r.sectors[0].lower,0);assert.ok(Math.abs(r.sectors[0].upper-100)<1e-8);}
  assert.equal(result.items.length,mode==='sectorial'?2:0);
 }
});
test('faltante conserva su tercio y un cero explícito no es un faltante',()=>{
 const d=fixture();d.rows=d.rows.filter(r=>r.code==='27050'&&r.id!=='3is_desaparecidos');
 d.rows.find(r=>r.id==='3is_fallecidos').v=0;
 const s=P.models(d).absolute.compute(state).all[0].sectors[0];
 assert.ok(Math.abs(s.lower-100/3)<1e-10);assert.ok(Math.abs(s.upper-200/3)<1e-10);
 assert.ok(Math.abs(s.coverage-2/3)<1e-10);
});
