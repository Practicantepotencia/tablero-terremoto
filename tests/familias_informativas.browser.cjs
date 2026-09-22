const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})}),errors=[],html=fs.readFileSync('index.html','utf8');
 const baseline=html.replace(/"families_informational_only"\s*:\s*true/,'"families_informational_only":false');
 assert.notEqual(baseline,html);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'familias-ui-')),previous=path.join(dir,'antes.html');fs.writeFileSync(previous,baseline);
 async function open(file){const p=await browser.newPage({viewport:{width:1440,height:1000}});p.on('pageerror',e=>errors.push(e.message));await p.goto('file://'+path.resolve(file),{waitUntil:'load'});await p.waitForSelector('#relative-matrix table',{state:'attached'});return p;}
 async function familyCards(p){
  const out=[];
  for(const prefix of ['','percapita-','relative-']){
   const search='matrix-search',matrix=prefix?prefix+'matrix':'matrix';
   await p.selectOption('#affectation-mode',prefix==='percapita-'?'percapita':prefix==='relative-'?'sectorial':'absolute');
   await p.locator('#'+search).fill('Pereira');
   assert.equal(await p.locator('#'+matrix+' tbody tr').count(),1);
   const tile=p.locator('#'+matrix+' tbody tr').first().locator('td').nth(1).locator('.heat-item').first();
   assert.match(await tile.innerText(),/Familias afectadas/);
   // Only the contribution tooltip may change; the visible card is identical.
   out.push(await tile.evaluate(el=>({html:el.innerHTML,style:el.getAttribute('style'),className:el.className})));
  }
  return out;
 }
 const old=await open(previous),cards=await familyCards(old);await old.close();
 const page=await open('index.html');assert.deepEqual(await familyCards(page),cards);
 assert.match(await page.locator('#priority-method').innerText(),/Impacto humano = \(z fallecidos \+ z desaparecidos\) \/ 2/);
 const snapshots=await page.evaluate(()=>{
  const state={scope:'decree',date:DATA.latest,dept:''},models=Priorizacion.models(DATA);
  MunicipalComparisons.render(models.absolute,state);
  return ['absolute','percapita','sectorial'].map(mode=>{
   const r=models[mode].compute(state).all.find(r=>r.code==='66001'),h=r.sectors[0];
   return {mode,fields:r.fieldCount,shares:h.fields.map(f=>f.share),human:h.lower,expected:(h.fields[1].score+h.fields[2].score)/2,available:r.available,contribution:h.fields[0].contribution};
  });
 });
 for(const r of snapshots){assert.equal(r.fields,9);assert.deepEqual(r.shares,[0,.5,.5]);assert.equal(r.contribution,0);assert.ok(Math.abs(r.human-r.expected)<1e-8);}
 for(const prefix of ['radar','radar-percapita','radar-relative']){
  await page.evaluate(prefix=>{
   const select=document.getElementById('radar-select-0');select.value='municipal:66001';select.dispatchEvent(new Event('change'));
   document.querySelector('#'+prefix+'-chart [data-radar-m="0"][data-radar-axis="0"]').dispatchEvent(new Event('mouseenter'));
  },prefix);
  const text=await page.locator('#'+prefix+'-inspector').innerText();
  assert.match(text,/Familias afectadas/);
  assert.equal((text.match(/Peso interno = 0,5/g)||[]).length,2);
  assert.match(text,/Peso interno = 0(?![0-9,])/);
 }
 await page.locator('#relative-matrix [data-relative-geo]').click();
 assert.ok((await page.locator('#relative-detail').innerText()).includes(snapshots.find(r=>r.mode==='sectorial').available+'/9 campos'));
 assert.deepEqual(errors,[]);await browser.close();
 console.log('Family cards preserved in all three matrices; two-factor radar verified',snapshots);
})().catch(e=>{console.error(e);process.exit(1);});
