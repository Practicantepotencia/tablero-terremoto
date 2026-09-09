const {test} = require('node:test');
const assert = require('node:assert/strict');
const T = require('../web/modelo.js');
const date = '2026-09-07';
const state = {date, scope:'all', dept:'', level:'municipal', order:'desc'};
function row(geo, v, overrides={}) {
  return {geo, v, lv:'municipal', d:'Chocó', m:geo, f:T.RAPIDA, id:T.RECOVERY, dim:'Recuperación', u:'Índice', i:'Recuperación',date,...overrides};
}
function model(rows) { return T.create({rows, dates:[...new Set(rows.map(r=>r.date))].sort()}); }

test('ExE has four own columns and never borrows another source',()=>{
  const ids=['sedes_edu_n_sedes','sedes_edu_n_sedes_criticas','sedes_edu_matricula_afectada','sedes_edu_docentes_afectados'];
  const m=model([row('a',.9),...ids.map((id,i)=>row('a',i,{id,f:'FundacionExe',dim:'Educación',u:'Número'})),row('b',40,{id:ids[0],f:'PNUD'})]);
  const s={...state,matrixSource:'FundacionExe'};
  assert.deepEqual(m.matrixLayout(s).map(c=>c.name),['Sedes afectadas','Sedes críticas','Matrícula afectada','Docentes afectados']);
  assert.deepEqual(m.matrix(s)[0].cells.map(c=>c.cells[0].v),[0,1,2,3]);
  assert.ok(m.matrix(s)[1].cells.every(c=>c.cells[0]===null));
  assert.equal(m.matrix(s)[0].f,'FundacionExe');
});
test('other sources preserve dimensions, units and cohort variants in separate cards',()=>{
  const m=model([row('a',2,{f:'PNUD',id:'school',dim:'Educación',u:'Número'}),row('b',200,{f:'PNUD',id:'school',dim:'Educación',u:'COP'})]);
  const s={...state,matrixSource:'PNUD'};
  assert.equal(m.matrixLayout(s).length,1);
  assert.equal(m.matrixLayout(s)[0].metrics.length,2);
  assert.deepEqual(m.matrix(s).map(r=>r.cells[0].cells.filter(Boolean).map(c=>c.p)),[[50],[50]]);
});
test('department-only sources never duplicate totals across municipalities',()=>{
  const m=model([row('a',.9),row('dep',45,{lv:'departamental',m:'',f:'Camaras',dim:'Productividad',id:'business'})]);
  assert.equal(m.matrix({...state,matrixSource:'Camaras'})[0].cells.length,0);
  const result=m.matrix({...state,matrixSource:'Camaras',matrixLevel:'departamental'});
  assert.equal(result.length,1);
  assert.equal(result[0].cells[0].cells[0].v,45);
  assert.equal(result[0].lv,'departamental');
});
test('categorical source values do not get quantitative heat percentiles',()=>{
  const m=model([row('a',0,{f:'Naboo/UNGRD',id:'gravedad_oficial',dim:'Gravedad municipal',u:'Categoría (0-100)'})]);
  assert.equal(m.matrix({...state,matrixSource:'Naboo/UNGRD'})[0].cells[0].cells[0].p,null);
});

test('matrix includes all municipalities, ranked first and unassessed last',()=>{
  const m=model([...Array.from({length:20},(_,i)=>row(`m${i}`,20-i)),row('sin dato',7,{id:T.IPM})]);
  const result=m.matrix(state);
  assert.equal(result.length,21);
  assert.deepEqual(result.slice(0,20).map(r=>r.geo),Array.from({length:20},(_,i)=>`m${i}`));
  assert.equal(result.at(-1).rank,null);
  assert.ok(result.at(-1).cells.every(s=>s.cells.every(c=>c===null)));
});
test('matrix search ignores accents, preserves percentiles and is independent of ranking search',()=>{
  const id='undp_rapida_bdg_homes_dest';
  const m=model([row('q',.8,{m:'Quibdó'}),row('b',.3),row('q',10,{id,m:'Quibdó'}),row('b',20,{id})]);
  const all=m.matrix(state), found=m.matrix({...state,search:'nonexistent',matrixSearch:'  QUIBDO  '});
  assert.equal(found.length,1);
  assert.equal(found[0].rank,all[0].rank);
  assert.deepEqual(found[0].cells,all[0].cells);
  assert.equal(m.matrix({...state,matrixSearch:'inexistente'}).length,0);
  assert.equal(m.matrix({...state,dept:'Cauca'}).length,0);
});
test('matrix respects decree and does not substitute another source',()=>{
  const m=model([row('a',.8),row('b',.9,{d:'Cauca'}),row('c',10,{f:'PNUD',id:'undp_rapida_bdg_homes_dest'}),row('norm',1,{lv:'departamental',f:'Decreto1171',id:'en_decreto_1171'})]);
  const result=m.matrix({...state,scope:'decree'});
  assert.deepEqual(result.map(r=>r.geo),['a','c']);
  assert.equal(result[1].cells[0].cells[0],null);
});

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

test('new baselines do not change RAPIDA ranking or missing-data denominator',()=>{
  const rows=[row('a',.8),row('b',.3),row('c',10,{f:'PNUD',id:'homes'})];
  const extra=row('nuevo',14.4,{f:'DANE-CNPV2018',id:'dane_ipm_total',external:true,period:'2018'});
  const original=T.create({rows,dates:[date],latest:date});
  const expanded=T.create({rows,dates:[date],latest:date,supplemental:{rows:[extra]}});
  assert.deepEqual(expanded.priorities(state),original.priorities(state));
  assert.equal(expanded.matrix({...state,matrixSource:extra.f,matrixSearch:'nuevo'}).length,1);
  assert.equal(expanded.profile({...state,source:extra.f},'nuevo')[0].v,14.4);
});

test('supplemental tables respect scope and are not fabricated historical captures',()=>{
  const extra=row('lorica',40,{f:'MEN-Estadisticas',id:'coverage',d:'Córdoba',external:true,period:'2024'});
  const rows=[row('a',.8),row('norm',1,{lv:'departamental',f:'Decreto1171',id:'en_decreto_1171'})];
  const m=T.create({rows,dates:['2026-09-06',date],latest:date,supplemental:{rows:[extra]}});
  const s={...state,metric:T.cohort(extra)};
  assert.equal(m.sector(s).pool.length,1);
  assert.equal(m.sector({...s,scope:'decree'}).pool.length,0);
  assert.equal(m.sector({...s,date:'2026-09-06'}).pool.length,0);
  assert.equal(m.history(s,T.cohort(extra)).ready,false);
});
