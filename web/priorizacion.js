/* Modelo 1.1: escala proporcional, pesos fijos y límites por datos faltantes. */
(function (root) {
  'use strict';
  const T = typeof module !== 'undefined' && module.exports ? require('./modelo.js') : root.Territorial;
  const field = (id, source, label, share) => ({id, source, label, share, unit:'Número'});
  const reported = (id, label, share=1) => field('3is_'+id, '3iS-Sheets', label, share);
  const estimated = (id, label, share=1) => field('pnud_'+id, 'PNUD', label, share);
  // Cada sector pesa 1/6. En sectores compartidos, cada canal pesa 1/2.
  // Los canales pueden compartir insumos: nunca se cuentan como validaciones independientes.
  const SECTORS = [
    {id:'hogares', name:'Hogares afectados', fields:[reported('familias','Familias afectadas')]},
    {id:'vivienda', name:'Vivienda', fields:[reported('vivdestruidas','Destruidas · 3iS',.25),reported('vivaveriadas','Averiadas · 3iS',.25),estimated('vd','Destruidas · PNUD',.25),estimated('va','Averiadas · PNUD',.25)]},
    {id:'salud', name:'Salud', fields:[reported('salud','Puntos de salud · 3iS',.5),estimated('csalud','Centros de salud · PNUD',.5)]},
    {id:'educacion', name:'Educación', fields:[reported('educativos','Puntos educativos · 3iS',.5),estimated('cedu','Centros educativos · PNUD',.5)]},
    {id:'infraestructura', name:'Infraestructura y acceso', fields:[reported('colapsos','Colapsos de edificios',1/3),reported('acueductos','Acueductos afectados',1/3),reported('vias','Vías afectadas (conteo)',1/3)]},
    {id:'comunidad', name:'Servicios comunitarios', fields:[reported('comunitarios','Puntos comunitarios · 3iS',.5),estimated('ccom','Centros comunitarios · PNUD',.5)]}
  ];
  const clamp = (v,lo,hi) => Math.min(hi,Math.max(lo,v));
  const EPS = 1e-8;
  const same = (a,b) => Math.abs(a-b)<EPS;
  function normalize(value, anchor) {
    if (!Number.isFinite(value) || value<0) return null;
    if (value===0) return 0;
    if (!(anchor>0)) return null;
    return 100*clamp(value/anchor,0,1);
  }
  function aggregate(sectors, vulnerability, weights, alpha=.25) {
    const sum=weights.reduce((a,b)=>a+b,0);
    const lo=sectors.reduce((s,d,i)=>s+d.lower*weights[i]/sum,0);
    const hi=sectors.reduce((s,d,i)=>s+d.upper*weights[i]/sum,0);
    // IPM/100, no percentil de pobreza. Si falta, propagar el intervalo 0..1.
    const vLo=vulnerability==null?0:vulnerability/100, vHi=vulnerability==null?1:vulnerability/100;
    return {lower:lo*(1+alpha*vLo)/(1+alpha), upper:hi*(1+alpha*vHi)/(1+alpha),damageLower:lo,damageUpper:hi};
  }
  function ranks(items, value='lower') {
    const sorted=items.slice().sort((a,b)=>b[value]-a[value] || T.label(a).localeCompare(T.label(b),'es'));
    let previous, rank=0;
    return sorted.map((r,i)=>{if(!i||!same(r[value],previous))rank=i+1;previous=r[value];return {...r,rank};});
  }
  function create(data, territorial=T.create(data)) {
    const cache=new Map();
    function compute(state) {
      // Solo ámbito y captura definen referencias; buscar/filtrar departamento no renormaliza.
      const key=JSON.stringify([state.scope,state.date]);
      if(cache.has(key))return cache.get(key);
      const base=territorial.visible({...state,dept:''}).filter(r=>r.lv==='municipal');
      const places=[...new Map(base.map(r=>[r.geo,r])).values()];
      const baselines=new Map((data.baseline?.rows||[]).map(r=>[r.code,r]));
      const calibrations=new Map();
      SECTORS.flatMap(s=>s.fields).forEach(f=>{
        const candidates=base.filter(r=>r.f===f.source&&r.id===f.id);
        const cohorts=new Set(candidates.map(T.cohort));
        const coherent=cohorts.size<=1 && candidates.every(r=>r.u===f.unit);
        const byGeo=new Map();
        if(coherent)candidates.forEach(r=>{if(!byGeo.has(r.geo))byGeo.set(r.geo,[]);byGeo.get(r.geo).push(r);});
        const accepted=[...byGeo.values()].filter(rs=>rs.every(r=>r.v===rs[0].v)).map(rs=>rs[0]);
        const values=accepted.map(r=>r.v).filter(v=>Number.isFinite(v)&&v>=0);
        const positive=values.filter(v=>v>0),anchor=values.length?Math.max(...values):null;
        calibrations.set(f.id,{...f,anchor,n:values.length,positive:positive.length,coherent,values,rows:new Map(accepted.map(r=>[r.geo,r]))});
      });
      const recovery=territorial.strict(base,T.RECOVERY);
      const recoveryRank=new Map(territorial.ranked(recovery).map(r=>[r.geo,r]));
      const weights=SECTORS.map(()=>1);
      const items=places.map(place=>{
        const sectors=SECTORS.map(sector=>{
          const fields=sector.fields.map(f=>{
            const c=calibrations.get(f.id),r=c.rows.get(place.geo),score=normalize(r?.v,c.anchor);
            return {...f,row:r||null,score,anchor:c.anchor,n:c.n,positive:c.positive,
              percentile:r?T.percentile(c.values,r.v):null,contribution:score==null?null:score*f.share/6};
          });
          const lower=fields.reduce((s,f)=>s+(f.score??0)*f.share,0);
          const unknown=fields.filter(f=>f.score==null).reduce((s,f)=>s+100*f.share,0);
          const coverage=clamp(1-unknown/100,0,1);
          return {...sector,fields,lower:clamp(lower,0,100),upper:clamp(lower+unknown,0,100),coverage:coverage<EPS?0:coverage};
        });
        const baseline=baselines.get(place.code),vulnerability=baseline&&baseline.v<=100?baseline.v:null;
        const score=aggregate(sectors,vulnerability,weights);
        const coverage=sectors.reduce((s,d)=>s+d.coverage/6,0);
        const rec=recoveryRank.get(place.geo);
        return {...place,...score,sectors,coverage,baseline:baseline||null,vulnerability,
          recovery:rec?.v??null,recoveryRank:rec?.rank??null,available:sectors.flatMap(s=>s.fields).filter(f=>f.score!=null).length,
          complete:coverage>1-EPS&&vulnerability!=null,rank:null,rankMin:null,rankMax:null};
      });
      const scored=items.filter(r=>r.coverage>EPS), ranked=ranks(scored);
      // Posición compatible con límites por faltantes; no es intervalo de confianza.
      ranked.forEach(r=>{
        r.bestRank=1+ranked.filter(o=>o.geo!==r.geo&&o.lower>r.upper+EPS).length;
        r.worstRank=1+ranked.filter(o=>o.geo!==r.geo&&o.upper>r.lower+EPS).length;
      });
      const scenarioWeights=[weights];
      for(let i=0;i<6;i++)for(const factor of [.75,1.25])scenarioWeights.push(weights.map((w,j)=>j===i?w*factor:w));
      let scenarios=0;
      for(const alpha of [0,.25,.5])for(const w of scenarioWeights){
        scenarios++;
        const simulation=ranks(ranked.map(r=>({...r,...aggregate(r.sectors,r.vulnerability,w,alpha)})));
        simulation.forEach(r=>{
          const target=ranked.find(x=>x.geo===r.geo);
          target.rankMin=target.rankMin==null?r.rank:Math.min(target.rankMin,r.rank);
          target.rankMax=target.rankMax==null?r.rank:Math.max(target.rankMax,r.rank);
        });
      }
      const top=new Set(ranked.filter(r=>r.rank<=20).map(r=>r.geo));
      const rapidaTop=recovery.filter(r=>recoveryRank.get(r.geo).rank<=20);
      const result={items:ranked,missing:items.filter(r=>r.coverage<=EPS).sort((a,b)=>T.label(a).localeCompare(T.label(b),'es')),
        all:items,calibrations:[...calibrations.values()].map(({rows,values,...r})=>r),scenarios,
        overlap:rapidaTop.filter(r=>top.has(r.geo)).length,rapidaTopN:rapidaTop.length,referenceN:places.length};
      cache.set(key,result);return result;
    }
    function selection(state) {
      const result=compute(state);
      const order=state.priorityOrder||'integrated';
      let items=[...result.items,...result.missing];
      if(order==='rapida')items.sort((a,b)=>(b.recovery??-1)-(a.recovery??-1)||T.label(a).localeCompare(T.label(b),'es'));
      if(order==='uncertainty')items.sort((a,b)=>b.upper-a.upper||a.coverage-b.coverage||T.label(a).localeCompare(T.label(b),'es'));
      const inView=r=>(!state.dept||r.d===state.dept)&&T.searchMatch(r,state.matrixSearch||'');
      return {...result,items:items.filter(inView)};
    }
    return {compute,selection};
  }
  const api={create,normalize,aggregate,ranks,SECTORS,VERSION:'1.1'};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Priorizacion=api;
})(typeof globalThis!=='undefined'?globalThis:this);
