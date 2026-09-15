'use strict';
// Pure JavaScript, no runtime dependencies. Models predict historical capacity,
// never damage, UNGRD recovery scores, or the prioritization index.
const ML = (() => {
 const mean=a=>a.reduce((s,v)=>s+v,0)/a.length;
 const quantile=(a,q)=>{const s=[...a].sort((a,b)=>a-b);if(!s.length)return null;const p=(s.length-1)*q,i=Math.floor(p);return s[i]+(s[Math.min(i+1,s.length-1)]-s[i])*(p-i)};
 const metrics=(a,p)=>{
   if(!a.length)return {n:0,mae:null,rmse:null,r2:null};
   const y=mean(a), ae=a.map((v,i)=>Math.abs(v-p[i])),se=ae.reduce((s,v)=>s+v*v,0),tot=a.reduce((s,v)=>s+(v-y)**2,0);
   return {n:a.length,mae:mean(ae),mean_absolute_log_error:mean(a.map((v,i)=>Math.abs(Math.log(Math.max(p[i],1))-Math.log(v)))),median_absolute_error:quantile(ae,.5),rmse:Math.sqrt(se/a.length),r2:tot>0?1-se/tot:null,
    within_one_fraction:ae.filter(v=>v<=1).length/a.length,
    median_absolute_percentage_error:quantile(a.map((v,i)=>Math.abs(v-p[i])/v*100),.5),
    median_inverse_ratio_error_percent:quantile(a.map((v,i)=>p[i]>0?Math.abs(v/p[i]-1)*100:1e9),.5)};
 };
 function folds(rows,k){
   const counts=new Map();for(const r of rows)counts.set(r.department,(counts.get(r.department)||0)+1);
   if(counts.size<k)throw Error('Not enough independent departments');
   const bins=Array.from({length:k},()=>({n:0,departments:[]}));
   const ordered=[...counts].sort((a,b)=>b[1]-a[1]||(a[0]<b[0]?-1:a[0]>b[0]?1:0));
   for(const [d,n]of ordered){let j=0;for(let i=1;i<k;i++)if(bins[i].n<bins[j].n)j=i;bins[j].n+=n;bins[j].departments.push(d)}
   return bins.map(b=>({departments:b.departments,rows:rows.filter(r=>b.departments.includes(r.department))}));
 }
 function rawFeatures(r,target,enriched){
   const v=[Math.log1p(r.population_2026),Number.isFinite(r.ipm_2018)?r.ipm_2018:null,Number.isFinite(r.ipm_2018)?0:1];
   if(enriched) for(let j=0;j<3;j++)if(j!==target){
     const c=r.capacity_2022[j];v.push(c===null?0:Math.log1p(c),c===null?1:0);
   }
   return v;
 }
 function preprocess(rows,target,enriched){
   const X=rows.map(r=>rawFeatures(r,target,enriched)),p=X[0].length;
   const med=Array.from({length:p},(_,j)=>quantile(X.map(r=>r[j]).filter(Number.isFinite),.5)??0);
   const filled=X.map(r=>r.map((v,j)=>Number.isFinite(v)?v:med[j]));
   const avg=Array.from({length:p},(_,j)=>mean(filled.map(r=>r[j])));
   const sd=Array.from({length:p},(_,j)=>Math.sqrt(mean(filled.map(r=>(r[j]-avg[j])**2)))||1);
   return {med,avg,sd};
 }
 function transform(r,target,enriched,s){
   return rawFeatures(r,target,enriched).map((v,j)=>((Number.isFinite(v)?v:s.med[j])-s.avg[j])/s.sd[j]);
 }
 function solve(A,b){
   A=A.map((r,i)=>[...r,b[i]]);const n=b.length;
   for(let k=0;k<n;k++){
     let pivot=k;for(let i=k+1;i<n;i++)if(Math.abs(A[i][k])>Math.abs(A[pivot][k]))pivot=i;
     [A[k],A[pivot]]=[A[pivot],A[k]];
     if(Math.abs(A[k][k])<1e-12)throw Error('Singular Newton system');
     const scale=A[k][k];for(let j=k;j<=n;j++)A[k][j]/=scale;
     for(let i=0;i<n;i++)if(i!==k){const f=A[i][k];for(let j=k;j<=n;j++)A[i][j]-=f*A[k][j]}
   }return A.map(r=>r[n]);
 }
 function poisson(X,y,alpha=1){
   X=X.map(r=>[1,...r]);const p=X[0].length,n=y.length;let beta=Array(p).fill(0);beta[0]=Math.log(mean(y));
   const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
   const loss=b=>{
     let total=0;for(let i=0;i<n;i++){const eta=dot(X[i],b);if(!Number.isFinite(eta)||eta>30)return Infinity;total+=Math.exp(eta)-y[i]*eta}
     return total/n+alpha*b.slice(1).reduce((s,v)=>s+v*v,0)/2;
   };
   let iterations=0,converged=false;
   for(;iterations<80;iterations++){
     const g=Array(p).fill(0),H=Array.from({length:p},()=>Array(p).fill(0));
     for(let i=0;i<n;i++){const mu=Math.exp(dot(X[i],beta));for(let j=0;j<p;j++){g[j]+=(mu-y[i])*X[i][j]/n;for(let k=0;k<p;k++)H[j][k]+=mu*X[i][j]*X[i][k]/n}}
     for(let j=1;j<p;j++){g[j]+=alpha*beta[j];H[j][j]+=alpha}
     if(Math.max(...g.map(Math.abs))<1e-7){converged=true;break}
     const step=solve(H,g),old=loss(beta);let rate=1,accepted=false;
     for(let b=0;b<35;b++){const candidate=beta.map((v,j)=>v-rate*step[j]);if(loss(candidate)<=old-1e-4*rate*dot(g,step)){beta=candidate;accepted=true;break}rate/=2}
     if(!accepted){converged=Math.max(...step.map(Math.abs))<1e-6;break}
     if(Math.max(...step.map(v=>Math.abs(v*rate)))<1e-8){converged=true;break}
   }
   return {kind:'poisson',beta,alpha,iterations,converged};
 }
 function treeValue(tree,x){while(tree.feature!==undefined)tree=x[tree.feature]<=tree.threshold?tree.left:tree.right;return tree.value}
 function boost(X,y,{rounds=160,depth=2,minLeaf=20,rate=.05,bins=24}={}){
   const n=y.length,p=X[0].length,z=y.map(Math.log1p),base=mean(z),prediction=Array(n).fill(base),trees=[];
   const edges=Array.from({length:p},(_,j)=>{
     const vals=[...new Set(X.map(r=>r[j]))].sort((a,b)=>a-b), cuts=[];
     if(vals.length<=bins+1){for(let i=0;i<vals.length-1;i++)cuts.push((vals[i]+vals[i+1])/2)}
     else{for(let i=1;i<=bins;i++){const k=Math.floor(i*vals.length/(bins+1));cuts.push((vals[k-1]+vals[k])/2)}}
     return [...new Set(cuts)];
   });
   const binX=X.map(row=>row.map((v,j)=>{let k=0;while(k<edges[j].length&&v>edges[j][k])k++;return k}));
   function grow(ids,residual,level){
     const total=ids.reduce((s,i)=>s+residual[i],0),leaf={value:total/ids.length};
     if(level===depth||ids.length<2*minLeaf)return leaf;
     let bestGain=1e-12,best=null;
     for(let j=0;j<p;j++){
       const m=edges[j].length,counts=Array(m+1).fill(0),sums=Array(m+1).fill(0);
       for(const i of ids){counts[binX[i][j]]++;sums[binX[i][j]]+=residual[i]}
       let count=0,sum=0;
       for(let k=0;k<m;k++){count+=counts[k];sum+=sums[k];const nr=ids.length-count;if(count<minLeaf||nr<minLeaf)continue;
         const gain=sum*sum/count+(total-sum)**2/nr-total*total/ids.length;
         if(gain>bestGain){bestGain=gain;best={feature:j,threshold:edges[j][k]}}
       }
     }
     if(!best)return leaf;
     const left=[],right=[];for(const i of ids)(X[i][best.feature]<=best.threshold?left:right).push(i);
     return {...best,left:grow(left,residual,level+1),right:grow(right,residual,level+1)};
   }
   const ids=Array.from({length:n},(_,i)=>i);
   for(let t=0;t<rounds;t++){const res=z.map((v,i)=>v-prediction[i]),tree=grow(ids,res,0);trees.push(tree);for(let i=0;i<n;i++)prediction[i]+=rate*treeValue(tree,X[i])}
   return {kind:'boost_log1p',base,rate,trees,params:{rounds,depth,minLeaf,bins}};
 }
 const candidates=[
   {id:'mediana_por_poblacion',family:'population_median',enriched:false},
   {id:'poisson_demografia',family:'poisson',enriched:false,alpha:1},
   {id:'poisson_capacidades',family:'poisson',enriched:true,alpha:1},
   {id:'boosting_demografia',family:'boosting',enriched:false},
   {id:'boosting_capacidades',family:'boosting',enriched:true}
 ];
 function train(rows,target,config){
   if(rows.some(r=>!(r.capacity_2022[target]>0)))throw Error('Only observed positive targets may train');
   if(config.family==='population_median'){
     const thresholds=[.2,.4,.6,.8].map(q=>quantile(rows.map(r=>r.population_2026),q));
     const category=r=>thresholds.filter(v=>r.population_2026>v).length;
     const global=quantile(rows.map(r=>r.capacity_2022[target]),.5);
     const medians=Array.from({length:5},(_,i)=>quantile(rows.filter(r=>category(r)===i).map(r=>r.capacity_2022[target]),.5)??global);
     return {target,config,model:{kind:'population_median',thresholds,medians}};
   }
   const scaler=preprocess(rows,target,config.enriched),X=rows.map(r=>transform(r,target,config.enriched,scaler)),y=rows.map(r=>r.capacity_2022[target]);
   const model=config.family==='poisson'?poisson(X,y,config.alpha):boost(X,y);
   return {target,config,scaler,model};
 }
 function predict(fitted,row){
   const m=fitted.model;if(m.kind==='population_median')return m.medians[m.thresholds.filter(v=>row.population_2026>v).length];
   const x=transform(row,fitted.target,fitted.config.enriched,fitted.scaler);
   if(m.kind==='poisson')return Math.max(1,Math.exp(m.beta[0]+x.reduce((s,v,j)=>s+v*m.beta[j+1],0)));
   return Math.max(1,Math.expm1(m.base+m.rate*m.trees.reduce((s,t)=>s+treeValue(t,x),0)));
 }
 function select(rows,target,k=3){
   const splits=folds(rows,k),scores=candidates.map(config=>{
     const real=[],pred=[];
     for(const fold of splits){
       const trainRows=rows.filter(r=>!fold.departments.includes(r.department)),model=train(trainRows,target,config);
       for(const r of fold.rows){real.push(r.capacity_2022[target]);pred.push(predict(model,r))}
     }
     return {id:config.id,...metrics(real,pred)};
   }).sort((a,b)=>a.mean_absolute_log_error-b.mean_absolute_log_error);
   return {config:candidates.find(c=>c.id===scores[0].id),scores};
 }
 function evaluateTarget(input,target,onFold=()=>{}){
   const rows=input.rows.filter(r=>r.capacity_2022[target]>0),splits=folds(rows,5),oof=[],selected=[];
   for(let f=0;f<splits.length;f++){
     const fold=splits[f],trainRows=rows.filter(r=>!fold.departments.includes(r.department));
     const choice=select(trainRows,target,3),model=train(trainRows,target,choice.config),baseline=quantile(trainRows.map(r=>r.capacity_2022[target]),.5);
     for(const r of fold.rows){const pred=predict(model,r);if(!Number.isFinite(pred)||pred<0)throw Error('Invalid prediction');
       oof.push({code:r.code,municipality:r.municipality,department:r.department,population_2026:r.population_2026,fold:f+1,model:choice.config.id,observed:r.capacity_2022[target],predicted:pred,baseline,error:pred-r.capacity_2022[target]});
     }
     selected.push({fold:f+1,train_n:trainRows.length,test_n:fold.rows.length,held_out_departments:fold.departments,selected:choice.config.id,inner_scores:choice.scores,converged:model.model.converged??null});
     onFold(f+1,choice.config.id);
   }
   const summary=subset=>metrics(subset.map(r=>r.observed),subset.map(r=>r.predicted));
   const selection=select(rows,target,5),model=train(rows,target,selection.config);
   const targetMissing=input.rows.filter(r=>r.capacity_2022[target]===null);
   const predictions=targetMissing.map(r=>{
     const predicted=predict(model,r),pattern=r.capacity_2022.map((v,j)=>j===target?'target':v===null?'missing':'observed').join('|');
     const support=rows.filter(t=>t.capacity_2022.map((v,j)=>j===target?'target':v===null?'missing':'observed').join('|')===pattern);
     const raw=rawFeatures(r,target,model.config.enriched),trainRaw=rows.map(t=>rawFeatures(t,target,model.config.enriched));
     const outOfRange=raw.map((v,j)=>{const a=trainRaw.map(x=>x[j]).filter(Number.isFinite);return Number.isFinite(v)&&a.length&&(v<Math.min(...a)||v>Math.max(...a))?j:null}).filter(v=>v!==null);
     return {...r,predicted,missing_pattern_observed_n:support.length,out_of_training_range_features:outOfRange,status:'experimental_conditional_positive_not_for_index'};
   });
   return {target:input.targets[target],train_n:rows.length,missing_n:targetMissing.length,metrics:summary(oof),baseline_metrics:metrics(oof.map(r=>r.observed),oof.map(r=>r.baseline)),
     small_under_50000:summary(oof.filter(r=>r.population_2026<50000)),observed_one_to_five:summary(oof.filter(r=>r.observed<=5)),
     folds:selected,final_selection:selection,predictions,oof,model};
 }
 return {mean,quantile,metrics,folds,rawFeatures,preprocess,transform,solve,poisson,boost,treeValue,candidates,train,predict,select,evaluateTarget};
})();
if(typeof module!=='undefined')module.exports=ML;

function finishResult(r){
 const residuals=r.oof.map(x=>Math.log(x.predicted/x.observed)),q10=ML.quantile(residuals,.1),q90=ML.quantile(residuals,.9);
 r.error_band={type:"descriptive_oof_80_percent_not_confidence_interval",log_pred_over_observed_quantile_10:q10,log_pred_over_observed_quantile_90:q90,note:"Dispersión central del error fuera de muestra, no garantía de cobertura en municipios sin registro. No es intervalo validado para ceros o capacidad 2026."};
 for(const p of r.predictions){
   p.exploratory_supported=p.missing_pattern_observed_n>=30&&p.out_of_training_range_features.length===0&&Number.isFinite(p.ipm_2018);
   p.released_estimate=p.exploratory_supported?p.predicted:null;
   p.descriptive_error_band=p.exploratory_supported?[Math.max(1,p.predicted/Math.exp(q90)),Math.max(1,p.predicted/Math.exp(q10))]:null;
   p.reasons=[];if(p.missing_pattern_observed_n<30)p.reasons.push("menos_de_30_ejemplos_con_mismo_patron_de_otros_registros");
   if(p.out_of_training_range_features.length)p.reasons.push("predictor_fuera_del_rango_de_entrenamiento");
   if(!Number.isFinite(p.ipm_2018))p.reasons.push("IPM_no_disponible");
   p.reasons.push("no_se_puede_distinguir_ausencia_real_de_falta_de_registro","no_valida_capacidad_2026");
 }
 return r;
}
ML.finishResult=finishResult;
