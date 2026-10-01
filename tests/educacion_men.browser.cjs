const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {execFileSync}=require('node:child_process'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
const P=require('../web/priorizacion.js');
const out=path.resolve('tmp/education-qa');fs.mkdirSync(out,{recursive:true});
const payload=s=>JSON.parse(s.slice(s.indexOf('const DATA=')+11,s.indexOf(';</script>',s.indexOf('const DATA='))));
const base='577052461c1a82232defeb92c120dc1ffd09fbb2';
const before=payload(execFileSync('git',['show',base+':index.html'],{encoding:'utf8',maxBuffer:150*1024*1024}));
const after=payload(fs.readFileSync('index.html','utf8'));
const original={exports:{}};
new Function('require','module','exports',execFileSync('git',['show',base+':web/priorizacion.js'],{encoding:'utf8'}))(name=>require('../web/'+name),original,original.exports);
const numeric=r=>({code:r.code,lower:r.lower,upper:r.upper,rank:r.rank,available:r.available,coverage:r.coverage,best:r.bestRank,worst:r.worstRank,rankMin:r.rankMin,rankMax:r.rankMax,sectors:r.sectors});
let comparisons=0;
for(const date of after.dates.filter(d=>d<'2026-09-21'))for(const scope of ['all','decree'])for(const mode of ['absolute','percapita','sectorial']){
 const state={date,scope,dept:''};
 assert.deepEqual(P.models(after)[mode].compute(state).all.map(numeric),original.exports.models(before)[mode].compute(state).all.map(numeric));comparisons++;
}
assert.deepEqual(after.rows,before.rows,'No se reescribe el inventario original');
const latest={date:after.latest,scope:'five',dept:''};
const result=P.models(after).absolute.compute(latest);
assert.equal(result.referenceN,126);
assert.equal(result.calibrations.find(c=>c.id==='men_matricula_critica').n,121);
for(const mode of ['absolute','percapita','sectorial']){
 const model=P.models(after)[mode],full=model.selection(latest);
 const filtered=model.selection({...latest,dept:'Risaralda',matrixSearch:'Pereira'});
 assert.deepEqual(filtered.items.map(numeric),full.items.filter(r=>r.code==='66001').map(numeric));
 assert.equal(full.all.find(r=>r.code==='76001').sectors.find(s=>s.id==='educacion').fields[1].score,0);
 for(const code of ['27006','27495','27660','66075','66456'])assert.equal(full.all.find(r=>r.code===code).sectors.find(s=>s.id==='educacion').fields[1].row,null);
}
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.route(/^https?:/,r=>r.abort());
  await page.goto(pathToFileURL(path.resolve('index.html')).href);await page.waitForSelector('#matrix table');
  await page.selectOption('#scope','five');await page.locator('#matrix-search').fill('Pereira');
  assert.match(await page.locator('#matrix').innerText(),/23.859/);
  await page.locator('#matrix [data-priority-geo]').click();
  const men=page.locator('#priority-detail details').filter({hasText:'Educación · MEN'});await men.locator('summary').click();
  assert.match(await men.innerText(),/95 sedes críticas/);assert.match(await men.innerText(),/95 reportan prestar servicio/);
  await page.screenshot({path:path.join(out,'desktop.png')});
  for(const mode of ['percapita','sectorial']){
   await page.selectOption('#affectation-mode',mode);const id=mode==='sectorial'?'relative':'percapita';
   assert.equal(await page.locator('#'+id+'-matrix tbody tr').count(),1);
   await page.locator('#'+id+'-matrix [data-relative-geo]').click();assert.match(await page.locator('#'+id+'-detail').innerText(),/Matrícula en sedes críticas/);
  }
  await page.locator('#tab-metodo').click();await page.locator('#education-evidence summary').first().click();
  const coverage=await page.locator('#education-coverage').innerText();assert.match(coverage,/121\/126/);assert.match(coverage,/570.091/);
  const event=page.waitForEvent('download');await page.locator('#download-education').click();await(await event).saveAs(path.join(out,'education.json'));
  const download=JSON.parse(fs.readFileSync(path.join(out,'education.json'),'utf8'));
  assert.equal(download.men.municipalities.length,121);assert.equal(download.territorialReference.missing.length,5);
  assert.equal(download.men.reportDate,'2026-09-21');assert.equal(download.men.observedAt,null);assert.equal(download.context.sources.length,4);
  await page.screenshot({path:path.join(out,'coverage.png')});
  await page.selectOption('#dept','Risaralda');
  const filtered=await page.evaluate(()=>educationSelection());assert.equal(filtered.men.municipalities.length,12);assert.equal(filtered.territorialReference.municipalities.length,14);
  await page.selectOption('#date','2026-09-20');assert.match(await page.locator('#priority-method').innerText(),/modelo sectorial 1.2-RS/);
  assert.doesNotMatch(await page.locator('#priority-method').innerText(),/MEN-20260921/);
  const early=await page.evaluate(()=>educationSelection());assert.equal(early.men.available,false);assert.deepEqual(early.men.municipalities,[]);
  await page.locator('#tab-prioridades').click();await page.selectOption('#affectation-mode','absolute');
  assert.doesNotMatch(await page.locator('#matrix').innerText(),/Matrícula en sedes críticas/);
  await page.selectOption('#date','2026-09-21');assert.match(await page.locator('#matrix').innerText(),/Matrícula en sedes críticas/);
  await page.locator('#tab-diagnostico').click();await page.selectOption('#source','MEN');
  assert.match(await page.locator('#source-warning').innerText(),/2026-09-21/);
  const csvEvent=page.waitForEvent('download');await page.locator('#download').click();await(await csvEvent).saveAs(path.join(out,'men.csv'));
  const csv=fs.readFileSync(path.join(out,'men.csv'),'utf8');assert.match(csv,/fecha_archivo_fuente/);assert.match(csv,/MEN-20260921/);assert.match(csv,/no acreditada/);
  await page.locator('#tab-prioridades').click();await page.setViewportSize({width:390,height:844});await page.evaluate(()=>window.scrollTo(0,0));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:path.join(out,'mobile.png')});assert.deepEqual(errors,[]);
  const report={parent:base,preCutComparisons:comparisons,originalRows:after.rows.length,territorialUniverse:126,menMunicipalities:121,missingMen:5,exports:true,errors,mobileOverflow:false};
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
