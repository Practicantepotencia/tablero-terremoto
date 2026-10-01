/* A dated MEN delivery; infrastructure condition and reported service stay separate. */
(function(root){
  'use strict';
  const ID='men_matricula_critica',SOURCE='MEN',SCOPE='five';
  const metrics=[
    [ID,'critical_enrollment','Matrícula en sedes críticas','Matrículas'],
    ['men_sedes_reportadas','reported_sites','Sedes reportadas al MEN','Sedes'],
    ['men_sedes_criticas','critical_sites','Sedes con condición crítica','Sedes'],
    ['men_matricula_reportada','enrollment','Matrícula de sedes reportadas','Matrículas'],
    ['men_sedes_sin_servicio','service_no_sites','Sedes que reportan no prestar servicio','Sedes'],
    ['men_matricula_sin_servicio','service_no_enrollment','Matrícula en sedes que reportan no prestar servicio','Matrículas'],
    ['men_servicio_desconocido','service_unknown_sites','Sedes con servicio por confirmar','Sedes']
  ];
  const field={id:ID,source:SOURCE,label:metrics[0][2],share:.5,unit:'Matrículas'};
  function create(data){
    const p=data.education||{},date=/^\d{4}-\d{2}-\d{2}$/;
    const enabled=p.enabled===true&&date.test(p.effective_from||'')&&date.test(p.report_date||'')&&p.effective_from>=p.report_date&&p.critical_share===.5;
    const groups=new Map();
    for(const r of p.municipalities||[]){if(!groups.has(r.code))groups.set(r.code,[]);groups.get(r.code).push(r);}
    const municipalities=new Map([...groups].filter(([,rs])=>rs.length===1).map(([code,rs])=>[code,rs[0]]));
    const active=capture=>enabled&&date.test(capture||'')&&capture>=p.effective_from;
    function observations(captures){
      if(!enabled)return [];
      return captures.filter(active).flatMap(capture=>[...municipalities.values()].flatMap(r=>{
        if(!Number.isInteger(r.reported_sites)||r.reported_sites<=0)return [];
        return metrics.flatMap(([id,key,label,unit])=>{
          const v=r[key];
          if(!Number.isInteger(v)||v<0)return [];
          if(id===ID&&(r.unclassified_sites>0||r.missing_critical_enrollment>0))return [];
          return [{geo:'municipal:'+r.code,code:r.code,lv:'municipal',d:r.d,m:r.m,f:SOURCE,id,i:label,dim:'Educación',u:unit,v,
            date:capture,source_date:p.report_date,observed_at:null,source_version:p.version,valid_from:p.effective_from,
            join:'DIVIPOLA',attribution:'Estado reportado; causalidad por sede no verificada'}];
        });
      }));
    }
    return {enabled,active,observations,municipalities,roster:p.roster||[],payload:p};
  }
  const api={create,ID,SOURCE,SCOPE,field,metrics};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Educacion=api;
})(typeof globalThis!=='undefined'?globalThis:this);
