'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const V=require('../web/validacion_ml_core.cjs');
const root=path.resolve(__dirname,'..');
const rows=V.fromCSV(fs.readFileSync(path.join(root,'experimentos/ml_salud/validacion.csv'),'utf8'));
const report=JSON.parse(fs.readFileSync(path.join(root,'experimentos/ml_salud/resultados.json'),'utf8'));
test('Parsea CSV citado y mantiene DIVIPOLA',()=>{
 assert.equal(rows.length,2817);assert.ok(rows.some(r=>r.code==='05001'));
 assert.deepEqual(V.csvParse('a,"b,c","d""e"\r\n1,"x\ny",3\n'),[['a','b,c','d"e'],['1','x\ny','3']]);
 assert.throws(()=>V.fromCSV('columna_incorrecta\n1'));
});
test('Métricas reproducen el experimento y bandas no duplican municipios',()=>{
 for(const result of report.results){
  const data=rows.filter(r=>r.target===result.target.id),m=V.metrics(data);
  assert.ok(Math.abs(m.mae-result.metrics.mae)<1e-10);
  assert.ok(Math.abs(m.r2-result.metrics.r2)<1e-10);
  assert.equal(V.distribution(data).reduce((s,b)=>s+b.n,0),data.length);
  assert.equal(V.sizeGroups(data).reduce((s,b)=>s+b.n,0),data.length);
 }
});
test('R2 indefinido, vacíos y búsquedas',()=>{
 assert.equal(V.metrics([]).mae,null);
 assert.equal(V.metrics([{observed:1,predicted:2,error:1}]).r2,null);
 assert.ok(V.matches({m:'San José del Palmar',d:'Chocó',code:'27660'},'san jose'));
 assert.equal(V.filter(rows,{target:'consulta_externa',population:'small',department:'all'}).length,954);
});
test('HTML autónomo contiene exactamente los datos del CSV',()=>{
 const html=fs.readFileSync(path.join(root,'validacion_ml.html'),'utf8');
 const embedded=JSON.parse(html.match(/<script id="validation-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
 assert.deepEqual(V.unpack(embedded.rows),rows);
 assert.ok(!/<script[^>]*src=/.test(html));
 assert.ok(!html.includes('__VALIDATION_'));
});
