const test=require('node:test'),assert=require('node:assert/strict');
const P=require('../web/priorizacion.js'),T=require('../web/modelo.js'),C=require('../web/comparacion.js');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
const date='2026-09-21',state={date,scope:'all'};
function fixture(){
  const codes=['05001','05002','05003'];
  return {rows:codes.flatMap((code,i)=>[
    {geo:code,code,lv:'municipal',m:code,d:'D',date,id:'3is_fallecidos',f:'3iS-Sheets',u:'Número',dim:'Personas',i:'Fallecidos',v:30-10*i},
    {geo:code,code,lv:'municipal',m:code,d:'D',date,id:T.RECOVERY,f:T.RAPIDA,u:'Índice',i:'Necesidad',v:.7-.1*i}
  ]),baseline:{rows:codes.map(code=>({code,v:20}))},
  population:{rows:codes.map(code=>({code,year:2026,population:10000}))},
  denominators:{event_date:'2026-08-10',sources:{official:{url:'https://www.dane.gov.co/',published:'2025-12-24',sha256:'fixture'}},
    rows:codes.map(code=>({code,value:10000,kind:'poblacion',year:2026,unit:'Habitantes',source:'official',reference_date:'2026-06-30',area:'Total',status:'verified'}))},
  fiscal:{rows:[{code:'05001',value:90,year:2023},{code:'05002',value:10,year:2023}]}};
}
test('fórmulas exactas: D, P con IPM y C; IDF no se aplica dos veces ni se renormaliza',()=>{
  const sectors=[10,20,30,40,50].map(x=>({lower:x,upper:x+10})),weights=sectors.map(()=>1),fiscal={value:75.23225403040647};
  const plain=P.adjustedAggregate(sectors,15.1,weights,'index',fiscal);
  assert.equal(plain.lower,30);assert.equal(plain.upper,40);
  const ipm=P.adjustedAggregate(sectors,15.1,weights,'ipm',fiscal);
  near(ipm.lower,30*(1+.25*.151)/1.25);
  const c=P.adjustedAggregate(sectors,15.1,weights,'ipm_idf',fiscal);
  near(c.lower,ipm.lower*(1-fiscal.value/100));near(c.upper,ipm.upper*(1-fiscal.value/100));
  assert.equal(c.damageLower,30);assert.equal(c.damageUpper,40);
});
test('IPM sigue siendo el valor inicial; nivel y caché solo alteran el modelo relativo',()=>{
  const d=fixture(),models=P.models(d),original=models.sectorial.compute(state);
  assert.strictEqual(original,models.sectorial.compute({...state,relativeDepth:'ipm'}));
  const abs=models.absolute.compute(state),pc=models.percapita.compute(state);
  for(const depth of Object.keys(P.DEPTHS)){
    const s={...state,relativeDepth:depth};
    assert.strictEqual(models.absolute.compute(s),abs);assert.strictEqual(models.percapita.compute(s),pc);
    const relative=models.sectorial.compute(s);
    for(const row of relative.all){
      const prev=original.all.find(r=>r.code===row.code);
      assert.deepEqual(row.sectors,prev.sectors);assert.equal(row.coverage,prev.coverage);
      assert.equal(row.damageLower,prev.damageLower);
      if(depth==='ipm')assert.equal(row.lower,P.aggregate(row.sectors,row.vulnerability,row.sectors.map(()=>1)).lower);
    }
  }
  assert.throws(()=>models.sectorial.compute({...state,relativeDepth:'other'}),/desconocido/);
});
test('C cambia puestos, excluye ausencia de IDF, mantiene sectores consultables y pares coherentes',()=>{
  const d=fixture(),models=P.models(d),s={...state,relativeDepth:'ipm_idf'};
  const p=models.sectorial.compute(state),c=models.sectorial.compute(s);
  assert.equal(p.items[0].code,'05001');assert.equal(c.items[0].code,'05002');
  assert.equal(c.items.length,2);assert.equal(c.missing.length,1);
  const missing=c.missing[0];assert.equal(missing.code,'05003');assert.equal(missing.lower,null);
  assert.equal(missing.upper,null);assert.equal(missing.rank,null);assert.ok(missing.coverage>0);
  assert.ok(missing.sectors[0].coverage>0);assert.equal(c.all.length,3);
  for(const r of c.items)assert.ok(r.rankMin<=r.rank&&r.rank<=r.rankMax);
  const compared=C.compare(models,T.create(d),s,{mode:'sectorial',axis:'value',panel:'available'});
  assert.equal(compared.n,2);assert.equal(compared.excluded.index,1);
  for(const pair of compared.pairs)assert.equal(pair.x,c.items.find(r=>r.geo===pair.geo).lower);
  assert.equal(models.sectorial.selection({...s,matrixSearch:'05003'}).items[0].lower,null);
  assert.strictEqual(models.sectorial.compute({...s,dept:'D',matrixSearch:'05002'}),c);
  assert.equal(models.sectorial.compute(state).items.length,3);
});
test('IDF cero es válido; IDF 100 da cero, no ausencia; inválidos y duplicados se excluyen',()=>{
  const d=fixture();d.fiscal.rows=[{code:'05001',value:0,year:2023},{code:'05002',value:100,year:2023}];
  const model=P.models(d).sectorial,p=model.compute(state),c=model.compute({...state,relativeDepth:'ipm_idf'});
  assert.equal(c.items.length,2);assert.equal(c.items[0].lower,p.items[0].lower);
  assert.equal(c.items[1].lower,0);assert.notEqual(c.items[1].rank,null);
  for(const rows of [[],[{code:'05001',value:null,year:2023}],[{code:'05001',value:'50',year:2023}],
    [{code:'05001',value:-1,year:2023}],[{code:'05001',value:101,year:2023}],
    [{code:'05001',value:50,year:2024}],[{code:'05001',value:50,year:2023},{code:'05001',value:50,year:2023}]]){
    const data=fixture();data.fiscal.rows=rows;
    assert.equal(P.models(data).sectorial.compute({...state,relativeDepth:'ipm_idf'}).items.length,0);
  }
});
test('sin IPM se propagan límites; sin ajuste no se arrastra la incertidumbre del IPM',()=>{
  const sectors=[{lower:50,upper:50}],fiscal={value:50};
  const plain=P.adjustedAggregate(sectors,null,[1],'index',null);
  assert.equal(plain.lower,50);assert.equal(plain.upper,50);
  const c=P.adjustedAggregate(sectors,null,[1],'ipm_idf',fiscal);
  assert.equal(c.lower,20);assert.equal(c.upper,25);
  assert.equal(P.adjustedAggregate(sectors,0,[1],'ipm_idf',null).lower,null);
});
