const {chromium}=require('playwright');
const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.BROWSER_PATH?{executablePath:process.env.BROWSER_PATH}:{})});
 try {
  const page=await browser.newPage({viewport:{width:1440,height:1050}}),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
  const order=id=>page.locator(`#${id} [data-${id==='matrix'?'priority':'relative'}-geo]`).evaluateAll(xs=>xs.map(x=>x.dataset.priorityGeo||x.dataset.relativeGeo));
  const absolute=await order('matrix'),normal=await order('relative-matrix');
  assert.notDeepEqual(normal,absolute);
  const head=page.locator('[data-relative-sort="impacto_humano"]');
  await head.click();assert.equal(await head.locator('..').getAttribute('aria-sort'),'descending');
  await head.click();assert.equal(await head.locator('..').getAttribute('aria-sort'),'ascending');
  await head.click();assert.deepEqual(await order('relative-matrix'),normal);
  assert.deepEqual(await order('matrix'),absolute);
  await page.locator('#relative-search').fill('pereira');
  assert.equal(await page.locator('#relative-matrix tbody tr').count(),1);
  await page.locator('#relative-matrix [data-relative-geo]').click();
  assert.match(await page.locator('#relative-detail').innerText(),/Tasa = valor original/);
  assert.match(await page.locator('#relative-detail').innerText(),/2026/);
  await page.locator('#relative-close').click();
  await page.locator('#relative-search').fill('');
  await page.locator('[data-relative-sort="educacion"]').click();
  await page.locator('#scope').selectOption('all');
  assert.equal(await page.locator('[data-relative-sort="educacion"]').locator('..').getAttribute('aria-sort'),'descending');
  if(process.env.RELATIVE_SCREENSHOT){await page.locator('#relative-card').scrollIntoViewIfNeeded();await page.screenshot({path:process.env.RELATIVE_SCREENSHOT});}
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.deepEqual(errors,[]);console.log('Relative UI OK: independent sorting, search, traceable formula, scope, mobile.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
