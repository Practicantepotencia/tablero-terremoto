const assert=require('node:assert/strict'),{chromium}=require('playwright'),path=require('node:path');
(async()=>{
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.goto('file://'+path.resolve('index.html'),{waitUntil:'load'});
await page.selectOption('#affectation-mode','sectorial');
await page.waitForSelector('#relative-matrix table');
const res=await page.evaluate(()=>{
 const state={scope:'decree',date:DATA.latest,dept:''},result=Priorizacion.models(DATA).sectorial.compute(state);
 const r=result.items.find(m=>m.code==='66001'),h=r.sectors.find(s=>s.id==='salud').fields[0];
 return {human:r.sectors[0].fields.map(f=>f.id),fields:r.fieldCount,raw:h.row.v,base:h.denominator.value,ratio:h.rate,score:h.score,mode:DATA.healthPressure.mode,n:result.referenceN};
});
const expectedFields=await page.evaluate(()=>DATA.healthPressure?.human_impact_policy?.families_informational_only?9:10);
assert.equal(res.fields,expectedFields);assert.deepEqual(res.human,['3is_familias','3is_fallecidos','3is_desaparecidos']);assert.ok(res.ratio>=0);assert.ok(Math.abs(res.ratio-res.raw/res.base)<1e-8);
await page.locator('#matrix-search').fill('Pereira');
assert.equal(await page.locator('#relative-matrix tbody tr').count(),1);
assert.match(await page.locator('#relative-matrix').innerText(),/Heridos frente a/);
await page.locator('#relative-matrix [data-relative-geo]').click();
assert.match(await page.locator('#relative-detail').innerText(),/REPS/);
for(const selector of ['#matrix','#percapita-matrix','#relative-matrix']){
 const human=page.locator(selector+' tbody tr').first().locator('td').nth(1);
 assert.doesNotMatch(await human.innerText(),/Personas heridas/);
 assert.match(await human.innerText(),/Familias afectadas/);
 assert.match(await human.innerText(),/Personas fallecidas/);
 assert.match(await human.innerText(),/Personas desaparecidas/);
}
// Exercise the same radar objects, independently of tab visibility.
await page.evaluate(()=>MunicipalComparisons.render(Priorizacion.models(DATA).absolute,{scope:'decree',date:DATA.latest,dept:''}));
await page.evaluate(()=>{
 const s=document.getElementById('radar-select-0');s.value='municipal:66001';s.dispatchEvent(new Event('change'));
 document.querySelector('#radar-relative-chart [data-radar-m="0"][data-radar-axis="2"]')?.dispatchEvent(new Event('mouseenter'));
});
assert.match(await page.locator('#radar-relative-inspector').innerText(),/Heridos frente a/);
const selects=page.locator('[id$="radar-select-0"], [id*="radar"][id$="select-0"]');
assert.equal(await selects.count(),1);
require('node:fs').mkdirSync('tmp/panorama-qa',{recursive:true});
await page.screenshot({path:'tmp/panorama-qa/presion.png',fullPage:false});
const check=await page.evaluate(()=>{
 const state={scope:'decree',date:DATA.latest,dept:''};
 return ['absolute','percapita','sectorial'].map(mode=>{
  const r=Priorizacion.models(DATA)[mode].compute(state).all.find(r=>r.code==='66001');
  return {mode,fields:r.fieldCount,counts:r.sectors.map(s=>s.fields.length),sources:r.sectors[1].fields.map(f=>f.source)};
 });
});
for(const r of check){assert.equal(r.fields,expectedFields);assert.deepEqual(r.counts,[3,2,1,1,3]);assert.ok(r.sources.every(s=>s==='PNUD'||s==='3iS-Sheets'));}
assert.match(await page.locator('#priority-method').innerText(),/PNUD.*3iS/);
for(const selector of ['#matrix','#percapita-matrix','#relative-matrix']){
 assert.equal(await page.locator(selector+' thead th').count(),6);
 assert.match(await page.locator(selector+' thead').innerText(),/Educación/);
}
const education=await page.evaluate(()=>{
 const state={scope:'decree',date:DATA.latest,dept:''},models=Priorizacion.models(DATA);
 MunicipalComparisons.render(models.absolute,state);
 return ['absolute','percapita','sectorial'].map(mode=>{
  const r=models[mode].compute(state).all.find(r=>r.code==='66001'),s=r.sectors.find(s=>s.id==='educacion');
  return {mode,sectors:r.sectors.length,rate:s.fields[0].rate,score:s.fields[0].score,raw:s.fields[0].row.v,coverage:s.coverage};
 });
});
for(const e of education){assert.equal(e.sectors,5);assert.ok(e.raw>=0);assert.ok(e.score>=0);if(e.mode==='sectorial'){assert.ok(e.rate>0);assert.equal(e.coverage,1);}}
for(const prefix of ['radar','radar-percapita','radar-relative']){
 const chart=page.locator('#'+prefix+'-chart');assert.match(await chart.innerText(),/Educación/);
 assert.equal(await chart.locator('polygon').first().evaluate(p=>p.getAttribute('points').trim().split(/\s+/).length),5);
}
const educationCell=page.locator('#relative-matrix tbody tr').first().locator('td').nth(4);
assert.doesNotMatch(await educationCell.innerText(),/Sin datos relativos/);
assert.match(await educationCell.innerText(),/165 \/ 314 sedes educativas/);
await page.evaluate(()=>{
 const s=document.getElementById('radar-select-0');s.value='municipal:66001';s.dispatchEvent(new Event('change'));
 const point=document.querySelector('#radar-relative-chart [data-radar-m="0"][data-radar-axis="3"]');
 if(!point)throw new Error('Falta el punto educativo relativo');point.dispatchEvent(new Event('mouseenter'));
});
assert.match(await page.locator('#radar-relative-inspector').innerText(),/Centros educativos/);
assert.doesNotMatch(await page.locator('#radar-relative-inspector').innerText(),/deshabilitado/);

assert.match(await page.locator('#radar-relative-inspector').innerText(),/100 × min/);
assert.match(await page.locator('#relative-detail').innerText(),/Tope fijo: 1/);
assert.match(await page.locator('#relative-detail').innerText(),/Educación: z = 100 × min/);
assert.match(await educationCell.innerText(),/52,55/);
await page.evaluate(()=>{
 const s=document.getElementById('radar-select-0');s.value='municipal:76020';s.dispatchEvent(new Event('change'));
 document.querySelector('#radar-relative-chart [data-radar-m="0"][data-radar-axis="3"]').dispatchEvent(new Event('mouseenter'));
});
const capped=await page.locator('#radar-relative-inspector').innerText();
assert.match(capped,/Conteo original: 25/);assert.match(capped,/17 Sedes/);assert.match(capped,/100 × min\(1,4706, 1\) = 100/);
assert.doesNotMatch(capped,/Máxima tasa comparable/);
await page.locator('#matrix-search').fill('Alcalá');
assert.match(await page.locator('#relative-matrix tbody tr').first().locator('td').nth(4).innerText(),/100 \/100/);

assert.match(await page.locator('#priority-method').innerText(),/Vivienda = \(2 × z destruidas \+ 1 × z averiadas\) \/ 3/);
for(const prefix of ['radar','radar-percapita','radar-relative']){
 await page.evaluate(prefix=>{
  const select=document.getElementById('radar-select-0');select.value='municipal:66001';select.dispatchEvent(new Event('change'));
  document.querySelector('#'+prefix+'-chart [data-radar-m="0"][data-radar-axis="1"]').dispatchEvent(new Event('mouseenter'));
 },prefix);
 const inspector=await page.locator('#'+prefix+'-inspector').innerText();
 assert.match(inspector,/Peso interno = 0,6667/);assert.match(inspector,/Peso interno = 0,3333/);
}
const housing=await page.evaluate(()=>{
 const state={scope:'decree',date:DATA.latest,dept:''};
 return ['absolute','percapita','sectorial'].map(mode=>{
  const r=Priorizacion.models(DATA)[mode].compute(state).all.find(r=>r.code==='66001'),s=r.sectors[1];
  return {mode,shares:s.fields.map(f=>f.share),score:s.lower,expected:(2*s.fields[0].score+s.fields[1].score)/3,global:r.lower};
 });
});
for(const h of housing){assert.deepEqual(h.shares,[2/3,1/3]);assert.ok(Math.abs(h.score-h.expected)<1e-8);}
await page.locator('#matrix-search').fill('Pereira');
assert.match(await page.locator('#relative-matrix tbody tr').first().locator('td').nth(2).innerText(),/29,35/);
await page.locator('#relative-matrix [data-relative-geo]').click();
assert.match(await page.locator('#relative-detail').innerText(),/66,6667%/);
assert.match(await page.locator('#relative-detail').innerText(),/33,3333%/);
assert.deepEqual(errors,[]);await browser.close();console.log('UI pressure scenario OK',res);
})().catch(e=>{console.error(e);process.exit(1);});
