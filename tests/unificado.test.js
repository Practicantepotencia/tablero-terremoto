const test=require('node:test'),assert=require('node:assert/strict');
const P=require('../web/priorizacion.js'),T=require('../web/modelo.js'),C=require('../web/comparacion.js');
const date='2026-09-09',state={date,scope:'all'};
const row=(code,v,extra={})=>({geo:'municipal:'+code,code,lv:'municipal',m:code,d:'D',date,id:'3is_heridos',f:'3iS-Sheets',u:'Número',dim:'Personas',i:'Heridos',v,...extra});
const data=()=>({rows:[row('1',100),row('2',20),row('3',0)],population:{rows:[{code:'1',year:2026,population:100000},{code:'2',year:2026,population:1000}]},baseline:{rows:[]}});
test('tres modos separados: absoluto, tasas poblacionales y denominadores homologados',()=>{
 const d=data(),models=P.models(d);
 assert.equal(models,P.models(d));
 assert.equal(models.absolute.compute(state).items[0].code,'1');
 const p=models.percapita.compute(state);assert.equal(p.items[0].code,'2');
 const a=p.items.find(r=>r.code==='1').sectors[0].fields[3];
 assert.equal(a.rate,10);assert.equal(a.anchor,200);assert.equal(a.score,5);
 assert.equal(p.missing[0].code,'3'); // zero without population is unknown
 assert.equal(models.sectorial.compute(state).items.length,0); // no compatible verified registry
 assert.throws(()=>P.create(d,undefined,{mode:'other'}));
});
test('per cápita no inventa bases ausentes, duplicadas, negativas ni de otro año',()=>{
 for(const rows of [[],[{code:'1',year:2025,population:100}],[{code:'1',year:2026,population:0}],[{code:'1',year:2026,population:-1}],[{code:'1',year:2026,population:10},{code:'1',year:2026,population:10}]]){
  const d=data();d.population.rows=rows;
  assert.equal(P.models(d).percapita.compute(state).items.length,0);
 }
 const d=data();d.rows=[row('1',0)];
 assert.equal(P.models(d).percapita.compute(state).items[0].sectors[0].fields[3].score,0);
});
test('regresión con intercepto y signo: R² no pierde la dirección de Pearson visible',()=>{
 const s=C.statistics([{x:1,y:7},{x:2,y:5},{x:3,y:3},{x:4,y:1}]);
 assert.equal(s.regression.r,-1);assert.equal(s.regression.r2,1);assert.equal(s.rho,-1);
 assert.equal(s.regression.slope,-2);assert.equal(s.regression.intercept,9);
 const p=C.statistics([{x:1,y:1},{x:2,y:3},{x:3,y:2},{x:4,y:4}]);
 assert.ok(Math.abs(p.regression.r-.8)<1e-12);assert.ok(Math.abs(p.regression.r2-.64)<1e-12);
 const ys=[1,3,2,4],sse=ys.reduce((s,y,i)=>s+(y-(p.regression.intercept+p.regression.slope*(i+1)))**2,0);
 assert.ok(Math.abs(1-sse/5-p.regression.r2)<1e-12);
});
test('Spearman usa rangos promedio en empates',()=>{
 assert.deepEqual(C.midranks([10,20,20,40]),[1,2.5,2.5,4]);
 const s=C.statistics([{x:10,y:1},{x:20,y:2},{x:20,y:3},{x:40,y:4}]);
 assert.ok(Math.abs(s.rho-Math.sqrt(.9))<1e-12);
});
test('sin pares, dos puntos y varianza nula no producen R² espurio',()=>{
 for(const pairs of [[],[{x:1,y:1}],[{x:1,y:1},{x:2,y:2}],[{x:1,y:2},{x:1,y:3},{x:1,y:4}],[{x:1,y:2},{x:2,y:2},{x:3,y:2}]]){
  assert.equal(C.statistics(pairs).regression,null);assert.equal(C.statistics(pairs).rho,null);
 }
});
function fixture(){
 const places=['a','b','c','d','e'].map((geo,i)=>({geo,m:geo,d:i<2?'D':'Otro',lv:'municipal'}));
 const rows=places.slice(0,4).map((r,i)=>({...r,date,f:T.RAPIDA,id:T.RECOVERY,u:'Índice',i:'Recuperación',v:[1,.8,.8,0][i]}));
 const territorial=T.create({rows});
 const values={absolute:[10,20,30,0,50],percapita:[40,30,20,0,10],sectorial:[4,3,null,0,1]};
 const models=Object.fromEntries(C.MODES.map(mode=>[mode,{compute:()=>({all:places,referenceN:5,items:places.flatMap((r,i)=>values[mode][i]==null?[]:[{...r,lower:values[mode][i],upper:values[mode][i]+5,rank:i+1,coverage:.5,available:7}])})}]));
 return {models,territorial};
}
test('panel común fijo, ceros válidos incluidos, exclusiones contadas y puestos con empates',()=>{
 const {models,territorial}=fixture(),results=C.MODES.map(mode=>C.compare(models,territorial,state,{mode}));
 for(const c of results){
  assert.deepEqual(c.pairs.map(r=>r.geo),['a','b','d']);
  assert.equal(c.pairs[2].y,4);assert.equal(c.pairs[2].recovery,0);
  assert.equal(c.pairs.length+Object.values(c.excluded).reduce((s,v)=>s+v,0),c.total);
 }
 const all=C.compare(models,territorial,state,{panel:'available'});
 assert.deepEqual(all.pairs.map(r=>r.recoveryRank),[1,2,2,4]);assert.equal(all.n,4);
 assert.equal(C.compare(models,territorial,state,{axis:'value'}).pairs[0].y,1);
});
test('departamento reduce pares pero no cambia puntajes ni puestos del ámbito; búsqueda no entra',()=>{
 const {models,territorial}=fixture(),all=C.compare(models,territorial,state,{panel:'available'});
 const sub=C.compare(models,territorial,{...state,dept:'Otro',matrixSearch:'zz'},{panel:'available'});
 assert.equal(sub.n,2);assert.equal(sub.regression,null);
 for(const r of sub.pairs){const a=all.pairs.find(x=>x.geo===r.geo);assert.equal(r.x,a.x);assert.equal(r.recoveryRank,a.recoveryRank);}
});
test('RAPIDA conflictivo no crea pares ni duplicación; definiciones mixtas quedan excluidas',()=>{
 const {models}=fixture();
 const rows=[row('a',1,{geo:'a',f:T.RAPIDA,id:T.RECOVERY}),row('a',2,{geo:'a',f:T.RAPIDA,id:T.RECOVERY})];
 assert.equal(C.compare(models,T.create({rows}),state).n,0);
 rows[1].v=1;assert.equal(C.compare(models,T.create({rows}),state).n,1);
 rows[1].u='COP';assert.equal(C.compare(models,T.create({rows}),state).n,0);
});
