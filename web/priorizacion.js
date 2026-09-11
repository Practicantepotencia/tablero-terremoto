/* Modelo 1.3: impacto total/grave, pesos fijos y límites por datos faltantes. */
(function (root) {
  'use strict';
  const T = typeof module !== 'undefined' && module.exports ? require('./modelo.js') : root.Territorial;
  const D = typeof module !== 'undefined' && module.exports ? require('./denominadores.js') : root.Denominadores;
  const field = (id, source, label, share) => ({id, source, label, share, unit:'Número'});
  const reported = (id, label, share=1) => field('3is_'+id, '3iS-Sheets', label, share);
  const estimated = (id, label, share=1) => field('pnud_'+id, 'PNUD', label, share);
  // Cada sector pesa 1/6. En sectores compartidos, cada canal pesa 1/2.
  // Los canales pueden compartir insumos: nunca se cuentan como validaciones independientes.
  const SECTORS = [
    {id:'impacto_humano', name:'Impacto humano', fields:[reported('fallecidos','Personas fallecidas',1/3),reported('desaparecidos','Personas desaparecidas',1/3),reported('heridos','Personas heridas',1/3)]},
    {id:'vivienda', name:'Vivienda', fields:[reported('vivdestruidas','Destruidas · 3iS',.25),reported('vivaveriadas','Averiadas · 3iS',.25),estimated('vd','Destruidas · PNUD',.25),estimated('va','Averiadas · PNUD',.25)]},
    {id:'salud', name:'Salud', fields:[reported('salud','Puntos de salud · 3iS',.5),estimated('csalud','Centros de salud · PNUD',.5)]},
    {id:'educacion', name:'Educación', fields:[reported('educativos','Puntos educativos · 3iS',.5),estimated('cedu','Centros educativos · PNUD',.5)]},
    {id:'infraestructura', name:'Infraestructura y acceso', fields:[reported('colapsos','Colapsos de edificios',1/3),reported('acueductos','Acueductos afectados',1/3),reported('vias','Vías afectadas (conteo)',1/3)]},
    {id:'comunidad', name:'Servicios comunitarios', fields:[reported('comunitarios','Puntos comunitarios · 3iS',.5),estimated('ccom','Centros comunitarios · PNUD',.5)]}
  ];
  function sectorsFor(severity='total') {
    if(!['total','grave'].includes(severity))throw new Error('Tipo de impacto desconocido: '+severity);
    const excluded=new Set(severity==='grave'?['3is_heridos','3is_vivaveriadas','pnud_va']:[]);
    return SECTORS.map(s=>{
      const fields=s.fields.filter(f=>!excluded.has(f.id));
      const sum=fields.reduce((n,f)=>n+f.share,0);
      return {...s,fields:fields.map(f=>({...f,share:f.share/sum}))};
    });
  }
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
  function create(data, territorial=T.create(data), options={}) {
    // Explicit modes keep the historical per-capita view separate from compatible stocks.
    const mode=options.mode||(options.relative===true?'sectorial':'absolute');
    if(!['absolute','percapita','sectorial'].includes(mode))throw new Error('Modo de priorización desconocido: '+mode);
    const relative=mode!=='absolute';
    const denominators=mode==='sectorial'?D.create(data):null;
    const cache=new Map();
    function compute(state) {
      // Cambiar impacto cambia componentes, no el universo de referencia de cada campo.
      const severity=state.severity||'total',definitions=sectorsFor(severity);
      const fieldCount=definitions.reduce((n,s)=>n+s.fields.length,0);
      const key=JSON.stringify([state.scope,state.date,severity]);
      if(cache.has(key))return cache.get(key);
      const base=territorial.visible({...state,dept:''}).filter(r=>r.lv==='municipal');
      const places=[...new Map(base.map(r=>[r.geo,r])).values()];
      const baselines=new Map((data.baseline?.rows||[]).map(r=>[r.code,r]));
      const populationGroups=new Map(),populations=new Map();
      (data.population?.rows||[]).filter(r=>String(r.year)===String(state.date).slice(0,4)).forEach(r=>{
        if(!populationGroups.has(r.code))populationGroups.set(r.code,[]);
        populationGroups.get(r.code).push(r);
      });
      populationGroups.forEach((rs,code)=>{
        if(rs.length===1&&Number.isFinite(rs[0].population)&&rs[0].population>0)populations.set(code,rs[0]);
      });
      const relativeMeasure=(r,id,code)=>{
        if(mode==='sectorial')return denominators.measure(r,id,code,state.date);
        const p=populations.get(code),valid=!!r&&Number.isFinite(r.v)&&r.v>=0;
        return {rate:p&&valid?10000*r.v/p.population:null,multiplier:10000,relativeUnit:'/10.000 hab.',
          denominatorLabel:'Población municipal proyectada',
          denominator:p?{...p,value:p.population,unit:'Habitantes',reference_date:String(p.year)}:null,
          denominatorSource:{label:'DANE · proyección municipal',url:data.population?.download||data.population?.url||'https://www.dane.gov.co/'},
          reason:!p?'Sin población positiva, única y del año de la captura.':!valid?'Sin numerador válido.':''};
      };
      const measure=r=>{if(!r||!Number.isFinite(r.v)||r.v<0)return null;
        if(!relative)return r.v;
        return relativeMeasure(r,r.id,r.code).rate;};
      const calibrations=new Map();
      definitions.flatMap(s=>s.fields).forEach(f=>{
        const candidates=base.filter(r=>r.f===f.source&&r.id===f.id);
        const cohorts=new Set(candidates.map(T.cohort));
        const coherent=cohorts.size<=1 && candidates.every(r=>r.u===f.unit);
        const byGeo=new Map();
        if(coherent)candidates.forEach(r=>{if(!byGeo.has(r.geo))byGeo.set(r.geo,[]);byGeo.get(r.geo).push(r);});
        const accepted=[...byGeo.values()].filter(rs=>rs.every(r=>r.v===rs[0].v)).map(rs=>rs[0]);
        const values=accepted.map(measure).filter(v=>Number.isFinite(v)&&v>=0);
        const positive=values.filter(v=>v>0),anchor=values.length?Math.max(...values):null;
        calibrations.set(f.id,{...f,anchor,n:values.length,positive:positive.length,coherent,values,rows:new Map(accepted.map(r=>[r.geo,r]))});
      });
      const recovery=territorial.strict(base,T.RECOVERY);
      const recoveryRank=new Map(territorial.ranked(recovery).map(r=>[r.geo,r]));
      const weights=definitions.map(()=>1);
      const items=places.map(place=>{
        const sectors=definitions.map(sector=>{
          const fields=sector.fields.map(f=>{
            const c=calibrations.get(f.id),r=c.rows.get(place.geo),value=measure(r),score=normalize(value,c.anchor);
            return {...f,row:r||null,score,rate:relative?value:null,...(relative?relativeMeasure(r,f.id,place.code):{}),anchor:c.anchor,n:c.n,positive:c.positive,
              percentile:value!=null?T.percentile(c.values,value):null,contribution:score==null?null:score*f.share/6};
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
        return {...place,...score,sectors,severity,fieldCount,coverage,baseline:baseline||null,vulnerability,population:populations.get(place.code)||null,relative,mode,
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
        overlap:rapidaTop.filter(r=>top.has(r.geo)).length,rapidaTopN:rapidaTop.length,referenceN:places.length,definitions,severity,fieldCount};
      cache.set(key,result);return result;
    }
    function selection(state) {
      const result=compute(state);
      const order=state.priorityOrder||'integrated';
      let items=[...result.items,...result.missing];
      const sectorIndex=SECTORS.findIndex(s=>s.id===state.priorityDimension);
      if(sectorIndex>=0&&order!=='rapida'){
        const value=order==='uncertainty'?'upper':'lower';
        const known=items.filter(r=>r.sectors[sectorIndex].coverage>EPS).sort((a,b)=>b.sectors[sectorIndex][value]-a.sectors[sectorIndex][value]||T.label(a).localeCompare(T.label(b),'es'));
        let previous=null,rank=0;
        items=known.map((r,i)=>{const v=r.sectors[sectorIndex][value];if(i===0||!same(v,previous))rank=i+1;previous=v;return {...r,dimensionRank:rank};})
          .concat(items.filter(r=>r.sectors[sectorIndex].coverage<=EPS).sort((a,b)=>T.label(a).localeCompare(T.label(b),'es')).map(r=>({...r,dimensionRank:null})));
        if(state.dimensionDirection==='asc')items=items.filter(r=>r.dimensionRank!=null).sort((a,b)=>a.sectors[sectorIndex][value]-b.sectors[sectorIndex][value]||T.label(a).localeCompare(T.label(b),'es')).concat(items.filter(r=>r.dimensionRank==null));
      } else {
        if(order==='rapida')items.sort((a,b)=>(b.recovery??-1)-(a.recovery??-1)||T.label(a).localeCompare(T.label(b),'es'));
        if(order==='uncertainty')items.sort((a,b)=>b.upper-a.upper||a.coverage-b.coverage||T.label(a).localeCompare(T.label(b),'es'));
      }
      const inView=r=>(!state.dept||r.d===state.dept)&&T.searchMatch(r,state.matrixSearch||'');
      return {...result,items:items.filter(inView)};
    }
    return {compute,selection};
  }
  const bundles=new WeakMap();
  function models(data){
    if(!bundles.has(data)){
      const territorial=T.create(data);
      bundles.set(data,Object.fromEntries(['absolute','percapita','sectorial'].map(mode=>[mode,create(data,territorial,{mode})])));
    }
    return bundles.get(data);
  }
  const api={create,models,normalize,aggregate,ranks,SECTORS,sectorsFor,VERSION:'1.3'};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Priorizacion=api;
})(typeof globalThis!=='undefined'?globalThis:this);
