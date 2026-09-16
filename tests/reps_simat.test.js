const test=require('node:test'),assert=require('node:assert/strict');
const P=require('../web/priorizacion.js'),D=require('../web/denominadores.js');
const date='2026-09-16';
const row=(id='pnud_csalud',v=9)=>({geo:'municipal:27050',code:'27050',lv:'municipal',m:'Atrato',d:'Chocó',date,id,f:id.startsWith('pnud_')?'PNUD':'3iS-Sheets',u:'Número',dim:'Sector',i:id,v});
function data(){
 const catalog={sedes_ips:{year:2026,unit:'Sedes IPS',source:'reps',reference_date:'2026-03-12',label:'REPS'},
 sedes_educativas:{year:2022,unit:'Sedes educativas',source:'men',reference_date:'2022-12-31',label:'MEN/SIMAT'}};
 const proxy={enabled:true,catalog,sources:{reps:{url:'https://www.datos.gov.co/d/c36g-9fc2',sha256:'a'.repeat(64)},men:{url:'https://portalsineb.mineducacion.gov.co/',sha256:'b'.repeat(64)}},
 rows:Object.entries(catalog).map(([kind,c])=>({...c,kind,code:'27050',value:kind==='sedes_ips'?3:30,area:'Total',status:'observed_registry_proxy'}))};
 return {rows:[row(),row('3is_salud'),row('pnud_cedu',6),row('3is_educativos',6)],dates:[date],latest:date,baseline:{rows:[]},population:{rows:[{code:'27050',year:2026,population:10000}]},denominators:{event_date:'2026-08-10',rows:[],sources:{},registry_proxies:proxy}};
}
test('cinco dimensiones y catorce campos; pesos internos suman uno',()=>{
 assert.equal(P.SECTORS.length,5);assert.equal(P.FIELD_COUNT,14);assert.ok(!P.SECTORS.some(s=>s.id==='comunidad'));
 for(const s of P.SECTORS)assert.ok(Math.abs(s.fields.reduce((n,f)=>n+f.share,0)-1)<1e-12);
});
test('Atrato 9/3 = 3 se conserva, sin ML y sin tratarlo como porcentaje',()=>{
 const d=data(),m=D.create(d).measure(row(),'pnud_csalud','27050',date);
 assert.equal(m.rate,3);assert.equal(m.multiplier,1);assert.equal(m.exceedsRegistry,true);assert.equal(m.registryProxy,true);
 assert.equal(m.denominator.value,3);assert.match(m.proxyNote,/no porcentaje/);
 assert.equal(m.denominator.status,'observed_registry_proxy');
});
test('educación divide por sedes 2022, no por alumnos ni población',()=>{
 const m=D.create(data()).measure(row('pnud_cedu',6),'pnud_cedu','27050',date);
 assert.equal(m.rate,.2);assert.equal(m.denominator.year,2022);assert.equal(m.relativeKind,'sedes_educativas');
});
test('cero explícito solo es cero con denominador válido; desconocido sigue nulo',()=>{
 const d=data();assert.equal(D.create(d).measure(row('pnud_csalud',0),'pnud_csalud','27050',date).rate,0);
 assert.equal(D.create(d).measure(null,'pnud_csalud','27050',date).rate,null);
 d.denominators.registry_proxies.rows=[];
 assert.equal(D.create(d).measure(row('pnud_csalud',0),'pnud_csalud','27050',date).rate,null);
});
test('rechaza inventarios duplicados, ML, cero, negativos, fraccionarios o sin procedencia',()=>{
 for(const mutate of [
  p=>p.rows.push({...p.rows[0]}),p=>p.rows[0].status='estimated',p=>p.rows[0].value=0,
  p=>p.rows[0].value=-1,p=>p.rows[0].value=1.5,p=>p.sources.reps.sha256='',
  p=>p.rows[0].reference_date='2026-09-01',p=>p.rows[0].unit='Consultorios',
  p=>p.rows[0].year=2025,p=>p.rows[0].area='Rural',p=>p.rows[0].code='27001']){
  const d=data();mutate(d.denominators.registry_proxies);
  assert.equal(D.create(d).measure(row(),'pnud_csalud','27050',date).rate,null);
 }
 for(const bad of [{f:'Naboo'},{id:'pnud_vd'},{u:'Porcentaje'},{v:NaN},{v:-1}])
  assert.equal(D.create(data()).measure({...row(),...bad},'pnud_csalud','27050',date).rate,null);
});
test('inventarios solo cambian relativo; absoluto y per cápita no se alteran',()=>{
 const d=data(),before=structuredClone(d);delete before.denominators.registry_proxies;
 for(const mode of ['absolute','percapita'])
  assert.deepEqual(P.create(d,undefined,{mode}).compute({scope:'all',date}),P.create(before,undefined,{mode}).compute({scope:'all',date}));
 const r=P.models(d).sectorial.compute({scope:'all',date}).items[0];
 assert.equal(r.available,4);assert.equal(r.fieldCount,14);assert.equal(r.sectors[2].lower,100);assert.equal(r.sectors[3].lower,100);
 assert.equal(r.coverage,.4);assert.equal(r.damageLower,40);
 assert.equal(r.sectors[4].coverage,0);
});
test('ausencia del escenario mantiene las reglas de main sin fallback a candidatos',()=>{
 const d=data();delete d.denominators.registry_proxies;
 assert.equal(D.create(d).measure(row(),'pnud_csalud','27050',date).rate,null);
});
test('radares usan cinco ángulos uniformes en ambas coordenadas',()=>{
 const fs=require('node:fs'),s=fs.readFileSync(require('node:path').join(__dirname,'../web/radar.js'),'utf8');
 assert.ok(!s.includes('Math.PI/3'));assert.ok(s.includes('Math.sin(-Math.PI/2+i*2*Math.PI/Priorizacion.SECTORS.length)'));
});
