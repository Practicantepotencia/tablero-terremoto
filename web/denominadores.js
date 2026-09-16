/* Bases sectoriales verificadas. Un inventario candidato no habilita una tasa. */
(function(root){
  'use strict';
  const H = typeof module !== 'undefined' && module.exports ? require('./presion_salud.js') : root.PresionSalud;
  const spec=(kind,label,multiplier,unit,enabled,reason='')=>({kind,label,multiplier,unit,enabled,reason});
  const people=()=>spec('poblacion','Población municipal DANE del mismo año',10000,'/10.000 habitantes',true);
  const homes=()=>spec('viviendas','Total de viviendas DANE, ocupadas y desocupadas',100,'% de la base de viviendas',true);
  const health=()=>spec('sedes_ips','Sedes físicas de salud preevento, homologadas al reporte',100,'% de sedes',false,
    'REPS es un inventario candidato. Falta homologar los puntos/centros reportados con sus sedes y comprobar cobertura. Atrato reporta 9 afectados frente a 3 sedes IPS REPS.');
  const education=()=>spec('sedes_educativas','Sedes educativas preevento del mismo universo',100,'% de sedes',false,
    'Falta conciliar los puntos/centros afectados con códigos de sede y niveles/sectores del inventario educativo. Las bases MEN revisadas corresponden a 2019 y 2021; no acreditan el total de 2026.');
  const RULES={
    '3is_familias':spec('hogares','Hogares DANE, previa homologación de familia a hogar',100,'% de hogares',false,
      'Existe proyección DANE de hogares 2026, pero el reporte cuenta familias. Falta verificar su equivalencia y deduplicación; no se calcula porcentaje de hogares.'),
    '3is_fallecidos':people(), '3is_desaparecidos':people(), '3is_heridos':people(),
    '3is_vivdestruidas':homes(), '3is_vivaveriadas':homes(), 'pnud_vd':homes(), 'pnud_va':homes(),
    '3is_salud':health(), 'pnud_csalud':health(),
    '3is_educativos':education(), 'pnud_cedu':education(),
    '3is_colapsos':spec('edificios','Edificios físicos preevento del mismo universo',100,'% de edificios',false,
      'No se verificó un inventario municipal completo de edificios. Predios catastrales y viviendas no equivalen a edificios.'),
    '3is_acueductos':spec('sistemas_acueducto','Sistemas de acueducto preevento, urbanos y rurales',100,'% de sistemas',false,
      'No se verificó un total municipal exhaustivo de sistemas compatibles. Prestadores RUPS, suscriptores y sistemas son unidades distintas.'),
    '3is_vias':spec('vias','Vías o tramos preevento con la misma delimitación del reporte',100,'% de vías o tramos',false,
      'El numerador es un conteo de vías afectadas. Falta el inventario de esas mismas vías/tramos; kilómetros de red no son un denominador compatible.')
  };
  function create(data){
    const pressure=H.create(data);
    const payload=data.denominators||{}, groups=new Map(), sources=payload.sources||{};
    (payload.rows||[]).forEach(r=>{
      const key=[r.kind,r.code,r.year].join('|');
      if(!groups.has(key))groups.set(key,[]);
      groups.get(key).push(r);
    });

    // Observed registry stocks used as explicit proxies, not verified percentages of damage.
    function registryMeasure(row,id,code,date){
      const proxy=payload.registry_proxies, kind=id.includes('salud')?'sedes_ips':'sedes_educativas';
      const config=proxy.catalog?.[kind];
      const base={rate:null,denominator:null,denominatorSource:null,multiplier:1,
        relativeKind:kind,relativeUnit:kind==='sedes_ips'?'afectados / sede IPS registrada':'afectados / sede educativa registrada',
        denominatorLabel:config?.label||'Inventario registrado',registryProxy:true,reason:''};
      if(!config||!/^\d{5}$/.test(code||'')||!/^\d{4}-\d{2}-\d{2}$/.test(date||''))
        return {...base,reason:'Sin inventario o identidad municipal verificable'};
      const rs=(proxy.rows||[]).filter(r=>r.kind===kind&&r.code===code&&r.year===config.year);
      if(rs.length!==1)return {...base,reason:rs.length?'Inventario duplicado o ambiguo':'Sin sedes registradas en la base; no se supone cero'};
      const d=rs[0],source=proxy.sources?.[d.source];
      if(d.status!=='observed_registry_proxy'||!Number.isInteger(d.value)||d.value<=0||
        d.unit!==config.unit||d.area!=='Total'||d.source!==config.source||
        !source?.url||!/^[a-f0-9]{64}$/.test(source.sha256||'')||
        !/^\d{4}-\d{2}-\d{2}$/.test(d.reference_date||'')||
        d.reference_date!==config.reference_date||!payload.event_date||
        d.reference_date>payload.event_date||d.reference_date>date)
        return {...base,reason:'Inventario sin corte anterior al evento, identidad o procedencia válida'};
      const valid={...base,denominator:d,denominatorSource:source};
      const expectedSource=id.startsWith('pnud_')?'PNUD':'3iS-Sheets';
      if(!row||row.id!==id||row.f!==expectedSource||row.u!=='Número'||!Number.isFinite(row.v)||row.v<0)
        return {...valid,reason:'Sin numerador válido de esta fuente'};
      // Above-one values remain visible: changing units must not silently discard or clip them.
      return {...valid,rate:row.v/d.value,exceedsRegistry:row.v>d.value,
        proxyNote:row.v>d.value?'Afectados superiores al inventario registrado; cociente proxy, no porcentaje de sedes dañadas.':''};
    }
    function measure(row,id,code,date){
      if(pressure.enabled&&id===H.ID)return pressure.measure(row,id,code,date);
      if(payload.registry_proxies?.enabled===true&&['3is_salud','pnud_csalud','3is_educativos','pnud_cedu'].includes(id))
        return registryMeasure(row,id,code,date);
      const rule=RULES[id], year=Number(String(date).slice(0,4));
      const base={rate:null,denominator:null,denominatorSource:null,relativeUnit:rule?.unit||'',multiplier:rule?.multiplier||100,
        denominatorLabel:rule?.label||'Sin denominador definido',reason:'',relativeKind:rule?.kind||''};
      if(!rule)return {...base,reason:'Indicador sin denominador definido'};
      const rs=groups.get([rule.kind,code,year].join('|'))||[];
      // Candidate values are displayed as evidence only, never used as denominators.
      const candidate=rs.length===1?rs[0]:(payload.candidates||[]).find(r=>r.code===code&&r.kind===rule.kind)||null;
      if(!rule.enabled)return {...base,candidate,reason:rule.reason};
      if(!/^\d{5}$/.test(code||''))return {...base,reason:'Sin DIVIPOLA municipal verificable'};
      if(rs.length!==1)return {...base,reason:rs.length?'Denominador duplicado o ambiguo':'Sin base municipal para el año de la captura'};
      const d=rs[0],source=sources[d.source];
      if(d.status!=='verified'||!Number.isFinite(d.value)||d.value<=0||d.area!=='Total'||!source?.url||!source.sha256||
        d.unit!==(rule.kind==='poblacion'?'Habitantes':'Viviendas'))return {...base,reason:'Denominador sin validación, unidad o procedencia compatible'};
      if(!/^\d{4}-\d{2}-\d{2}$/.test(d.reference_date||'')||!/^\d{4}-\d{2}-\d{2}$/.test(source.published||'')||
        !payload.event_date||d.reference_date>payload.event_date||source.published>payload.event_date||d.reference_date>date)
        return {...base,reason:'Base sin fecha preevento verificable para esta captura'};
      const valid={...base,denominator:d,denominatorSource:source};
      if(!row||!Number.isFinite(row.v)||row.v<0)return {...valid,reason:'Sin numerador comparable'};
      if(row.v>d.value)return {...valid,reason:'El numerador supera el universo de referencia; requiere conciliación, no se recorta a 100%'};
      return {...valid,rate:rule.multiplier*row.v/d.value};
    }
    return {measure};
  }
  const api={create,RULES};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Denominadores=api;
})(typeof globalThis!=='undefined'?globalThis:this);
