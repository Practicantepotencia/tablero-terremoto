const test=require('node:test'),assert=require('node:assert/strict'),P=require('../web/priorizacion.js');
const date='2026-09-09',state={scope:'all',date};
const row=(code,v,extra={})=>({geo:'municipal:'+code,code,lv:'municipal',m:code,d:'D',f:'3iS-Sheets',id:'3is_familias',v,u:'Número',dim:'Impacto humano',i:'Familias',date,...extra});
const data=(rows,pop)=>({rows,dates:[date],latest:date,baseline:{rows:[]},population:{rows:pop},sources:{}});
const pop=(code,n,year=2026)=>({code,population:n,year});
test('relativizar antes de normalizar puede invertir el orden absoluto',()=>{
 const d=data([row('1',100),row('2',20)],[pop('1',100000),pop('2',1000)]);
 const absolute=P.create(d).compute(state),relative=P.create(d,undefined,{relative:true}).compute(state);
 assert.equal(absolute.items[0].code,'1');assert.equal(relative.items[0].code,'2');
 const f=relative.items.find(r=>r.code==='1').sectors[0].fields[0];
 assert.equal(f.row.v,100);assert.equal(f.rate,10);assert.equal(f.anchor,200);assert.equal(f.score,5);
 assert.equal(relative.items[0].sectors[0].fields[0].score,100);
 assert.equal(P.create(d).compute(state).items[0].lower,absolute.items[0].lower);
});
test('denominador ausente, cero, negativo, de otro año o duplicado no crea tasa',()=>{
 for(const populations of [[],[pop('1',0)],[pop('1',-10)],[pop('1',100,2025)],[pop('1',100),pop('1',100)]]){
  const r=P.create(data([row('1',0)],populations),undefined,{relative:true}).compute(state).missing[0];
  assert.equal(r.sectors[0].fields[0].score,null);assert.equal(r.sectors[0].fields[0].rate,null);assert.equal(r.coverage,0);
 }
});
test('cero explícito con población válida es tasa cero y no dato ausente',()=>{
 const r=P.create(data([row('1',0)],[pop('1',100)]),undefined,{relative:true}).compute(state).items[0];
 assert.equal(r.sectors[0].fields[0].rate,0);assert.equal(r.sectors[0].fields[0].score,0);
});
test('referencia relativa cambia por ámbito, no por búsqueda ni departamento',()=>{
 const d=data([row('1',100),row('2',20,{d:'Fuera'}),row('D',1,{lv:'departamental',f:'Decreto1171',id:'en_decreto_1171',u:'Sí/No (1-0)'})],[pop('1',100000),pop('2',1000)]);
 const model=P.create(d,undefined,{relative:true});
 const a=model.selection(state).items.find(r=>r.code==='1');
 const b=model.selection({...state,dept:'D',matrixSearch:'1'}).items[0];
 assert.equal(a.lower,b.lower);assert.equal(a.rank,b.rank);
 const c=model.selection({...state,scope:'decree'}).items.find(r=>r.code==='1');
 assert.ok(c.lower>a.lower);
});
