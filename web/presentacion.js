/* Presentación pública. No transforma datos ni interviene en el modelo del índice. */
(function(root){
  'use strict';
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number=(n,digits=2)=>Number.isFinite(n)?new Intl.NumberFormat('es-CO',{maximumFractionDigits:digits}).format(n):'—';
  const source=s=>String(s||'').replaceAll('3iS-Sheets','3iS');
  function municipality(r,attribute){
    return '<td class="municipal-cell"><button class="link municipality-name" type="button" '+attribute+'="'+esc(r.geo)+'">'+esc(r.m)+'</button><div class="muted small">'+esc(r.d)+'</div>'+
      '<div class="score-label">Puntaje de afectación</div><div class="priority-number">'+(r.coverage>0?number(r.lower):'—')+'<small> /100</small></div>'+
      '<div class="rank-label">Puesto global: '+(r.rank??'—')+'</div><div class="small muted">'+r.available+' de '+r.fieldCount+' indicadores con información</div></td>';
  }
  function field(f,relative){
    const has=relative?f.rate!=null:!!f.row;
    const value=has?number(relative?f.rate:f.row.v,relative?4:2):'—';
    const unit=relative?f.relativeUnit:(f.row?.u==='Número'?'':f.row?.u);
    const explanation=f.share===0?'Solo consulta; no suma al índice.':has?'Puntaje de la variable: '+number(f.score)+'/100.':'Sin dato; no equivale a cero.';
    const title=[f.label,explanation,relative&&f.row?'Valor original: '+number(f.row.v):'',relative&&f.denominator?'Base: '+number(f.denominator.value)+' '+f.denominator.unit+' · '+f.denominator.reference_date:'',f.reason||''].filter(Boolean).join('. ');
    const base=relative&&has&&f.denominator?'<small class="rate-base">'+number(f.row.v)+' / '+number(f.denominator.value)+' '+esc(f.denominator.unit.toLowerCase())+'</small>':relative&&f.row?'<small class="rate-base">Reportado: '+number(f.row.v)+'</small>':'';
    return '<span class="heat-item '+(has?'':'missing')+'" title="'+esc(title)+'" style="--intensity:'+ (f.score==null?0:Math.min(100,Math.max(0,f.score)))+'"><span class="field-name">'+esc(f.label.replace(/ · (3iS|PNUD)$/,''))+'</span><span class="field-value"><b>'+value+'</b>'+ (has&&unit?' <small>'+esc(unit)+'</small>':has?'':relative&&f.row?' <small>sin dato relativo</small>':' <small>sin dato</small>')+'</span>'+base+'</span>';
  }
  function sector(s,relative,selected=false){
    const sources=[...new Set(s.fields.filter(f=>f.row).map(f=>source(f.source)))];
    const bases=relative?[...new Set(s.fields.filter(f=>f.denominator).map(f=>source(f.denominatorSource?.label)).filter(Boolean))]:[];
    return '<td class="heat-cell '+(selected?'selected-sector':'')+'"><div class="sector-block sector-score"><span class="block-label">Puntaje</span><strong>'+(s.coverage>0?number(s.lower)+' <small>/100</small>':'Sin dato')+'</strong></div>'+
      '<div class="sector-block sector-result"><span class="block-label">Resultado</span>'+s.fields.map(f=>field(f,relative)).join('')+'</div>'+
      '<div class="sector-block sector-evidence"><span class="block-label">Evidencia</span>'+esc(sources.join(' · ')||'Sin reporte')+(bases.length?'<details><summary>Base de comparación</summary><span>'+esc(bases.join(' · '))+'</span></details>':'')+'</div></td>';
  }
  function summary(data,absolute,selected,state){
    // Resumen independiente de la búsqueda y del orden de columnas. Un reporte cero
    // no convierte un municipio en afectado; el IPM o los costos tampoco lo hacen.
    const ids=new Set(['3is_familias','3is_fallecidos','3is_desaparecidos','3is_heridos','3is_vivdestruidas','3is_vivaveriadas','3is_salud','3is_educativos','3is_colapsos','3is_acueductos','3is_vias','pnud_vd','pnud_va','pnud_csalud','pnud_cedu']);
    const places=new Map(absolute.items.map(r=>[r.geo,r]));
    const rows=data.rows.filter(r=>r.date===state.date&&r.lv==='municipal'&&places.has(r.geo));
    const gravity=rows.filter(r=>r.f==='Naboo/UNGRD'&&r.id==='gravedad_oficial');
    const affected=new Set(rows.filter(r=>r.v>0&&ids.has(r.id)&&['PNUD','3iS-Sheets'].includes(r.f)).map(r=>r.geo));
    gravity.filter(r=>r.v>0).forEach(r=>affected.add(r.geo));
    // Escala humana: población expuesta de la evaluación RAPIDA (PNUD/UNGRD), que
    // recorta por la huella de sacudida, y no la población municipal completa. Un
    // cero es valor observado, no faltante: el municipio quedó fuera de la huella.
    const exposure=new Map(rows.filter(r=>r.id==='undp_rapida_pop_exp'&&Number.isFinite(r.v)).map(r=>[r.geo,r.v]));
    function population(geos){
      const observed=[...geos].map(geo=>exposure.get(geo)).filter(n=>Number.isFinite(n));
      return {value:observed.length?observed.reduce((a,b)=>a+b,0):null,known:observed.length,total:geos.size};
    }
    const ranked=selected.items.filter(r=>r.coverage>0).slice().sort((a,b)=>b.lower-a.lower);
    const cutoff=ranked[Math.min(19,ranked.length-1)]?.lower;
    const top=new Set(ranked.filter(r=>r.lower>=cutoff).map(r=>r.geo));
    const critical=new Set(gravity.filter(r=>r.v===100).map(r=>r.geo));
    const classified=new Set(gravity.filter(r=>r.v>0).map(r=>r.geo));
    return {affected:affected.size,departments:new Set([...affected].map(g=>places.get(g).d)).size,
      population:population(affected),priorityPopulation:population(top),topN:top.size,
      critical:classified.size?critical.size:null,classified:classified.size,universe:places.size};
  }
  // Lectura del radar: redondeo visual solamente; los objetos calculados no se alteran.
  function radarLegend(items,colors){
    return items.map((r,k)=>'<article class="radar-summary" style="--municipality-color:'+colors[k]+'"><h3>'+esc(r.m)+', '+esc(r.d)+'</h3><dl>'+
      '<div><dt>Puntaje documentado</dt><dd>'+(r.coverage>0?number(r.lower,1)+' /100':'Sin dato')+'</dd></div>'+
      (r.coverage>0&&r.upper-r.lower>1e-8?'<div><dt>Con información faltante</dt><dd>hasta '+number(r.upper,1)+'</dd></div>':'')+
      '<div><dt>Cobertura de información</dt><dd>'+r.available+' de '+r.fieldCount+' indicadores</dd></div></dl></article>').join('');
  }
  function radarValue(f,relative){
    if(!f)return '<span class="muted">Sin dato</span>';
    const has=relative?f.rate!=null:!!f.row;
    const title=[f.row?'Fuente: '+source(f.source):'Sin reporte',relative&&f.denominator?'Base: '+number(f.denominator.value)+' '+f.denominator.unit+' · '+f.denominator.reference_date:'',f.reason||''].filter(Boolean).join('. ');
    if(!has)return '<span class="radar-data" title="'+esc(title)+'"><span class="muted">'+(relative&&f.row?'Sin dato relativo':'Sin dato')+'</span>'+(f.row?'<small>Reportado: '+number(f.row.v)+'</small>':'')+'</span>';
    return '<span class="radar-data" title="'+esc(title)+'"><strong>'+number(relative?f.rate:f.row.v,relative?4:2)+'</strong>'+
      (relative?'<small>'+esc(f.relativeUnit)+'</small><small>Reportado: '+number(f.row.v)+'</small>':f.row.u&&f.row.u!=='Número'?'<small>'+esc(f.row.u)+'</small>':'')+'</span>';
  }
  function radarMatrix(items,colors,relative){
    if(!items.length)return '';
    // Emparejar por ID, no por posición ni fuente elegida por la cascada.
    const sectors=[...new Map(items.flatMap(r=>r.sectors).map(s=>[s.id,s])).values()];
    const rows=sectors.map(s=>{
      const same=items.map(r=>r.sectors.find(x=>x.id===s.id));
      const fields=[...new Map(same.flatMap(x=>x?.fields||[]).map(f=>[f.id,f])).values()];
      const heading='<tr class="radar-dimension-row" data-sector="'+esc(s.id)+'"><th scope="row">'+esc(s.name)+'<small>Puntaje /100</small></th>'+same.map((x,k)=>{
        const axis=items[k].sectors.findIndex(y=>y.id===s.id);
        return '<td>'+(x?'<button type="button" class="radar-matrix-value" data-radar-m="'+k+'" data-radar-axis="'+axis+'" aria-label="Ver cálculo de '+esc(s.name)+' en '+esc(items[k].m)+'">'+(x.coverage>0?number(x.lower,1):'Sin dato')+'</button>':'Sin dato')+'</td>';
      }).join('')+'</tr>';
      return heading+fields.map(f=>'<tr class="radar-indicator-row" data-indicator="'+esc(f.id)+'"><th scope="row">'+esc(f.label.replace(/ · (3iS|PNUD)$/,''))+(f.share===0?'<small>Solo informativo</small>':'')+'</th>'+same.map(x=>'<td>'+radarValue(x?.fields.find(y=>y.id===f.id),relative)+'</td>').join('')+'</tr>').join('');
    }).join('');
    return '<table><caption>Comparación por dimensión e indicador</caption><thead><tr><th scope="col">Dimensión e indicador</th>'+items.map((r,k)=>'<th scope="col" style="--municipality-color:'+colors[k]+'"><span class="radar-column-name">'+esc(r.m)+'</span><small>'+esc(r.d)+'</small></th>').join('')+'</tr></thead><tbody>'+rows+'</tbody></table>';
  }
  function radarSelection(r,s,color){
    return '<div class="radar-selection-heading"><div><span class="small muted">Punto seleccionado</span><h3>'+esc(s.name)+'</h3><p style="color:'+color+'">'+esc(r.m)+', '+esc(r.d)+'</p></div><strong>'+(s.coverage>0?number(s.lower,1)+' <small>/100</small>':'Sin dato')+'</strong></div>'+
      '<button type="button" class="secondary" data-radar-method>Cómo se calcula</button>';
  }
  const api={municipality,sector,summary,number,esc,radarLegend,radarMatrix,radarSelection};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Presentacion=api;
})(globalThis);
