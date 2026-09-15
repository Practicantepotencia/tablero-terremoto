'use strict';
const ValidationML=(()=>{
 const targets={
 consulta_externa:{label:'Consulta externa',unit:'consultorios externos',short:'consultorios',color:'#2267c9'},
 urgencias:{label:'Urgencias',unit:'consultorios de urgencias',short:'consultorios',color:'#087f8c'},
 hospitalizacion:{label:'Hospitalización',unit:'camas generales',short:'camas',color:'#7851aa'}
 };
 const columns=['denominador','codigo','municipio','departamento','poblacion_2026','grupo_validacion','modelo','observado_2022','predicho_sin_ver_departamento','error_predicho_menos_observado'];
 function csvParse(text){
  const lines=[];let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){
   const c=text[i];
   if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++}else quoted=!quoted}
   else if(c===','&&!quoted){row.push(cell);cell=''}
   else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v!==''))lines.push(row);row=[];cell=''}
   else cell+=c;
  }
  if(quoted)throw Error('CSV con comillas sin cerrar');
  if(cell||row.length){row.push(cell);lines.push(row)}
  return lines;
 }
 function fromCSV(text){
  const table=csvParse(text.replace(/^\uFEFF/,'')),header=table.shift();
  if(JSON.stringify(header)!==JSON.stringify(columns))throw Error('El esquema del CSV cambió');
  const keys=new Set();
  return table.map((a,i)=>{
   if(a.length!==columns.length)throw Error('Fila incompleta '+(i+2));
   const r={target:a[0],code:a[1],m:a[2],d:a[3],population:Number(a[4]),fold:Number(a[5]),model:a[6],observed:Number(a[7]),predicted:Number(a[8]),error:Number(a[9])};
   if(!targets[r.target]||!/^\d{5}$/.test(r.code)||![r.population,r.fold,r.observed,r.predicted,r.error].every(Number.isFinite)||r.population<=0||r.observed<=0||r.predicted<1||r.fold<1||r.fold>5)throw Error('Datos inválidos en fila '+(i+2));
   if(Math.abs(r.predicted-r.observed-r.error)>1e-7)throw Error('Error de validación inconsistente '+r.code);
   const key=r.target+':'+r.code;if(keys.has(key))throw Error('Observación duplicada '+key);keys.add(key);
   return r;
  });
 }
 const norm=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 const matches=(r,q)=>!q||norm(r.m+' '+r.d+' '+r.code).includes(norm(q));
 const filter=(rows,state)=>rows.filter(r=>r.target===state.target&&(state.population==='all'||(state.population==='small'?r.population<50000:r.population>=50000))&&(state.department==='all'||r.d===state.department));
 const median=a=>{if(!a.length)return null;const s=[...a].sort((x,y)=>x-y),i=Math.floor(s.length/2);return s.length%2?s[i]:(s[i-1]+s[i])/2};
 function metrics(rows){
  if(!rows.length)return {n:0,mae:null,r2:null,mdape:null,rmse:null,bias:null,floor:0};
  const n=rows.length,avg=rows.reduce((s,r)=>s+r.observed,0)/n,ae=rows.map(r=>Math.abs(r.predicted-r.observed)),sq=ae.reduce((s,v)=>s+v*v,0),ss=rows.reduce((s,r)=>s+(r.observed-avg)**2,0);
  return {n,mae:ae.reduce((s,v)=>s+v,0)/n,r2:ss>0?1-sq/ss:null,mdape:median(rows.map(r=>Math.abs(r.predicted/r.observed-1)*100)),rmse:Math.sqrt(sq/n),bias:rows.reduce((s,r)=>s+r.error,0)/n,floor:rows.filter(r=>r.predicted===1).length};
 }
 function distribution(rows){
  const bins=[
   {label:'Menos de −75%',side:'under',test:x=>x< -75},
   {label:'−75% a −50%',side:'under',test:x=>x< -50},
   {label:'−50% a −25%',side:'under',test:x=>x< -25},
   {label:'−25% a <0%',side:'under',test:x=>x< -1e-9},
   {label:'Exacto',side:'exact',test:x=>Math.abs(x)<=1e-9},
   {label:'>0% a 25%',side:'over',test:x=>x<=25},
   {label:'>25% a 50%',side:'over',test:x=>x<=50},
   {label:'>50% a 100%',side:'over',test:x=>x<=100},
   {label:'Más de 100%',side:'over',test:x=>true}
  ].map(b=>({...b,n:0}));
  for(const r of rows)bins.find(b=>b.test((r.predicted/r.observed-1)*100)).n++;
  return bins.map(({test,...b})=>b);
 }
 function sizeGroups(rows){
  const groups=[{label:'<5 mil',min:0,max:5000},{label:'5–10 mil',min:5000,max:10000},{label:'10–20 mil',min:10000,max:20000},{label:'20–50 mil',min:20000,max:50000},{label:'50–100 mil',min:50000,max:100000},{label:'≥100 mil',min:100000,max:Infinity}];
  return groups.map(g=>{const data=rows.filter(r=>r.population>=g.min&&r.population<g.max);return {...g,...metrics(data)}});
 }
 function sorted(rows,key='abs_error',direction=-1){
  const val=r=>key==='name'?r.m:key==='abs_error'?Math.abs(r.error):key==='percent'?r.error/r.observed*100:r[key];
  return [...rows].sort((a,b)=>{const x=val(a),y=val(b),cmp=typeof x==='string'?x.localeCompare(y,'es'):x-y;return direction*cmp||a.code.localeCompare(b.code)});
 }
 const pack=rows=>rows.map(r=>[r.target,r.code,r.m,r.d,r.population,r.fold,r.model,r.observed,r.predicted,r.error]);
 const unpack=rows=>rows.map(a=>({target:a[0],code:a[1],m:a[2],d:a[3],population:a[4],fold:a[5],model:a[6],observed:a[7],predicted:a[8],error:a[9]}));
 return {targets,columns,csvParse,fromCSV,norm,matches,filter,median,metrics,distribution,sizeGroups,sorted,pack,unpack};
})();
if(typeof module!=='undefined')module.exports=ValidationML;
