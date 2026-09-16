const test=require('node:test'),assert=require('node:assert/strict');
const P=require('../web/priorizacion.js');
const date='2026-09-16',state={scope:'all',date};
const row=(code,id,v,extra={})=>({geo:'municipal:'+code,code,lv:'municipal',m:code,d:'Chocó',date,id,f:id.startsWith('pnud_')?'PNUD':'3iS-Sheets',u:'Número',dim:'Daños',i:id,v,...extra});
const definition={id:'pnud_vd',unit:'Número',candidates:[{id:'pnud_vd',source:'PNUD'},{id:'3is_vivdestruidas',source:'3iS-Sheets'}]};
function fixture(rows){
 const codes=['27050','27660'];
 return {rows,latest:date,dates:[date],baseline:{rows:[]},population:{rows:codes.map((code,i)=>({code,year:2026,population:1000*(i+1)}))},
 healthPressure:{enabled:false,source_cascade:{enabled:true}},
 denominators:{event_date:'2026-08-10',sources:{official:{url:'https://www.dane.gov.co/',published:'2025-12-24',sha256:'a'.repeat(64)}},
 rows:codes.map((code,i)=>({code,kind:'viviendas',value:100*(i+1),year:2026,unit:'Viviendas',source:'official',reference_date:'2026-06-30',area:'Total',status:'verified'})),
 registry_proxies:{enabled:true,catalog:{sedes_educativas:{year:2022,unit:'Sedes educativas',source:'men',reference_date:'2022-12-31',label:'MEN'}},
 sources:{men:{url:'https://portalsineb.mineducacion.gov.co/',sha256:'b'.repeat(64)}},rows:codes.map(code=>({code,kind:'sedes_educativas',value:10,year:2022,unit:'Sedes educativas',source:'men',reference_date:'2022-12-31',area:'Total',status:'observed_registry_proxy'}))}}};
}
test('PNUD gana incluido cero; 3iS completa solo ausencia y nunca suma o promedia',()=>{
 const result=P.chooseCascade([row('27050','pnud_vd',0),row('27050','3is_vivdestruidas',100),row('27660','3is_vivdestruidas',20)],definition);
 assert.equal(result.rows.get('municipal:27050').v,0);assert.equal(result.rows.get('municipal:27050').f,'PNUD');
 assert.equal(result.rows.get('municipal:27660').v,20);assert.equal(result.rows.size,2);
 assert.deepEqual(result.sourceCounts,{PNUD:1,'3iS-Sheets':1});
});
test('valores no válidos o conflictivos no se publican; duplicado idéntico cuenta una vez',()=>{
 for(const bad of [null,NaN,Infinity,-1,'0']){
  const selected=P.chooseCascade([row('27050','pnud_vd',bad),row('27050','3is_vivdestruidas',4)],definition);
  assert.equal(selected.rows.get('municipal:27050').f,'3iS-Sheets');
 }
 let selected=P.chooseCascade([row('27050','pnud_vd',2),row('27050','pnud_vd',3),row('27050','3is_vivdestruidas',4)],definition);
 assert.equal(selected.rows.get('municipal:27050').v,4);
 selected=P.chooseCascade([row('27050','pnud_vd',2),row('27050','pnud_vd',2)],definition);
 assert.equal(selected.rows.size,1);
 assert.equal(P.chooseCascade([row('27050','pnud_vd',2),row('27050','pnud_vd',3)],definition).rows.size,0);
});
test('unidades, fuente o definiciones incompatibles no entran',()=>{
 const selected=P.chooseCascade([row('27050','pnud_vd',5,{u:'COP'}),row('27050','3is_vivdestruidas',4),row('27660','pnud_vd',2,{f:'UNDP-RAPIDA'})],definition);
 assert.equal(selected.rows.get('municipal:27050').f,'3iS-Sheets');assert.equal(selected.rows.size,1);
 assert.equal(selected.channels[0].coherent,false);
 const mixed=P.chooseCascade([row('27050','pnud_vd',5),row('27660','pnud_vd',2,{i:'Otra definición'}),row('27050','3is_vivdestruidas',4)],definition);
 assert.equal(mixed.rows.get('municipal:27050').f,'3iS-Sheets');
});
test('selecciona antes de normalizar: un máximo común y diez campos en los tres modos',()=>{
 const d=fixture([row('27050','pnud_vd',10),row('27050','3is_vivdestruidas',100),row('27660','3is_vivdestruidas',20),
 row('27050','pnud_va',0),row('27050','3is_vivaveriadas',99),row('27660','pnud_va',10),
 row('27050','3is_educativos',5),row('27660','pnud_cedu',10),row('27660','3is_educativos',100)]);
 for(const mode of ['absolute','percapita','sectorial']){
  const r=P.models(d)[mode].compute(state),a=r.all.find(r=>r.code==='27050'),b=r.all.find(r=>r.code==='27660');
  assert.equal(a.fieldCount,10);assert.deepEqual(a.sectors.map(s=>s.fields.length),[3,2,1,1,3]);
  assert.equal(a.sectors[1].fields[0].source,'PNUD');
  assert.equal(b.sectors[1].fields[0].source,'3iS-Sheets');
  assert.equal(b.sectors[1].fields[0].row.id,'3is_vivdestruidas');
  assert.equal(a.sectors[1].fields[1].score,0);assert.equal(a.sectors[1].coverage,1);
  assert.deepEqual(a.sectors[1].fields.map(f=>f.share),[.5,.5]);
  assert.equal(a.sectors[3].fields[0].source,'3iS-Sheets');
  assert.equal(a.sectors[3].fields[0].score,mode==='percapita'?100:50);
  assert.equal(a.sectors[1].lower,mode==='absolute'?25:50);
  assert.equal(b.sectors[1].lower,100);
  assert.equal(a.sectors[1].fields[0].anchor,mode==='absolute'?20:mode==='percapita'?100:10);
  assert.equal(a.sectors[1].fields[0].n,2);
 }
});
test('falta de ambos conserva desconocido; ausencia de base no activa sustitución oportunista',()=>{
 const d=fixture([row('27050','pnud_vd',101),row('27050','3is_vivdestruidas',2)]);
 const r=P.models(d).sectorial.compute(state).all[0],housing=r.sectors[1];
 assert.equal(housing.fields[0].row.f,'PNUD');assert.equal(housing.fields[0].score,null);
 assert.equal(housing.fields[1].row,null);assert.equal(housing.coverage,0);
 assert.match(housing.fields[0].reason,/supera/);
});
test('no recupera PNUD de otra captura ni permite a 3iS cambiar un puntaje con PNUD válido',()=>{
 const d=fixture([row('27050','pnud_vd',100,{date:'2026-09-15'}),row('27050','3is_vivdestruidas',4)]);
 const model=P.models(d).absolute.compute(state);
 assert.equal(model.all[0].sectors[1].fields[0].source,'3iS-Sheets');
 const before=fixture([row('27050','pnud_vd',2),row('27050','3is_vivdestruidas',100),row('27660','pnud_vd',4)]);
 const after=structuredClone(before);after.rows[1].v=1e9;
 const a=P.models(before).absolute.compute(state),b=P.models(after).absolute.compute(state);
 assert.deepEqual(a.calibrations,b.calibrations);
 for(const r of a.all){const t=b.all.find(x=>x.geo===r.geo);assert.equal(r.lower,t.lower);assert.deepEqual(r.sectors,t.sectors);}
});
