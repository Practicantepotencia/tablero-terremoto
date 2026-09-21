const {chromium}=require('playwright'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url'),path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.BROWSER_PATH?{executablePath:process.env.BROWSER_PATH}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
  const absolute=await page.locator('#matrix').innerText(),percapita=await page.locator('#percapita-matrix').innerText();
  const absRadar=await page.locator('#radar-legend').innerText(),pcRadar=await page.locator('#radar-percapita-legend').innerText();
  const initial=await page.locator('#relative-matrix').innerText();
  assert.equal(await page.locator('#relative-depth').inputValue(),'ipm');
  assert.equal(await page.locator('#relative-depth option').count(),3);
  await page.locator('#relative-search').fill('pereira');
  await page.locator('#relative-matrix [data-relative-geo]').click();
  for(const depth of ['index','ipm','ipm_idf']){
    await page.locator('#relative-depth').selectOption(depth);
    assert.deepEqual(await page.locator('[data-relative-depth]').evaluateAll(xs=>xs.map(x=>x.value)),[depth,depth,depth]);
    const actual=await page.evaluate(()=>{
      const r=priorityModels.sectorial.compute(state).all.find(r=>r.code==='66001');
      return {lower:r.lower,fiscal:r.fiscal.value,formula:r.adjustment.formula,damage:r.damageLower};
    });
    assert.match(await page.locator('#relative-detail').innerText(),new RegExp(actual.formula.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
    const score=Number((await page.locator('#relative-matrix .priority-number').first().innerText()).split('/')[0].trim().replace(',','.'));
    assert.ok(Math.abs(score-actual.lower)<.006);
    assert.equal(await page.locator('#matrix').innerText(),absolute);
    assert.equal(await page.locator('#percapita-matrix').innerText(),percapita);
    assert.equal(await page.locator('#radar-legend').innerText(),absRadar);
    assert.equal(await page.locator('#radar-percapita-legend').innerText(),pcRadar);
  }
  assert.match(await page.locator('#relative-detail').innerText(),/75,2323/);
  await page.locator('#tab-radar').click();
  const shape=await page.locator('#radar-relative-chart').innerHTML();
  await page.locator('#radar-relative-depth').selectOption('index');
  assert.equal(await page.locator('#radar-relative-chart').innerHTML(),shape);
  assert.match(await page.locator('#radar-relative-inspector').innerText(),/P = D/);
  assert.doesNotMatch(await page.locator('#radar-relative-inspector').innerText(),/P = D ×/);
  await page.locator('#tab-rapida').click();
  assert.ok(await page.locator('#comparison-depth-control').isHidden());
  await page.locator('#comparison-mode').selectOption('sectorial');
  assert.ok(await page.locator('#comparison-depth-control').isVisible());
  const summaries=[];
  for(const depth of ['index','ipm','ipm_idf']){
    await page.locator('#comparison-depth').selectOption(depth);
    const summary=await page.evaluate(()=>{
      const c=Comparacion.compare(priorityModels,model,state,{mode:'sectorial',axis:'value',panel:'available'});
      return {depth:state.relativeDepth,n:c.n,r2:c.regression.r2,excluded:c.excluded};
    });
    summaries.push(summary);
    assert.equal(await page.locator('.comparison-point').count(),summary.n);
    const shown=await page.locator('#comparison-kpis').innerText();
    assert.ok(shown.includes(new Intl.NumberFormat('es-CO',{maximumFractionDigits:4}).format(summary.r2)));
  }
  assert.notEqual(summaries[0].r2,summaries[1].r2);assert.notEqual(summaries[1].r2,summaries[2].r2);
  for(const scope of ['all','decree']){
    await page.locator('#scope').selectOption(scope);
    assert.equal(await page.locator('#comparison-depth').inputValue(),'ipm_idf');
  }
  await page.locator('#tab-prioridades').click();
  await page.locator('#relative-search').fill('');
  await page.locator('#relative-depth').selectOption('ipm');
  assert.equal(await page.locator('#relative-matrix').innerText(),initial);
  await page.locator('#relative-depth').selectOption('ipm_idf');
  await page.locator('#relative-search').fill('pereira');
  await page.locator('#relative-close').click();
  await page.locator('#relative-card').scrollIntoViewIfNeeded();
  if(process.env.DEPTH_SCREENSHOT)await page.screenshot({path:process.env.DEPTH_SCREENSHOT});
  await page.setViewportSize({width:390,height:844});
  await page.locator('#relative-depth').selectOption('index');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assert.deepEqual(errors,[]);
  console.log('Tres niveles sincronizados, fórmulas y pares verificados; absoluto/per cápita intactos.',JSON.stringify(summaries));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
