/* Experimental demand/registered-capacity ratios. No imputation or occupancy claim. */
(function(root){
'use strict';
const ID='salud_presion_heridos';
const SOURCE='3iS-Sheets';
function create(data){
  const config=data.healthPressure;
  const enabled=config?.enabled===true&&['urgencias','hospitalizacion'].includes(config.mode);
  const field={id:ID,source:SOURCE,label:'Heridos frente a '+(config?.mode==='urgencias'?'consultorios de urgencias':'camas generales'),share:1,unit:'Número'};
  const groups=new Map();
  for(const r of config?.capacity?.rows||[]){if(!groups.has(r.code))groups.set(r.code,[]);groups.get(r.code).push(r);}
  function rows(base){
    if(!enabled)return [];
    return base.filter(r=>r.f===SOURCE&&r.id==='3is_heridos').map(r=>({...r,id:ID,i:field.label,dim:'Salud',original_id:r.id}));
  }
  function measure(row,id,code,date){
    const source=config?.capacity?.source;
    const base={rate:null,denominator:null,denominatorSource:source||null,multiplier:1,relativeKind:config?.capacity?.kind||'',
      relativeUnit:config?.mode==='urgencias'?'heridos / consultorio de urgencias':'heridos / cama general',
      denominatorLabel:config?.capacity?.label||'Capacidad REPS histórica',reason:'',pressureProxy:true};
    if(!enabled||id!==ID)return {...base,reason:'Escenario de presión no habilitado'};
    if(!/^\d{5}$/.test(code||''))return {...base,reason:'Sin código municipal verificable'};
    const rs=groups.get(code)||[];
    if(rs.length!==1)return {...base,reason:rs.length?'Capacidad municipal ambigua':'Sin capacidad registrada: no se supone cero ni se imputa'};
    const d=rs[0];
    if(d.status!=='observed_historical'||!Number.isInteger(d.value)||d.value<=0||d.kind!==config.capacity.kind||
      d.unit!==config.capacity.unit||d.year!==2022||d.reference_date!=='2022-11-05'||
      !source?.url||!/^[a-f0-9]{64}$/.test(source.sha256||'')||d.reference_date>config.event_date||
      !/^\d{4}-\d{2}-\d{2}$/.test(date||'')||date<config.event_date||d.reference_date>date)
      return {...base,reason:'Capacidad sin corte, unidad, valor positivo o trazabilidad válidos'};
    const valid={...base,denominator:d};
    if(!row||row.id!==ID||row.original_id!=='3is_heridos'||row.f!==SOURCE||row.u!=='Número'||
      row.code!==code||row.date!==date||!Number.isFinite(row.v)||row.v<0)
      return {...valid,reason:'Sin reporte de heridos comparable en esta captura'};
    return {...valid,rate:row.v/d.value,proxyNote:'Carga potencial frente a capacidad registrada en 2022; no ocupación observada ni demanda simultánea.'};
  }
  return {enabled,field,rows,measure};
}
const api={create,ID,SOURCE};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PresionSalud=api;
})(typeof globalThis!=='undefined'?globalThis:this);
