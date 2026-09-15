'use strict';
// Reproduce only this branch's Health denominators from the immutable original CSV.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');

function parseCSV(text){
 const records=[];let row=[],value='',quoted=false;text=text.replace(/^\uFEFF/,'');
 for(let i=0;i<text.length;i++){const c=text[i];
 if(quoted){if(c==='"'&&text[i+1]==='"'){value+='"';i++;}else if(c==='"')quoted=false;else value+=c;}
 else if(c==='"')quoted=true;else if(c===','){row.push(value);value='';}
 else if(c==='\n'){row.push(value.replace(/\r$/,''));records.push(row);row=[];value='';}else value+=c;
 }
 if(quoted)throw Error('CSV sin cierre de comillas');if(value||row.length){row.push(value.replace(/\r$/,''));records.push(row);}
 const fields=records.shift();
 return records.filter(r=>r.some(x=>x!=='')).map((r,i)=>{if(r.length!==fields.length)throw Error('Ancho CSV inválido: registro '+(i+2));return Object.fromEntries(fields.map((f,j)=>[f,r[j]]));});
}

function aggregateReps(raw,population,config){
 const fold=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\(ANM\)/g,'').replace(/[^A-Z0-9]/g,'');
 const populations=new Map(population.map(p=>[p.code,p]));
 const depAliases={'08001':'BARRANQUILLA','76001':'CALI','76109':'BUENAVENTURA','13001':'CARTAGENA','47001':'SANTAMARTA','88564':'SANANDRESYPROVIDENCIA','88001':'SANANDRESYPROVIDENCIA'};
 const nameAliases={'11001':'BOGOTA','05647':'SANANDRES','05664':'SANPEDRO','52835':'TUMACO','15332':'GUICAN','13001':'CARTAGENA','19418':'LOPEZ','19548':'PIENDAMO','19760':'SOTARA','20443':'MANAURE','23586':'PURISIMA','47161':'CERROSANANTONIO','52224':'CUASPUD','54001':'CUCUTA','86573':'LEGUIZAMO','70742':'SINCE'};
 const dedup=new Map(),rejected=[],invalidCodes=new Set(),aliases=[];
 raw.forEach((r,i)=>{
 const group=r['nom grupo capacidad '],description=r['nom descripcion capacidad '];
 if(group!==config.group||!config.descriptions.includes(description))return;
 const rawCode=r['Código sede']||'',siteCode=rawCode.padStart(10,'0'),code=siteCode.slice(0,5),p=populations.get(code),branch=String(r['Número sede']||'');
 const dep=fold(r.Departamento),name=fold(r.Municipio);
 const geoOk=p&&(fold(p.d)===dep||depAliases[code]===dep)&&(fold(p.m)===name||nameAliases[code]===name);
 const quantity=String(r['num cantidad capacidad instalada']||'');
 const valid=/^\d{9,10}$/.test(rawCode)&&/^\d{1,2}$/.test(branch)&&geoOk&&/^\d+$/.test(quantity)&&r['Fecha Corte']==='Fecha corte REPS: Nov  5 2022  1:37PM';
 if(!valid){invalidCodes.add(code);rejected.push({record:i+2,code,reason:!geoOk?'geography':'schema_value_or_date'});return;}
 const site=siteCode+':'+branch.padStart(2,'0'),key=site+'|'+group+'|'+description;
 if(fold(p.d)!==dep||fold(p.m)!==name)aliases.push({code,raw_department:r.Departamento,raw_municipality:r.Municipio,department:p.d,municipality:p.m});
 if(!dedup.has(key))dedup.set(key,[]);
 dedup.get(key).push({record:i+2,code,site,group,description,value:Number(quantity),reference_date:'2022-11-05'});
 });
 const selected=[],duplicates=[];
 for(const [key,rs] of dedup){
 if(new Set(rs.map(r=>r.value)).size!==1){invalidCodes.add(rs[0].code);rejected.push({code:rs[0].code,key,reason:'conflicting_capacity'});continue;}
 if(rs.length>1)duplicates.push({key,kept:rs[0].record,removed:rs.slice(1).map(r=>r.record)});
 selected.push({...rs[0],records:rs.map(r=>r.record)});
 }
 const groups=new Map();selected.forEach(r=>{if(!groups.has(r.code))groups.set(r.code,[]);groups.get(r.code).push(r);});
 const rows=[];
 for(const [code,rs] of groups){
 if(invalidCodes.has(code))continue;
 const value=rs.reduce((s,r)=>s+r.value,0);if(!(value>0))continue;
 rows.push({code,year:2022,kind:config.kind,value,unit:config.unit,source:'reps_capacity_2022',reference_date:'2022-11-05',area:'Total',status:'verified_historical',locator:'data/salud_capacidad_reps_2022.json · '+config.id+' · DIVIPOLA '+code,record_count:rs.length,site_count:new Set(rs.map(r=>r.site)).size});
 }
 rows.sort((a,b)=>a.code.localeCompare(b.code));
 selected.sort((a,b)=>a.code.localeCompare(b.code)||a.site.localeCompare(b.site)||a.description.localeCompare(b.description));
 return {rows,selected,duplicates,rejected,invalid_codes:[...invalidCodes].sort(),aliases:[...new Map(aliases.map(a=>[JSON.stringify(a),a])).values()]};
}
function main(){
 const root=path.resolve(__dirname,'..'),input=process.argv[2];
 if(!input)throw Error('Uso: node scripts/preparar_salud_relativa.cjs RUTA_CSV_ORIGINAL');
 const original=fs.readFileSync(input),denPath=path.join(root,'data/denominadores_sectoriales.json'),snapshotPath=path.join(root,'data/salud_capacidad_reps_2022.json');
 const den=JSON.parse(fs.readFileSync(denPath,'utf8')),snapshot=JSON.parse(fs.readFileSync(snapshotPath,'utf8'));
 const source=den.sources.reps_capacity_2022;
 if(crypto.createHash('sha256').update(original).digest('hex')!==source.sha256)throw Error('El CSV no coincide con el extracto verificado. No se modifica ningún dato.');
 const population=JSON.parse(fs.readFileSync(path.join(root,'data/poblacion_relativa.json'),'utf8'));
 const result=aggregateReps(parseCSV(original.toString('utf8')),population.rows,snapshot.config);
 if(result.rejected.length)throw Error('Revisar registros excluidos antes de reemplazar la base: '+JSON.stringify(result.rejected));
 den.rows=den.rows.filter(r=>r.kind!==snapshot.config.kind).concat(result.rows);
 const next={config:snapshot.config,source,records:result.selected,audit:{duplicates:result.duplicates,rejected:result.rejected,invalid_codes:result.invalid_codes,aliases:result.aliases}};
 fs.writeFileSync(denPath,JSON.stringify(den,null,2)+'\n','utf8');
 fs.writeFileSync(snapshotPath,JSON.stringify(next,null,2)+'\n','utf8');
 process.stdout.write(result.rows.length+' bases territoriales. Regenerar index.html con generar_tablero_recuperacion.py.\n');
}
module.exports={parseCSV,aggregateReps};
if(require.main===module)main();
