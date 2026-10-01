const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {execFileSync}=require('node:child_process'),{pathToFileURL}=require('node:url');
const {chromium}=require('playwright'),P=require('../web/priorizacion.js');
const out=path.resolve('tmp/cepal-qa');fs.mkdirSync(out,{recursive:true});
const payload=s=>JSON.parse(s.slice(s.indexOf('const DATA=')+11,s.indexOf(';</script>',s.indexOf('const DATA='))));
const before=payload(execFileSync('git',['show','c66aa361fb713fdaf741e0c0ceedf9c5798bb6bb:index.html'],{encoding:'utf8',maxBuffer:150*1024*1024}));
const after=payload(fs.readFileSync('index.html','utf8'));
// Execute the actual main engine, not this branch's engine twice.
const original={exports:{}};
const originalCode=execFileSync('git',['show','c66aa361fb713fdaf741e0c0ceedf9c5798bb6bb:web/priorizacion.js'],{encoding:'utf8'});
new Function('require','module','exports',originalCode)(name=>require('../web/'+name),original,original.exports);
const originalPriority=original.exports;
const values=data=>data.rows.map(r=>[r.geo,r.f,r.id,r.v,r.u,r.date]);
assert.deepEqual(values(after),values(before),'Conservar el inventario original');
const numeric=r=>({code:r.code,lower:r.lower,upper:r.upper,rank:r.rank,available:r.available,coverage:r.coverage,best:r.bestRank,worst:r.worstRank,rankMin:r.rankMin,rankMax:r.rankMax,
 sectors:r.sectors.map(s=>({id:s.id,lo:s.lower,hi:s.upper,fields:s.fields.map(f=>({id:f.id,score:f.score,share:f.share,anchor:f.anchor,source:f.source,rate:f.rate}))}))});
// Verify the chapter-II change independently of the explicit later educational model.
const legacy={...after,education:null};
let comparisons=0;
for(const date of after.dates)for(const scope of ['all','decree'])for(const mode of ['absolute','percapita','sectorial']){
 const state={date,scope,dept:''};
 assert.deepEqual(P.models(legacy)[mode].compute(state).items.map(numeric),originalPriority.models(before)[mode].compute(state).items.map(numeric));comparisons++;
}
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1050}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.route(/^https?:/,r=>r.abort());
  await page.goto(pathToFileURL(path.resolve('index.html')).href);await page.waitForSelector('#matrix table');
  assert.match(await page.locator('#capture-label').innerText(),/^Captura /);
  assert.match(await page.locator('.scale-key').innerText(),/Índice propio/);
  assert.equal(await page.locator('.tab-panel').count(),5);
  await page.screenshot({path:path.join(out,'desktop.png')});
  await page.locator('#matrix-search').fill('Pereira');
  for(const [mode,id,attribute]of [['absolute','matrix','data-priority-geo'],['percapita','percapita-matrix','data-relative-geo'],['sectorial','relative-matrix','data-relative-geo']]){
   await page.selectOption('#affectation-mode',mode);assert.equal(await page.locator('#'+id+' tbody tr').count(),1);
   assert.match(await page.locator('#'+id+' .municipal-cell').innerText(),/Rango:/);
   await page.locator('#'+id+' ['+attribute+']').click();
   const detail=mode==='absolute'?'priority-detail':mode==='percapita'?'percapita-detail':'relative-detail';
   assert.ok(await page.locator('#'+detail).isVisible());
  }
  assert.match(await page.locator('#relative-matrix').innerText(),/Capacidad histórica; no ocupación/);
  await page.locator('#tab-metodo').click();await page.locator('#cepal-method summary').click();
  assert.equal(await page.locator('#cepal-status tbody tr').count(),3);
  assert.equal((await page.locator('#cepal-status').innerText()).match(/No evaluada/g).length,3);
  const downloadPromise=page.waitForEvent('download');await page.locator('#download-cepal').click();
  const download=await downloadPromise;await download.saveAs(path.join(out,'evaluation.json'));
  const exported=JSON.parse(fs.readFileSync(path.join(out,'evaluation.json'),'utf8'));
  assert.equal(exported.status,'not_evaluated');assert.deepEqual(exported.records,[]);assert.equal(exported.index.cepal_formula,false);
  await page.screenshot({path:path.join(out,'method.png')});
  await page.locator('#tab-diagnostico').click();await page.selectOption('#source','PNUD');await page.selectOption('#dimension','Estimaciones monetarias');
  assert.match(await page.locator('#source-warning').innerText(),/No acredita pérdidas de flujos/);
  const csvPromise=page.waitForEvent('download');await page.locator('#download').click();await(await csvPromise).saveAs(path.join(out,'selection.csv'));
  const csv=fs.readFileSync(path.join(out,'selection.csv'),'utf8');assert.match(csv,/dimension_original/);assert.match(csv,/pending_valuation/);assert.match(csv,/no acreditada/);
  // An assessment from a later observation must not appear in an earlier capture.
  const temporal=await page.evaluate(()=>{
   const previous=DATA.cepal.records,oldDate=state.date;DATA.cepal.records=[{code:'66001',observed_at:'2026-09-21',effect:'damage'}];
   state.date=DATA.dates[0];const early=cepalSelection().records.length;state.date=DATA.latest;const latest=cepalSelection().records.length;
   DATA.cepal.records=previous;state.date=oldDate;return {early,latest};
  });assert.equal(temporal.early,0);assert.equal(temporal.latest,1);
  await page.locator('#tab-prioridades').click();await page.selectOption('#affectation-mode','absolute');await page.locator('#matrix-search').fill('');
  await page.selectOption('#dept','Risaralda');assert.ok(await page.locator('#matrix tbody tr').count()>0);await page.selectOption('#dept','');
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>window.scrollTo(0,0));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:path.join(out,'mobile.png')});assert.deepEqual(errors,[]);
  const report={base:'c66aa361fb713fdaf741e0c0ceedf9c5798bb6bb',numericComparisons:comparisons,inventoryRows:after.rows.length,legacyIndexUnchanged:true,errors,temporal,exports:true,mobileOverflow:false};
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
