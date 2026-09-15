'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ML=require('../scripts/ml_salud.cjs');
const input=JSON.parse(fs.readFileSync(path.join(__dirname,'../experimentos/ml_salud/entrada.json'),'utf8'));
const saved=JSON.parse(fs.readFileSync(path.join(__dirname,'../experimentos/ml_salud/resultados.json'),'utf8'));
test('Solución lineal y modelos con respuesta analítica conocida',()=>{
 assert.ok(Math.abs(ML.solve([[2,1],[1,3]],[5,7])[0]-1.6)<1e-9);
 assert.ok(Math.abs(Math.exp(ML.poisson([[0],[0],[0]],[2,4,6]).beta[0])-4)<1e-9);
 const X=Array.from({length:100},(_,i)=>[(i-50)/30]),y=X.map(x=>Math.exp(.3+.7*x[0])),m=ML.poisson(X,y,0);
 assert.ok(Math.abs(m.beta[0]-.3)<1e-6&&Math.abs(m.beta[1]-.7)<1e-6);
});
test('Boosting recupera un escalón conocido',()=>{
 const x=Array.from({length:100},(_,i)=>[i]),y=x.map(r=>r[0]<50?2:20);
 const m=ML.boost(x,y,{rounds:100,depth:1,minLeaf:5,bins:99});
 const p=x=>Math.expm1(m.base+m.rate*m.trees.reduce((s,t)=>s+ML.treeValue(t,[x]),0));
 assert.ok(Math.abs(p(10)-2)<.1&&Math.abs(p(90)-20)<.3);
});
test('Métricas reproducen cálculos sencillos',()=>{
 assert.equal(ML.metrics([1,3,9],[1,3,9]).r2,1);
 assert.equal(ML.metrics([1,5,9],[2,3,12]).mae,2);
 assert.ok(Math.abs(ML.metrics([1,100],[2,200]).mean_absolute_log_error-Math.log(2))<1e-12);
});
test('Particiones departamentales exhaustivas, sin mezcla',()=>{
 const f=ML.folds(input.rows,5),d=f.flatMap(s=>s.departments);
 assert.equal(new Set(d).size,d.length);
 assert.equal(f.reduce((s,x)=>s+x.rows.length,0),input.rows.length);
 for(const fold of f){
  const training=input.rows.filter(r=>!fold.departments.includes(r.department));
  assert.ok(fold.rows.every(r=>!training.some(t=>t.department===r.department)));
 }
});
test('Etiquetas y casos faltantes nunca entran como predictores objetivo',()=>{
 for(const t of [0,1,2]){
  const r=input.rows.find(r=>r.capacity_2022[t]>0),changed={...r,capacity_2022:[...r.capacity_2022]};
  changed.capacity_2022[t]=999999;
  assert.deepEqual(ML.rawFeatures(r,t,true),ML.rawFeatures(changed,t,true));
 }
 const rows=input.rows.filter(r=>r.capacity_2022[0]>0).slice(0,100);
 for(const c of ML.candidates){
  const model=ML.train(rows,0,c),r=rows[0],changed={...r,capacity_2022:[999999,...r.capacity_2022.slice(1)]};
  assert.equal(ML.predict(model,r),ML.predict(model,changed));
 }
 assert.throws(()=>ML.train([{...rows[0],capacity_2022:[null,1,1]}],0,ML.candidates[0]));
});
test('Preprocesamiento usa únicamente el conjunto entregado como entrenamiento',()=>{
 const rows=input.rows.filter(r=>r.capacity_2022[0]>0).slice(0,20);
 const before=ML.preprocess(rows,0,true);
 const heldOut={...input.rows[21],population_2026:1e20};
 ML.transform(heldOut,0,true,before);
 assert.deepEqual(before,ML.preprocess(rows,0,true));
});
test('Predicciones guardadas: una por observado; abstenciones y soporte explícitos',()=>{
 for(const r of saved.results){
  assert.equal(r.oof.length,r.train_n);
  assert.equal(new Set(r.oof.map(o=>o.code)).size,r.train_n);
  assert.ok(r.predictions.every(p=>!r.oof.some(o=>o.code===p.code)));
  assert.ok(r.predictions.every(p=>p.exploratory_supported||p.released_estimate===null));
  assert.ok([...r.oof,...r.predictions].every(p=>Number.isFinite(p.predicted)&&p.predicted>=1));
  assert.ok(r.folds.every(f=>f.converged!==false));
 }
});
test('Experimento de urgencias exactamente reproducible, entradas inmutables',()=>{
 const before=JSON.stringify(input);
 const rerun=ML.finishResult(ML.evaluateTarget(input,1));
 assert.deepEqual(rerun,saved.results[1]);
 assert.equal(JSON.stringify(input),before);
});
