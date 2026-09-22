/* Vista relativa con denominadores específicos y trazables. */
(function(root){
  'use strict';
  function createView(prefix,mode){
  const percapita=mode==='percapita';
  const $=id=>document.getElementById(id.replace(/^relative/,prefix));
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=n=>Number.isFinite(n)?new Intl.NumberFormat('es-CO',{maximumFractionDigits:4}).format(n):'—';
  const points=n=>Number.isFinite(n)?new Intl.NumberFormat('es-CO',{maximumFractionDigits:2}).format(n):'—';
  const range=(lo,hi)=>Math.abs(lo-hi)<1e-8?points(lo)+' /100':'Documentado '+points(lo)+' · posible '+points(hi)+' /100';
  const headers=names=>'<thead><tr>'+names.map(n=>'<th scope="col">'+esc(n)+'</th>').join('')+'</tr></thead>';
  const baseInfo=f=>f.denominator?'<b>'+fmt(f.denominator.value)+' '+esc(f.denominator.unit)+'</b><br><a href="'+esc(f.denominatorSource.url)+'" target="_blank" rel="noopener">'+esc(f.denominatorSource.label)+'</a><div class="small muted">Referencia '+esc(f.denominator.reference_date)+' · '+esc(f.denominator.locator)+'</div>':'Sin base homologada'+(f.candidate?'<div class="small muted">Base candidata: '+fmt(f.candidate.value)+'. No utilizada.</div>':'');
  let relativeModel,absoluteModel,sectorId='',direction='desc',selectedGeo='';
  function detail(r,absolute){
    $('relative-detail').hidden=!r;if(!r)return;
    const factorLo=(1+.25*(r.vulnerability??0)/100)/1.25,factorHi=(1+.25*(r.vulnerability??100)/100)/1.25;
    const fixedEducation=r.sectors.some(s=>s.fields.some(f=>f.normalization==='fixed_inventory_cap_1'));
    const table=r.sectors.flatMap(s=>s.fields.map(f=>'<tr><td>'+esc(s.name)+' · '+esc(f.label)+'<div class="small muted">'+esc(f.source)+'</div></td><td>'+ (f.row?fmt(f.row.v):'Sin dato')+'</td><td>'+esc(f.denominatorLabel)+'<br>'+baseInfo(f)+'</td><td>'+(f.rate==null?'Sin dato relativo: '+esc(f.reason):'<b>'+fmt(f.rate)+'</b> '+esc(f.relativeUnit)+'<div class="small formula">'+fmt(f.row.v)+' × '+f.multiplier+' / '+fmt(f.denominator.value)+' = '+fmt(f.rate)+'</div>')+'</td><td>'+(f.normalization==='fixed_inventory_cap_1'?'Tope fijo: ':'')+fmt(f.anchor)+' / '+f.n+'</td><td>'+fmt(f.score)+'</td><td>'+fmt(f.share*100)+'%</td><td>'+(f.share===0?'0':f.score==null?'Desconocido':fmt(f.score*f.share))+'</td></tr>')).join('');
    $('relative-detail').innerHTML='<div class="section-head"><h3>'+esc(r.m)+', '+esc(r.d)+(percapita?' · cálculo per cápita':' · cálculo relativo por indicador')+'</h3><button type="button" class="secondary" id="'+prefix+'-close">Cerrar ficha</button></div><p>Prioridad relativa documentada: '+(r.coverage?range(r.lower,r.upper):'Sin puntaje')+' · puesto '+(r.rank??'—')+'. Prioridad absoluta: '+points(absolute?.lower)+' · puesto '+(absolute?.rank??'—')+'. Cobertura '+r.available+'/'+r.fieldCount+' campos · '+points(100*r.coverage)+'% del peso.</p><div class="table-scroll"><table>'+headers(['Dimensión / variable','Valor original','Denominador y fuente','Tasa / cociente',fixedEducation?'Referencia / N':'Máxima tasa / N','Puntaje variable','Peso interno','Aporte al sector'])+'<tbody>'+table+'</tbody></table></div><p class="formula">Tasa = valor original × factor de presentación / denominador propio<br>'+(fixedEducation?'Educación: z = 100 × min(cociente, 1)<br>Resto: ':'')+'z relativo = 100 × tasa / máxima tasa comparable<br>Sector = Σ(z relativo × peso interno)<br>D inferior = ('+r.sectors.map(s=>fmt(s.lower)).join(' + ')+') / '+r.sectors.length+' = '+fmt(r.damageLower)+'<br>P relativo inferior = '+fmt(r.damageLower)+' × '+fmt(factorLo)+' = '+fmt(r.lower)+'<br>P relativo superior = '+fmt(r.damageUpper)+' × '+fmt(factorHi)+' = '+fmt(r.upper)+'</p><p>IPM DANE 2018: '+(r.vulnerability==null?'sin dato, se propaga 0–100':fmt(r.vulnerability)+'%')+'. Factor = (1 + 0,25 × IPM/100) / 1,25. </p>';
    $('relative-close').onclick=()=>{selectedGeo='';$('relative-detail').hidden=true;};
  }
  function render(state){
    if(!$('relative-matrix'))return;
    if(!relativeModel){absoluteModel=Priorizacion.models(DATA).absolute;relativeModel=Priorizacion.models(DATA)[mode];}
    const selected={...state,priorityOrder:'integrated',priorityDimension:sectorId,dimensionDirection:direction,matrixSearch:$('relative-search').value};
    const result=relativeModel.selection(selected),absolute=absoluteModel.compute(state),abs=new Map(absolute.items.map(r=>[r.geo,r]));
    const sector=Priorizacion.SECTORS.find(s=>s.id===sectorId);
    $('relative-note').textContent=sector?'Orden por '+sector.name+': '+(direction==='desc'?'mayor a menor':'menor a mayor'):'Municipios ordenados según nivel de afectación documentada';
    const fixedEducation=!percapita&&DATA.healthPressure?.education_relative_policy?.normalization==='fixed_inventory_cap_1';
    $('relative-formula').textContent=(fixedEducation?'Educación: puntaje = 100 × min(centros afectados / sedes registradas, 1). Resto: ':'')+(percapita?'Cada variable: tasa = valor × 10.000 / población municipal; puntaje':'Cada variable: tasa = valor × factor / denominador propio; puntaje')+' = 100 × tasa / máxima tasa comparable. Cinco sectores de igual peso y ajuste IPM. Referencia: '+(state.scope==='decree'?'departamentos del decreto':'inventario completo')+', captura '+state.date+'. '+(percapita?'':'Bases verificadas el '+(DATA.denominators?.checked?.slice(0,10)||'—')+'.');
    if(!percapita)$('relative-formula').textContent+=' '+(DATA.healthPressure?.enabled?DATA.healthPressure.note:DATA.denominators?.registry_proxies?.notice||'');
    $('relative-count').textContent=result.items.length+(result.items.length===1?' municipio':' municipios');
    let html='<table>'+headers(['Municipio y puntaje',...Priorizacion.SECTORS.map(s=>s.name)])+'<tbody>';
    html+=result.items.map(r=>{
      return '<tr>'+Presentacion.municipality(r,'data-relative-geo')+r.sectors.map(s=>Presentacion.sector(s,true,s.id===sectorId)).join('')+'</tr>';
    }).join('');
    $('relative-matrix').innerHTML=result.items.length?html+'</tbody></table>':'<p class="empty">Sin municipios para esta búsqueda.</p>';
    $('relative-matrix').querySelectorAll('thead th').forEach((th,i)=>{
      if(!i)return;const s=Priorizacion.SECTORS[i-1],active=s.id===sectorId;
      th.setAttribute('aria-sort',active?(direction==='asc'?'ascending':'descending'):'none');
      th.innerHTML='<button type="button" class="column-sort" data-relative-sort="'+s.id+'">'+esc(s.name)+' <span aria-hidden="true">'+(active?(direction==='asc'?'↑':'↓'):'↕')+'</span></button>';
      th.querySelector('button').onclick=()=>{if(!active){sectorId=s.id;direction='desc';}else if(direction==='desc')direction='asc';else{sectorId='';direction='desc';}render(state);$('relative-matrix').scrollTop=0;$('relative-matrix').querySelector('[data-relative-sort="'+s.id+'"]').focus({preventScroll:true});};
    });
    $('relative-matrix').querySelectorAll('[data-relative-geo]').forEach(b=>b.onclick=()=>{selectedGeo=b.dataset.relativeGeo;detail(result.items.find(r=>r.geo===selectedGeo),abs.get(selectedGeo));$('relative-detail').scrollIntoView({behavior:'smooth',block:'start'});});
    $('relative-search').oninput=()=>{render(state);$('relative-matrix').scrollTop=0;};
    detail(result.items.find(r=>r.geo===selectedGeo),abs.get(selectedGeo));
  }
  return {render};
  }
  root.PrioridadRelativa=createView('relative','sectorial');
  root.PrioridadPerCapita=createView('percapita','percapita');
})(globalThis);

