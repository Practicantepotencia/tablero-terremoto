// Verificación de la presentación comparativa, no de un segundo modelo de puntajes.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.route(/^https?:/,route=>route.abort());
  await page.goto(pathToFileURL(path.resolve('index.html')).href);
  await page.locator('#tab-radar').click();
  fs.mkdirSync('tmp/panorama-qa',{recursive:true});
  const snapshots=[];
  for(const [prefix,mode]of [['radar','absolute'],['radar-percapita','percapita'],['radar-relative','sectorial']]){
   await page.selectOption('#'+prefix+'-select-0','municipal:66001');
   await page.selectOption('#'+prefix+'-select-1','municipal:76001');
   await page.selectOption('#'+prefix+'-select-2','municipal:27050');
   const matrix=page.locator('#'+prefix+'-sectors'),legend=page.locator('#'+prefix+'-legend'),dialog=page.locator('#'+prefix+'-method-dialog');
   assert.equal(await matrix.locator('thead th').count(),4);
   assert.deepEqual(await matrix.locator('.radar-column-name').allTextContents(),['Pereira','Santiago de Cali','Atrato']);
   assert.equal(await matrix.locator('.radar-dimension-row').count(),5);
   assert.equal(await matrix.locator('[data-indicator="3is_desaparecidos"] td').count(),3);
   assert.equal(await matrix.locator('[data-indicator="3is_desaparecidos"]').count(),1);
   assert.match(await legend.innerText(),/Puntaje documentado/);assert.doesNotMatch(await legend.innerText(),/P:|campos/);
   assert.equal(await dialog.isVisible(),false);
   assert.equal(await page.locator('#'+prefix+'-inspector .formula:visible').count(),0);
   const expected=await page.evaluate(mode=>{
    const p=Priorizacion.models(DATA)[mode].compute(state);
    return ['66001','76001','27050'].map(code=>{
     const r=p.all.find(x=>x.code===code);
     return {global:r.coverage?Presentacion.number(r.lower,1)+' /100':'Sin dato',sectors:r.sectors.map(s=>({id:s.id,score:s.coverage?Presentacion.number(s.lower,1):'Sin dato',fields:s.fields.map(f=>({id:f.id,raw:f.row?.v??null,value:mode==='absolute'?f.row?.v??null:f.rate??null}))}))};
    });
   },mode);
   for(let k=0;k<expected.length;k++){
    assert.match(await legend.locator('article').nth(k).innerText(),new RegExp(expected[k].global.replace('.','\\.')));
    for(const s of expected[k].sectors){
     assert.equal(await matrix.locator('[data-sector="'+s.id+'"] td').nth(k).innerText(),s.score);
     for(const f of s.fields){
      const cell=await matrix.locator('[data-indicator="'+f.id+'"] td').nth(k).innerText();
      if(f.value==null)assert.match(cell,/Sin dato/);
      else assert.ok(cell.startsWith(new Intl.NumberFormat('es-CO',{maximumFractionDigits:mode==='absolute'?2:4}).format(f.value)),cell);
     }
    }
   }
   const disappeared=await matrix.locator('[data-indicator="3is_desaparecidos"] td').allTextContents();snapshots.push({mode,disappeared});
   const cell=matrix.locator('[data-radar-m="0"][data-radar-axis="0"]');
   await cell.click();assert.equal(await dialog.isVisible(),true);
   assert.match(await dialog.innerText(),/Personas desaparecidas/);assert.match(await dialog.innerText(),/Cómo entra al índice global/);
   assert.match(await dialog.innerText(),/Peso interno/);
   await page.keyboard.press('Escape');assert.equal(await dialog.isVisible(),false);
   assert.equal(await cell.evaluate(el=>document.activeElement===el),true,'Escape devuelve foco a la celda');
   const method=page.locator('#'+prefix+'-selection [data-radar-method]');
   await method.click();assert.equal(await dialog.isVisible(),true);
   await dialog.locator('[data-radar-close]').click();assert.equal(await dialog.isVisible(),false);
   assert.equal(await method.evaluate(el=>document.activeElement===el),true,'Cerrar devuelve foco al botón');
   if(mode==='absolute'){
    await page.locator('#radar-reference').scrollIntoViewIfNeeded();await page.screenshot({path:'tmp/panorama-qa/radar-publico.png'});
    await matrix.screenshot({path:'tmp/panorama-qa/radar-matriz.png'});
   }
   // Las selecciones independientes permanecen; quitar todas limpia gráfico y matriz.
   for(let i=0;i<3;i++)await page.selectOption('#'+prefix+'-select-'+i,'');
   assert.equal(await matrix.locator('table').count(),0);assert.equal(await dialog.isVisible(),false);
   assert.match(await page.locator('#'+prefix+'-chart').innerText(),/Selecciona un municipio/);
   await page.selectOption('#'+prefix+'-select-0','municipal:66001');
   await page.locator('#'+prefix+'-chart [data-radar-m="0"][data-radar-axis="1"]').first().hover();
   assert.match(await page.locator('#'+prefix+'-selection').innerText(),/Vivienda/);
   assert.equal(await dialog.isVisible(),false,'Hover no abre metodología');
  }
  await page.selectOption('#scope','all');await page.selectOption('#dept','Risaralda');
  for(const prefix of ['radar','radar-percapita','radar-relative']){
   assert.equal(await page.locator('#'+prefix+'-sectors .radar-column-name').innerText(),'Pereira');
  }
  await page.setViewportSize({width:390,height:844});
  await page.locator('#radar-reference').scrollIntoViewIfNeeded();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:'tmp/panorama-qa/radar-mobile.png'});
  await page.locator('#radar-selection [data-radar-method]').click();
  assert.ok(await page.locator('#radar-method-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth));
  await page.screenshot({path:'tmp/panorama-qa/radar-modal-mobile.png'});
  await page.keyboard.press('Escape');
  assert.deepEqual(errors,[]);console.log(JSON.stringify({radars:3,alignedIndicators:true,modal:true,modelValuesMatch:true,mobile:true,snapshots,errors},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
