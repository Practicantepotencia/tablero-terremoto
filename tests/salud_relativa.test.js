
const test=require('node:test'),assert=require('node:assert/strict');
const D=require('../web/denominadores.js'),data=require('../data/denominadores_sectoriales.json');
const {aggregateReps}=require('../scripts/preparar_salud_relativa.cjs');
const date='2026-09-11';
function fixture(){
 const p=JSON.parse(JSON.stringify(data)),v=p.health_variant;
 p.rows=p.rows.filter(r=>r.kind!==v.kind);
 p.rows.push({code:'27050',year:2022,kind:v.kind,value:2,
 unit:{consulta_externa:'Consultorios de consulta externa',urgencias:'Consultorios de urgencias',hospitalizacion:'Camas generales adultas y pediátricas'}[v.id],
 source:'reps_capacity_2022',reference_date:'2022-11-05',area:'Total',status:'verified_historical'});
 return {denominators:p};
}
const numerator=(v=9,id='3is_salud')=>({id,v,u:'Número'});
test('presión histórica permite cociente mayor que uno; no es porcentaje',()=>{
 const r=D.create(fixture()).measure(numerator(),'3is_salud','27050',date);
 assert.equal(r.rate,4.5);assert.equal(r.multiplier,1);assert.equal(r.denominator.year,2022);assert.ok(!r.relativeUnit.includes('%'));
});
test('ambas fuentes usan la misma base sin sumar sus conteos',()=>{
 const m=D.create(fixture());assert.equal(m.measure(numerator(9,'pnud_csalud'),'pnud_csalud','27050',date).rate,4.5);
});
test('cero explícito se conserva; ausencia de conteo o denominador es null',()=>{
 const m=D.create(fixture());
 assert.equal(m.measure(numerator(0),'3is_salud','27050',date).rate,0);
 assert.equal(m.measure(null,'3is_salud','27050',date).rate,null);
 assert.equal(m.measure(numerator(),'3is_salud','27660',date).rate,null);
});
test('no divide entre denominadores inválidos ni ambiguos',()=>{
 for(const value of [0,-1,null,Infinity]){
 const x=fixture();x.denominators.rows.at(-1).value=value;
 assert.equal(D.create(x).measure(numerator(),'3is_salud','27050',date).rate,null);
 }
 const x=fixture();x.denominators.rows.push({...x.denominators.rows.at(-1)});
 assert.equal(D.create(x).measure(numerator(),'3is_salud','27050',date).rate,null);
});
test('rechaza año falso, fecha postevento, otra unidad, estado candidato o fuente sin hash',()=>{
 for(const field of ['future','unit','checksum','status','year','reference']){
 const x=fixture(),d=x.denominators.rows.at(-1),s=x.denominators.sources.reps_capacity_2022;
 if(field==='future')s.published='2026-09-01';
 if(field==='unit')d.unit='Habitantes';
 if(field==='checksum')s.sha256='';
 if(field==='status')d.status='candidate';
 if(field==='year')d.year=2026;
 if(field==='reference')d.reference_date='2026-06-30';
 assert.equal(D.create(x).measure(numerator(),'3is_salud','27050',date).rate,null);
 }
});
test('rechaza numeradores incompatibles y modo no validado',()=>{
 for(const r of [numerator(-1),{...numerator(),u:'Porcentaje'},{...numerator(),id:'3is_educativos'}])
 assert.equal(D.create(fixture()).measure(r,'3is_salud','27050',date).rate,null);
 const x=fixture();x.denominators.health_variant.mode='fraction_lost';
 assert.equal(D.create(x).measure(numerator(),'3is_salud','27050',date).rate,null);
});
test('bases reales únicas, positivas e identificadas como históricas',()=>{
 const rs=data.rows.filter(r=>r.kind===data.health_variant.kind);
 assert.ok(rs.length>0);assert.equal(new Set(rs.map(r=>r.code)).size,rs.length);
 assert.ok(rs.every(r=>r.value>0&&r.year===2022&&r.reference_date==='2022-11-05'&&r.status==='verified_historical'));
 assert.equal(data.sources.reps_capacity_2022.mirror_commit,'95f33af6ab50e09bef92bb7872eb7246b3c23529');
});
test('agregación usa municipio de la sede, no municipio de casa matriz; deduplica copias',()=>{
 const config={id:'consulta_externa',group:'CONSULTORIOS',descriptions:['Consulta Externa'],kind:'consultorios_externos_reps',unit:'Consultorios de consulta externa'};
 const row={'Código prestador':'2700100001','Código sede':'2705000001','Número sede':'01',Departamento:'Chocó',Municipio:'ATRATO','nom grupo capacidad ':'CONSULTORIOS','nom descripcion capacidad ':'Consulta Externa','num cantidad capacidad instalada':'2','Fecha Corte':'Fecha corte REPS: Nov  5 2022  1:37PM'};
 const pop=[{code:'27050',d:'Chocó',m:'Atrato'}];
 const clean=aggregateReps([row,{...row}],pop,config);assert.equal(clean.rows[0].code,'27050');assert.equal(clean.rows[0].value,2);assert.equal(clean.duplicates.length,1);
 const conflict=aggregateReps([row,{...row,'num cantidad capacidad instalada':'3'}],pop,config);
 assert.equal(conflict.rows.length,0);assert.equal(conflict.invalid_codes[0],'27050');
 const wrong=aggregateReps([{...row,Municipio:'Quibdó'}],pop,config);
 assert.equal(wrong.rows.length,0);
});
