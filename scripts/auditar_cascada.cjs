const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process'),{createRequire}=require('node:module'),path=require('node:path');
const P=require('../web/priorizacion.js'),T=require('../web/modelo.js');
const parse=html=>JSON.parse(html.match(/const DATA=([\s\S]*?);<\/script>/)[1]);
const data=parse(fs.readFileSync('index.html','utf8')),policy=data.healthPressure.source_cascade;
assert.equal(policy.enabled,true);assert.match(policy.parent_commit,/^[a-f0-9]{40}$/);
const git=p=>execFileSync('git',['show',policy.parent_commit+':'+p],{encoding:'utf8',maxBuffer:64*1024*1024});
const oldData=parse(git('index.html'));
for(const key of ['rows','baseline','population','denominators','latest','dates'])assert.deepEqual(data[key],oldData[key],'Inventario preservado: '+key);
assert.deepEqual(data.healthPressure.capacity,oldData.healthPressure.capacity);
const sandbox={module:{exports:{}},require:createRequire(path.resolve('web/priorizacion.js'))};vm.runInNewContext(git('web/priorizacion.js'),sandbox);
const parent=sandbox.module.exports,clean=x=>JSON.parse(JSON.stringify(x)),close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8);
const output={parent_commit:policy.parent_commit,mode:data.healthPressure.mode,capture:data.latest,policy:'PNUD válido incluido 0; si falta/no utilizable, 3iS; nunca combinar ambos',scopes:{}};
for(const scope of ['decree','all']){
 const state={scope,date:data.latest,dept:''},raw=T.create(data).visible(state).filter(r=>r.lv==='municipal'),modes={};
 for(const mode of ['absolute','percapita','sectorial']){
  const old=parent.models(oldData)[mode].compute(state),now=P.models(data)[mode].compute(state),before=new Map(old.all.map(r=>[r.geo,r]));
  assert.equal(now.referenceN,old.referenceN);
  for(const r of now.all){
   const b=before.get(r.geo);assert.equal(r.fieldCount,10);assert.equal(r.sectors.length,5);
   for(const i of [0,4])assert.deepEqual(clean(r.sectors[i]),clean(b.sectors[i]));
   if(mode==='sectorial')assert.deepEqual(clean(r.sectors[2]),clean(b.sectors[2]),'Presión sanitaria sin cambios');
   for(const s of r.sectors)for(const f of s.fields)if(f.candidates){
    const local=raw.filter(x=>x.geo===r.geo),pnud=local.find(x=>x.id===f.id&&x.f==='PNUD'&&x.u==='Número'&&Number.isFinite(x.v)&&x.v>=0);
    // Real inventory is deduplicated and coherent; independently assert precedence.
    if(pnud){assert.equal(f.row?.f,'PNUD');assert.equal(f.row.v,pnud.v);}
    else if(f.row){assert.equal(f.row.f,'3iS-Sheets');assert.equal(f.row.id,f.candidates[1].id);}
    assert.equal(f.source,f.row?.f??'PNUD → 3iS-Sheets');
    if(f.score!=null)close(f.score,f.rate===0||f.row.v===0?0:100*(mode==='absolute'?f.row.v:f.rate)/f.anchor);
   }
   close(r.damageLower,r.sectors.reduce((a,s)=>a+s.lower,0)/5);
   close(r.lower,r.damageLower*(1+.25*(r.vulnerability??0)/100)/1.25);
  }
  const model=P.models(data)[mode],searched=model.selection({...state,matrixSearch:'Pereira',dept:'Risaralda'});
  assert.deepEqual(searched.calibrations,now.calibrations);
  const entry=r=>({code:r.code,name:r.m,score:r.lower,rank:r.rank,previous_score:before.get(r.geo).lower,
   previous_rank:old.items.find(x=>x.geo===r.geo)?.rank??null,available:r.available,fields:r.fieldCount});
  modes[mode]={reference:now.referenceN,with_score:now.items.length,
   health_with_data:now.all.filter(r=>r.sectors[2].coverage>0).length,
   fields:now.calibrations.filter(c=>c.candidates).map(c=>({id:c.id,selected_sources:c.sourceCounts,usable:c.n,anchor:c.anchor,channels:c.channels})),
   top10:now.items.slice(0,10).map(entry),examples:now.items.filter(r=>['27050','66001','76828','76001'].includes(r.code)).map(entry)};
 }
 output.scopes[scope]=modes;
}
fs.writeFileSync('docs/verificacion_cascada.json',JSON.stringify(output,null,2)+'\n');
console.log('Cascade audit OK',JSON.stringify(output));
