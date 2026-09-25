const test=require('node:test'),assert=require('node:assert/strict'),V=require('../web/presentacion.js');
const state={date:'2026-09-18'},place=geo=>({geo,d:'D',m:geo,coverage:1,lower:1});
const row=(geo,id,v,f='3iS-Sheets')=>({geo,lv:'municipal',date:state.date,id,v,f});
// La escala humana sale de la población expuesta de RAPIDA, no del inventario de población.
const exp=(geo,v=100)=>row(geo,'undp_rapida_pop_exp',v,'UNDP-RAPIDA');
test('el resumen cuenta afectaciones, no registros de inventario ni pobreza',()=>{
 const items=[place('a'),place('b'),place('c'),place('d')];
 const s=V.summary({rows:[row('a','3is_fallecidos',1),row('a','pnud_va',2,'PNUD'),row('b','3is_fallecidos',0),row('c','ipm',70,'DANE'),row('d','gravedad_oficial',100,'Naboo/UNGRD'),exp('a'),exp('b'),exp('c'),exp('d')]},{items},{items},state);
 assert.equal(s.affected,2);assert.equal(s.departments,1);assert.equal(s.population.value,200);assert.equal(s.critical,1);assert.equal(s.classified,1);
});
test('no clasificación es ausencia, y población faltante se señala como parcial',()=>{
 const items=[place('a'),place('b')];
 // 'a' es afectado pero RAPIDA no lo cubre: suma parcial, no cero.
 const s=V.summary({rows:[row('a','pnud_va',5,'PNUD'),row('b','gravedad_oficial',0,'Naboo/UNGRD'),exp('b')]},{items},{items},state);
 assert.equal(s.critical,null);assert.equal(s.population.value,null);assert.equal(s.population.known,0);assert.equal(s.population.total,1);
});
test('respeta captura y ámbito, incluye empates sin sumar población duplicada',()=>{
 const items=Array.from({length:22},(_,i)=>({...place(String(i)),lower:i<19?30-i:5}));
 const s=V.summary({rows:[row('outside','3is_heridos',20),{...row('0','3is_fallecidos',1),date:'2026-09-17'},row('1','3is_fallecidos',1),...items.map(r=>exp(r.geo))]},{items},{items},state);
 assert.equal(s.affected,1);assert.equal(s.topN,22);assert.equal(s.priorityPopulation.value,2200);
});
test('exposición cero es dato observado, no faltante',()=>{
 const items=[place('a'),place('b')];
 const s=V.summary({rows:[row('a','3is_fallecidos',1),row('b','3is_fallecidos',1),exp('a',0),exp('b',500)]},{items},{items},state);
 assert.equal(s.affected,2);assert.equal(s.population.value,500);
 assert.equal(s.population.known,2);assert.equal(s.population.total,2);
});
test('cero y faltante distintos, familias informativas permanecen y se escapan etiquetas',()=>{
 const s={lower:0,upper:100,coverage:.5,fields:[{label:'Familias afectadas <script>',source:'3iS-Sheets',row:{v:0,u:'Número'},share:0,score:0},{label:'Desaparecidos',source:'3iS-Sheets',row:null,share:.5,score:null}]};
 const html=V.sector(s,false);
 assert.match(html,/Solo consulta/);assert.match(html,/<b>0<\/b>/);assert.match(html,/sin dato/);assert.ok(!html.includes('Número'));assert.ok(!html.includes('Documentado'));assert.ok(!html.includes('posible'));assert.ok(!html.includes('<script>'));
 assert.match(V.sector({...s,coverage:0},false),/<strong>Sin dato<\/strong>/);
});
test('la celda municipal conserva puntaje global aun ordenando por una dimensión',()=>{
 const html=V.municipality({geo:'a',m:'A',d:'D',coverage:1,lower:25,rank:3,available:8,fieldCount:9},'data-priority-geo');
 assert.match(html,/25<small> \/100/);assert.match(html,/Puesto global: 3/);assert.match(html,/8 de 9/);
});
test('si falta el denominador, el conteo conocido sigue visible sin fabricar una tasa',()=>{
 const html=V.sector({lower:0,coverage:0,fields:[{label:'Familias afectadas',row:{v:42000},source:'3iS-Sheets',share:0,rate:null,score:null}]},true);
 assert.match(html,/sin dato relativo/);assert.match(html,/Reportado: 42.000/);assert.match(html,/<strong>Sin dato<\/strong>/);
});

const colors=['#07558a','#b95319','#724c9e'];
const radarPlace=(m,fields,extra={})=>({geo:m,m,d:'Departamento',coverage:1,lower:61.0777,upper:66.6123,available:8,fieldCount:9,sectors:[{id:'impacto_humano',name:'Impacto humano',lower:40,upper:90,coverage:.5,fields}],...extra});
test('resumen del radar separa puntaje, faltantes y cobertura, sin notación técnica',()=>{
 const html=V.radarLegend([radarPlace('Pereira',[])],colors);
 assert.match(html,/Puntaje documentado/);assert.match(html,/61,1 \/100/);assert.match(html,/hasta 66,6/);assert.match(html,/8 de 9 indicadores/);
 assert.doesNotMatch(html,/61,0777|P:|campos/);
 const missing=V.radarLegend([radarPlace('Sin datos',[],{coverage:0,lower:0,upper:100,available:0})],colors);
 assert.match(missing,/Sin dato/);assert.doesNotMatch(missing,/0 \/100|hasta 100/);
 const complete=V.radarLegend([radarPlace('Completo',[],{lower:50,upper:50})],colors);
 assert.doesNotMatch(complete,/hasta|Con información faltante/);
});
test('comparación por indicador alinea municipios aun si cambia el orden de campos',()=>{
 const field=(id,v)=>({id,label:id,share:.5,row:v==null?null:{v,u:'Número'},source:'PNUD'});
 const a=radarPlace('Pereira',[field('fallecidos',98),field('desaparecidos',78)]);
 const b=radarPlace('Cali',[field('desaparecidos',0),field('fallecidos',156)]);
 const c=radarPlace('Tercero',[field('fallecidos',null)]);
 const snapshot=JSON.stringify([a,b,c]),html=V.radarMatrix([a,b,c],colors,false);
 const deaths=html.match(/data-indicator="fallecidos"[\s\S]*?<\/tr>/)[0];
 assert.match(deaths,/<strong>98<\/strong>[\s\S]*?<strong>156<\/strong>[\s\S]*?Sin dato/);
 const missing=html.match(/data-indicator="desaparecidos"[\s\S]*?<\/tr>/)[0];
 assert.match(missing,/<strong>78<\/strong>[\s\S]*?<strong>0<\/strong>[\s\S]*?Sin dato/);
 assert.equal((html.match(/data-indicator="desaparecidos"/g)||[]).length,1);
 assert.equal(JSON.stringify([a,b,c]),snapshot,'El formato no modifica el modelo');
});
test('comparación relativa conserva tasa, unidad y dato original; no inventa bases',()=>{
 const f={id:'salud',label:'Salud',share:1,row:{v:4},source:'3iS-Sheets',rate:2,relativeUnit:'/10.000 hab.',denominator:{value:20000,unit:'Habitantes',reference_date:'2026'}};
 const a=radarPlace('A',[f]),b=radarPlace('B',[{...f,rate:null,denominator:null}]);
 const html=V.radarMatrix([a,b],colors,true);
 assert.match(html,/<strong>2<\/strong>/);assert.match(html,/\/10.000 hab./);assert.match(html,/Reportado: 4/);assert.match(html,/Sin dato relativo/);assert.match(html,/20.000 Habitantes/);
 assert.equal(V.radarMatrix([],colors,true),'');
});
test('radar mantiene familias informativas y escapa todos los rótulos',()=>{
 const r=radarPlace('<img onerror=1>',[{id:'f',label:'Familias <script>',share:0,row:{v:0,u:'Número'},source:'3iS-Sheets'}]);
 for(const html of [V.radarLegend([r],colors),V.radarMatrix([r],colors,false),V.radarSelection(r,r.sectors[0],colors[0])])assert.doesNotMatch(html,/<img|<script>/);
 assert.match(V.radarMatrix([r],colors,false),/Solo informativo/);
 assert.match(V.radarSelection(r,r.sectors[0],colors[0]),/Cómo se calcula/);
});
