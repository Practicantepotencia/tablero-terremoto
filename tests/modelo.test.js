const {test} = require('node:test');
const assert = require('node:assert/strict');
const T = require('../web/modelo.js');
const date = '2026-09-07';
const state = {date, scope:'all', dept:'', level:'municipal', order:'desc'};
function row(geo, v, overrides={}) {
  return {geo, v, lv:'municipal', d:'Chocó', m:geo, f:T.RAPIDA, id:T.RECOVERY, dim:'Recuperación', u:'Índice', i:'Recuperación',date,...overrides};
}
function model(rows) { return T.create({rows, dates:[...new Set(rows.map(r=>r.date))].sort()}); }

test('ranking uses only recovery; IPM and other sources do not change order',()=>{
  const m=model([row('a',.8),row('b',.5),row('a',1,{id:T.IPM,dim:'Vulnerabilidad'}),row('b',90,{id:T.IPM,dim:'Vulnerabilidad'}),row('b',900,{f:'PNUD'})]);
  assert.deepEqual(m.priorities(state).items.map(r=>r.geo),['a','b']);
  assert.equal(m.priorities(state).items[1].ipm,90);
});
test('sector never fills a missing source or mixes units and captures',()=>{
  const rows=[row('a',3),row('b',4,{f:'PNUD'}),row('c',5,{u:'Porcentaje'}),row('d',6,{date:'2026-09-06'})];
  const m=model(rows), chosen={...state,metric:T.cohort(rows[0])};
  assert.deepEqual(m.sector(chosen).items.map(r=>r.geo),['a']);
});
test('decree narrows geography while indicator selection remains unchanged, even without observations',()=>{
  const r=row('a',100,{d:'Córdoba',f:'FundacionExe',id:'sedes'});
  const m=model([r,row('norm',1,{lv:'departamental',f:'Decreto1171',id:'en_decreto_1171'})]);
  const chosen={...state,metric:T.cohort(r)};
  assert.equal(m.sector(chosen).items.length,1);
  assert.equal(m.sector({...chosen,scope:'decree'}).items.length,0);
  assert.equal(m.sector({...chosen,scope:'decree'}).meta.key,chosen.metric);
  assert.equal(m.sector(chosen).items.length,1);
});
test('a missing recovery value is unranked, and true zero is still ranked',()=>{
  const m=model([row('a',0),row('b',45,{id:T.IPM,dim:'Vulnerabilidad'})]);
  assert.deepEqual(m.priorities(state).items.map(r=>r.geo),['a']);
  assert.deepEqual(m.priorities(state).missing.map(r=>r.geo),['b']);
});
test('recovery with inconsistent metadata is not pooled',()=>{
  const m=model([row('a',.7),row('b',80,{u:'Porcentaje'})]);
  assert.equal(m.priorities(state).items.length,0);
  assert.equal(m.priorities(state).mixed,true);
});
test('ties share position; search does not renumber or change denominator',()=>{
  const m=model([row('a',.8),row('b',.8),row('c',.5)]);
  assert.deepEqual(m.priorities(state).items.map(r=>r.rank),[1,1,3]);
  assert.equal(m.priorities({...state,search:'c,'}).items[0].rank,3);
  assert.equal(m.priorities({...state,search:'c,'}).pool.length,3);
});
test('department filtering preserves the universe P75 threshold',()=>{
  const m=model([row('a',.1),row('b',.2),row('c',.8,{d:'Cauca'}),row('d',.9,{d:'Cauca'})]);
  assert.equal(m.priorities(state).qr,m.priorities({...state,dept:'Chocó'}).qr);
  assert.equal(m.priorities({...state,dept:'Chocó'}).items.filter(r=>r.high).length,0);
});
test('all equal or fewer than four observations do not produce high-need categories',()=>{
  const m=model(['a','b','c','d'].map(k=>row(k,0)));
  assert.equal(m.priorities(state).canBand,false);
  assert.equal(m.priorities(state).items.filter(r=>r.high).length,0);
});
test('history uses the intersection of territories, not shifting coverage',()=>{
  const first=row('a',10,{date:'2026-09-06'});
  const m=model([first,row('b',100,{date:'2026-09-06'}),row('a',20),row('c',300)]);
  const h=m.history(state,T.cohort(first));
  assert.equal(h.n,1);
  assert.deepEqual(h.points.map(p=>p.v),[10,20]);
  assert.equal(h.delta,10);
});
test('a source missing in one capture prevents a false trend',()=>{
  const r=row('a',20);
  const m=model([r,row('a',10,{date:'2026-09-06',f:'PNUD'})]);
  assert.equal(m.history(state,T.cohort(r)).ready,false);
  assert.equal(m.history(state,T.cohort(r)).delta,null);
});
test('housing categories remain separate in the sector matrix',()=>{
  const m=model([row('a',.8),row('a',10,{id:'undp_rapida_bdg_homes_dest',dim:'Vivienda'}),row('a',20,{id:'undp_rapida_bdg_homes_dmg',dim:'Vivienda'})]);
  const p=m.priorities(state);
  assert.equal(p.items[0].coverage,1);
  assert.deepEqual(m.matrix(state,p.items)[0].cells[0].cells.map(r=>r.v),[10,20]);
});
