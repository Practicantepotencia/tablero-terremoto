const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process'),{createRequire}=require('node:module'),path=require('node:path');
const P=require('../web/priorizacion.js');
const parse=html=>JSON.parse(html.match(/const DATA=([\s\S]*?);<\/script>/)[1]);
const data=parse(fs.readFileSync('index.html','utf8'));
const variant=data.healthPressure.human_impact_variant;
assert.equal(variant.id,'sin-heridos-ih');
assert.match(variant.parent_commit,/^[a-f0-9]{40}$/);
const git=p=>execFileSync('git',['show',variant.parent_commit+':'+p],{encoding:'utf8',maxBuffer:64*1024*1024});
const originalData=parse(git('index.html'));
for(const key of ['rows','baseline','population','denominators','latest','dates'])assert.deepEqual(data[key],originalData[key],'Datos preservados: '+key);
assert.deepEqual(data.healthPressure.capacity,originalData.healthPressure.capacity,'Capacidad sin cambios');
const sandbox={module:{exports:{}},require:createRequire(path.resolve('web/priorizacion.js'))};
vm.runInNewContext(git('web/priorizacion.js'),sandbox);
const parent=sandbox.module.exports;
const clean=x=>JSON.parse(JSON.stringify(x)),close=(x,y)=>assert.ok(Math.abs(x-y)<1e-8,x+' != '+y);
const output={parent_branch:variant.parent_branch,parent_commit:variant.parent_commit,capture:data.latest,mode:data.healthPressure.mode,
 formula:'Impacto humano = (z_familias + z_fallecidos + z_desaparecidos) / 3',scopes:{}};
for(const scope of ['decree','all']){
 const state={scope,date:data.latest,dept:''},modes={};
 for(const mode of ['absolute','percapita','sectorial']){
  const old=parent.models(originalData)[mode].compute(state),now=P.models(data)[mode].compute(state);
  const before=new Map(old.all.map(r=>[r.geo,r]));
  assert.equal(now.referenceN,old.referenceN);
  assert.deepEqual(clean(now.calibrations.map(({share,...c})=>c)),clean(old.calibrations.filter(c=>c.id!=='3is_heridos').map(({share,...c})=>c)),'Anclas de los campos restantes: '+mode);
  for(const r of now.all){
   const b=before.get(r.geo);assert.ok(b);assert.equal(r.fieldCount,b.fieldCount-1);
   assert.equal(r.vulnerability,b.vulnerability);assert.equal(r.recovery,b.recovery);
   for(let i=1;i<5;i++)assert.deepEqual(clean(r.sectors[i]),clean(b.sectors[i]),'Sector inalterado: '+mode+'/'+r.code+'/'+i);
   const h=r.sectors[0],bh=b.sectors[0];
   assert.deepEqual(h.fields.map(f=>f.id),['3is_familias','3is_fallecidos','3is_desaparecidos']);
   for(const f of h.fields){
    assert.equal(f.share,1/3);const bf=bh.fields.find(x=>x.id===f.id);
    for(const k of ['score','rate','anchor','n','positive'])assert.equal(f[k],bf[k]);
    if(f.score!=null)close(f.contribution,f.score/15);
   }
   close(h.lower,h.fields.reduce((s,f)=>s+(f.score??0)/3,0));
   close(h.upper,h.lower+h.fields.filter(f=>f.score==null).length*100/3);
   close(r.damageLower,r.sectors.reduce((s,d)=>s+d.lower,0)/5);
   close(r.lower,r.damageLower*(1+.25*(r.vulnerability??0)/100)/1.25);
  }
  const oldRanks=new Map(old.items.map(r=>[r.geo,r.rank]));
  const entry=r=>({code:r.code,name:r.m,human:r.sectors[0].lower,previous_human:before.get(r.geo).sectors[0].lower,
   health:r.sectors[2].coverage?r.sectors[2].lower:null,score:r.lower,previous_score:before.get(r.geo).lower,
   rank:r.rank,previous_rank:oldRanks.get(r.geo)??null,available:r.available,fields:r.fieldCount});
  modes[mode]={reference:now.referenceN,with_score:now.items.length,health_with_data:now.all.filter(r=>r.sectors[2].coverage>0).length,
   top10:now.items.slice(0,10).map(entry),examples:now.items.filter(r=>['27050','66001','76828','76001'].includes(r.code)).map(entry)};
 }
 output.scopes[scope]=modes;
}
fs.writeFileSync('docs/verificacion_sin_heridos_ih.json',JSON.stringify(output,null,2)+'\n');
console.log('Verified human-impact-only change against both original data and parent model',JSON.stringify(output));
