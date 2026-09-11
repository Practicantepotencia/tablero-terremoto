const test=require('node:test'),assert=require('node:assert/strict'),P=require('../web/priorizacion.js'),D=require('../web/denominadores.js');
const date='2026-09-09',state={scope:'all',date};
const row=(code,v,extra={})=>({geo:'municipal:'+code,code,lv:'municipal',m:code,d:'D',f:'3iS-Sheets',id:'3is_heridos',v,u:'Número',dim:'Impacto humano',i:'Heridos',date,...extra});
const denominator=(code,value,kind='poblacion',extra={})=>({code,value,kind,year:2026,unit:kind==='poblacion'?'Habitantes':'Viviendas',source:'official',reference_date:'2026-06-30',area:'Total',status:'verified',...extra});
const data=(rows,bases)=>({rows,dates:[date],latest:date,baseline:{rows:[]},population:{rows:[]},sources:{},
 denominators:{event_date:'2026-08-10',sources:{official:{url:'https://www.dane.gov.co/',published:'2025-12-24',sha256:'test-fixture'}},rows:bases}});
const rel=d=>P.create(d,undefined,{relative:true}).compute(state);
const injured=r=>r.sectors[0].fields.find(f=>f.id==='3is_heridos');
test('relativizar antes de normalizar puede invertir el orden absoluto',()=>{
 const d=data([row('05001',100),row('05002',20)],[denominator('05001',100000),denominator('05002',1000)]);
 const a=P.create(d).compute(state),r=rel(d);
 assert.equal(a.items[0].code,'05001');assert.equal(r.items[0].code,'05002');
 const f=injured(r.items.find(x=>x.code==='05001'));
 assert.equal(f.rate,10);assert.equal(f.anchor,200);assert.equal(f.score,5);
 assert.equal(injured(r.items[0]).score,100);
});
test('vivienda usa viviendas, aunque la población dé otro orden',()=>{
 const d=data([row('05001',100,{id:'3is_vivdestruidas'}),row('05002',200,{id:'3is_vivdestruidas'})],
 [denominator('05001',1000,'viviendas'),denominator('05002',10000,'viviendas'),denominator('05001',1000000),denominator('05002',1000)]);
 const result=rel(d);assert.equal(result.items[0].code,'05001');
 const f=result.items[0].sectors[1].fields[0];
 assert.equal(f.rate,10);assert.equal(f.score,100);assert.equal(f.denominator.kind,'viviendas');
});
test('ausente, cero, negativo, otro año, duplicado o sin procedencia no crea tasa ni siquiera con numerador cero',()=>{
 const variants=[[],[denominator('05001',0)],[denominator('05001',-1)],[denominator('05001',100,'poblacion',{year:2025})],
 [denominator('05001',100),denominator('05001',100)],[denominator('05001',100,'poblacion',{source:'unknown'})],
 [denominator('05001',100,'poblacion',{reference_date:'2026-09-01'})],[denominator('05001',100,'poblacion',{unit:'Sedes'})]];
 for(const bases of variants){
  const r=rel(data([row('05001',0)],bases)).missing[0];assert.equal(injured(r).rate,null);assert.equal(injured(r).score,null);
 }
});
test('cero explícito con base verificada es cero; un numerador ausente sigue ausente',()=>{
 const d=data([row('05001',0)],[denominator('05001',100)]);
 const r=rel(d).items[0];assert.equal(injured(r).rate,0);assert.equal(injured(r).score,0);
 assert.equal(r.sectors[0].fields[1].rate,null);
});
test('ni población ni bases candidatas sustituyen inventarios sin homologar',()=>{
 const d=data([row('27050',9,{id:'3is_salud'})],[denominator('27050',6532),denominator('27050',3,'sedes_ips')]);
 d.denominators.candidates=[{code:'27050',kind:'sedes_ips',value:3}];
 const r=rel(d).missing[0];assert.equal(r.sectors[2].fields[0].rate,null);assert.equal(r.sectors[2].fields[0].score,null);
 assert.match(r.sectors[2].fields[0].reason,/homologar/);
 const families=rel(data([row('05001',1,{id:'3is_familias'})],[denominator('05001',100,'hogares')]));
 assert.equal(families.items.length,0);assert.ok(families.missing[0].sectors.flatMap(s=>s.fields).every(f=>f.id!=='3is_familias'));
});
test('numerador que supera universo se rechaza en vez de truncarse',()=>{
 const d=data([row('05001',101,{id:'pnud_vd',f:'PNUD'})],[denominator('05001',100,'viviendas')]);
 const r=rel(d).missing[0],f=r.sectors[1].fields[2];
 assert.equal(f.rate,null);assert.equal(f.score,null);assert.match(f.reason,/supera/);
});
test('faltantes conservan su peso y no se convierten en ceros observados',()=>{
 const r=rel(data([row('05001',10)],[denominator('05001',100)])).items[0];
 assert.ok(Math.abs(r.sectors[0].lower-100/3)<1e-8);assert.ok(Math.abs(r.sectors[0].upper-100)<1e-8);assert.equal(r.available,1);
 assert.equal(r.sectors[2].coverage,0);assert.equal(r.sectors[2].lower,0);assert.equal(r.sectors[2].upper,100);
});
test('ámbito recalcula; búsqueda y departamento conservan referencia',()=>{
 const d=data([row('05001',100),row('05002',20,{d:'Fuera'}),row('05',1,{lv:'departamental',f:'Decreto1171',id:'en_decreto_1171',u:'Sí/No (1-0)'})],
 [denominator('05001',100000),denominator('05002',1000)]);
 const model=P.create(d,undefined,{relative:true});
 const a=model.selection(state).items.find(r=>r.code==='05001');
 const b=model.selection({...state,dept:'D',matrixSearch:'05001'}).items[0];assert.equal(a.lower,b.lower);assert.equal(a.rank,b.rank);
 const c=model.selection({...state,scope:'decree'}).items.find(r=>r.code==='05001');assert.ok(c.lower>a.lower);
});
test('los 16 campos activos tienen decisión explícita; solo siete están habilitados',()=>{
 const ids=P.SECTORS.flatMap(s=>s.fields).map(f=>f.id).sort();
 assert.equal(ids.length,16);assert.ok(ids.every(id=>D.RULES[id]));
 assert.equal(Object.values(D.RULES).filter(r=>r.enabled).length,7);
});
test('población antigua sin registro verificado no sirve de fallback',()=>{
 const d=data([row('05001',1)],[]);d.population.rows=[{code:'05001',year:2026,population:1000}];
 assert.equal(rel(d).missing.length,1);
});
