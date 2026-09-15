'use strict';
const fs=require('node:fs');
const path=require('node:path');
const V=require('../web/validacion_ml_core.cjs');
const root=path.resolve(__dirname,'..');
const csv=fs.readFileSync(path.join(root,'experimentos/ml_salud/validacion.csv'),'utf8');
const rows=V.fromCSV(csv);
const payload={source_url:"https://github.com/Practicantepotencia/tablero-terremoto/blob/salud-relativa-consulta-externa/experimentos/ml_salud/validacion.csv",rows:V.pack(rows)};
let html=fs.readFileSync(path.join(root,'web/validacion_ml.template.html'),'utf8');
const replacements={
 '__VALIDATION_DATA__':JSON.stringify(payload).replace(/</g,'\\u003c'),
 '__VALIDATION_CORE__':fs.readFileSync(path.join(root,'web/validacion_ml_core.cjs'),'utf8'),
 '__VALIDATION_APP__':fs.readFileSync(path.join(root,'web/validacion_ml_app.js'),'utf8')
};
for(const [marker,value]of Object.entries(replacements)){
 if(html.split(marker).length!==2)throw Error('Marcador ausente o duplicado: '+marker);
 html=html.replace(marker,()=>value);
}
fs.writeFileSync(path.join(root,'validacion_ml.html'),html,'utf8');
console.log('validacion_ml.html generado: '+rows.length+' observaciones. Sin cambios en index.html.');
