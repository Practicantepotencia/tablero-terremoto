const test=require('node:test'),assert=require('node:assert/strict');
const P=require('../web/priorizacion.js'),stock=require('../data/denominadores_sectoriales.json');
const date='2026-09-11',state={scope:'all',date,severity:'total'};
const codes=['27050','27660'];
function fixture(){
 const denominators=JSON.parse(JSON.stringify(stock)),v=denominators.health_variant;
 const template=denominators.rows.find(r=>r.kind===v.kind);
 denominators.rows=denominators.rows.filter(r=>r.kind!==v.kind).concat(codes.map(code=>({...template,code,value:2})));
 const rows=codes.flatMap((code,i)=>P.SECTORS.flatMap(s=>s.fields.map(f=>({
   geo:'municipal:'+code,code,lv:'municipal',m:code,d:'Chocó',f:f.source,id:f.id,
   v:f.id==='pnud_csalud'?(i+1)*4:f.id==='3is_salud'?999:0,u:'Número',dim:s.name,i:f.label,date
 }))));
 return {rows,latest:date,dates:[date],sources:{},baseline:{rows:codes.map(code=>({code,v:20}))},
 population:{rows:codes.map(code=>({code,year:2026,population:1000}))},denominators};
}
const calc=d=>P.create(d,undefined,{mode:'sectorial'}).compute(state);
const health=(r,code=codes[0])=>r.all.find(x=>x.code===code).sectors.find(s=>s.id==='salud');
test('Salud sectorial contiene exclusivamente PNUD con peso 1 y máximo PNUD',()=>{
 const r=calc(fixture()),h=health(r);
 assert.deepEqual(h.fields.map(f=>[f.id,f.source,f.share]),[['pnud_csalud','PNUD',1]]);
 assert.equal(h.fields[0].rate,2);assert.equal(h.fields[0].anchor,4);
 assert.equal(h.lower,50);assert.equal(h.upper,50);assert.equal(h.coverage,1);
 assert.equal(r.fieldCount,15);
 assert.ok(!r.calibrations.some(c=>c.id==='3is_salud'));
});
test('cambiar o retirar 3iS Salud no cambia el cálculo sectorial',()=>{
 const d=fixture(),reference=calc(d),changed=fixture();
 changed.rows=changed.rows.filter(r=>r.id!=='3is_salud');
 const alternative=calc(changed);
 for(const r of reference.all){
   const a=alternative.all.find(x=>x.geo===r.geo);
   assert.deepEqual(a.sectors,r.sectors);
   for(const k of ['lower','upper','coverage','available','fieldCount'])assert.equal(a[k],r[k]);
 }
});
test('PNUD ausente no se rellena con un conteo 3iS disponible',()=>{
 const d=fixture();d.rows=d.rows.filter(r=>!(r.code===codes[0]&&r.id==='pnud_csalud'));
 const h=health(calc(d));assert.equal(h.fields[0].score,null);
 assert.equal(h.lower,0);assert.equal(h.upper,100);assert.equal(h.coverage,0);
});
test('cero PNUD válido conserva cero, incluso si 3iS reporta 999',()=>{
 const d=fixture();d.rows.find(r=>r.code===codes[0]&&r.id==='pnud_csalud').v=0;
 const h=health(calc(d));assert.equal(h.lower,0);assert.equal(h.upper,0);assert.equal(h.coverage,1);
});
test('sin denominador PNUD no se calcula Salud ni se imputa capacidad',()=>{
 const d=fixture(),kind=d.denominators.health_variant.kind;
 d.denominators.rows=d.denominators.rows.filter(r=>!(r.code===codes[0]&&r.kind===kind));
 const h=health(calc(d));assert.equal(h.fields[0].rate,null);assert.equal(h.coverage,0);
});
test('impacto grave también usa solo PNUD y ajusta el número de campos',()=>{
 const d=fixture(),r=P.create(d,undefined,{mode:'sectorial'}).compute({...state,severity:'grave'});
 assert.equal(r.fieldCount,12);assert.equal(health(r).fields.length,1);assert.equal(health(r).fields[0].share,1);
});
test('absoluto y per cápita conservan sus dos canales anteriores',()=>{
 for(const mode of ['absolute','percapita']){
  const d=fixture(),before=P.create(d,undefined,{mode}).compute(state);
  delete d.denominators.health_variant;
  const after=P.create(d,undefined,{mode}).compute(state);
  assert.deepEqual(before,after);
  assert.deepEqual(health(before).fields.map(f=>f.share),[.5,.5]);
 }
});
