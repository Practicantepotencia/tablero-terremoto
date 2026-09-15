'use strict';
// Audit only: never overwrites model denominators or index.html.
// Four fixed candidates; departmental outer validation; selection inside train.
function correctedAudit(ML, input) {
  const ids = ['siempre_1', 'mediana_comparables', 'poisson_demografia', 'poisson_capacidades'];
  const observed = input.rows.filter(r => r.capacity_2022[1] > 0);
  const populationBand = r => [5000,10000,20000,50000,100000].filter(v => r.population_2026 >= v).length;
  const hasBeds = r => r.capacity_2022[2] !== null;
  const primary = r => !hasBeds(r) && r.population_2026 < 10000;
  function fit(rows,id) {
    if(id==='siempre_1') return {id};
    if(id==='mediana_comparables') return {id,rows};
    return {id,model:ML.train(rows,1,ML.candidates.find(c=>c.id===id))};
  }
  function pred(f,r) {
    if(f.id==='siempre_1') return {value:1};
    if(f.id==='mediana_comparables') {
      let pool=f.rows.filter(t=>hasBeds(t)===hasBeds(r)&&populationBand(t)===populationBand(r));
      let fallback='camas_y_banda_poblacion';
      if(!pool.length){pool=f.rows.filter(t=>hasBeds(t)===hasBeds(r));fallback='solo_disponibilidad_camas'}
      if(!pool.length){pool=f.rows;fallback='todos_entrenamiento'}
      return {value:ML.quantile(pool.map(t=>t.capacity_2022[1]),.5),support:pool.length,fallback};
    }
    return {value:ML.predict(f.model,r)};
  }
  function pick(trainRows) {
    const inner=ML.folds(trainRows,3);
    const scores=ids.map(id=>{
      const real=[],prediction=[];
      for(const fold of inner) {
        const tr=trainRows.filter(r=>!fold.departments.includes(r.department));
        const te=fold.rows.filter(primary), f=fit(tr,id);
        for(const r of te){real.push(r.capacity_2022[1]);prediction.push(pred(f,r).value)}
      }
      if(!real.length)throw Error('No primary observations in inner validation');
      return {id,...ML.metrics(real,prediction)};
    }).sort((a,b)=>a.mean_absolute_log_error-b.mean_absolute_log_error||ids.indexOf(a.id)-ids.indexOf(b.id));
    return {id:scores[0].id,scores};
  }
  const outer=ML.folds(observed,5),oof=[],folds=[];
  for(let i=0;i<outer.length;i++) {
    const fold=outer[i],tr=observed.filter(r=>!fold.departments.includes(r.department));
    const chosen=pick(tr),fitted=Object.fromEntries(ids.map(id=>[id,fit(tr,id)]));
    const diagnostics=Object.fromEntries(ids.filter(id=>id.startsWith('poisson')).map(id=>[id,{converged:fitted[id].model.model.converged,beta:fitted[id].model.model.beta}]));
    for(const r of fold.rows){
      const predictions=Object.fromEntries(ids.map(id=>[id,pred(fitted[id],r).value]));
      const median=pred(fitted.mediana_comparables,r);
      oof.push({code:r.code,municipality:r.municipality,department:r.department,population_2026:r.population_2026,
        has_beds:hasBeds(r),observed:r.capacity_2022[1],fold:i+1,predictions,selected_id:chosen.id,
        selected_prediction:predictions[chosen.id],median_support:median.support,median_fallback:median.fallback});
    }
    folds.push({fold:i+1,held_out_departments:fold.departments,train_n:tr.length,test_n:fold.rows.length,
      primary_test_n:fold.rows.filter(primary).length,selected:chosen.id,inner_scores:chosen.scores,diagnostics});
  }
  const groups={
    primary_small_no_beds:r=>!r.has_beds&&r.population_2026<10000,
    without_beds:r=>!r.has_beds,
    with_beds:r=>r.has_beds,
    all:r=>true,
    population_lt5000:r=>r.population_2026<5000,
    population_5000_10000:r=>r.population_2026>=5000&&r.population_2026<10000,
    population_10000_20000:r=>r.population_2026>=10000&&r.population_2026<20000,
    population_20000_50000:r=>r.population_2026>=20000&&r.population_2026<50000,
    population_50000_100000:r=>r.population_2026>=50000&&r.population_2026<100000,
    population_ge100000:r=>r.population_2026>=100000,
    observed_1_to_5_diagnostic:r=>r.observed<=5
  };
  const score=(rs,id)=>ML.metrics(rs.map(r=>r.observed),rs.map(r=>id==='selected_nested'?r.selected_prediction:r.predictions[id]));
  const metrics=Object.entries(groups).flatMap(([group,predicate])=>{
    const rs=oof.filter(predicate);
    return [...ids,'selected_nested'].map(method=>({group,method,...score(rs,method)}));
  });
  const by_department=Object.entries(groups).filter(([g])=>['primary_small_no_beds','without_beds'].includes(g)).flatMap(([group,predicate])=>{
    const rs=oof.filter(predicate);
    return [...new Set(rs.map(r=>r.department))].sort().flatMap(department=>ids.map(method=>({group,department,method,...score(rs.filter(r=>r.department===department),method)})));
  });
  const comparisons=[];
  for(const group of ['primary_small_no_beds','without_beds']) {
    const rs=oof.filter(groups[group]),departments=[...new Set(rs.map(r=>r.department))].sort();
    for(const method of ids.filter(x=>x!=='siempre_1')) {
      const deltas=departments.map(d=>{
        const a=rs.filter(r=>r.department===d);
        const sum=a.reduce((s,r)=>s+Math.abs(Math.log(r.predictions[method]/r.observed))-Math.abs(Math.log(1/r.observed)),0);
        return {department:d,n:a.length,sum,mean:sum/a.length};
      });
      let seed=20260915;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
      const draws=[];
      for(let b=0;b<2000;b++){let total=0,n=0;for(let k=0;k<deltas.length;k++){const d=deltas[Math.floor(random()*deltas.length)];total+=d.sum;n+=d.n}draws.push(total/n)}
      comparisons.push({group,method,reference:'siempre_1',metric:'paired_mean_absolute_log_error_difference',
        delta:deltas.reduce((s,d)=>s+d.sum,0)/rs.length,
        bootstrap_department_percentile_95:[ML.quantile(draws,.025),ML.quantile(draws,.975)],
        departments:departments.length,better_departments:deltas.filter(d=>d.mean<-1e-12).length,
        equal_departments:deltas.filter(d=>Math.abs(d.mean)<=1e-12).length,
        worse_departments:deltas.filter(d=>d.mean>1e-12).length,
        replicates:2000,seed:20260915,
        note:'Exploratory paired cluster bootstrap on reused observed municipalities; not external confirmation, not a prediction interval or a guarantee for missing/zero capacity.'});
    }
  }
  const by_fold=Object.entries(groups).filter(([g])=>['primary_small_no_beds','without_beds'].includes(g)).flatMap(([group,predicate])=>
    outer.flatMap((_,i)=>ids.map(method=>({group,fold:i+1,method,...score(oof.filter(r=>r.fold===i+1&&predicate(r)),method)}))));
  const missing=input.rows.filter(r=>r.capacity_2022[1]===null);
  const distribution=rs=>({n:rs.length,median_population:ML.quantile(rs.map(r=>r.population_2026),.5),with_beds:rs.filter(hasBeds).length,primary:rs.filter(primary).length});
  return {
    version:1,created:'2026-09-15',source_commit:'a350ca6591174542e76b08d108e4d4e15c629b4c',
    protocol:{primary:'population_2026 < 10000 and no observed beds record',population_bins:[5000,10000,20000,50000,100000],
      candidates:ids,outer_folds:5,inner_folds:3,tie_break:'simpler first: always 1, comparable median, demographic Poisson, capacity Poisson',
      selection_metric:'mean absolute log error within primary group only; candidate fits use all train municipalities',
      status:'post-review exploratory reanalysis of the SAME observed sample, not a new independent test',
      group_definition:'beds missing means no usable record, not confirmed absence of beds',
      denominator_applied:false},
    distribution:{observed:distribution(observed),missing:distribution(missing)},
    folds,oof,metrics,by_fold,by_department,comparisons,
    decision:{
      primary_reference_error:metrics.find(m=>m.group==='primary_small_no_beds'&&m.method==='siempre_1').mean_absolute_log_error,
      methods_with_lower_primary_error:metrics.filter(m=>m.group==='primary_small_no_beds'&&m.method!=='selected_nested'&&m.method!=='siempre_1'&&m.mean_absolute_log_error<metrics.find(q=>q.group==='primary_small_no_beds'&&q.method==='siempre_1').mean_absolute_log_error-1e-12).map(m=>m.method),
      caution:'Exploratory comparison only. Winning constant does not verify service existence. No new imputation or production changes.'
    }
  };
}

function sensitivityAudit(P, payload) {
  const results=[];
  for(const scope of ['decree','all']) {
    const state={scope,date:'2026-09-11',severity:'total'};
    const baseline=P.models(payload).sectorial.compute(state);
    const original=new Map(baseline.items.map(r=>[r.code,r]));
    for(const baseAtrato of [1,2,3])for(const baseTrujillo of [1,2,3]){
      const den={...payload.denominators,
        rows:payload.denominators.rows.map(r=>r.code==='76828'&&r.kind==='consultorios_urgencias_reps'?{...r,value:baseTrujillo}:r),
        health_imputations:payload.denominators.health_imputations.map(r=>r.code==='27050'&&r.kind==='consultorios_urgencias_reps'?{...r,value:baseAtrato}:r)};
      const result=P.models({...payload,denominators:den}).sectorial.compute(state);
      const field=r=>r.sectors.find(s=>s.id==='salud').fields.find(f=>f.id==='pnud_csalud');
      const values=result.items.map(r=>field(r)).filter(f=>f.rate!=null);
      const anchor=Math.max(...values.map(f=>f.rate));
      const maxMunicipalities=result.items.filter(r=>field(r).rate===anchor).map(r=>r.m);
      const items=result.items.map(r=>{
        const old=original.get(r.code),f=field(r),oldF=old?field(old):null;
        return {code:r.code,municipality:r.m,department:r.d,health:f.score,health_before:oldF?.score??null,
          health_change:f.score!=null&&oldF?.score!=null?f.score-oldF.score:null,
          global_score:r.lower,global_before:old?.lower??null,global_change:old?r.lower-old.lower:null,
          rank:r.rank,rank_before:old?.rank??null,denominator:f.denominator?.value??null,affected:f.row?.v??null};
      });
      results.push({scope,base_atrato:baseAtrato,base_trujillo:baseTrujillo,anchor,
        max_municipalities:maxMunicipalities,
        changed_health:items.filter(r=>r.health_change!=null&&Math.abs(r.health_change)>1e-9).length,
        changed_global:items.filter(r=>r.global_change!=null&&Math.abs(r.global_change)>1e-9).length,
        changed_rank:items.filter(r=>r.rank!==r.rank_before).length,
        atrato:items.find(r=>r.code==='27050'),trujillo:items.find(r=>r.code==='76828'),items});
    }
  }
  return {note:'Hypothetical sensitivity, not corrected observations, confidence bounds, or evidence that registered stock is wrong. Recomputes original six-sector engine; payload is not written.',scenarios:results};
}

if(typeof module!=='undefined')module.exports={correctedAudit,sensitivityAudit};

if(typeof require!=='undefined'&&require.main===module){
  const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
  const root=path.resolve(__dirname,'..');
  const readPinned=(file,sha)=>{
    const b=fs.readFileSync(path.join(root,file));
    const actual=crypto.createHash('sha1').update(Buffer.from('blob '+b.length+'\0')).update(b).digest('hex');
    if(actual!==sha)throw Error('Archivo distinto del corte congelado: '+file);
    return b.toString('utf8');
  };
  const input=JSON.parse(readPinned('experimentos/ml_salud/entrada.json','989bac0dcbf1e89d778c7494adc0cfb4e66165b4'));
  readPinned('scripts/ml_salud.cjs','d96d77e0cbb217030c0eb8614d9ea6b219ff303b');
  const ML=require('./ml_salud.cjs');
  const result=correctedAudit(ML,input);
  const output=path.join(root,'experimentos','ml_salud','revision_faltantes');
  fs.mkdirSync(output,{recursive:true});
  fs.writeFileSync(path.join(output,'comparacion.json'),JSON.stringify(result));
  const headers=['codigo','municipio','departamento','poblacion_2026','registro_camas','observado_2022','grupo','siempre_1','mediana_comparables','poisson_demografia','poisson_capacidades','seleccion_interna','prediccion_seleccionada'];
  const esc=v=>{const s=String(v??'');return /[",\r\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s};
  const csv=[headers,...result.oof.map(r=>[r.code,r.municipality,r.department,r.population_2026,r.has_beds,r.observed,r.fold,...result.protocol.candidates.map(k=>r.predictions[k]),r.selected_id,r.selected_prediction])].map(r=>r.map(esc).join(',')).join('\n')+'\n';
  fs.writeFileSync(path.join(output,'validacion_comparada.csv'),csv);
  // Sensitivity depends on the original dashboard engine. Verify every dependency.
  for(const [file,sha] of Object.entries({"web/priorizacion.js":"ffe23b91f83f803be7fc521b69b86795140f2ba1","web/denominadores.js":"f2213f2bd31e68fa0e1091ea256d72ed78280b86","web/modelo.js":"4f66d9bf236df4c36561565c6633e9197bf7ec56"}))readPinned(file,sha);
  const html=readPinned('index.html','98592fadffd7fb9d7b821b7420c8948be6c4aef1');
  const marker=html.indexOf('const DATA=');
  if(marker<0)throw Error('DATA no encontrado');
  const start=marker+'const DATA='.length;
  let depth=0,quoted=false,escape=false,end=-1;
  for(let i=start;i<html.length;i++){
    const ch=html[i];
    if(quoted){if(escape)escape=false;else if(ch==='\\')escape=true;else if(ch==='"')quoted=false;continue}
    if(ch==='"'){quoted=true;continue}
    if(ch==='{')depth++;else if(ch==='}'&&--depth===0){end=i+1;break}
  }
  if(end<0)throw Error('DATA incompleto');
  const payload=JSON.parse(html.slice(start,end));
  const P=require('../web/priorizacion.js');
  fs.writeFileSync(path.join(output,'sensibilidad.json'),JSON.stringify(sensitivityAudit(P,payload)));
  console.log('Revisión calculada. index.html y denominadores no se modificaron.');
}
