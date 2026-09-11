const test=require('node:test'),assert=require('node:assert/strict');
const P=require('../web/priorizacion.js');
const date='2026-09-09';
function row(geo,f,id,v,extras={}){return {geo:'municipal:'+geo,code:geo,lv:'municipal',m:geo,d:'D',f,id,v,u:'Número',dim:'Campo',i:id,date,...extras};}
function payload(rows,baseline=[]){return {rows,baseline:{rows:baseline},latest:date,dates:[date],sources:{}};}
const state={scope:'all',date};
test('impacto humano total incluye tres entradas iguales y respeta cero y ausencia',()=>{
 const values=[2,0,8];
 const rows=P.SECTORS[0].fields.map((f,i)=>row('1',f.source,f.id,values[i]));
 const r=P.create(payload(rows)).compute(state).items[0].sectors[0];
 assert.equal(r.id,'impacto_humano');
 assert.deepEqual(r.fields.map(f=>f.share),[1/3,1/3,1/3]);
 assert.ok(Math.abs(r.lower-200/3)<1e-8);assert.ok(Math.abs(r.upper-200/3)<1e-8);
 const missing=P.create(payload(rows.filter(x=>x.id!=='3is_desaparecidos'))).compute(state).items[0].sectors[0];
 assert.ok(Math.abs(missing.lower-200/3)<1e-8);assert.ok(Math.abs(missing.upper-100)<1e-8);
});
function full(geo,value){return P.SECTORS.flatMap(s=>s.fields.map(f=>row(geo,f.source,f.id,value)));}
test('cada sector conserva su peso fijo, incluso con distinto número de variables',()=>{
 assert.equal(P.SECTORS.length,6);
 for(const s of P.SECTORS)assert.ok(Math.abs(s.fields.reduce((n,f)=>n+f.share,0)-1)<1e-10);
 assert.equal(P.SECTORS.flatMap(s=>s.fields).length,16);
});
test('normalización proporcional conserva razones, cero y faltantes',()=>{
 assert.equal(P.normalize(0,null),0);assert.equal(P.normalize(null,100),null);
 assert.equal(P.normalize(-1,100),null);assert.equal(P.normalize(1000,100),100);
 assert.ok(P.normalize(2,100)<P.normalize(50,100));
 assert.equal(P.normalize(20,100),20);
 assert.equal(P.normalize(40,100)/P.normalize(20,100),2);
 assert.ok(P.normalize(12098,43052)<P.normalize(20998,43052));
});
test('un vacío amplía el intervalo sin transferir su peso a otra variable',()=>{
 const rows=full('1',10).concat(full('2',0));
 const complete=P.create(payload(rows,[{code:'1',v:50},{code:'2',v:50}])).compute(state).items.find(r=>r.code==='1');
 const missing=P.create(payload(rows.filter(r=>!(r.code==='1'&&r.id==='3is_fallecidos')),[{code:'1',v:50},{code:'2',v:50}])).compute(state).items.find(r=>r.code==='1');
 assert.ok(complete.complete);assert.equal(complete.lower,complete.upper);
 assert.ok(missing.lower<complete.lower);assert.ok(missing.upper>=complete.lower-1e-8);
 assert.ok(missing.coverage<complete.coverage);
});
test('pobreza sola no crea daño y falta de IPM propaga límites',()=>{
 const zero=P.create(payload(full('1',0),[{code:'1',v:100}])).compute(state).items[0];
 assert.equal(zero.lower,0);assert.equal(zero.upper,0);
 const missing=P.create(payload(full('1',5))).compute(state).items[0];
 assert.ok(Math.abs(missing.lower-80)<1e-8);assert.ok(Math.abs(missing.upper-100)<1e-8);assert.equal(missing.complete,false);
});
test('RAPIDA, ExE, rescatados y costos no alteran la puntuación propia',()=>{
 const rows=full('1',5),base=payload(rows,[{code:'1',v:10}]);
 const before=P.create(base).compute(state).items[0].lower;
 const extra=[row('1','UNDP-RAPIDA','undp_rapida_recovery_needs',999,{u:'Índice'}),row('1','FundacionExe','sedes_edu_n_sedes',999999),row('1','3iS-Sheets','3is_rescatados',99999),row('1','PNUD','pnud_tot_cop',9e12,{u:'COP'})];
 assert.equal(P.create({...base,rows:rows.concat(extra)}).compute(state).items[0].lower,before);
});
test('mismo dato duplicado no vota dos veces; datos conflictivos se excluyen',()=>{
 const rows=full('1',10),base=payload(rows,[{code:'1',v:10}]);
 const a=P.create(base).compute(state).items[0];
 const b=P.create({...base,rows:rows.concat({...rows[0]})}).compute(state).items[0];
 assert.equal(a.lower,b.lower);
 const c=P.create({...base,rows:rows.concat({...rows[0],v:20})}).compute(state).items[0];
 assert.ok(c.coverage<a.coverage);
});
test('no combina unidades ni definiciones diferentes del mismo campo',()=>{
 const rows=full('1',10).concat(row('2','3iS-Sheets','3is_fallecidos',2,{u:'Personas'}));
 const p=P.create(payload(rows)).compute(state);
 assert.equal(p.calibrations.find(c=>c.id==='3is_fallecidos').coherent,false);
 assert.equal(p.items[0].sectors[0].fields[0].score,null);
});
test('decreto cambia referencia, departamento y búsqueda conservan puntajes y puestos',()=>{
 const rows=full('1',10).concat(full('2',100).map(r=>({...r,d:'Fuera'})),row('D','Decreto1171','en_decreto_1171',1,{lv:'departamental',u:'Sí/No (1-0)'}));
 const m=P.create(payload(rows));
 const a=m.selection(state).items.find(r=>r.code==='1');
 const b=m.selection({...state,dept:'D',matrixSearch:'1'}).items[0];
 const c=m.selection({...state,scope:'decree'}).items[0];
 assert.equal(a.lower,b.lower);assert.equal(a.rank,b.rank);assert.ok(c.lower>a.lower);
});
test('selector de dimensión ordena por su puntaje y conserva el puesto global',()=>{
 const rows=full('1',10).concat(full('2',10));
 rows.find(r=>r.code==='1'&&r.id==='3is_fallecidos').v=20;
 const p=P.create(payload(rows,[{code:'1',v:20},{code:'2',v:20}])).selection({...state,priorityDimension:'impacto_humano',priorityOrder:'integrated'});
 assert.deepEqual(p.items.map(r=>r.code),['1','2']);
 assert.deepEqual(p.items.map(r=>r.dimensionRank),[1,2]);
 assert.ok(p.items.every(r=>r.rank!=null));
});
test('empates comparten puesto; sensibilidad y límites incluyen el caso base',()=>{
 const p=P.create(payload(full('1',10).concat(full('2',10)),[{code:'1',v:20},{code:'2',v:20}])).compute(state);
 assert.equal(p.scenarios,39);
 for(const r of p.items){assert.equal(r.rank,1);assert.equal(r.bestRank,1);assert.equal(r.worstRank,1);assert.ok(r.rankMin<=r.rank&&r.rankMax>=r.rank);}
});
test('municipio solo ExE permanece consultable, sin un puesto global fabricado',()=>{
 const p=P.create(payload([row('1','FundacionExe','sedes_edu_n_sedes',1)])).selection(state);
 assert.equal(p.items.length,1);assert.equal(p.items[0].rank,null);assert.equal(p.items[0].coverage,0);
});
test('ejemplo calculado a mano: fallecidos conocidos y resto faltante',()=>{
 const r=P.create(payload([row('1','3iS-Sheets','3is_fallecidos',10)],[{code:'1',v:25}])).compute(state).items[0];
 assert.ok(Math.abs(r.lower-(100/18)*.85)<1e-8);
 assert.ok(Math.abs(r.upper-85)<1e-8);
 assert.ok(Math.abs(r.coverage-1/18)<1e-8);
});
test('grave cambia componentes y pesos, no duplica sectores ni pierde el total en caché',()=>{
 const rows=full('1',10).concat(full('2',100),row('1','3iS-Sheets','3is_familias',999999));
 for(const mode of ['absolute','percapita','sectorial']){
  const d=payload(rows,[{code:'1',v:20},{code:'2',v:20}]);
  d.population={rows:[{code:'1',year:2026,population:1000},{code:'2',year:2026,population:1000}]};
  const model=P.create(d,undefined,{mode}),total=model.compute(state),grave=model.compute({...state,severity:'grave'});
  assert.equal(total.fieldCount,16);assert.equal(grave.fieldCount,13);
  assert.equal(model.compute(state),total);
  assert.deepEqual(grave.definitions[0].fields.map(f=>f.id),['3is_fallecidos','3is_desaparecidos']);
  assert.deepEqual(grave.definitions[1].fields.map(f=>f.id),['3is_vivdestruidas','pnud_vd']);
  for(const s of grave.definitions){assert.ok(Math.abs(s.fields.reduce((n,f)=>n+f.share,0)-1)<1e-8);}
  for(const r of grave.all){
   const t=total.all.find(t=>t.code===r.code);
   assert.deepEqual(r.sectors.slice(2),t.sectors.slice(2));
   assert.equal(r.sectors.length,6);assert.equal(r.fieldCount,13);
   assert.ok(r.sectors.flatMap(s=>s.fields).every(f=>!['3is_familias','3is_heridos','3is_vivaveriadas','pnud_va'].includes(f.id)));
  }
 }
 assert.throws(()=>P.sectorsFor('desconocido'));
});
test('grave conserva ausencias y permite invertir el orden de humano y vivienda',()=>{
 const rows=full('1',0).concat(full('2',0));
 for(const r of rows){
  if(['3is_fallecidos','3is_desaparecidos','3is_vivdestruidas','pnud_vd'].includes(r.id))r.v=r.code==='1'?10:9;
  if(['3is_heridos','3is_vivaveriadas','pnud_va'].includes(r.id))r.v=r.code==='1'?0:100;
 }
 const model=P.create(payload(rows,[{code:'1',v:20},{code:'2',v:20}]));
 assert.equal(model.compute(state).items[0].code,'2');
 assert.equal(model.compute({...state,severity:'grave'}).items[0].code,'1');
 const missing=P.create(payload([row('1','3iS-Sheets','3is_fallecidos',5)])).compute({...state,severity:'grave'}).items[0];
 assert.equal(missing.sectors[0].lower,50);assert.equal(missing.sectors[0].upper,100);
 assert.equal(missing.available,1);assert.equal(missing.fieldCount,13);
});
