/* Modelo 1.2-RS: cinco dimensiones, escala proporcional, pesos fijos y límites por datos faltantes. */
(function (root) {
  'use strict';
  const T = typeof module !== 'undefined' && module.exports ? require('./modelo.js') : root.Territorial;
  const D = typeof module !== 'undefined' && module.exports ? require('./denominadores.js') : root.Denominadores;
  const H = typeof module !== 'undefined' && module.exports ? require('./presion_salud.js') : root.PresionSalud;
  const field = (id, source, label, share) => ({id, source, label, share, unit:'Número'});
  const reported = (id, label, share=1) => field('3is_'+id, '3iS-Sheets', label, share);
  const estimated = (id, label, share=1) => field('pnud_'+id, 'PNUD', label, share);
  // Cada sector pesa 1/5. En sectores compartidos, cada canal pesa 1/2.
  // Los canales pueden compartir insumos: nunca se cuentan como validaciones independientes.
  const SECTORS = [
    {id:'impacto_humano', name:'Impacto humano', fields:[reported('familias','Familias afectadas',1/3),reported('fallecidos','Personas fallecidas',1/3),reported('desaparecidos','Personas desaparecidas',1/3)]},
    {id:'vivienda', name:'Vivienda', fields:[reported('vivdestruidas','Destruidas · 3iS',.25),reported('vivaveriadas','Averiadas · 3iS',.25),estimated('vd','Destruidas · PNUD',.25),estimated('va','Averiadas · PNUD',.25)]},
    {id:'salud', name:'Salud', fields:[reported('salud','Puntos de salud · 3iS',.5),estimated('csalud','Centros de salud · PNUD',.5)]},
    {id:'educacion', name:'Educación', fields:[reported('educativos','Puntos educativos · 3iS',.5),estimated('cedu','Centros educativos · PNUD',.5)]},
    {id:'infraestructura', name:'Infraestructura y acceso', fields:[reported('colapsos','Colapsos de edificios',1/3),reported('acueductos','Acueductos afectados',1/3),reported('vias','Vías afectadas (conteo)',1/3)]}
  ];
  const CASCADE_FIELDS={
    vivienda:[{id:'pnud_vd',fallback:'3is_vivdestruidas',label:'Viviendas destruidas',share:.5},{id:'pnud_va',fallback:'3is_vivaveriadas',label:'Viviendas averiadas',share:.5}],
    salud:[{id:'pnud_csalud',fallback:'3is_salud',label:'Centros de salud afectados',share:1}],
    educacion:[{id:'pnud_cedu',fallback:'3is_educativos',label:'Centros educativos afectados',share:1}]
  };
  function cascadedSectors(){
    return SECTORS.map(s=>CASCADE_FIELDS[s.id]?{...s,fields:CASCADE_FIELDS[s.id].map(f=>({
      ...field(f.id,'PNUD',f.label,f.share),candidates:[{id:f.id,source:'PNUD'},{id:f.fallback,source:'3iS-Sheets'}]
    }))}:s);
  }
  function housingWeights(sectors,policy){
    if(policy?.enabled!==true)return sectors;
    const {destroyed,damaged}=policy;
    if(!Number.isFinite(destroyed)||!Number.isFinite(damaged)||destroyed<=0||damaged<=0)
      throw new Error('Los pesos de vivienda deben ser positivos y finitos.');
    const destroyedIds=new Set(['pnud_vd','3is_vivdestruidas']);
    return sectors.map(s=>{
      if(s.id!=='vivienda')return s;
      // Normalize over the defined fields, never over the fields available in a municipality.
      const weights=s.fields.map(f=>destroyedIds.has(f.id)?destroyed:damaged);
      const total=weights.reduce((a,b)=>a+b,0);
      return {...s,fields:s.fields.map((f,i)=>({...f,share:weights[i]/total}))};
    });
  }
  function chooseCascade(base,f){
    // Validate each source independently before crossing the declared equivalent indicators.
    const channels=f.candidates.map(source=>{
      const candidates=base.filter(r=>r.f===source.source&&r.id===source.id);
      const coherent=new Set(candidates.map(T.cohort)).size<=1&&candidates.every(r=>r.u===f.unit);
      const groups=new Map();
      if(coherent)candidates.forEach(r=>{if(!groups.has(r.geo))groups.set(r.geo,[]);groups.get(r.geo).push(r);});
      const rows=new Map([...groups].filter(([,rs])=>rs.every(r=>Number.isFinite(r.v)&&r.v>=0&&r.v===rs[0].v)).map(([geo,rs])=>[geo,rs[0]]));
      return {...source,coherent,rows};
    });
    const rows=new Map(),sourceCounts={PNUD:0,'3iS-Sheets':0};
    for(const source of channels)for(const [geo,row]of source.rows){
      if(!rows.has(geo)){rows.set(geo,row);sourceCounts[source.source]++;}
    }
    return {rows,sourceCounts,channels:channels.map(({rows,...c})=>c),coherent:channels.some(c=>c.coherent)};
  }
  const FIELD_COUNT = SECTORS.reduce((n,s)=>n+s.fields.length,0);
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
  const DEPTHS={index:'Índice',ipm:'Índice con IPM',ipm_idf:'Índice con IPM y opción C de IDF'};
  function fiscalRegistry(fiscal){
    const groups=new Map(),accepted=new Map();
    for(const r of fiscal?.rows||[]){
      if(!groups.has(r.code))groups.set(r.code,[]);
      groups.get(r.code).push(r);
    }
    groups.forEach((rs,code)=>{
      const r=rs[0];
      if(rs.length===1&&/^\d{5}$/.test(code)&&r.year===2023&&Number.isFinite(r.value)&&r.value>=0&&r.value<=100)accepted.set(code,r);
    });
    return accepted;
  }
  function depthAdjustment(depth,vulnerability,fiscal,alpha=.25){
    if(!Object.hasOwn(DEPTHS,depth))throw new Error('Nivel relativo desconocido: '+depth);
    const factorLower=depth==='index'?1:(1+alpha*(vulnerability??0)/100)/(1+alpha);
    const factorUpper=depth==='index'?1:(1+alpha*(vulnerability??100)/100)/(1+alpha);
    const fiscalFactor=depth==='ipm_idf'?(fiscal==null?null:1-fiscal.value/100):1;
    return {depth,label:DEPTHS[depth],factorLower:fiscalFactor==null?null:factorLower*fiscalFactor,
      factorUpper:fiscalFactor==null?null:factorUpper*fiscalFactor,fiscalFactor,
      formula:depth==='index'?'P = D':depth==='ipm'?'P = D × (1 + 0,25 × IPM/100) / 1,25':'P = [D × (1 + 0,25 × IPM/100) / 1,25] × (1 − IDF/100)'};
  }
  function adjustedAggregate(sectors,vulnerability,weights,depth,fiscal,alpha=.25){
    const score=aggregate(sectors,vulnerability,weights,alpha),a=depthAdjustment(depth,vulnerability,fiscal,alpha);
    // Keep the historical IPM arithmetic unchanged; apply C once, without renormalizing.
    return {...score,lower:depth==='index'?score.damageLower:a.fiscalFactor==null?null:score.lower*a.fiscalFactor,
      upper:depth==='index'?score.damageUpper:a.fiscalFactor==null?null:score.upper*a.fiscalFactor,adjustment:a};
  }
  function adjustmentNote(r,format=String){
    const a=r.adjustment||depthAdjustment('ipm',r.vulnerability,null);
    if(a.depth==='index')return 'Promedio sectorial sin ajustes de IPM ni IDF.';
    const ipm='IPM DANE 2018: '+(r.vulnerability==null?'sin dato; se propaga 0–100':format(r.vulnerability)+'%')+'.';
    if(a.depth==='ipm')return ipm;
    return ipm+' IDF DNP 2023: '+(r.fiscal?format(r.fiscal.value)+'; factor fiscal = '+format(a.fiscalFactor):'sin dato válido; este escenario no tiene puntaje ni puesto')+'.';
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
    const fiscalByCode=fiscalRegistry(data.fiscal);
    const denominators=mode==='sectorial'?D.create(data):null;
    const pressure=H.create(data);
    const sourceCascade=data.healthPressure?.source_cascade?.enabled===true;
    const familiesInformational=data.healthPressure?.human_impact_policy?.families_informational_only===true;
    const definitions=housingWeights(sourceCascade?cascadedSectors():SECTORS,data.healthPressure?.housing_weight_policy).map(s=>
      familiesInformational&&s.id==='impacto_humano'
        ?{...s,fields:s.fields.map(f=>({...f,share:f.id==='3is_familias'?0:.5}))}:s);
    const sectorDefs=mode==='sectorial'&&pressure.enabled?definitions.map(s=>s.id==='salud'?{...s,fields:[pressure.field]}:s):definitions;
    const fieldCount=sectorDefs.reduce((n,s)=>n+s.fields.filter(f=>f.share>0).length,0);
    const fixedEducation=mode==='sectorial'&&data.healthPressure?.education_relative_policy?.normalization==='fixed_inventory_cap_1';
    const scale=(f,values)=>{
      const observedMax=values.length?Math.max(...values):null;
      // A fraction of the registered inventory uses a fixed ceiling, never the municipal maximum.
      return fixedEducation&&['pnud_cedu','3is_educativos'].includes(f.id)
        ?{anchor:1,normalization:'fixed_inventory_cap_1',observedMax}:{anchor:observedMax};
    };
    const cache=new Map();
    function compute(state) {
      // Solo ámbito y captura definen referencias; buscar/filtrar departamento no renormaliza.
      const depth=mode==='sectorial'?(state.relativeDepth||'ipm'):'ipm';
      if(!Object.hasOwn(DEPTHS,depth))throw new Error('Nivel relativo desconocido: '+depth);
      const key=JSON.stringify([state.scope,state.date,depth]);
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
        if(mode==='sectorial'){
          const result=denominators.measure(r,id,code,state.date);
          if(data.healthPressure?.disabled_relative_indicators?.includes(id))
            return {...result,rate:null,calculationDisabled:true,reason:'Cálculo relativo de centros educativos deshabilitado en esta rama.'};
          return result;
        }
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
      sectorDefs.flatMap(s=>s.fields).forEach(f=>{
        if(f.candidates){
          const selected=chooseCascade(base,f),accepted=[...selected.rows.values()];
          const values=accepted.map(measure).filter(v=>Number.isFinite(v)&&v>=0);
          calibrations.set(f.id,{...f,...selected,...scale(f,values),n:values.length,positive:values.filter(v=>v>0).length,values});
          return;
        }
        const candidates=(f.id===H.ID&&mode==='sectorial'?pressure.rows(base):base).filter(r=>r.f===f.source&&r.id===f.id);
        const cohorts=new Set(candidates.map(T.cohort));
        const coherent=cohorts.size<=1 && candidates.every(r=>r.u===f.unit);
        const byGeo=new Map();
        if(coherent)candidates.forEach(r=>{if(!byGeo.has(r.geo))byGeo.set(r.geo,[]);byGeo.get(r.geo).push(r);});
        const accepted=[...byGeo.values()].filter(rs=>rs.every(r=>r.v===rs[0].v)).map(rs=>rs[0]);
        const values=accepted.map(measure).filter(v=>Number.isFinite(v)&&v>=0);
        const positive=values.filter(v=>v>0);
        calibrations.set(f.id,{...f,...scale(f,values),n:values.length,positive:positive.length,coherent,values,rows:new Map(accepted.map(r=>[r.geo,r]))});
      });
      const recovery=territorial.strict(base,T.RECOVERY);
      const recoveryRank=new Map(territorial.ranked(recovery).map(r=>[r.geo,r]));
      const weights=sectorDefs.map(()=>1);
      const items=places.map(place=>{
        const sectors=sectorDefs.map(sector=>{
          const fields=sector.fields.map(f=>{
            const c=calibrations.get(f.id),r=c.rows.get(place.geo),value=measure(r),score=normalize(value,c.anchor);
            return {...f,...(f.candidates?{source:r?.f||'PNUD → 3iS-Sheets',selectedIndicator:r?.id??null,cascadeFallback:r?.f==='3iS-Sheets'}:{}),row:r||null,score,rate:relative?value:null,...(relative?relativeMeasure(r,r?.id||f.id,place.code):{}),anchor:c.anchor,n:c.n,positive:c.positive,...(c.normalization?{normalization:c.normalization,observedMax:c.observedMax}:{}),
              percentile:value!=null?T.percentile(c.values,value):null,contribution:f.share===0?0:score==null?null:score*f.share/sectorDefs.length};
          });
          const lower=fields.reduce((s,f)=>s+(f.score??0)*f.share,0);
          const unknown=fields.filter(f=>f.score==null).reduce((s,f)=>s+100*f.share,0);
          const coverage=clamp(1-unknown/100,0,1);
          return {...sector,fields,lower:clamp(lower,0,100),upper:clamp(lower+unknown,0,100),coverage:coverage<EPS?0:coverage};
        });
        const baseline=baselines.get(place.code),vulnerability=baseline&&baseline.v<=100?baseline.v:null;
        const fiscal=fiscalByCode.get(place.code)||null;
        const score=mode==='sectorial'?adjustedAggregate(sectors,vulnerability,weights,depth,fiscal):aggregate(sectors,vulnerability,weights);
        const coverage=sectors.reduce((s,d)=>s+d.coverage/sectorDefs.length,0);
        const rec=recoveryRank.get(place.geo);
        return {...place,...score,...(mode==='sectorial'?{fiscal}:{}),sectors,fieldCount:fieldCount,coverage,baseline:baseline||null,vulnerability,population:populations.get(place.code)||null,relative,mode,
          recovery:rec?.v??null,recoveryRank:rec?.rank??null,available:sectors.flatMap(s=>s.fields).filter(f=>f.share>0&&f.score!=null).length,
          complete:coverage>1-EPS&&(depth==='index'||vulnerability!=null)&&(depth!=='ipm_idf'||fiscal!=null),rank:null,rankMin:null,rankMax:null};
      });
      const hasScore=r=>r.coverage>EPS&&Number.isFinite(r.lower);
      const scored=items.filter(hasScore), ranked=ranks(scored);
      // Posición compatible con límites por faltantes; no es intervalo de confianza.
      ranked.forEach(r=>{
        r.bestRank=1+ranked.filter(o=>o.geo!==r.geo&&o.lower>r.upper+EPS).length;
        r.worstRank=1+ranked.filter(o=>o.geo!==r.geo&&o.upper>r.lower+EPS).length;
      });
      const scenarioWeights=[weights];
      for(let i=0;i<sectorDefs.length;i++)for(const factor of [.75,1.25])scenarioWeights.push(weights.map((w,j)=>j===i?w*factor:w));
      let scenarios=0;
      for(const alpha of (depth==='index'?[0]:[0,.25,.5]))for(const w of scenarioWeights){
        scenarios++;
        const simulation=ranks(ranked.map(r=>({...r,...(mode==='sectorial'?adjustedAggregate(r.sectors,r.vulnerability,w,depth,r.fiscal,alpha):aggregate(r.sectors,r.vulnerability,w,alpha))})));
        simulation.forEach(r=>{
          const target=ranked.find(x=>x.geo===r.geo);
          target.rankMin=target.rankMin==null?r.rank:Math.min(target.rankMin,r.rank);
          target.rankMax=target.rankMax==null?r.rank:Math.max(target.rankMax,r.rank);
        });
      }
      const top=new Set(ranked.filter(r=>r.rank<=20).map(r=>r.geo));
      const rapidaTop=recovery.filter(r=>recoveryRank.get(r.geo).rank<=20);
      const result={definitions:sectorDefs,items:ranked,missing:items.filter(r=>!hasScore(r)).sort((a,b)=>T.label(a).localeCompare(T.label(b),'es')),
        all:items,calibrations:[...calibrations.values()].map(({rows,values,...r})=>r),scenarios,
        overlap:rapidaTop.filter(r=>top.has(r.geo)).length,rapidaTopN:rapidaTop.length,referenceN:places.length};
      cache.set(key,result);return result;
    }
    function selection(state) {
      const result=compute(state);
      const order=state.priorityOrder||'integrated';
      let items=[...result.items,...result.missing];
      const sectorIndex=sectorDefs.findIndex(s=>s.id===state.priorityDimension);
      if(sectorIndex>=0&&order!=='rapida'){
        const value=order==='uncertainty'?'upper':'lower';
        const known=items.filter(r=>r.sectors[sectorIndex].coverage>EPS).sort((a,b)=>b.sectors[sectorIndex][value]-a.sectors[sectorIndex][value]||T.label(a).localeCompare(T.label(b),'es'));
        let previous=null,rank=0;
        items=known.map((r,i)=>{const v=r.sectors[sectorIndex][value];if(i===0||!same(v,previous))rank=i+1;previous=v;return {...r,dimensionRank:rank};})
          .concat(items.filter(r=>r.sectors[sectorIndex].coverage<=EPS).sort((a,b)=>T.label(a).localeCompare(T.label(b),'es')).map(r=>({...r,dimensionRank:null})));
        if(state.dimensionDirection==='asc')items=items.filter(r=>r.dimensionRank!=null).sort((a,b)=>a.sectors[sectorIndex][value]-b.sectors[sectorIndex][value]||T.label(a).localeCompare(T.label(b),'es')).concat(items.filter(r=>r.dimensionRank==null));
      } else {
        if(order==='rapida')items.sort((a,b)=>(b.recovery??-1)-(a.recovery??-1)||T.label(a).localeCompare(T.label(b),'es'));
        if(order==='uncertainty')items.sort((a,b)=>(b.upper??-1)-(a.upper??-1)||a.coverage-b.coverage||T.label(a).localeCompare(T.label(b),'es'));
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
  const api={create,models,normalize,aggregate,adjustedAggregate,depthAdjustment,adjustmentNote,fiscalRegistry,DEPTHS,ranks,SECTORS,FIELD_COUNT,VERSION:'1.2-RS',CASCADE_FIELDS,chooseCascade};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Priorizacion=api;
})(typeof globalThis!=='undefined'?globalThis:this);
