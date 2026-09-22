const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process'),{chromium}=require('playwright');
const output=path.resolve('tmp/panorama-qa');fs.mkdirSync(output,{recursive:true});
const baseline=process.env.BASELINE_REF||'0fe69704f8d97ff7ebddb5bc5afff13a6ec03fb3';
const payload=html=>{const a=html.indexOf('const DATA=')+11,b=html.indexOf(';</script>',a);return JSON.parse(html.slice(a,b));};
(async()=>{
 const before=payload(execFileSync('git',['show',baseline+':index.html'],{encoding:'utf8',maxBuffer:150*1024*1024}));
 const after=payload(fs.readFileSync('index.html','utf8'));
 delete before.generated;delete after.generated;assert.deepEqual(after,before,'Los datos publicados no deben cambiar');
 for(const file of ['modelo.js','priorizacion.js','denominadores.js','presion_salud.js','comparacion.js'])assert.equal(fs.readFileSync('web/'+file,'utf8').replaceAll('\r\n','\n'),execFileSync('git',['show',baseline+':web/'+file],{encoding:'utf8'}).replaceAll('\r\n','\n'),'Modelo intacto: '+file);
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.route(/^https?:/,route=>route.abort());
 await page.goto('file:///'+path.resolve('index.html').replaceAll('\\','/'),{waitUntil:'load'});
 await page.waitForSelector('#matrix table');
 assert.equal(await page.locator('h1').innerText(),'Panorama territorial');assert.equal(await page.locator('#tab-prioridades').innerText(),'Índice');
 assert.equal(await page.locator('#priority-kpis .tile').count(),2);
 assert.doesNotMatch(await page.locator('#priority-kpis').innerText(),/Severidad|afectación crítica/);
 assert.equal(await page.locator('.profile-controls input:visible').count(),1);
 await page.screenshot({path:path.join(output,'desktop.png')});
 const originalSummary=await page.locator('#priority-kpis').innerText();
 await page.locator('#matrix-search').fill('Pereira');assert.equal(await page.locator('#priority-kpis').innerText(),originalSummary);
 const snapshots=[];
 for(const [mode,id,geo]of [['absolute','matrix','data-priority-geo'],['percapita','percapita-matrix','data-relative-geo'],['sectorial','relative-matrix','data-relative-geo']]){
  await page.selectOption('#affectation-mode',mode);await page.waitForSelector('#'+id+' table');
  assert.equal(await page.locator('.profile-card .matrix-card:visible').count(),1);assert.equal(await page.locator('#'+id+' tbody tr').count(),1);
  const matrix=page.locator('#'+id),text=await matrix.innerText();
  assert.ok(!/Documentado|posible|Número/.test(text));assert.match(text,/Familias afectadas/);
  const expected=await page.evaluate(mode=>{const r=priorityModels[mode].selection(state).items.find(r=>r.code==='66001');return {score:Presentacion.number(r.lower),rank:r.rank,available:r.available,fields:r.fieldCount,sectors:r.sectors.map(s=>s.coverage?Presentacion.number(s.lower):'Sin dato')};},mode);
  assert.match(await matrix.locator('.priority-number').innerText(),new RegExp(expected.score.replace('.','\\.')));
  assert.match(text,new RegExp(expected.available+' de '+expected.fields));
  assert.match(text,new RegExp('Puesto global: '+expected.rank));
  for(let i=0;i<5;i++)assert.ok((await matrix.locator('.sector-score strong').nth(i).innerText()).startsWith(expected.sectors[i]));
  await matrix.locator('['+geo+']').click();const detailId=mode==='absolute'?'priority-detail':mode==='percapita'?'percapita-detail':'relative-detail';
  assert.equal(await page.locator('#'+detailId).isVisible(),true);assert.match(await page.locator('#'+detailId).innerText(),/IPM/);
  snapshots.push({mode,...expected});
 }
 await page.selectOption('#affectation-mode','absolute');await page.locator('#matrix-search').fill('');
 const initial=await page.locator('#matrix [data-priority-geo]').evaluateAll(xs=>xs.map(x=>x.dataset.priorityGeo));
 const btn=page.locator('[data-sort-sector="educacion"]'),header=btn.locator('..');
 await btn.click();assert.equal(await header.getAttribute('aria-sort'),'descending');await btn.click();assert.equal(await header.getAttribute('aria-sort'),'ascending');await btn.click();assert.equal(await header.getAttribute('aria-sort'),'none');
 assert.deepEqual(await page.locator('#matrix [data-priority-geo]').evaluateAll(xs=>xs.map(x=>x.dataset.priorityGeo)),initial);
 for(const [mode,id]of [['percapita','percapita-matrix'],['sectorial','relative-matrix']]){
  await page.selectOption('#affectation-mode',mode);const button=page.locator('#'+id+' [data-relative-sort="educacion"]');
  for(const order of ['descending','ascending','none']){await button.click();assert.equal(await button.locator('..').getAttribute('aria-sort'),order);}
 }
 await page.selectOption('#scope','all');await page.selectOption('#dept','Risaralda');
 assert.equal(await page.locator('#priority-kpis .tile-sub').first().innerText(),'1 departamento afectado');
 await page.locator('#matrix-search').fill('ningun-municipio-xyz');assert.match(await page.locator('#relative-matrix').innerText(),/Sin municipios/);
 await page.locator('#matrix-search').fill('');await page.selectOption('#dept','');
 await page.locator('#tab-radar').click();
 await page.selectOption('#radar-select-0','municipal:66001');
 for(const prefix of ['radar','radar-percapita','radar-relative'])assert.equal(await page.locator('#'+prefix+'-chart svg').count(),1);
 for(const tab of ['rapida','diagnostico','metodo']){await page.locator('#tab-'+tab).click();assert.equal(await page.locator('#'+tab).isVisible(),true);}
 await page.locator('#tab-prioridades').click();await page.selectOption('#affectation-mode','sectorial');await page.locator('#matrix-search').fill('Pereira');
 if(await page.locator('#relative-close').isVisible())await page.locator('#relative-close').click();await page.locator('#profile-title').scrollIntoViewIfNeeded();
 await page.screenshot({path:path.join(output,'relative.png')});
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>window.scrollTo(0,0));
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'No desbordamiento de la página en móvil');
 await page.screenshot({path:path.join(output,'mobile.png')});
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({dataUnchanged:true,modelsUnchanged:true,errors,snapshots},null,2));
 await browser.close();console.log(JSON.stringify({dataUnchanged:true,modelsUnchanged:true,snapshots,errors},null,2));
})().catch(e=>{console.error(e);process.exit(1);});
