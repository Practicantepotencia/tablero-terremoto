'use strict';
const SCENARIO='urgencias_ml_2026_09_15',KIND='consultorios_urgencias_reps',SOURCE='ml_urgencias_2026_09_15',UNIT='Consultorios de urgencias';
function applyUrgencyML(denominators,snapshot,experiment,input){
 const den=JSON.parse(JSON.stringify(denominators));
 const result=experiment.results.find(r=>r.target.id==='urgencias');
 if(!result||result.final_selection.config.id!=='poisson_capacidades'||snapshot.config.id!=='urgencias'||snapshot.config.kind!==KIND||input.target_date!=='2022-11-05')throw Error('Experimento o stock de urgencias incompatible');
 if(den.sources.reps_capacity_2022&&den.sources.reps_capacity_2022.sha256!==snapshot.source.sha256)throw Error('La fuente REPS cambió: requiere nueva validación');
 if(!den.sources.reps_capacity_2022)den.sources.reps_capacity_2022=JSON.parse(JSON.stringify(snapshot.source));
 const stock=snapshot.municipal_rows,seen=new Set(),train=new Map(input.rows.map(r=>[r.code,r.capacity_2022[1]]));
 if(!Array.isArray(stock)||stock.length!==901)throw Error('Stock histórico de urgencias incompleto');
 for(const r of stock){
  if(seen.has(r.code)||r.kind!==KIND||r.status!=='verified_historical'||r.unit!==UNIT||r.source!=='reps_capacity_2022'||r.reference_date!=='2022-11-05'||!(r.value>0)||train.get(r.code)!==r.value)throw Error('Stock histórico inconsistente: '+r.code);
  const records=snapshot.records.filter(v=>v.code===r.code);
  if(records.reduce((s,v)=>s+v.value,0)!==r.value||records.length!==r.record_count||new Set(records.map(v=>v.site)).size!==r.site_count)throw Error('Detalle REPS no concuerda: '+r.code);
  seen.add(r.code);
 }
 const priorCodes=new Set(den.rows.filter(r=>r.kind===KIND).map(r=>r.code));
 den.rows.push(...stock.filter(r=>!priorCodes.has(r.code)));
 const registered=new Set(den.rows.filter(r=>r.kind===KIND).map(r=>r.code)),eligible=[],abstentions=[];
 const predictionCodes=new Set();
 for(const p of result.predictions){
  if(predictionCodes.has(p.code))throw Error('Predicción duplicada: '+p.code);predictionCodes.add(p.code);
  if(registered.has(p.code))continue;
  const good=p.exploratory_supported===true&&p.released_estimate===p.predicted&&Number.isFinite(p.predicted)&&p.predicted>=1&&p.capacity_2022[1]===null&&p.missing_pattern_observed_n>=30&&p.out_of_training_range_features.length===0&&Number.isFinite(p.ipm_2018);
  if(!good){abstentions.push({code:p.code,reasons:p.reasons});continue}
  eligible.push({code:p.code,year:2022,kind:KIND,value:p.predicted,unit:UNIT,source:SOURCE,reference_date:'2022-11-05',area:'Total',status:'estimated_ml',
   estimated_at:'2026-09-15',scenario_id:SCENARIO,model_id:'poisson_capacidades',positive_only:true,support_n:p.missing_pattern_observed_n,
   out_of_range:false,population_year:2026,ipm_year:2018,
   locator:'experimentos/ml_salud/estimaciones_faltantes.csv · urgencias · DIVIPOLA '+p.code,
   descriptive_error_band:p.descriptive_error_band,at_positive_floor:p.predicted===1});
 }
 den.sources[SOURCE]={label:'ML · Poisson de urgencias, estimación experimental',
  url:'https://github.com/Practicantepotencia/tablero-terremoto/blob/salud-relativa-urgencias-ml/docs/ML_URGENCIAS_APLICADO.md',
  published:'2026-09-15',target_reference:'2022-11-05',training_n:901,
  artifact_blob_sha:'0d0dabd32ee5f6fdfac59bbb7a1f656b945d9e2f',predictions_blob_sha:'e94c068938882ffaca335da2ee2cf6ef23b2d4bc',
  caveat:'Condicionado a existencia de capacidad positiva; no acredita existencia del servicio ni stock operativo 2026. Bandas descriptivas, no intervalos de confianza.'};
 den.health_variant={id:'urgencias',mode:'capacity_pressure',baseline_year:2022,kind:KIND,numerator_source:'PNUD',numerator_id:'pnud_csalud',
  notice:'Salud: centros afectados PNUD por consultorio de urgencias. REPS 2022; sólo faltantes con soporte reciben una base ML marcada. Escenario condicionado a que exista el servicio. Los límites por faltantes no incluyen el error de ML.',
  ml:{enabled:true,scenario_id:SCENARIO,model_id:'poisson_capacidades',source:SOURCE,retrospective_scenario:true,population_year:2026,estimated_at:'2026-09-15'}};
 den.health_imputations=eligible.sort((a,b)=>a.code.localeCompare(b.code));
 den.health_imputation_audit={scenario_id:SCENARIO,observed_registered:den.rows.filter(r=>r.kind===KIND).length,applied:eligible.length,abstained:abstentions.length,abstentions,remaining_uncertainty:'No incluye posible cero real, cambio 2022–2026 ni error de estimación del denominador.'};
 return den;
}
if(typeof module!=='undefined')module.exports={applyUrgencyML};
if(typeof require!=='undefined'&&require.main===module){
 const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..');
 const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
 const den=applyUrgencyML(read('data/denominadores_sectoriales.json'),read('data/salud_capacidad_reps_2022.json'),read('experimentos/ml_salud/resultados.json'),read('experimentos/ml_salud/entrada.json'));
 fs.writeFileSync(path.join(root,'data/denominadores_sectoriales.json'),JSON.stringify(den,null,2)+'\n');
 console.log(den.health_imputation_audit);
 console.log('Regenerar index.html con python generar_tablero_recuperacion.py');
}
