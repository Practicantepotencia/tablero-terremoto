// Audit the actual embedded capture, optionally against the branch's frozen base.
const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm'),path=require('node:path');
const {execFileSync}=require('node:child_process'),{createRequire}=require('node:module');
const P=require('../web/priorizacion.js'),T=require('../web/modelo.js'),C=require('../web/comparacion.js');
const parse=html=>JSON.parse(html.match(/const DATA=([\s\S]*?);<\/script>/)[1]);
const data=parse(fs.readFileSync('index.html','utf8'));
let original;
const baselineRef=process.argv[2];
if(baselineRef){
 const git=file=>execFileSync('git',['show',`${baselineRef}:${file}`],{encoding:'utf8',maxBuffer:100*1024*1024});
 const previous=parse(git('index.html'));
 for(const key of Object.keys(previous))if(key!=='generated')assert.deepEqual(data[key],previous[key],`Cambió DATA.${key}`);
 const context={module:{exports:{}},require:createRequire(path.resolve('web/priorizacion.js'))};
 vm.runInNewContext(git('web/priorizacion.js'),context);original=context.module.exports;
}
const output={capture:data.latest,baseline_ref:baselineRef||null,idf:{year:data.fiscal.year,n:data.fiscal.rows.length,sha256:data.fiscal.sha256},scopes:{}};
const compact=r=>({code:r.code,lower:r.lower,upper:r.upper,damageLower:r.damageLower,damageUpper:r.damageUpper,
 coverage:r.coverage,available:r.available,rank:r.rank,rankMin:r.rankMin,rankMax:r.rankMax,sectors:r.sectors});
for(const scope of ['decree','all']){
 const state={scope,date:data.latest,dept:''},models=P.models(data),entry={levels:{}};
 output.scopes[scope]=entry;
 if(original){
   for(const mode of ['absolute','percapita','sectorial']){
     const before=original.create(data,undefined,{mode}).compute(state),after=models[mode].compute(state);
     // Cross-realm objects have different prototypes; compare their serialized content.
     assert.equal(JSON.stringify(after.items.map(compact)),JSON.stringify(before.items.map(compact)),`Regresión: ${mode}/${scope}`);
   }
   entry.baseline_unchanged=true;
 }
 const defaultResult=models.sectorial.compute(state);
 for(const depth of Object.keys(P.DEPTHS)){
   const s={...state,relativeDepth:depth},result=models.sectorial.compute(s);
   const compare=C.compare(models,T.create(data),s,{mode:'sectorial',axis:'value',panel:'available'});
   for(const r of result.all){
     const before=defaultResult.all.find(x=>x.geo===r.geo);
     assert.deepEqual(r.sectors,before.sectors);assert.equal(r.damageLower,before.damageLower);
     const expected=depth==='index'?r.damageLower:depth==='ipm'?before.lower:r.fiscal?before.lower*(1-r.fiscal.value/100):null;
     assert.equal(r.lower,expected);
   }
   const summarize=r=>r?{code:r.code,name:r.m,lower:r.lower,upper:r.upper,rank:r.rank,damage:r.damageLower,ipm:r.vulnerability,idf:r.fiscal?.value??null}:null;
   entry.levels[depth]={reference:result.referenceN,scored:result.items.length,
     with_idf:result.all.filter(r=>r.fiscal).length,without_idf:result.all.filter(r=>!r.fiscal).map(r=>({code:r.code,name:r.m})),
     comparison:{n:compare.n,r2:compare.regression?.r2,pearson:compare.regression?.r,rho:compare.rho},
     pereira:summarize(result.items.find(r=>r.code==='66001')),top5:result.items.slice(0,5).map(summarize)};
 }
}
fs.writeFileSync('docs/verificacion_niveles_relativo.json',JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify(output));
