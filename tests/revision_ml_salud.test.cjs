'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {correctedAudit}=require('../scripts/revisar_ml_salud.cjs'),ML=require('../scripts/ml_salud.cjs');
const root=path.resolve(__dirname,'..');
const input=JSON.parse(fs.readFileSync(path.join(root,'experimentos/ml_salud/entrada.json'),'utf8'));
const stored=JSON.parse(fs.readFileSync(path.join(root,'experimentos/ml_salud/revision_faltantes/comparacion.json'),'utf8'));
test('reproduce every corrected prediction and selection deterministically',()=>{
  const current=correctedAudit(ML,input);
  assert.deepEqual(current,stored);
});
test('target cohort, references, folds and bootstrap are explicit',()=>{
  assert.equal(stored.oof.length,901);
  assert.equal(new Set(stored.oof.map(r=>r.code)).size,901);
  assert.equal(stored.metrics.find(r=>r.group==='primary_small_no_beds').n,69);
  assert.equal(stored.metrics.find(r=>r.group==='without_beds').n,125);
  assert(stored.folds.every(f=>f.selected==='siempre_1'));
  assert(stored.folds.every(f=>Object.values(f.diagnostics).every(d=>d.converged)));
  assert.equal(stored.decision.methods_with_lower_primary_error.length,0);
  for(const f of stored.folds)assert(stored.oof.filter(r=>r.fold===f.fold).every(r=>f.held_out_departments.includes(r.department)));
  assert.equal(stored.comparisons.find(r=>r.group==='primary_small_no_beds').departments,11);
});
test('original ML OOF and constant reference are checked, not invented',()=>{
  const original=JSON.parse(fs.readFileSync(path.join(root,'experimentos/ml_salud/resultados.json'),'utf8')).results.find(r=>r.target.id==='urgencias');
  for(const r of stored.oof){
    assert.equal(r.predictions.siempre_1,1);
    assert(Math.abs(r.predictions.poisson_capacidades-original.oof.find(o=>o.code===r.code).predicted)<1e-9);
  }
});
test('sensitivity recomputes the maximum, including a third municipality',()=>{
  const sens=JSON.parse(fs.readFileSync(path.join(root,'experimentos/ml_salud/revision_faltantes/sensibilidad.json'),'utf8'));
  assert.equal(sens.scenarios.length,18);
  for(const scope of ['all','decree']){
    const base=sens.scenarios.find(s=>s.scope===scope&&s.base_atrato===1&&s.base_trujillo===1);
    assert.equal(base.changed_global,0);assert.equal(base.changed_rank,0);assert.equal(base.anchor,16);
    const moved=sens.scenarios.find(s=>s.scope===scope&&s.base_atrato===1&&s.base_trujillo===2);
    assert.equal(moved.anchor,9);assert.equal(moved.atrato.health,100);
    const third=sens.scenarios.find(s=>s.scope===scope&&s.base_atrato===2&&s.base_trujillo===3);
    assert.equal(third.max_municipalities[0],'Acandí');
  }
});
