const assert=require('node:assert/strict'),{chromium}=require('playwright'),path=require('node:path');
(async()=>{
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.goto('file://'+path.resolve('index.html'),{waitUntil:'load'});
await page.waitForSelector('#relative-matrix table');
const res=await page.evaluate(()=>{
 const state={scope:'decree',date:DATA.latest,dept:''},result=Priorizacion.models(DATA).sectorial.compute(state);
 const r=result.items.find(m=>m.code==='66001'),h=r.sectors.find(s=>s.id==='salud').fields[0];
 return {human:r.sectors[0].fields.map(f=>f.id),fields:r.fieldCount,raw:h.row.v,base:h.denominator.value,ratio:h.rate,score:h.score,mode:DATA.healthPressure.mode,n:result.referenceN};
});
assert.equal(res.fields,10);assert.deepEqual(res.human,['3is_familias','3is_fallecidos','3is_desaparecidos']);assert.ok(res.ratio>=0);assert.ok(Math.abs(res.ratio-res.raw/res.base)<1e-8);
await page.locator('#relative-search').fill('Pereira');await page.waitForTimeout(100);
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
await page.evaluate(()=>RelativeMunicipalRadar.render(null,{scope:'decree',date:DATA.latest,dept:''}));
await page.evaluate(()=>{
 const s=document.getElementById('radar-relative-select-0');s.value='municipal:66001';s.dispatchEvent(new Event('change'));
 document.querySelector('#radar-relative-chart [data-radar-m="0"][data-radar-axis="2"]')?.dispatchEvent(new Event('mouseenter'));
});
assert.match(await page.locator('#radar-relative-inspector').innerText(),/Heridos frente a/);
const selects=page.locator('[id$="radar-select-0"], [id*="radar"][id$="select-0"]');
assert.ok(await selects.count()>=3);
await page.screenshot({path:'experimentos/presion_salud/interfaz.png',fullPage:false});
const check=await page.evaluate(()=>{
 const state={scope:'decree',date:DATA.latest,dept:''};
 return ['absolute','percapita','sectorial'].map(mode=>{
  const r=Priorizacion.models(DATA)[mode].compute(state).all.find(r=>r.code==='66001');
  return {mode,fields:r.fieldCount,counts:r.sectors.map(s=>s.fields.length),sources:r.sectors[1].fields.map(f=>f.source)};
 });
});
for(const r of check){assert.equal(r.fields,10);assert.deepEqual(r.counts,[3,2,1,1,3]);assert.ok(r.sources.every(s=>s==='PNUD'||s==='3iS-Sheets'));}
assert.match(await page.locator('#priority-method').innerText(),/PNUD.*3iS/);
assert.deepEqual(errors,[]);await browser.close();console.log('UI pressure scenario OK',res);
})().catch(e=>{console.error(e);process.exit(1);});
