/* Paired descriptive comparison. Never recalibrates indices on the paired sample. */
(function(root){
  'use strict';
  const MODES=['absolute','percapita','sectorial'];
  function midranks(values){
    const sorted=values.map((v,i)=>({v,i})).sort((a,b)=>a.v-b.v),out=[];
    for(let i=0;i<sorted.length;){
      let j=i+1;while(j<sorted.length&&sorted[j].v===sorted[i].v)j++;
      for(let k=i;k<j;k++)out[sorted[k].i]=(i+1+j)/2;
      i=j;
    }
    return out;
  }
  function fit(xs,ys){
    if(xs.length!==ys.length||xs.length<2||!xs.every(Number.isFinite)||!ys.every(Number.isFinite))return null;
    const n=xs.length,mx=xs.reduce((s,x)=>s+x,0)/n,my=ys.reduce((s,y)=>s+y,0)/n;
    let xx=0,yy=0,xy=0;
    xs.forEach((x,i)=>{xx+=(x-mx)**2;yy+=(ys[i]-my)**2;xy+=(x-mx)*(ys[i]-my);});
    if(xx===0||yy===0)return null;
    const r=Math.max(-1,Math.min(1,xy/Math.sqrt(xx*yy)));
    return {r,r2:r*r,slope:xy/xx,intercept:my-xy/xx*mx};
  }
  function statistics(pairs){
    const xs=pairs.map(p=>p.x),ys=pairs.map(p=>p.y);
    // At least 3 observations: avoid the vacuous R²=1 from any two distinct points.
    const regression=pairs.length>=3?fit(xs,ys):null;
    const rankFit=pairs.length>=3?fit(midranks(xs),midranks(ys)):null;
    return {n:pairs.length,regression,rho:rankFit?.r??null,
      reason:pairs.length<3?'Se requieren al menos tres pares.':!regression?'Una de las series es constante: correlación y R² no definidos.':''};
  }
  function compare(models,territorial,state,{mode='absolute',panel='common',axis='rank'}={}){
    if(!MODES.includes(mode))throw new Error('Modo desconocido');
    const results=Object.fromEntries(MODES.map(k=>[k,models[k].compute(state)]));
    const maps=Object.fromEntries(MODES.map(k=>[k,new Map(results[k].items.map(r=>[r.geo,r]))]));
    const rows=territorial.strict(territorial.visible({...state,dept:''}),'undp_rapida_recovery_needs');
    const groups=new Map();
    rows.filter(r=>Number.isFinite(r.v)).forEach(r=>{if(!groups.has(r.geo))groups.set(r.geo,[]);groups.get(r.geo).push(r);});
    const unique=[...groups.values()].filter(rs=>rs.every(r=>r.v===rs[0].v)).map(rs=>rs[0]);
    const recovery=new Map(territorial.ranked(unique).map(r=>[r.geo,r]));
    const universe=results[mode].all.filter(r=>!state.dept||r.d===state.dept);
    const excluded={index:0,rapida:0,common:0},pairs=[];
    for(const place of universe){
      const own=maps[mode].get(place.geo),rec=recovery.get(place.geo);
      if(!own||!Number.isFinite(own.lower)){excluded.index++;continue;}
      if(!rec){excluded.rapida++;continue;}
      if(panel==='common'&&!MODES.every(k=>maps[k].has(place.geo))){excluded.common++;continue;}
      pairs.push({geo:place.geo,m:place.m,d:place.d,x:own.lower,y:axis==='rank'?rec.rank:rec.v,
        lower:own.lower,upper:own.upper,ownRank:own.rank,recoveryRank:rec.rank,recovery:rec.v,
        available:own.available,coverage:own.coverage});
    }
    return {pairs,...statistics(pairs),excluded,total:universe.length,referenceN:results[mode].referenceN,
      recoveryN:recovery.size,mode,panel,axis};
  }
  const api={MODES,midranks,fit,statistics,compare};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Comparacion=api;
})(typeof globalThis!=='undefined'?globalThis:this);
