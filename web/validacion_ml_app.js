
(()=>{
 const $=id=>document.getElementById(id),V=ValidationML,DATA=JSON.parse($('validation-data').textContent),rows=V.unpack(DATA.rows);
 const state={target:'urgencias',population:'all',department:'all',scale:'log',query:'',selected:null,page:0,sort:'abs_error',direction:-1};
 const fmt=(x,n=2)=>x===null||!Number.isFinite(x)?'—':new Intl.NumberFormat('es-CO',{maximumFractionDigits:n}).format(x);
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const active=()=>V.filter(rows,state);
 const text=(x,y,s,extra='')=>'<text x="'+x+'" y="'+y+'" '+extra+'>'+esc(s)+'</text>';
 const line=(x1,y1,x2,y2,extra='')=>'<line x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'" '+extra+'/>';
 const signed=(x,n=2)=>(x>0?'+':'')+fmt(x,n);
 function ticks(max,height){
  if(state.scale==='linear'){
   const raw=max/5,p=10**Math.floor(Math.log10(raw||1)),step=[1,2,5,10].map(n=>n*p).find(n=>n>=raw)||p*10;
   const a=[0];for(let v=step;v<=max;v+=step)a.push(v);return a;
  }
  const out=[0];for(let p=1;p<=max*10;p*=10)for(const m of [1,2,5]){const v=p*m;if(v<=max&&height*(Math.log1p(v)-Math.log1p(out.at(-1)))/Math.log1p(max)>35)out.push(v)}
  return out;
 }
 function scatter(data){
  if(!data.length)return text(380,250,'Sin observaciones para estos filtros','text-anchor="middle"');
  const w=760,h=510,L=76,R=26,T=24,B=70,pw=w-L-R,ph=h-T-B,max=Math.max(...data.map(r=>Math.max(r.observed,r.predicted)))*1.07;
  const trans=x=>state.scale==='log'?Math.log1p(x):x,den=trans(max),sx=x=>L+pw*trans(x)/den,sy=x=>h-B-ph*trans(x)/den;
  let s='<defs><clipPath id="plot-clip"><rect x="'+L+'" y="'+T+'" width="'+pw+'" height="'+ph+'"/></clipPath></defs>';
  for(const t of ticks(max,ph)){
   s+=line(sx(t),T,sx(t),h-B,'class="grid"')+line(L,sy(t),w-R,sy(t),'class="grid"');
   s+=text(sx(t),h-B+25,fmt(t,0),'text-anchor="middle" class="tick"')+text(L-12,sy(t)+4,fmt(t,0),'text-anchor="end" class="tick"');
  }
  s+=line(L,h-B,w-R,T,'class="ideal"')+text(w-R-8,T+18,'Predicción exacta','text-anchor="end" class="ideal-label"');
  const searched=!!state.query,selected=data.some(r=>r.code===state.selected)?state.selected:null;
  const ordered=data.slice().sort((a,b)=>Number(a.code===selected||searched&&V.matches(a,state.query))-Number(b.code===selected||searched&&V.matches(b,state.query)));
  s+='<g clip-path="url(#plot-clip)">';
  for(const r of ordered){
   const hit=r.code===selected||searched&&V.matches(r,state.query),muted=(searched||selected)&&!hit;
   s+='<circle data-code="'+r.code+'" cx="'+sx(r.observed).toFixed(3)+'" cy="'+sy(r.predicted).toFixed(3)+'" r="'+(hit?6:3.5)+'" class="point'+(hit?' highlighted':'')+'" fill="'+(hit?'#d76921':V.targets[state.target].color)+'" opacity="'+(muted?.09:hit?1:.48)+'"><title>'+esc(r.m+' · observado '+fmt(r.observed)+' · predicho '+fmt(r.predicted))+'</title></circle>';
  }
  s+='</g>'+text(L+pw/2,h-15,'Observado · '+V.targets[state.target].unit,'text-anchor="middle" class="axis-label"');
  s+='<text transform="translate(18 '+(T+ph/2)+') rotate(-90)" text-anchor="middle" class="axis-label">Predicho</text>';
  return s;
 }
 function histogram(data){
  const bins=V.distribution(data),max=Math.max(1,...bins.map(b=>b.n)),w=510,L=136,T=16,row=32,pw=300;
  let s='';
  bins.forEach((b,i)=>{
   const y=T+i*row,color=b.side==='under'?'#3676b5':b.side==='over'?'#d67943':'#19816b';
   s+=text(L-12,y+17,b.label,'text-anchor="end" class="tick"');
   s+='<rect x="'+L+'" y="'+y+'" width="'+(pw*b.n/max)+'" height="24" rx="4" fill="'+color+'" opacity=".88"><title>'+esc(b.label+': '+b.n+' municipios')+'</title></rect>';
   s+=text(L+pw*b.n/max+7,y+17,fmt(b.n,0),'class="bar-number"');
  });
  return s;
 }
 function populations(data){
  const groups=V.sizeGroups(data),max=Math.max(1,...groups.map(g=>g.mae??0)),L=94,T=18,step=43,pw=270;
  let s='';
  groups.forEach((g,i)=>{
   const y=T+i*step;
   s+=text(L-10,y+17,g.label,'text-anchor="end" class="tick"');
   s+='<rect x="'+L+'" y="'+y+'" width="'+(pw*(g.mae??0)/max)+'" height="24" rx="4" fill="'+V.targets[state.target].color+'" opacity=".85"/>';
   s+=text(L+pw*(g.mae??0)/max+7,y+16,g.n?fmt(g.mae):'—','class="bar-number"');
   s+=text(494,y+16,'n='+fmt(g.n,0),'text-anchor="end" class="tick"');
  });
  s+=text(94,297,'Error absoluto medio · '+V.targets[state.target].unit,'class="tick"');
  return s;
 }
 function detail(r){
  if(!r){$('selection').hidden=true;return}
  $('selection').hidden=false;
  $('selection').innerHTML='<div><span class="eyebrow">MUNICIPIO SELECCIONADO</span><h3>'+esc(r.m)+', '+esc(r.d)+'</h3><p>'+fmt(r.population,0)+' habitantes · DIVIPOLA '+r.code+' · grupo de validación '+r.fold+'</p></div><dl><div><dt>Observado</dt><dd>'+fmt(r.observed)+'</dd></div><div><dt>Predicho</dt><dd>'+fmt(r.predicted)+'</dd></div><div><dt>Diferencia</dt><dd>'+signed(r.error)+'</dd></div><div><dt>Error relativo</dt><dd>'+signed(r.error/r.observed*100,1)+'%</dd></div></dl><p class="selection-note">'+(r.predicted===1?'La predicción está en el piso de 1 del ensayo de capacidades positivas. ':'')+'Su departamento quedó fuera del entrenamiento de esta predicción.</p>';
 }
 function renderTable(data){
  const searched=data.filter(r=>V.matches(r,state.query)),sorted=V.sorted(searched,state.sort,state.direction),pages=Math.max(1,Math.ceil(sorted.length/30));
  state.page=Math.min(state.page,pages-1);
  const page=sorted.slice(state.page*30,state.page*30+30);
  $('table-body').innerHTML=page.length?page.map(r=>'<tr'+(r.code===state.selected?' class="selected-row"':'')+'><td><button class="municipality" data-select="'+r.code+'">'+esc(r.m)+'</button><small>'+esc(r.d)+' · '+r.code+'</small></td><td>'+fmt(r.observed)+'</td><td>'+fmt(r.predicted)+'</td><td>'+fmt(Math.abs(r.error))+'</td><td class="'+(r.error<0?'under-text':'over-text')+'">'+signed(r.error/r.observed*100,1)+'%</td><td>'+fmt(r.population,0)+'</td></tr>').join(''):'<tr><td colspan="6" class="empty">No hay municipios que coincidan.</td></tr>';
  $('pagination-label').textContent=sorted.length?((state.page*30+1)+'–'+Math.min(sorted.length,(state.page+1)*30)+' de '+fmt(sorted.length,0)):'0 resultados';
  $('previous').disabled=state.page===0;$('next').disabled=state.page>=pages-1;
  document.querySelectorAll('[data-sort]').forEach(b=>{const yes=b.dataset.sort===state.sort;b.querySelector('span').textContent=yes?(state.direction===-1?' ↓':' ↑'):' ↕';b.closest('th').setAttribute('aria-sort',yes?(state.direction===-1?'descending':'ascending'):'none')});
  return searched.length;
 }
 function render(){  $('tooltip').hidden=true;
  const data=active(),m=V.metrics(data),target=V.targets[state.target];
  document.documentElement.style.setProperty('--accent',target.color);
  document.querySelectorAll('[data-target]').forEach(b=>{const yes=b.dataset.target===state.target;b.setAttribute('aria-pressed',String(yes));b.classList.toggle('active',yes)});
  $('n').textContent=fmt(m.n,0);$('mae').textContent=fmt(m.mae);$('r2').textContent=fmt(m.r2,3);$('mdape').textContent=m.mdape===null?'—':fmt(m.mdape,1)+'%';$('mae-unit').textContent=target.unit;
  $('chart').innerHTML=scatter(data);$('histogram').innerHTML=histogram(data);$('by-size').innerHTML=populations(data);
  const count=renderTable(data);
  $('scope-line').textContent=fmt(m.n,0)+' municipios · '+(state.department==='all'?'Todos los departamentos':state.department)+' · '+(state.population==='all'?'Todas las poblaciones':state.population==='small'?'Menos de 50.000 habitantes':'50.000 habitantes o más');
  $('search-line').textContent=state.query?count+' coincidencias resaltadas. La búsqueda no cambia las métricas.':'Pulsa un punto o un municipio para ver sus valores.';
  const models=[...new Set(data.map(r=>r.model))];
  $('model-label').textContent=models.length===1?(models[0].startsWith('poisson')?'Poisson regularizado':'Gradient boosting'):'Modelo seleccionado por grupo';
  $('scale-note').textContent=state.scale==='log'?'Escala log(1 + valor): permite ver municipios pequeños y grandes. No modifica datos ni métricas.':'Escala lineal. Los municipios con capacidad pequeña pueden concentrarse cerca del origen.';
  $('floor-info').textContent=fmt(m.floor,0)+' predicciones de esta vista están exactamente en el piso de 1.';
  detail(data.find(r=>r.code===state.selected));
 }
 function select(code){
  state.selected=code;
  const data=active().filter(r=>V.matches(r,state.query)),ordered=V.sorted(data,state.sort,state.direction),i=ordered.findIndex(r=>r.code===code);
  if(i>=0)state.page=Math.floor(i/30);
  render();
 }
 $('target-controls').addEventListener('click',e=>{const b=e.target.closest('[data-target]');if(!b)return;state.target=b.dataset.target;state.page=0;render()});
 $('population').addEventListener('change',e=>{state.population=e.target.value;state.page=0;render()});
 $('department').innerHTML='<option value="all">Todos los departamentos</option>'+[...new Set(rows.map(r=>r.d))].sort((a,b)=>a.localeCompare(b,'es')).map(d=>'<option value="'+esc(d)+'">'+esc(d)+'</option>').join('');
 $('department').addEventListener('change',e=>{state.department=e.target.value;state.page=0;render()});
 $('scale').addEventListener('change',e=>{state.scale=e.target.value;render()});
 $('search').addEventListener('input',e=>{state.query=e.target.value;state.selected=null;state.page=0;render()});
 $('clear-search').addEventListener('click',()=>{state.query='';state.selected=null;$('search').value='';state.page=0;render()});
 $('previous').addEventListener('click',()=>{state.page--;renderTable(active())});$('next').addEventListener('click',()=>{state.page++;renderTable(active())});
 $('table').addEventListener('click',e=>{
  const b=e.target.closest('[data-select]');if(b){select(b.dataset.select);return}
  const sort=e.target.closest('[data-sort]');if(sort){if(state.sort===sort.dataset.sort){if(state.direction===-1)state.direction=1;else{state.sort='abs_error';state.direction=-1}}else{state.sort=sort.dataset.sort;state.direction=-1}state.page=0;renderTable(active())}
 });
 $('chart').addEventListener('click',e=>{const c=e.target.closest('[data-code]');if(c)select(c.dataset.code)});
 $('chart').addEventListener('pointermove',e=>{
  const c=e.target.closest('[data-code]');if(!c){$('tooltip').hidden=true;return}
  const r=active().find(r=>r.code===c.dataset.code);if(!r)return;
  const overlap=active().filter(v=>v.observed===r.observed&&Math.abs(v.predicted-r.predicted)<1e-9).length;
  $('tooltip').innerHTML='<strong>'+esc(r.m)+', '+esc(r.d)+'</strong><dl><div><dt>Observado</dt><dd>'+fmt(r.observed)+'</dd></div><div><dt>Predicho</dt><dd>'+fmt(r.predicted)+'</dd></div><div><dt>Error</dt><dd>'+signed(r.error)+' · '+signed(r.error/r.observed*100,1)+'%</dd></div></dl>'+(overlap>1?'<small>'+overlap+' municipios comparten estos valores; usa la búsqueda para distinguirlos.</small>':'')+(r.predicted===1?'<small>Predicción en el piso de 1.</small>':'');
  $('tooltip').hidden=false;
  $('tooltip').style.left=Math.max(8,Math.min(e.clientX+14,window.innerWidth-$('tooltip').offsetWidth-10))+'px';
  $('tooltip').style.top=Math.max(8,Math.min(e.clientY+14,window.innerHeight-$('tooltip').offsetHeight-10))+'px';
 });
 $('chart').addEventListener('pointerleave',()=>{$('tooltip').hidden=true});
 $('source-link').href=DATA.source_url;
 render();
})();
