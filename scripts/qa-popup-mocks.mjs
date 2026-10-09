// Local-only QA and review evidence for the three paper reader experiments.
import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.FABLE_TEST_URL || 'http://localhost:8787';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname), 'Mocks are local only');
const evidence = process.env.FABLE_QA_EVIDENCE || '/private/tmp/fable-popup-mocks';
await mkdir(evidence, { recursive:true });
const browser = await chromium.launch({...(process.env.FABLE_CHROME?{executablePath:process.env.FABLE_CHROME}:{channel:'chrome'}),headless:true});
const errors=[], results=[];
const settle = async page => {
  await expect(page.locator('.pb-spread')).toHaveAttribute('data-turning','false');
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i=>i.decode().catch(()=>{}))); });
};
const shoot = (page,name) => page.screenshot({path:`${evidence}/${name}.png`});
async function open(context,variant,route='#read/cover') {
  const p=await context.newPage(); p.on('pageerror',e=>errors.push(e.message));
  await p.goto(`${base}/?reader=${variant}${route}`); await settle(p); return p;
}
async function turn(page,dir=1,mobile=false) {
  if(mobile) await page.locator('.pb-mobile-nav button').nth(dir>0?1:0).click();
  else await page.keyboard.press(dir>0?'ArrowRight':'ArrowLeft');
  await settle(page);
}
const expectedRoutes = page => page.evaluate(() => {
  const lang=document.documentElement.lang.split('-')[0];
  const pages=FABLE.buildPages(document.getElementById('source-md').textContent.trim(),lang), sections=[];
  pages.forEach(p=>{
    if(p.kind==='Cover') sections.push({type:'cover',page:p});
    else if(p.kind==='Story') {if(p.sceneIndex===0) sections.push({type:'chapter',page:p});sections.push({type:'scene',page:p});}
    else sections.push({type:'decode',page:p});
  });sections.push({type:'end',page:{}});return sections.map(sectionRoute);
});
async function route(page,value) { assert.equal(await page.evaluate(()=>location.hash),value); }
async function mechanismChecks(page) {
  await page.goto(`${base}/?reader=mechanics#read/scene/1/1`);await settle(page);
  const slider=page.getByRole('slider');await slider.focus();await page.keyboard.press('End');await expect(slider).toHaveAttribute('aria-valuenow','100');
  await page.keyboard.press('Home');await expect(slider).toHaveAttribute('aria-valuenow','0');
  const box=await slider.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+70,box.y+box.height/2,{steps:10});await page.mouse.up();
  assert.ok(Number(await slider.getAttribute('aria-valuenow'))>20);await route(page,'#read/scene/1/1');
  await page.locator('.pb-text').focus();await turn(page);const peek=page.locator('.pb-flap-control');await peek.click();await expect(peek).toHaveAttribute('aria-expanded','true');
  await peek.focus();await page.keyboard.press('Space');await expect(peek).toHaveAttribute('aria-expanded','false');
  await page.goto(`${base}/?reader=mechanics#read/explanation/1`);await settle(page);
  const flap=page.locator('.pb-flap-control');await flap.click();await expect(flap).toHaveAttribute('aria-expanded','true');
  await shoot(page,`mechanics-lifted-${page.viewportSize().width}`);
  await flap.focus();await page.keyboard.press('Enter');await expect(flap).toHaveAttribute('aria-expanded','false');
  await page.waitForTimeout(700);const f=await page.locator('.pb-lift').boundingBox();await page.mouse.move(f.x+f.width*.5,f.y+f.height*.7);await page.mouse.down();await page.mouse.move(f.x+f.width*.5,f.y+f.height*.7-65,{steps:10});await page.mouse.up();await expect(flap).toHaveAttribute('aria-expanded','true');
}
try {
  for(const variant of ['popup','tunnel','mechanics']) {
    for(const width of [1440,390]) {
      const context=await browser.newContext({viewport:{width,height:width===1440?1000:844},hasTouch:width===390});
      const page=await open(context,variant);
      await expect(page.locator('.pb-root')).toHaveAttribute('data-variant',variant);await expect(page.locator('.cine')).toHaveCount(0);
      const routes=await expectedRoutes(page);assert.equal(routes.length,14);
      if(width===390) {
        const cdp=await context.newCDPSession(page), box=await page.locator('.pb-picture').boundingBox();
        const x=box.x+box.width*.8,y=box.y+box.height-15;
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
        await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-100,y:y+2}]});
        await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
        await settle(page);await route(page,routes[1]);await turn(page,-1,true);
      }
      await shoot(page,`${variant}-${width}-cover`);
      for(let i=1;i<routes.length;i++) {
        if(i===2) {
          await page.clock.install();await page.keyboard.press('ArrowRight');await page.clock.runFor(450);await shoot(page,`${variant}-${width}-mid-turn`);await page.clock.runFor(900);await page.clock.resume();await settle(page);
        } else await turn(page,1,width<900);
        await route(page,routes[i]);
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
        assert.equal(await page.locator('.pb-root').evaluate(e=>e.scrollTop),0);
        const textBox=await page.locator('.pb-text').boundingBox();
        assert.ok(textBox.y>=64 && textBox.y+textBox.height<=page.viewportSize().height-90, 'Text stays between toolbar and navigation');
        if(i===2 || i===routes.length-2 || i===routes.length-1) await shoot(page,`${variant}-${width}-${i===2?'scene':i===routes.length-2?'decode':'end'}`);
      }
      await turn(page,-1,width<900);await route(page,routes.at(-2));
      // Long explanation must scroll before Space can turn it away.
      await page.locator('.pb-text').focus();await page.keyboard.press('Space');await page.waitForTimeout(500);
      assert.ok(await page.locator('.pb-text').evaluate(e=>e.scrollTop>0));await route(page,routes.at(-2));
      assert.equal(await page.evaluate(()=>sessionStorage.getItem('fable-reading-place')),null);
      if(variant==='mechanics') await mechanismChecks(page);
      if(variant==='tunnel'&&width===1440) {
        await page.goto(`${base}/?reader=tunnel#read/scene/1/1`);await settle(page);
        const stack=page.locator('.pb-tunnel');const before=await stack.evaluate(e=>getComputedStyle(e).transform);const b=await stack.boundingBox();
        await page.mouse.move(b.x+b.width*.8,b.y+b.height*.2);await page.waitForTimeout(350);assert.notEqual(await stack.evaluate(e=>getComputedStyle(e).transform),before);
      }
      results.push(`PASS ${variant} ${width}: routes, forward/back, overflow, long text, evidence, no reading-storage writes`);await context.close();
    }
    for(const settings of [{reducedMotion:'reduce'},{locale:'zh'},{theme:'light'}]) {
      const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:settings.reducedMotion});
      await context.addInitScript(s=>{if(s.locale)localStorage.setItem('fable-lang',s.locale);if(s.theme)localStorage.setItem('fable-theme',s.theme);},settings);
      const p=await open(context,variant,'#read/scene/1/1');
      if(settings.reducedMotion) {
        await p.keyboard.press('ArrowRight');await route(p,'#read/scene/1/2');assert.equal(await p.locator('.pb-spread').evaluate(e=>getComputedStyle(e).getPropertyValue('--open').trim()),'1');await expect(p.locator('.pb-spread')).toHaveAttribute('data-turning','false');
      } else await shoot(p,`${variant}-${settings.locale||settings.theme}`);
      await context.close();
    }
    // A short real browser recording: cover → chapter → two scenes → explanation.
    const context=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:evidence,size:{width:1440,height:1000}}});
    const p=await open(context,variant);await p.waitForTimeout(700);
    for(let i=0;i<3;i++){await turn(p);await p.waitForTimeout(600);}
    if(variant==='mechanics') {await p.locator('.pb-flap-control').click();await p.waitForTimeout(600);}
    await p.getByRole('button',{name:'Contents',exact:true}).click();await p.getByRole('dialog').getByRole('button').filter({hasText:'Explanation'}).click();await settle(p);
    if(variant==='mechanics') await p.locator('.pb-flap-control').click();
    await p.waitForTimeout(1200);const video=p.video();await context.close();await video.saveAs(`${evidence}/${variant}-walkthrough.webm`);
    results.push(`PASS ${variant}: reduced motion, Chinese, light theme, recorded walkthrough`);
  }
  // Narrow locales, routing fallback, contents/guide, switching, original isolation.
  for(const lang of ['en','fr','da','zh']) {
    const context=await browser.newContext({viewport:{width:320,height:844},reducedMotion:'reduce'});await context.addInitScript(l=>localStorage.setItem('fable-lang',l),lang);
    const p=await open(context,'popup','#read/explanation/1');
    assert.ok(await p.locator('.pb-top button,.pb-top select,.pb-mobile-nav button,.pb-switch select').evaluateAll(els=>els.every(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;})));
    await shoot(p,`narrow-${lang}`);await context.close();
  }
  const context=await browser.newContext({reducedMotion:'reduce'});const p=await open(context,'popup','#read/scene/1/10');
  await p.getByRole('combobox',{name:'Language',exact:true}).selectOption('zh');await settle(p);await route(p,'#read/cover');
  await p.getByRole('combobox',{name:'语言',exact:true}).selectOption('en');await settle(p);
  await p.getByRole('button',{name:'Contents',exact:true}).click();await expect(p.getByRole('dialog')).toBeVisible();await p.getByRole('button',{name:'Guide me',exact:true}).click();await expect(p.getByRole('dialog')).toContainText('Read by scrolling');await p.keyboard.press('Escape');
  await turn(p);await p.getByRole('link',{name:'B Tunnel Book'}).click();await settle(p);await route(p,'#read/chapter/1');await p.goBack();await settle(p);await expect(p.locator('.pb-root')).toHaveAttribute('data-variant','popup');
  for(const query of ['', '?reader=original','?reader=unknown','?reader=constructor','?reader=toString']) {await p.goto(`${base}/${query}#read/cover`);await expect(p.locator('.cine')).toBeVisible();await expect(p.locator('.pb-root')).toHaveCount(0);assert.equal(await p.locator('style').evaluateAll(styles=>styles.some(s=>s.textContent.includes('.pb-root'))),false);}
  await context.close();assert.deepEqual(errors,[]);
  results.push('PASS narrow four-language controls, locale route fallback, guide, switcher/history, original isolation; no browser errors');
  await writeFile(`${evidence}/results.txt`,results.join('\n')+'\n');console.log(results.join('\n'));
} finally {await browser.close();}
