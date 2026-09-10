'use strict';
const T = Territorial, model = T.create(DATA), priorityModels=Priorizacion.models(DATA), priorityModel=priorityModels.absolute;
const $ = id => document.getElementById(id);
const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = (n, unit = '') => n == null || !Number.isFinite(n) ? '—' : new Intl.NumberFormat('es-CO',
  {maximumFractionDigits: unit === 'COP' ? 0 : unit === 'Índice' ? 3 : Math.abs(n)<1 ? 4 : 2}).format(n);
const short = n => n == null ? '—' : new Intl.NumberFormat('es-CO', {notation:'compact',maximumFractionDigits:1}).format(n);
const sorted = a => [...new Set(a)].sort((x,y) => x.localeCompare(y,'es'));
const state = {scope:'decree',dept:'',date:DATA.latest,level:'municipal',source:T.RAPIDA,dim:'Vivienda',metric:'',order:'desc',geo:'',tab:'prioridades',matrixSource:'integrated',priorityOrder:'integrated',priorityDimension:'',priorityGeo:''};
let priorityLimit = 25, sectorLimit = 25, rapidaLimit=25, comparisonGeo='';
const table = (heads, rows) => rows.length ? `<table><thead><tr>${heads.map(h=>`<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>` : '<p class="empty">Sin datos para esta selección.</p>';
const tile = (label, value, sub) => `<div class="tile"><div class="tile-label">${esc(label)}</div><div class="tile-value">${esc(value)}</div><div class="tile-sub">${esc(sub)}</div></div>`;
const geoButton = (r, source = r.f) => `<button type="button" class="link" data-geo="${esc(r.geo)}" data-source="${esc(source)}">${esc(r.m || r.d)}</button>${r.m?`<div class="muted small">${esc(r.d)}</div>`:''}`;
function attribution(r) {
  if(r.f !== 'FundacionExe') return '';
  return `<div class="small">${model.decree(state.date).has(r.d)?'Atribución al sismo no verificada':'No atribuida al sismo'}</div>`;
}
function setOptions(id, choices, selected, emptyLabel) {
  const options = emptyLabel ? [{value:'',label:emptyLabel},...choices] : choices;
  $(id).innerHTML = options.map(o=>`<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('');
  $(id).value = options.some(o=>o.value===selected) ? selected : options[0]?.value ?? '';
  return $(id).value;
}
function globalControls() {
  setOptions('date',DATA.dates.slice().reverse().map(d=>({value:d,label:d})),state.date);
  const deps = sorted(model.visible({...state,dept:''}).map(r=>r.d));
  state.dept = setOptions('dept',deps.map(d=>({value:d,label:d})),state.dept,'Todos');
  $('capture-label').textContent = `Captura: ${state.date || 'sin fecha válida'}`;
  $('build-label').textContent = `Generado: ${DATA.generated.slice(0,10)}`;
  $('scope-note').textContent = state.scope==='decree'
    ? `${model.decree(state.date).size} departamentos nombrados en el inventario del Decreto 1171. El ámbito administrativo no acredita afectación en cada municipio.`
    : 'Inventario completo. Incluye coberturas ajenas al sismo; revisa la atribución y la fuente de cada indicador.';
  $('footer-capture').textContent = `Captura del inventario ${state.date}. Fecha efectiva de las observaciones pendiente de verificación por fuente.`;
}
function diagnosticControls() {
  const valid = model.catalog.filter(m=>m.lv===state.level && m.f!=='Decreto1171');
  const sources = sorted(valid.map(m=>m.f));
  state.source = setOptions('source',sources.map(f=>({value:f,label:DATA.sources[f]?.label||f})),state.source);
  const sourceCatalog = valid.filter(m=>m.f===state.source);
  const dims = sorted(sourceCatalog.map(m=>m.dim));
  state.dim = setOptions('dimension',dims.map(d=>({value:d,label:d})),state.dim);
  const metrics = sourceCatalog.filter(m=>m.dim===state.dim).sort((a,b)=>a.i.localeCompare(b.i,'es'));
  state.metric = setOptions('indicator',metrics.map(m=>({value:m.key,label:`${m.i} (${m.u})`})),state.metric);
  const places = [...new Map(model.visible(state).filter(r=>r.lv===state.level).map(r=>[r.geo,r])).values()].sort((a,b)=>T.label(a).localeCompare(T.label(b),'es'));
  state.geo = setOptions('territory',places.map(r=>({value:r.geo,label:T.label(r)})),state.geo);
}
function activate(tab) {
  state.tab=tab;
  document.querySelectorAll('[data-tab]').forEach(b=>{const on=b.dataset.tab===tab;b.classList.toggle('active',on);b.setAttribute('aria-selected',String(on));});
  document.querySelectorAll('.tab-panel').forEach(p=>p.hidden=p.id!==tab);
}
function openProfile(geo,source) {
  const r = model.visible(state).find(x=>x.geo===geo);
  if(!r)return;
  state.level=r.lv; $('level').value=r.lv;
  state.source=source||T.RAPIDA;state.geo=geo;
  diagnosticControls(); renderDiagnostic(); activate('diagnostico');
  $('profile-card').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
  $('territory').focus({preventScroll:true});
}
function scatter(items,qr,qi) {
  const points=items.filter(r=>r.ipm!=null);
  if(!points.length){$('scatter').innerHTML='<p class="empty">No hay municipios con IPM y necesidad de recuperación temprana en esta selección.</p>';return;}
  const W=540,H=330,L=64,B=50,R=22,U=20;
  const xmax=Math.max(...points.map(r=>r.ipm),qi||0,1)*1.06, ymax=Math.max(...points.map(r=>r.v),qr||0,.01)*1.06;
  const sx=x=>L+x/xmax*(W-L-R),sy=y=>H-B-y/ymax*(H-U-B);
  const ticks=[0,.25,.5,.75,1];
  $('scatter').innerHTML=`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Necesidad de recuperación temprana frente al IPM municipal">
    ${ticks.map(t=>`<line class="gridline" x1="${L}" x2="${W-R}" y1="${sy(t*ymax)}" y2="${sy(t*ymax)}"/><text x="${L-8}" y="${sy(t*ymax)+4}" text-anchor="end">${fmt(t*ymax,'Índice')}</text><text x="${sx(t*xmax)}" y="${H-B+22}" text-anchor="middle">${fmt(t*xmax)}</text>`).join('')}
    <line class="axis" x1="${L}" x2="${W-R}" y1="${H-B}" y2="${H-B}"/>
    ${qr!=null?`<line class="threshold" x1="${L}" x2="${W-R}" y1="${sy(qr)}" y2="${sy(qr)}"/>`:''}
    ${qi!=null?`<line class="threshold" x1="${sx(qi)}" x2="${sx(qi)}" y1="${U}" y2="${H-B}"/>`:''}
    ${points.map(r=>`<circle class="point ${r.high?'high':''}" cx="${sx(r.ipm)}" cy="${sy(r.v)}" r="5" data-geo="${esc(r.geo)}" data-source="${T.RAPIDA}" tabindex="0" role="button" aria-label="${esc(`${T.label(r)}. IPM ${fmt(r.ipm)}. Necesidad de recuperación temprana ${fmt(r.v,'Índice')}. Abrir ficha.`)}"><title>${esc(T.label(r))}\nIPM: ${fmt(r.ipm)}\nNecesidad de recuperación temprana: ${fmt(r.v,'Índice')}</title></circle>`).join('')}
    <text x="${W/2}" y="${H-7}" text-anchor="middle">IPM publicado (0–100)</text><text transform="translate(16 ${H/2}) rotate(-90)" text-anchor="middle">Necesidad de recuperación temprana</text></svg>`;
}
function historyBlock(key,geo='') {
  if(!key)return '<p class="empty">Sin indicador seleccionado.</p>';
  const result=model.history(state,key,geo);
  if(!result.ready)return `<p class="empty">${result.points.length<2?'Solo hay una captura disponible. Se requieren al menos dos.':'No existe un panel de territorios presente en todas las capturas.'}</p>`;
  const [, , , ,unit]=JSON.parse(key), pts=result.points;
  const lo=Math.min(...pts.map(p=>p.v)),hi=Math.max(...pts.map(p=>p.v)),pad=(hi-lo)*.1||1;
  const W=520,H=205,L=65,B=42,U=18,R=28;
  const sx=i=>L+i/(pts.length-1)*(W-L-R),sy=v=>H-B-(v-lo+pad)/(hi-lo+2*pad)*(H-U-B);
  const d=pts.map((p,i)=>`${i?'L':'M'}${sx(i)},${sy(p.v)}`).join(' ');
  return `<p class="note">Panel constante: ${result.n} ${geo?'territorio':'territorios'}. Cambio entre primera y última captura: ${fmt(result.delta,unit)} ${esc(unit)}.</p>
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Mediana por captura del inventario"><line class="axis" x1="${L}" x2="${W-R}" y1="${H-B}" y2="${H-B}"/><path class="line" d="${d}"/>
    ${pts.map((p,i)=>`<circle class="point" r="4" cx="${sx(i)}" cy="${sy(p.v)}"><title>${esc(p.date)}: ${fmt(p.v,unit)}</title></circle>${i===0||i===pts.length-1?`<text x="${sx(i)}" y="${H-15}" text-anchor="${i===0?'start':'end'}">${esc(p.date)}</text><text x="${sx(i)}" y="${sy(p.v)-9}" text-anchor="${i===0?'start':'end'}">${fmt(p.v,unit)}</text>`:''}`).join('')}</svg>
    <details><summary>Valores y cobertura por captura</summary>${table(['Captura','Mediana','Panel común','Con dato'],pts.map(p=>`<tr><td>${esc(p.date)}</td><td class="num">${fmt(p.v,unit)}</td><td class="num">${p.n}</td><td class="num">${p.observed}</td></tr>`))}</details>`;
}
function renderPriorities() {
  const p=priorityModel.selection(state), scored=p.items.filter(r=>r.coverage>0);
  $('priority-kpis').innerHTML=tile('Municipios con evidencia',`${scored.length} / ${p.items.length}`,'Al menos un campo de los 17 del modelo')+
    tile('Con todos los campos',p.items.filter(r=>r.complete).length,'Si faltan datos, se muestra un intervalo')+
    tile('Cobertura ponderada mediana',scored.length?`${fmt(T.quantile(scored.map(r=>100*r.coverage),.5))}%`:'—','Disponibilidad de componentes; no certeza')+
    tile('Coincidencias con mayor necesidad de recuperación temprana',`${p.overlap} / ${p.rapidaTopN}`,'Top 20 con empates · universo de referencia');
  renderMatrix();
  if(state.priorityGeo)renderPriorityDetail(state.priorityGeo,false);
}
function renderMatrix() {
  const integrated=true;
  state.matrixSource='integrated';state.matrixLevel='municipal';
  const selected={...state,matrixSearch:$('matrix-search').value};
  const p=priorityModel.selection(selected),municipal=state.matrixLevel==='municipal';
  const selectedSector=Priorizacion.SECTORS.find(s=>s.id===state.priorityDimension);
  const orderText=selectedSector?`Orden por ${selectedSector.name}: ${state.dimensionDirection==='asc'?'menor a mayor':'mayor a menor'}, usando el puntaje documentado. Municipios sin datos al final`:'Orden normal: prioridad global documentada de mayor a menor';
  $('priority-note').textContent=municipal?`${orderText}. Pulsa una columna: mayor a menor → menor a mayor → orden normal. Selecciona un municipio para ver su fórmula.`:'Los totales departamentales no se reparten entre municipios ni reciben puntaje municipal.';
  if(state.matrixSource==='FundacionExe')$('priority-note').textContent+=' ExE: atribución de las sedes al sismo pendiente de verificar.';
  const source=DATA.sources[state.matrixSource];
  $('matrix-title').textContent=municipal?'Qué necesita cada municipio · absoluto':'Qué reporta cada departamento';
  $('matrix-caption').textContent=integrated?'3iS: reportes consolidados · PNUD: inventario de daños usado para la estimación · DANE 2018: vulnerabilidad':`${source?.label||state.matrixSource} · valores originales`;
  $('matrix-note').textContent=integrated?'El intervalo propaga datos faltantes; no es un intervalo de confianza. El color representa la intensidad normalizada de cada campo. «—» es sin dato.':'Cada color es el percentil del mismo indicador y fuente dentro del ámbito seleccionado. La búsqueda y el departamento no alteran la referencia.';
  $('matrix-warning').textContent=integrated?'Las cifras PNUD y 3iS pueden compartir insumos. Cada sector mantiene un peso fijo; coincidir no cuenta como corroboración independiente.':source?.note||'';
  const compactRange=(lo,hi)=>Math.abs(lo-hi)<1e-8?`${fmt(lo)} /100`:`Documentado ${fmt(lo)} · posible ${fmt(hi)} /100`;
  const placeCell=r=>{const sector=selectedSector&&r.sectors.find(s=>s.id===selectedSector.id),hasSector=sector&&sector.coverage>0;return `<td class="municipal-cell"><button class="link" type="button" data-priority-geo="${esc(r.geo)}">${esc(r.m)}</button><div class="muted small">${esc(r.d)}</div><div class="priority-number">${selectedSector?(hasSector?fmt(state.priorityOrder==='uncertainty'?sector.upper:sector.lower):'—'):(r.coverage>0?fmt(state.priorityOrder==='uncertainty'?r.upper:r.lower):'—')}<small> / 100</small></div><div class="small">${selectedSector?(hasSector?`${esc(selectedSector.name)} · ${compactRange(sector.lower,sector.upper)}`:'Sin datos en esta dimensión'):(r.coverage>0?`Prioridad · ${compactRange(r.lower,r.upper)}`:'Sin componentes puntuables')}</div><div class="small muted">Cobertura ${fmt(100*r.coverage)}% · ${r.available}/17 campos</div><div class="small muted">${selectedSector?`Puesto en dimensión ${r.dimensionRank??'—'} · global ${r.rank??'—'}`:`Puesto global ${r.rank??'—'}`} · Puesto de necesidad de recuperación temprana ${r.recoveryRank??'—'}</div></td>`;};
  if(integrated){
    $('matrix-count').textContent=`${p.items.length} municipios visibles · ${p.referenceN} en la referencia. El filtro del decreto recalcula anclas, puntajes y posiciones. La búsqueda no los cambia.`;
    const columns=Priorizacion.SECTORS;
    $('matrix').innerHTML=table(['Municipio y puntaje',...columns.map(s=>s.name)],p.items.map(r=>`<tr>${placeCell(r)}${columns.map(column=>{const s=r.sectors.find(x=>x.id===column.id);return `<td class="heat-cell ${selectedSector?.id===s.id?'selected-sector':''}"><div class="sector-score">${compactRange(s.lower,s.upper)} <span class="muted small">sector</span></div>${s.fields.map(f=>`<span class="heat-item ${f.row?'':'missing'}" style="background:rgba(31,95,174,${f.score==null?.025:.04+.2*f.score/100})" title="${esc(`${f.label}. ${f.row?`Valor ${fmt(f.row.v)}. Intensidad ${fmt(f.score)}. Aporte antes de IPM ${fmt(f.contribution)} puntos. Referencia n=${f.n}.`:'Sin observación. No se convierte en cero.'}`)}"><span>${esc(f.label)}</span><br><b>${f.row?fmt(f.row.v):'—'}</b> <span>${f.row?esc(f.row.u):'sin dato'}</span></span>`).join('')}</td>`;}).join('')}</tr>`));
    $('matrix').querySelectorAll('thead th').forEach((th,i)=>{
      if(!i)return;
      const sector=columns[i-1],active=state.priorityDimension===sector.id;
      th.setAttribute('aria-sort',active?(state.dimensionDirection==='asc'?'ascending':'descending'):'none');
      th.innerHTML=`<button type="button" class="column-sort" data-sort-sector="${sector.id}">${esc(sector.name)} <span aria-hidden="true">${active?(state.dimensionDirection==='asc'?'↑':'↓'):'↕'}</span></button>`;
      th.querySelector('button').onclick=()=>{
        if(!active){state.priorityDimension=sector.id;state.dimensionDirection='desc';}
        else if(state.dimensionDirection!=='asc')state.dimensionDirection='asc';
        else {state.priorityDimension='';state.dimensionDirection='desc';}
        renderMatrix();$('matrix').scrollTop=0;
        $('matrix').querySelector(`[data-sort-sector="${sector.id}"]`).focus({preventScroll:true});
      };
    });
    return;
  }
  // La matriz conserva las distinciones internas de cada fuente, ordenada por el modelo elegido.
  const matrix=model.matrix(selected,municipal?p.items:undefined),layout=model.matrixLayout(selected);
  const scores=new Map(p.items.map(r=>[r.geo,r]));
  const withData=matrix.filter(r=>r.cells.some(s=>s.cells.some(Boolean))).length;
  $('matrix-count').textContent=`${matrix.length} ${municipal?'municipios':'departamentos'} visibles · ${withData} con datos de esta fuente. La búsqueda no cambia los colores ni el orden.`;
  $('matrix').innerHTML=table([municipal?'Municipio y prioridad':'Departamento',...layout.map(s=>s.name)],matrix.map(r=>`<tr>${municipal?placeCell(scores.get(r.geo)):`<td>${geoButton(r,state.matrixSource)}</td>`}${r.cells.map(s=>`<td class="heat-cell">${s.cells.map(c=>c?`<span class="heat-item" style="background:rgba(31,95,174,${c.p==null?.04:.04+.2*c.p/100})" title="${esc(`${c.i}. ${c.u}${c.p==null?'':`. P${Math.round(c.p)}`}`)}"><span>${esc(c.i)}</span><br><b>${c.u==='COP'?short(c.v):fmt(c.v,c.u)}</b> <span>${esc(c.u)}</span></span>`:'<span class="heat-item muted">—</span>').join('')}</td>`).join('')}</tr>`));
}
function renderPriorityDetail(geo,scroll=true){
  state.priorityGeo=geo;
  const p=priorityModel.compute(state),r=[...p.items,...p.missing].find(x=>x.geo===geo&&(!state.dept||x.d===state.dept));
  $('priority-detail').hidden=!r;
  if(!r)return;
  const factorLo=(1+.25*(r.vulnerability??0)/100)/1.25;
  const fields=r.sectors.flatMap(s=>s.fields.map(f=>({s:s.name,...f})));
  $('priority-detail').innerHTML=`<div class="section-head"><h2>${esc(T.label(r))}</h2><button class="secondary" type="button" id="close-priority-detail">Cerrar ficha</button></div><p class="note">${esc(r.code?`DIVIPOLA ${r.code}`:r.geo)} · captura ${esc(state.date)}. Fecha efectiva de cada fuente pendiente de acreditar.</p><div class="tiles">${tile('Prioridad documentada',r.coverage?fmt(r.lower):'—',`Intervalo ${fmt(r.lower)}–${fmt(r.upper)}`)}${tile('Puesto al variar pesos',r.rankMin==null?'—':`${r.rankMin}–${r.rankMax}`,`${p.scenarios} escenarios; no probabilidad`)}${tile('Puesto posible por faltantes',r.bestRank==null?'—':`${r.bestRank}–${r.worstRank}`,'Entre municipios con algún componente')}${tile('IPM censal 2018',r.vulnerability==null?'—':`${fmt(r.vulnerability)}%`,'DANE · vulnerabilidad previa')}</div><p class="formula">P = D × (1 + 0,25 × IPM/100) / 1,25<br>Límite inferior: ${fmt(r.damageLower)} × ${fmt(factorLo)} = ${fmt(r.lower)} puntos.</p><p>D = promedio de los seis sectores. Sectores: ${r.sectors.map(s=>`${esc(s.name)} ${fmt(s.lower)}–${fmt(s.upper)}`).join('; ')}. ${r.vulnerability==null?'El IPM faltante también amplía el intervalo.':''}</p><div class="table-scroll">${table(['Sector','Variable y fuente','Valor','Referencia positiva / total','Máximo observado','Intensidad 0–100','Aporte mínimo al puntaje'],fields.map(f=>`<tr><td>${esc(f.s)}</td><td>${esc(f.label)}<div class="small muted">${esc(f.source)}</div></td><td class="num">${f.row?fmt(f.row.v):'Sin dato'}</td><td class="num">${f.positive} / ${f.n}</td><td class="num">${fmt(f.anchor)}</td><td class="num">${fmt(f.score)}</td><td class="num">${f.score==null?'Desconocido':fmt(f.contribution*factorLo)}</td></tr>`))}</div><p class="note">Necesidad de recuperación temprana original: ${fmt(r.recovery,'Índice')} (puesto ${r.recoveryRank??'—'}). No interviene en este cálculo. ${r.baseline?`Línea base: <a href="${esc(r.baseline.download)}" target="_blank" rel="noopener">DANE 2018</a>, ${esc(r.baseline.locator)}.`:''}</p><button class="secondary" type="button" data-geo="${esc(r.geo)}" data-source="${esc(state.matrixSource==='integrated'?'3iS-Sheets':state.matrixSource)}">Consultar todos los indicadores de la fuente</button>`;
  $('close-priority-detail').onclick=()=>{state.priorityGeo='';$('priority-detail').hidden=true;};
  if(scroll)$('priority-detail').scrollIntoView({behavior:'smooth',block:'start'});
}
function renderPriorityMethod(){
  const p=priorityModel.compute(state);
  $('priority-method').innerHTML=`<h2>Fórmula del modelo sectorial ${Priorizacion.VERSION}</h2><p class="formula">z = 100 × valor / máximo observado del indicador<br>Sector = suma de z × peso interno<br>D = (Impacto humano + Vivienda + Salud + Educación + Infraestructura + Comunidad) / 6<br>P = D × (1 + 0,25 × IPM censal / 100) / 1,25</p><p>Un cero explícito tiene intensidad cero. Si falta una observación, su intensidad puede estar entre 0 y 100. Se propagan ambos extremos sin repartir su peso a otra variable ni rellenarla desde otra fuente. Los valores originales se conservan. La escala proporcional conserva las razones entre cantidades de un mismo indicador, sin recorte P95. Es sensible a máximos extremos o erróneos y al tamaño municipal; no mide tasas de afectación.</p><p>Se usa la captura ${esc(state.date)} y el ámbito ${state.scope==='decree'?'de departamentos del decreto':'completo'}: ${p.referenceN} municipios del inventario. Cada ancla usa exclusivamente su propia fuente, definición y unidad. No son tasas de afectación: faltan denominadores compatibles de vivienda, servicios y matrícula.</p><div class="table-scroll">${table(['Sector (peso 1/6)','Variable','Fuente','Peso dentro del sector','Con dato / positivos','Máximo observado'],Priorizacion.SECTORS.flatMap(s=>s.fields.map(f=>{const c=p.calibrations.find(c=>c.id===f.id);return `<tr><td>${esc(s.name)}</td><td>${esc(f.label)}</td><td>${esc(f.source)}</td><td class="num">${fmt(f.share*100)}%</td><td class="num">${c.n} / ${c.positive}</td><td class="num">${fmt(c.anchor)}${c.positive<10?'<div class="small">Referencia positiva pequeña</div>':''}${!c.coherent?'<div class="small">Definiciones incompatibles: excluido</div>':''}</td></tr>`;})))}</div><h3>Qué se comprueba</h3><p>39 escenarios: pesos sectoriales iguales o un sector ±25%, cruzados con un ajuste de pobreza de 0%, 25% y 50%. La ficha muestra el rango de puestos del límite inferior. Es sensibilidad a decisiones metodológicas, no confianza estadística ni validación del daño. Los intervalos por faltantes se muestran por separado.</p><h3>Qué no entra en la suma</h3><p>La necesidad de recuperación temprana se usa como comparación. No se suman sus componentes duplicados con PNUD, ni costos de reposición que repiten el daño físico. Rescatados mide una respuesta realizada. Impacto humano incorpora familias afectadas, fallecidos, desaparecidos y heridos de 3iS, con un peso interno de 25% cada uno. Sus conteos se normalizan por separado: no se suman como personas únicas. ExE se mantiene en su matriz porque falta atribuir cada sede al sismo. OPS departamental y puntos Naboo no se asignan como daños municipales.</p><p>El modelo no mide necesidad neta pendiente: todavía faltan entregas, reparación realizada, costos de acceso y capacidades locales. Sus pesos son una propuesta explícita y el orden conservador puede favorecer territorios con más evidencia. <a href="https://knowledge4policy.ec.europa.eu/composite-indicators/toolkit_en/navigation-page/10-step-guide_en/step-8-sensitivity-analysis_en" target="_blank" rel="noopener">JRC: sensibilidad de indicadores compuestos</a>.</p>`;
}
function distribution(pool) {
  if(!pool.length)return '<p class="empty">No hay distribución para estos filtros.</p>';
  const vals=pool.map(r=>r.v),min=Math.min(...vals),max=Math.max(...vals),n=min===max?1:8;
  const bins=Array(n).fill(0);vals.forEach(v=>bins[min===max?0:Math.min(n-1,Math.floor((v-min)/(max-min)*n))]++);
  const W=540,H=240,L=45,R=18,B=50,U=24,step=(W-L-R)/n,top=Math.max(...bins);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Histograma de valores originales"><text x="${L}" y="15">Territorios</text>${bins.map((count,i)=>{const h=count/top*(H-B-U);return `<rect x="${L+i*step+2}" y="${H-B-h}" width="${step-4}" height="${h}" fill="#1f5fae"><title>${fmt(min+(max-min)*i/n)} a ${fmt(min+(max-min)*(i+1)/n)}: ${count} territorios</title></rect><text x="${L+(i+.5)*step}" y="${H-B-h-6}" text-anchor="middle">${count}</text>`;}).join('')}<text x="${L}" y="${H-24}">${fmt(min)}</text><text x="${W-R}" y="${H-24}" text-anchor="end">${fmt(max)}</text><text x="${W/2}" y="${H-5}" text-anchor="middle">Valor original del indicador</text></svg>`;
}
function renderDiagnostic() {
  const s=model.sector({...state,search:$('sector-search').value}),meta=s.meta;
  $('cohort-note').textContent=meta?`${DATA.sources[meta.f]?.label||meta.f} · ${meta.lv} · ${meta.u} · captura ${state.date}. La selección de fuente e indicador se conserva aunque el filtro deje la vista sin datos.`:'No hay indicadores registrados para este nivel.';
  const sourceWarning=$('source-warning');
  if(state.source===T.RAPIDA){
    sourceWarning.className='note';
    sourceWarning.textContent=`Cobertura del indicador seleccionado: ${s.pool.length} de ${s.total} territorios del inventario en este ámbito, nivel y departamento. ${s.total-s.pool.length} sin valor comparable; sin dato no significa cero. Se muestra el valor publicado por PNUD/UNGRD. Consulta sus límites en «Fuentes y método».`;
  }else{
    sourceWarning.className='notice';
    sourceWarning.textContent=DATA.sources[state.source]?.note||'Metodología de esta fuente pendiente de documentación.';
  }
  const vals=s.pool.map(r=>r.v);
  $('sector-kpis').innerHTML=tile('Territorios con dato',`${s.pool.length} / ${s.total}`,'Respecto del inventario filtrado en este nivel')+
    tile('Mediana',fmt(T.quantile(vals,.5),meta?.u),meta?.u||'')+
    tile('Rango observado',vals.length?`${short(Math.min(...vals))} – ${short(Math.max(...vals))}`:'—',meta?.u||'')+
    tile('Fuente de la comparación',state.source||'—','Corte efectivo y versión: no verificados');
  $('sector-title').textContent=meta?.i||'Ranking sectorial';
  $('sector-table').innerHTML=table(['#','Territorio',meta?.u||'Valor','Percentil'],s.items.slice(0,sectorLimit).map(r=>`<tr><td>${r.rank}</td><td>${geoButton(r)}${attribution(r)}</td><td class="num">${fmt(r.v,r.u)}</td><td class="num">P${Math.round(T.percentile(vals,r.v))}</td></tr>`));
  $('sector-more').hidden=s.items.length<=sectorLimit;
  $('distribution').innerHTML=distribution(s.pool);
  $('distribution-note').textContent=`${s.pool.length} territorios. Percentiles y distribución dentro del mismo indicador, fuente, unidad y captura. La búsqueda solo reduce las tablas.`;
  $('download').disabled=!s.items.length;
  renderProfile();
}
function renderProfile() {
  const rows=model.profile(state,state.geo);
  const r=model.visible(state).find(x=>x.geo===state.geo);
  $('profile-note').textContent=r?`${T.label(r)} · ${state.source}. Vínculo territorial: ${r.join}${r.code?` (${r.code})`:''}. Los percentiles usan la misma fuente, indicador y selección geográfica.`:'Sin territorio disponible en este universo.';
  const rec=rows.find(x=>x.id===T.RECOVERY),ipm=rows.find(x=>x.id===T.IPM);
  $('profile-kpis').innerHTML=tile('Necesidad de recuperación temprana',fmt(rec?.v,'Índice'),rec?'RAPIDA · valor original':'Sin dato en la fuente elegida')+tile('IPM',fmt(ipm?.v),ipm?'Año base no documentado':'Sin dato en la fuente elegida')+tile('Indicadores disponibles',rows.length,'Fuente y captura seleccionadas')+tile('Atribución',state.source==='FundacionExe'?'Por verificar':'Consultar fuente','El filtro del decreto es administrativo');
  $('profile-table').innerHTML=rows.length?table(['Dimensión','Indicador','Valor','Unidad','Percentil'],rows.map(r=>`<tr><td>${esc(r.dim)}</td><td>${esc(r.i)}${attribution(r)}</td><td class="num">${fmt(r.v,r.u)}</td><td>${esc(r.u)}</td><td class="num">P${Math.round(r.percentile)}</td></tr>`)):'<p class="empty">Este territorio no tiene observaciones de la fuente elegida en esta captura. Puedes consultar otra fuente de forma explícita.</p>';
  $('profile-trend').innerHTML=historyBlock(state.metric,state.geo);
}
function renderMethod() {
  renderPriorityMethod();
  const base=model.visible(state),sources=sorted(base.map(r=>r.f));
  $('coverage-table').innerHTML=table(['Fuente','Municipios','Departamentos','Indicadores','Origen y límites'],sources.map(f=>{const r=base.filter(x=>x.f===f),info=DATA.sources[f];return `<tr><td><a href="${esc(info?.url||'#')}" target="_blank" rel="noopener">${esc(info?.label||f)}</a></td><td class="num">${new Set(r.filter(x=>x.lv==='municipal').map(x=>x.geo)).size}</td><td class="num">${new Set(r.map(x=>x.d)).size}</td><td class="num">${new Set(r.map(x=>x.id)).size}</td><td>${esc(info?.kind||'Fuente registrada')}<div class="small muted">${esc(info?.note||'Pendiente de documentación')}</div></td></tr>`; }));
  const missingCodes=new Set(base.filter(r=>r.lv==='municipal'&&!r.code).map(r=>r.geo)).size;
  $('checks').innerHTML=table(['Control','Resultado'],[
    `<tr><td>Integridad de las capturas cargadas (todo el historial)</td><td>${DATA.issues.length?'Ver incidencias debajo':'Sin conflictos o valores inválidos detectados'}</td></tr>`,
    ...DATA.issues.map(i=>`<tr><td>${esc(i.label)}</td><td class="num">${i.n}</td></tr>`),
    `<tr><td>Municipios de esta selección sin DIVIPOLA</td><td class="num">${missingCodes}</td></tr>`,
    '<tr><td>Fecha efectiva de observación por fila</td><td>No acreditada en el esquema actual</td></tr>',
    '<tr><td>Probabilidad o nivel de confianza estadístico</td><td>No estimado; se muestra cobertura observada</td></tr>'
  ]);
  const metas=[...new Map(base.map(r=>[T.cohort(r),r])).values()];
  $('dictionary').innerHTML=table(['Indicador','Dimensión','Fuente','Nivel','Unidad'],metas.map(r=>`<tr><td>${esc(r.i)}<div class="small muted">${esc(r.id)}</div></td><td>${esc(r.dim)}</td><td>${esc(r.f)}</td><td>${esc(r.lv)}</td><td>${esc(r.u)}</td></tr>`));
}

function renderRapida(){
  const p=model.priorities({...state,search:$('rapida-search').value});
  $('rapida-kpis').innerHTML=tile('Municipios con necesidad de recuperación temprana',p.pool.length+' / '+p.total,'Municipios del inventario filtrado')+
    tile('Necesidad de recuperación temprana mediana',fmt(T.quantile(p.pool.map(r=>r.v),.5),'Índice'),'Índice original publicado por RAPIDA')+
    tile('En el tramo superior',p.canBand?p.pool.filter(r=>r.high).length:'—',p.canBand?'Umbral P75: '+fmt(p.qr,'Índice')+' · referencia: '+p.referenceN+' municipios':'Cobertura o variación insuficientes')+
    tile('IPM mediano',fmt(T.quantile(p.pool.map(r=>r.ipm),.5)),p.pool.filter(r=>r.ipm!=null).length+' municipios con necesidad de recuperación temprana e IPM');
  $('rapida-note').textContent=p.mixed?'Definiciones incompatibles: ranking suspendido.':'Orden exclusivamente por necesidad de recuperación temprana. '+p.items.length+' municipios coinciden con la búsqueda. Captura '+state.date+'; corte de fuente no verificado. Cobertura: sectores con todos sus campos / 5. Los puestos de esta tabla se calculan dentro del departamento visible; el gráfico de comparación conserva los del ámbito completo.';
  $('rapida-table').innerHTML=table(['#','Municipio','Necesidad de recuperación temprana','IPM','Cobertura'],p.items.slice(0,rapidaLimit).map(r=>'<tr><td>'+r.rank+'</td><td>'+geoButton(r)+(r.high?'<div class="badge high">Tramo superior</div>':'')+'</td><td class="num"><b>'+fmt(r.v,'Índice')+'</b></td><td class="num">'+fmt(r.ipm)+'</td><td>'+r.coverage+'/5'+(r.ipm==null?'<div class="small">Sin IPM</div>':'')+'</td></tr>'));
  $('rapida-more').hidden=p.items.length<=rapidaLimit;
  scatter(p.pool,p.canBand?p.qr:null,p.qi);
  $('scatter-note').textContent=p.pool.filter(r=>r.ipm!=null).length+' pares visibles. Líneas P75: necesidad de recuperación temprana '+fmt(p.qr,'Índice')+' e IPM '+fmt(p.qi)+'. Referencia: ámbito territorial seleccionado, antes de filtrar departamento.';
  $('rapida-missing-title').textContent=p.missing.length+' municipios del inventario sin necesidad de recuperación temprana evaluada';
  $('rapida-missing-table').innerHTML=table(['Municipio','Estado'],p.missing.map(r=>'<tr><td>'+geoButton(r,r.f)+'</td><td>Sin dato de necesidad de recuperación temprana</td></tr>'));
  renderComparison();
}
function renderComparison(){
  const mode=$('comparison-mode').value;
  const c=Comparacion.compare(priorityModels,model,state,{mode,axis:'value',panel:'available'}),pairs=c.pairs;
  const names={absolute:'Absoluto',percapita:'Per cápita',sectorial:'Relativo'};
  const precision=n=>n==null?'—':new Intl.NumberFormat('es-CO',{maximumFractionDigits:4}).format(n);
  const search=$('comparison-search').value,matched=pairs.filter(r=>T.searchMatch({...r,lv:'municipal'},search));
  const exclusion=c.excluded.index+' sin índice documentado; '+c.excluded.rapida+' sin necesidad de recuperación temprana comparable (categorías excluyentes)';
  $('comparison-note').textContent='Base: '+(state.scope==='decree'?'departamentos del decreto':'todos los departamentos')+(state.dept?' · '+state.dept:'')+' · captura '+state.date+'. '+c.n+' pares de '+c.total+' municipios.'+(search?' '+matched.length+' coincidencias resaltadas; la búsqueda no cambia los cálculos.':'');
  $('comparison-reference').textContent=c.referenceN+' municipios en la referencia; '+c.recoveryN+' con necesidad de recuperación temprana. Excluidos de la dispersión: '+exclusion+'. Se incluyen todos los pares disponibles de la versión seleccionada; no se rellenan faltantes.';
  $('comparison-kpis').innerHTML=tile('Pares comparables',c.n,'Municipios con ambos datos')+
    tile('R²',precision(c.regression?.r2),'X: nuestro índice · Y: puntaje de necesidad')+
    tile('Pearson r',precision(c.regression?.r),'Positivo: puntajes altos juntos')+
    tile('Spearman ρ',precision(c.rho),'Rangos promedio en empates · solo estos pares');
  function detail(r){
    comparisonGeo=r?.geo||'';
    $('comparison-detail').innerHTML=r?'<h3>'+esc(r.m)+', '+esc(r.d)+'</h3><p><b>'+names[mode]+': '+fmt(r.lower)+' /100</b><br>Posible por faltantes: '+fmt(r.upper)+' /100<br>Puesto nuestro: '+r.ownRank+'</p><p><b>Necesidad de recuperación temprana: '+precision(r.recovery)+'</b><br>Puesto en la referencia: '+r.recoveryRank+'</p><p>Cobertura: '+r.available+'/17 campos · '+fmt(100*r.coverage)+'% del peso.</p><p class="formula">Par usado: X = '+precision(r.x)+'; Y = '+precision(r.y)+'</p><button type="button" class="secondary" data-geo="'+esc(r.geo)+'" data-source="'+T.RAPIDA+'">Abrir diagnóstico territorial</button>':'<p>Pasa el mouse, enfoca con Tab o toca un municipio para consultar sus valores y cobertura.</p>';
  }
  if(!pairs.length){$('comparison-chart').innerHTML='<p class="empty">No hay municipios con ambos datos en esta selección. Revisa los filtros generales o cambia la versión del índice.</p>';detail(null);}
  else{
    const W=760,H=440,L=77,R=25,U=22,B=65,maxY=Math.max(.01,...pairs.map(r=>r.y))*1.06;
    const sx=x=>L+x/100*(W-L-R),sy=y=>H-B-y/maxY*(H-U-B);
    const xticks=[0,20,40,60,80,100],yticks=Array.from({length:5},(_,i)=>i*maxY/4);
    const line=c.regression,lo=Math.min(...pairs.map(r=>r.x)),hi=Math.max(...pairs.map(r=>r.x));
    const rankTitle='Puntaje de necesidad (escala original)';
    $('comparison-chart').innerHTML='<svg class="chart" viewBox="0 0 '+W+' '+H+'" role="group" aria-label="'+esc(names[mode]+' frente a '+rankTitle)+'"><defs><clipPath id="comparison-clip"><rect x="'+L+'" y="'+U+'" width="'+(W-L-R)+'" height="'+(H-U-B)+'"/></clipPath></defs>'+
      yticks.map(y=>'<line class="gridline" x1="'+L+'" x2="'+(W-R)+'" y1="'+sy(y)+'" y2="'+sy(y)+'"/><text x="'+(L-9)+'" y="'+(sy(y)+4)+'" text-anchor="end">'+precision(y)+'</text>').join('')+
      xticks.map(x=>'<text x="'+sx(x)+'" y="'+(H-B+24)+'" text-anchor="middle">'+x+'</text>').join('')+
      '<line class="axis" x1="'+L+'" x2="'+(W-R)+'" y1="'+(H-B)+'" y2="'+(H-B)+'"/>'+
      (line?'<line clip-path="url(#comparison-clip)" x1="'+sx(lo)+'" x2="'+sx(hi)+'" y1="'+sy(line.intercept+line.slope*lo)+'" y2="'+sy(line.intercept+line.slope*hi)+'" stroke="#b95319" stroke-dasharray="7 5" stroke-width="2"><title>Ajuste lineal con intercepto</title></line>':'')+
      pairs.slice().sort((a,b)=>Number(!!search&&T.searchMatch({...a,lv:'municipal'},search))-Number(!!search&&T.searchMatch({...b,lv:'municipal'},search))).map(r=>{
        const hit=!!search&&T.searchMatch({...r,lv:'municipal'},search);
        return '<circle class="comparison-point '+(hit?'highlight':'')+'" cx="'+sx(r.x)+'" cy="'+sy(r.y)+'" r="'+(hit?7:4.5)+'" data-compare-geo="'+esc(r.geo)+'" tabindex="0" role="button" aria-label="'+esc(r.m+', '+r.d+'. Nuestro índice '+precision(r.x)+'. '+rankTitle+' '+precision(r.y)+'. Ver datos.')+'"><title>'+esc(r.m+', '+r.d)+' · '+precision(r.x)+' /100 · Necesidad de recuperación temprana '+precision(r.recovery)+' · puesto '+r.recoveryRank+'</title></circle>';
      }).join('')+
      '<text x="'+(W/2)+'" y="'+(H-13)+'" text-anchor="middle">'+names[mode]+' · puntaje documentado (0–100)</text><text transform="translate(20 '+(H/2)+') rotate(-90)" text-anchor="middle">'+rankTitle+'</text></svg>';
    $('comparison-chart').querySelectorAll('[data-compare-geo]').forEach(el=>{
      const show=()=>detail(pairs.find(r=>r.geo===el.dataset.compareGeo));
      el.onmouseenter=show;el.onfocus=show;el.onclick=show;
      el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();show();}};
    });
    detail(pairs.find(r=>r.geo===comparisonGeo)||(search?matched[0]:null));
  }
  $('comparison-fit').textContent=c.regression?'Recta discontinua: Y = '+precision(c.regression.intercept)+(c.regression.slope<0?' − ':' + ')+precision(Math.abs(c.regression.slope))+' × X. R² = '+precision(c.regression.r2)+'. No es una fórmula de priorización ni convierte puntajes en probabilidades.':c.reason;
  $('comparison-table').innerHTML=table(['Municipio','Nuestro índice documentado','Posible','Puesto nuestro','Necesidad de recuperación temprana','Puesto de necesidad','Cobertura'],pairs.slice().sort((a,b)=>b.x-a.x).map(r=>'<tr><td>'+geoButton({...r,lv:'municipal'},T.RAPIDA)+'</td><td class="num">'+precision(r.x)+'</td><td class="num">'+precision(r.upper)+'</td><td class="num">'+r.ownRank+'</td><td class="num">'+precision(r.recovery)+'</td><td class="num">'+r.recoveryRank+'</td><td>'+r.available+'/17 · '+fmt(100*r.coverage)+'%</td></tr>'));
}
function refresh() {globalControls();diagnosticControls();renderPriorities();renderDiagnostic();renderMethod();MunicipalRadar.render(priorityModel,state);PerCapitaMunicipalRadar.render(priorityModel,state);RelativeMunicipalRadar.render(priorityModel,state);PrioridadPerCapita.render(state);PrioridadRelativa.render(state);renderRapida();}
document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>activate(b.dataset.tab)));
document.querySelector('.tab-nav').addEventListener('keydown',event=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  const tabs=[...document.querySelectorAll('[data-tab]')],i=tabs.indexOf(document.activeElement);
  if(i<0)return; event.preventDefault();
  const j=event.key==='Home'?0:event.key==='End'?tabs.length-1:(i+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
  tabs[j].focus();activate(tabs[j].dataset.tab);
});
['scope','dept','date'].forEach(id=>$(id).addEventListener('change',()=>{state[id]=$(id).value;priorityLimit=sectorLimit=rapidaLimit=25;refresh();}));
['level','source','dimension','indicator'].forEach(id=>$(id).addEventListener('change',()=>{
  const field={dimension:'dim',indicator:'metric'}[id]||id;state[field]=$(id).value;
  diagnosticControls();sectorLimit=25;renderDiagnostic();
}));
$('order').addEventListener('change',()=>{state.order=$('order').value;renderDiagnostic();});
$('territory').addEventListener('change',()=>{state.geo=$('territory').value;renderProfile();});
$('show-method').addEventListener('click',()=>{activate('metodo');$('priority-method').scrollIntoView({behavior:'smooth'});});
$('matrix-search').addEventListener('input',()=>{renderMatrix();$('matrix').scrollTop=0;});
$('sector-search').addEventListener('input',()=>{sectorLimit=25;renderDiagnostic();});
$('rapida-search').addEventListener('input',()=>{rapidaLimit=25;renderRapida();});
$('rapida-more').addEventListener('click',()=>{rapidaLimit+=50;renderRapida();});
$('comparison-mode').addEventListener('change',renderComparison);
$('comparison-search').addEventListener('input',renderComparison);
document.addEventListener('keydown',event=>{if((event.key==='Enter'||event.key===' ')&&event.target.matches('svg [data-geo]')){event.preventDefault();openProfile(event.target.dataset.geo,event.target.dataset.source);}});
$('sector-more').addEventListener('click',()=>{sectorLimit+=50;renderDiagnostic();});
document.addEventListener('click',event=>{const priority=event.target.closest('[data-priority-geo]');if(priority){renderPriorityDetail(priority.dataset.priorityGeo);return;}const item=event.target.closest('[data-geo]');if(item)openProfile(item.dataset.geo,item.dataset.source);});
$('download').addEventListener('click',()=>{
  const rows=model.sector({...state,search:$('sector-search').value}).items;
  // Quote every cell and neutralize spreadsheet formula injection in labels.
  const quote=v=>'"'+String(typeof v==='string'&&/^[=+@\-\t\r]/.test(v)?"'"+v:v??'').replaceAll('"','""')+'"';
  const header=['puesto','divipola','departamento','municipio','nivel','fuente','indicador_id','indicador','valor','unidad','captura_inventario','fecha_fuente','atribucion'];
  const lines=[header,...rows.map(r=>[r.rank,r.code,r.d,r.m,r.lv,r.f,r.id,r.i,r.v,r.u,r.date,'no acreditada',r.f==='FundacionExe'?(model.decree(state.date).has(r.d)?'no verificada':'no atribuida al sismo'):'consultar fuente'])];
  const blob=new Blob(['\ufeff'+lines.map(row=>row.map(quote).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='seleccion-territorial.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
refresh();

