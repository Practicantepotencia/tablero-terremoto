/* Comparative per-resident view. Uses the same sectors/weights as the absolute model. */
(function(root){
  'use strict';
  const $=id=>document.getElementById(id);
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=n=>Number.isFinite(n)?new Intl.NumberFormat('es-CO',{maximumFractionDigits:4}).format(n):'—';
  const points=n=>Number.isFinite(n)?new Intl.NumberFormat('es-CO',{maximumFractionDigits:2}).format(n):'—';
  const range=(lo,hi)=>Math.abs(lo-hi)<1e-8?`${points(lo)} /100`:`Documentado ${points(lo)} · posible ${points(hi)} /100`;
  const headers=names=>'<thead><tr>'+names.map(n=>`<th scope="col">${esc(n)}</th>`).join('')+'</tr></thead>';
  let relativeModel,absoluteModel,sectorId='',direction='desc',selectedGeo='';
  function detail(r,absolute){
    $('relative-detail').hidden=!r;
    if(!r)return;
    const factorLo=(1+.25*(r.vulnerability??0)/100)/1.25,factorHi=(1+.25*(r.vulnerability??100)/100)/1.25;
    const pop=r.population;
    $('relative-detail').innerHTML=`<div class="section-head"><h3>${esc(r.m)}, ${esc(r.d)} · cálculo relativo</h3><button type="button" class="secondary" id="relative-close">Cerrar ficha</button></div><p>${pop?`Población proyectada ${pop.year}: <strong>${fmt(pop.population)} habitantes</strong>. <a target="_blank" rel="noopener" href="${esc(DATA.population.url)}">DANE</a> · ${esc(pop.locator)}`:'Sin población positiva vinculada por DIVIPOLA para el año de esta captura; no se asigna un puntaje relativo.'}</p><p>Prioridad relativa: ${r.coverage?range(r.lower,r.upper):'Sin puntaje'} · puesto ${r.rank??'—'}. Prioridad absoluta: ${points(absolute?.lower)} · puesto ${absolute?.rank??'—'}.</p><div class="table-scroll"><table>${headers(['Dimensión / variable','Valor original','Habitantes','Tasa × 10.000','Máxima tasa / N','Puntaje variable','Peso interno','Aporte al sector'])}<tbody>${r.sectors.flatMap(s=>s.fields.map(f=>`<tr><td>${esc(s.name)} · ${esc(f.label)}<div class="small muted">${esc(f.source)}</div></td><td class="num">${f.row?fmt(f.row.v):'Sin dato'}</td><td class="num">${fmt(pop?.population)}</td><td class="num">${fmt(f.rate)}</td><td class="num">${fmt(f.anchor)} / ${f.n}</td><td class="num">${fmt(f.score)}</td><td class="num">${fmt(f.share*100)}%</td><td class="num">${f.score==null?'Desconocido':fmt(f.score*f.share)}</td></tr>`)).join('')}</tbody></table></div><p class="formula">Tasa = valor original × 10.000 / habitantes<br>z relativo = 100 × tasa / máxima tasa comparable<br>Sector = Σ(z relativo × peso interno)<br>D inferior = (${r.sectors.map(s=>fmt(s.lower)).join(' + ')}) / 6 = ${fmt(r.damageLower)}<br>P relativo inferior = ${fmt(r.damageLower)} × ${fmt(factorLo)} = ${fmt(r.lower)}<br>P relativo superior = ${fmt(r.damageUpper)} × ${fmt(factorHi)} = ${fmt(r.upper)}</p><p>IPM DANE 2018: ${r.vulnerability==null?'sin dato, se propaga 0–100':fmt(r.vulnerability)+'%'}. Factor = (1 + 0,25 × IPM/100) / 1,25. Si falta un numerador o población, su puntaje queda desconocido; los ceros explícitos solo puntúan cero con denominador válido. Las sumas inferiores usan cero como límite, no como observación.</p>`;
    $('relative-close').onclick=()=>{selectedGeo='';$('relative-detail').hidden=true;};
  }
  function render(state){
    if(!$('relative-matrix'))return;
    if(!relativeModel){absoluteModel=Priorizacion.create(DATA);relativeModel=Priorizacion.create(DATA,undefined,{relative:true});}
    const selected={...state,priorityOrder:'integrated',priorityDimension:sectorId,dimensionDirection:direction,matrixSearch:$('relative-search').value};
    const result=relativeModel.selection(selected),absolute=absoluteModel.compute(state),abs=new Map(absolute.items.map(r=>[r.geo,r]));
    const sector=Priorizacion.SECTORS.find(s=>s.id===sectorId),year=String(state.date).slice(0,4);
    $('relative-note').textContent=`${sector?`Orden por ${sector.name}, ${direction==='desc'?'mayor a menor':'menor a mayor'}`:'Orden por prioridad relativa documentada'}. Pulsa una dimensión: mayor a menor → menor a mayor → orden normal. Población DANE ${year}; tasas por 10.000 habitantes. Índices normalizados de 0 a 100.`;
    $('relative-formula').textContent=`Cada variable: tasa = valor × 10.000 / población; puntaje = 100 × tasa / máxima tasa comparable. Se mantienen los 17 campos, los seis sectores (1/6 cada uno) y el ajuste IPM. Referencia: ${state.scope==='decree'?'departamentos del decreto':'inventario completo'}, captura ${state.date}. Buscar, ordenar o filtrar departamento no cambia esa referencia. Población: proyección DANE del mismo año; versión publicada el ${DATA.population?.publication||'—'}.`;
    const withPop=result.items.filter(r=>r.population).length,scored=result.items.filter(r=>r.coverage>0).length;
    $('relative-count').textContent=`${result.items.length} municipios visibles · ${withPop} con población · ${scored} con puntaje relativo · ${result.referenceN} en el universo de referencia. La referencia de cada variable excluye los municipios sin numerador comparable o denominador válido.`;
    let html=`<table>${headers(['Municipio y prioridad relativa',...Priorizacion.SECTORS.map(s=>s.name)])}<tbody>`;
    html+=result.items.map(r=>{const chosen=sector?r.sectors.find(s=>s.id===sector.id):null;
      return `<tr><td class="municipal-cell"><button class="link" type="button" data-relative-geo="${esc(r.geo)}">${esc(r.m)}</button><div class="muted small">${esc(r.d)}</div><div class="priority-number">${chosen?(chosen.coverage?points(chosen.lower):'—'):(r.coverage?points(r.lower):'—')}<small> /100</small></div><div class="small">${chosen?esc(chosen.name):'Prioridad relativa'} · ${r.coverage?range(chosen?.lower??r.lower,chosen?.upper??r.upper):'Sin puntaje'}</div><div class="small muted">${r.population?`${fmt(r.population.population)} habitantes · ${r.population.year}`:'Sin población vinculada del año seleccionado'}</div><div class="small muted">Cobertura ${points(100*r.coverage)}% · ${r.available}/17 campos</div><div class="small muted">${sector?`Puesto en dimensión ${r.dimensionRank??'—'} · `:''}Puesto relativo ${r.rank??'—'} · absoluto ${abs.get(r.geo)?.rank??'—'}</div></td>${r.sectors.map(s=>`<td class="heat-cell ${s.id===sectorId?'selected-sector':''}"><div class="sector-score">${s.coverage?range(s.lower,s.upper):'Sin datos relativos'}</div>${s.fields.map(f=>`<span class="heat-item ${f.score==null?'missing':''}" style="background:rgba(31,95,174,${f.score==null?.025:.04+.2*f.score/100})" title="${esc(`${f.label} · ${f.source}. Puntaje relativo ${fmt(f.score)}. Máxima tasa ${fmt(f.anchor)}; N=${f.n}.`)}"><span>${esc(f.label)}</span><br><b>${fmt(f.rate)}</b> <span>/10.000 hab.</span><div class="small muted">Original: ${f.row?`${fmt(f.row.v)} ${esc(f.unit)}`:'sin dato'}${!r.population?' · sin denominador':''}</div></span>`).join('')}</td>`).join('')}</tr>`;
    }).join('');
    $('relative-matrix').innerHTML=result.items.length?html+'</tbody></table>':'<p class="empty">Sin municipios para esta búsqueda.</p>';
    $('relative-matrix').querySelectorAll('thead th').forEach((th,i)=>{if(!i)return;const s=Priorizacion.SECTORS[i-1],active=s.id===sectorId;
      th.setAttribute('aria-sort',active?(direction==='asc'?'ascending':'descending'):'none');
      th.innerHTML=`<button type="button" class="column-sort" data-relative-sort="${s.id}">${esc(s.name)} <span aria-hidden="true">${active?(direction==='asc'?'↑':'↓'):'↕'}</span></button>`;
      th.querySelector('button').onclick=()=>{if(!active){sectorId=s.id;direction='desc';}else if(direction==='desc')direction='asc';else{sectorId='';direction='desc';}render(state);$('relative-matrix').scrollTop=0;$('relative-matrix').querySelector(`[data-relative-sort="${s.id}"]`).focus({preventScroll:true});};
    });
    $('relative-matrix').querySelectorAll('[data-relative-geo]').forEach(b=>b.onclick=()=>{selectedGeo=b.dataset.relativeGeo;detail(result.items.find(r=>r.geo===selectedGeo),abs.get(selectedGeo));$('relative-detail').scrollIntoView({behavior:'smooth',block:'start'});});
    $('relative-search').oninput=()=>{render(state);$('relative-matrix').scrollTop=0;};
    detail(result.items.find(r=>r.geo===selectedGeo),abs.get(selectedGeo));
  }
  root.PrioridadRelativa={render};
})(globalThis);
