/* Radar reads the same computed objects as Prioridades: no second score model. */
(function(root){
  'use strict';
  const colors=['#07558a','#b95319','#724c9e'];
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=x=>x==null?'Sin dato':new Intl.NumberFormat('es-CO',{maximumFractionDigits:4}).format(x);
  const label=r=>`${r.m}, ${r.d}`;
  let selected=[], current=[], active=null, initialized=false;
  const point=(i,v)=>[330+190*v/100*Math.cos(-Math.PI/2+i*Math.PI/3),270+190*v/100*Math.sin(-Math.PI/2+i*Math.PI/3)];
  const polygon=values=>values.map((v,i)=>point(i,v).join(',')).join(' ');
  function inspect(index,axis){
    const r=current[index]; if(!r)return;
    active=[r.geo,axis];
    const s=r.sectors[axis],loFactor=(1+.25*(r.vulnerability??0)/100)/1.25,hiFactor=(1+.25*(r.vulnerability??100)/100)/1.25;
    document.getElementById('radar-inspector').innerHTML=`<h3 style="color:${colors[index]}">${esc(label(r))}</h3><h4>${esc(s.name)}: ${fmt(s.lower)}–${fmt(s.upper)} / 100</h4><p>Referencia: misma fuente, indicador, unidad y captura. N incluye ceros explícitos; excluye vacíos y conflictos.</p>${s.fields.map(f=>`<div class="radar-input"><strong>${esc(f.label)}</strong><div class="small muted">${esc(f.source)} · ${esc(f.unit)} · N = ${f.n}</div>${f.row?`<div>Valor = ${fmt(f.row.v)}; máximo = ${fmt(f.anchor)}</div><div class="formula">z = ${f.row.v===0?'0 (cero explícito)':`100 × ${fmt(f.row.v)} / ${fmt(f.anchor)}`} = ${fmt(f.score)}<br>Peso interno = ${fmt(f.share)}<br>Aporte al sector = ${fmt(f.score)} × ${fmt(f.share)} = ${fmt(f.score*f.share)}</div>`:`<p><strong>Sin dato, no cero.</strong> Máximo de referencia = ${fmt(f.anchor)}. Peso interno = ${fmt(f.share)}. Aporte desconocido al sector: 0–${fmt(100*f.share)}.</p>`}</div>`).join('')}<p class="formula">Sector inferior = ${s.fields.map(f=>f.score==null?'0 [límite, no dato]':fmt(f.score*f.share)).join(' + ')} = ${fmt(s.lower)}<br>Sector superior = ${fmt(s.lower)} + ${fmt(s.upper-s.lower)} por faltantes = ${fmt(s.upper)}</p><h4>Cómo entra al índice global</h4><p>D = (${r.sectors.map(x=>fmt(x.lower)).join(' + ')}) / 6 = ${fmt(r.damageLower)} (límite inferior).</p><p>IPM censal DANE 2018 = ${r.vulnerability==null?'Sin dato: intervalo 0–100':fmt(r.vulnerability)+'%'}.</p><p class="formula">P = D × (1 + 0,25 × IPM/100) / 1,25<br>P inferior = ${fmt(r.damageLower)} × ${fmt(loFactor)} = ${fmt(r.lower)}<br>P superior = ${fmt(r.damageUpper)} × ${fmt(hiFactor)} = ${fmt(r.upper)}</p><p>Aporte de este sector a P: ${fmt(s.lower/6*loFactor)}–${fmt(s.upper/6*hiFactor)} puntos (peso sectorial 1/6). Los resultados se calculan con precisión completa; aquí se redondean.</p>`;
  }
  function render(model,state){
    const host=document.getElementById('radar-pickers');if(!host)return;
    const p=model.compute(state), places=p.all.filter(r=>!state.dept||r.d===state.dept).slice().sort((a,b)=>label(a).localeCompare(label(b),'es'));
    if(!initialized){selected=p.items.slice(0,2).map(r=>r.geo);initialized=true;}
    selected=[0,1,2].map(i=>places.some(r=>r.geo===selected[i])?selected[i]:'');
    host.innerHTML=[0,1,2].map(i=>`<div><label for="radar-search-${i}">Municipio ${i+1}</label><input type="search" id="radar-search-${i}" placeholder="Escribe y elige un resultado" aria-label="Buscar municipio ${i+1}" aria-controls="radar-results-${i}"><div id="radar-results-${i}" class="radar-results" hidden></div><p id="radar-count-${i}" class="small muted" role="status"></p><select id="radar-select-${i}" aria-label="Municipio ${i+1}"><option value="">Sin seleccionar</option>${places.map(r=>`<option value="${esc(r.geo)}" ${selected[i]===r.geo?'selected':''}>${esc(label(r))}</option>`).join('')}</select></div>`).join('');
    [0,1,2].forEach(i=>{
      const select=document.getElementById(`radar-select-${i}`);
      const input=document.getElementById(`radar-search-${i}`),results=document.getElementById(`radar-results-${i}`),count=document.getElementById(`radar-count-${i}`);
      const choose=geo=>{selected[i]=geo;selected=selected.map((g,j)=>j!==i&&g===geo?'':g);render(model,state);document.getElementById(`radar-select-${i}`).focus();};
      const fold=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
      input.oninput=()=>{
        const q=fold(input.value);results.hidden=!q;
        const matches=q?places.filter(r=>fold(label(r)).includes(q)):[];
        count.textContent=q?`${matches.length} coincidencias en el ámbito y departamento seleccionados. Elige un resultado.`:'';
        results.innerHTML=matches.map(r=>`<button type="button" data-radar-choice="${esc(r.geo)}">${esc(label(r))}</button>`).join('')||(q?'<p>Sin coincidencias. Revisa los filtros de universo y departamento.</p>':'');
        results.querySelectorAll('button').forEach(b=>b.onclick=()=>choose(b.dataset.radarChoice));
      };
      input.onkeydown=e=>{if(e.key==='ArrowDown'||e.key==='Enter'){const first=results.querySelector('button');if(first){e.preventDefault();first.focus();}}if(e.key==='Escape'){results.hidden=true;}};
      select.onchange=()=>choose(select.value);
    });
    current=selected.map(g=>places.find(r=>r.geo===g)).filter(Boolean);
    document.getElementById('radar-reference').textContent=`Modelo 1.1 · Captura ${state.date} · Referencia: ${state.scope==='decree'?'departamentos del decreto':'todos los departamentos del inventario'}, ${p.referenceN} municipios; cada variable usa solo los que tienen dato comparable. Buscar o seleccionar municipios no recalcula la referencia; cambiar universo o captura sí.`;
    let svg='<svg viewBox="0 0 660 540" aria-label="Radar de seis sectores, escala de cero a cien" role="group">';
    [20,40,60,80,100].forEach(v=>{svg+=`<polygon points="${polygon(Array(6).fill(v))}" fill="none" stroke="#d5dfe8"/><text x="338" y="${270-190*v/100+4}" class="radar-scale">${v}</text>`;});
    const names=['Hogares','Vivienda','Salud','Educación','Infraestructura','Comunidad'];
    names.forEach((name,i)=>{const [x,y]=point(i,100),[tx,ty]=point(i,119);svg+=`<line x1="330" y1="270" x2="${x}" y2="${y}" stroke="#d5dfe8"/><text x="${tx}" y="${ty+5}" text-anchor="middle">${name}</text>`;});
    current.forEach((r,k)=>{svg+=`<polygon points="${polygon(r.sectors.map(s=>s.upper))}" fill="none" stroke="${colors[k]}" stroke-width="2" stroke-dasharray="6 5"/><polygon points="${polygon(r.sectors.map(s=>s.lower))}" fill="${colors[k]}" fill-opacity=".07" stroke="${colors[k]}" stroke-width="2.5"/>`;});
    current.forEach((r,k)=>r.sectors.forEach((s,i)=>{
      const values=s.upper-s.lower>1e-8?[s.lower,s.upper]:[s.lower];
      values.forEach((v,j)=>{const [x,y]=point(i,v);svg+=`<circle class="radar-point" cx="${x}" cy="${y}" r="6" fill="${j?'white':colors[k]}" stroke="${colors[k]}" stroke-width="2" tabindex="0" role="button" data-radar-m="${k}" data-radar-axis="${i}" aria-label="${esc(label(r))}, ${esc(s.name)}, ${fmt(s.lower)} a ${fmt(s.upper)}. Ver cálculo"><title>${esc(label(r))} · ${esc(s.name)}: ${fmt(s.lower)}–${fmt(s.upper)}. Consultar cálculo.</title></circle>`;});
    }));
    document.getElementById('radar-chart').innerHTML=current.length?svg+'</svg>':'<p class="empty">Selecciona un municipio para comenzar.</p>';
    document.getElementById('radar-legend').innerHTML=current.map((r,k)=>`<p style="color:${colors[k]}"><strong>${esc(label(r))}</strong> · P: ${fmt(r.lower)}–${fmt(r.upper)} · ${r.available}/14 campos${!r.coverage?' · Sin puntaje documentado':''}</p>`).join('');
    document.getElementById('radar-sectors').innerHTML=current.map((r,k)=>`<div><strong style="color:${colors[k]}">${esc(label(r))}</strong><div>${r.sectors.map((s,i)=>`<button type="button" class="secondary" data-radar-m="${k}" data-radar-axis="${i}">${esc(s.name)}: ${fmt(s.lower)}–${fmt(s.upper)}</button>`).join('')}</div></div>`).join('');
    document.querySelectorAll('[data-radar-m]').forEach(el=>{const show=()=>inspect(Number(el.dataset.radarM),Number(el.dataset.radarAxis));el.onmouseenter=show;el.onfocus=show;el.onclick=show;el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();show();}};});
    const old=current.findIndex(r=>r.geo===active?.[0]);
    if(current.length)inspect(old<0?0:old,active?.[1]??0);else document.getElementById('radar-inspector').textContent='Sin municipios seleccionados.';
  }
  root.MunicipalRadar={render};
})(globalThis);
