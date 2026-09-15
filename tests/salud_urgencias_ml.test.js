'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const D=require('../web/denominadores.js'),P=require('../web/priorizacion.js');
const stock=require('../data/denominadores_sectoriales.json');
const row={id:'pnud_csalud',u:'Número',v:9},date='2026-09-11',code='27050';
const clone=()=>JSON.parse(JSON.stringify(stock));
const measure=d=>D.create({denominators:d}).measure(row,'pnud_csalud',code,date);
test('203 estimaciones separadas de los 901 observados de urgencias',()=>{
 assert.equal(stock.health_imputations.length,203);
 assert.equal(stock.rows.filter(r=>r.kind==='consultorios_urgencias_reps').length,901);
 assert.ok(stock.rows.every(r=>r.status!=='estimated_ml'));
 assert.equal(stock.health_imputation_audit.abstained,18);
});
test('Atrato: 9 puntos / 1 consultorio estimado = 9; nunca porcentaje',()=>{
 const f=measure(clone());assert.equal(f.rate,9);assert.equal(f.estimated,true);
 assert.equal(f.denominator.status,'estimated_ml');assert.equal(f.multiplier,1);
 assert.ok(!f.relativeUnit.includes('%'));
});
test('ML requiere opt-in explícito y no rellena el numerador ni 3iS',()=>{
 const d=clone();d.health_variant.ml.enabled=false;assert.equal(measure(d).rate,null);
 const m=D.create({denominators:clone()});
 assert.equal(m.measure(null,'pnud_csalud',code,date).rate,null);
 assert.equal(m.measure({...row,id:'3is_salud'},'3is_salud',code,date).rate,null);
 assert.equal(m.measure({...row,v:0},'pnud_csalud',code,date).rate,0);
});
test('Dato observado siempre tiene precedencia y no se sustituye si es inválido',()=>{
 for(const value of [2,0,-1]){
  const d=clone(),r={...d.rows.find(x=>x.kind===d.health_variant.kind),code,value};
  d.rows.push(r);const f=measure(d);
  assert.equal(f.rate,value===2?4.5:null);assert.ok(!f.estimated);
 }
 const d=clone(),r={...d.rows.find(x=>x.kind===d.health_variant.kind),code,value:2};
 d.rows.push(r,{...r});assert.equal(measure(d).rate,null);
});
test('No acepta estimaciones fuera de soporte, unidades, modelo o procedencia',()=>{
 for(const kind of ['zero','fraction','negative','nan','support','range','unit','status','model','date','sha']){
  const d=clone(),r=d.health_imputations.find(x=>x.code===code);
  if(kind==='zero')r.value=0;if(kind==='fraction')r.value=.5;if(kind==='negative')r.value=-1;if(kind==='nan')r.value=Infinity;
  if(kind==='support')r.support_n=29;if(kind==='range')r.out_of_range=true;
  if(kind==='unit')r.unit='Habitantes';if(kind==='status')r.status='verified_historical';
  if(kind==='model')r.model_id='otro';if(kind==='date')r.estimated_at='2020-01-01';
  if(kind==='sha')d.sources[r.source].artifact_blob_sha='';
  assert.equal(measure(d).rate,null,kind);
 }
 const d=clone();d.health_imputations.push({...d.health_imputations.find(r=>r.code===code)});
 assert.equal(measure(d).rate,null);
});
test('Modelo de 2026 no se extiende silenciosamente a otro año',()=>{
 const m=D.create({denominators:clone()});
 assert.equal(m.measure(row,'pnud_csalud',code,'2027-09-11').rate,null);
});
test('Muestra sintética: máximo, puntaje, aporte y cobertura ML trazables',()=>{
 const codes=[code,'76828'],d=clone(),date='2026-09-11';
 const rows=codes.map((code,i)=>({geo:'municipal:'+code,code,m:code,d:'Chocó',lv:'municipal',date,f:'PNUD',id:'pnud_csalud',u:'Número',v:i?16:9,dim:'Salud',i:'Centros de salud'}));
 const payload={rows,dates:[date],latest:date,baseline:{rows:codes.map(code=>({code,v:20}))},population:{rows:[]},denominators:d};
 const r=P.create(payload,undefined,{mode:'sectorial'}).compute({scope:'all',date}),atrato=r.all.find(r=>r.code===code),f=atrato.sectors[2].fields[0];
 assert.equal(f.anchor,16);assert.equal(f.score,56.25);assert.equal(f.share,1);
 assert.equal(atrato.imputedAvailable,1);assert.equal(atrato.observedAvailable,0);
 assert.equal(atrato.observedCoverage,0);assert.equal(atrato.mlScenario,true);
 assert.ok(Math.abs(atrato.lower-7.875)<1e-12);
});
