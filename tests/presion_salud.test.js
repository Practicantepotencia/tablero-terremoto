const test=require('node:test'),assert=require('node:assert/strict'),H=require('../web/presion_salud.js');
function fixture(){
 const data={healthPressure:{enabled:true,mode:'urgencias',event_date:'2026-08-10',capacity:{kind:'consultorios_urgencias_reps',label:'Consultorios REPS',unit:'Consultorios de urgencias',source:{url:'https://www.datos.gov.co/resource/s2ru-bqt6.json',sha256:'a'.repeat(64)},rows:[
 {code:'27050',year:2022,kind:'consultorios_urgencias_reps',reference_date:'2022-11-05',value:3,unit:'Consultorios de urgencias',status:'observed_historical'}]}}};
 const r={id:'3is_heridos',f:'3iS-Sheets',code:'27050',v:9,u:'Número',date:'2026-09-16'};
 return {data,r};
}
test('Carga documentada y cero explícito, sin confundir con ocupación',()=>{
 const {data,r}=fixture(),h=H.create(data),row=h.rows([r])[0];
 assert.equal(h.measure(row,H.ID,r.code,r.date).rate,3);
 assert.equal(h.measure({...row,v:0},H.ID,r.code,r.date).rate,0);
 assert.equal(h.measure({...row,v:null},H.ID,r.code,r.date).rate,null);
 assert.equal(h.measure({...row,original_id:'pnud_csalud'},H.ID,r.code,r.date).rate,null);
 assert.equal(h.rows([{...r,f:'PNUD'}]).length,0);
});
test('Faltantes, cero de capacidad, duplicados, predicciones y fechas inválidas quedan sin dato',()=>{
 for(const mutate of [
 d=>d.healthPressure.capacity.rows=[],
 d=>d.healthPressure.capacity.rows[0].value=0,
 d=>d.healthPressure.capacity.rows.push({...d.healthPressure.capacity.rows[0]}),
 d=>d.healthPressure.capacity.rows[0].status='ml_prediction',
 d=>d.healthPressure.capacity.rows[0].value=-1,
 d=>d.healthPressure.capacity.rows[0].reference_date='2026-09-20',
 d=>d.healthPressure.capacity.source.sha256=''
 ]){
  const {data,r}=fixture();mutate(data);const h=H.create(data);assert.equal(h.measure(h.rows([r])[0],H.ID,r.code,r.date).rate,null);
 }
 const {data,r}=fixture(),h=H.create(data);
 assert.equal(h.measure(h.rows([r])[0],H.ID,r.code,'2026-08-09').rate,null);
 assert.equal(h.measure(h.rows([r])[0],H.ID,r.code,'2026-09-15').rate,null);
});
test('Escenario ausente no altera modelos existentes',()=>{
 assert.equal(H.create({}).enabled,false);assert.deepEqual(H.create({}).rows([]),[]);
});
