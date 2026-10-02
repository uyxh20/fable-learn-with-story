import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const base = process.env.FABLE_TEST_URL || 'http://localhost:8787';
const errors = [];
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => localStorage.setItem('fable-tour-v1-done', '1'));
    await page.goto(base);
    await page.locator('[data-ob="concept"]').waitFor();
    await page.locator('[data-ob="concept"]').fill('How does gravity work?');
    assert.equal(await page.locator('[data-ob="weave"]').isDisabled(), true);
    assert.match(await page.locator('[role="status"]').textContent(), /coming soon/);
    await page.locator('.cine-nowshowing').click();
    await page.waitForFunction(() => window.__fableScreen === 'reader');
    await page.waitForFunction(() => [...document.images].every(img => img.complete && img.naturalWidth > 0), undefined, { timeout: 60000 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    const missing = await page.locator('img').evaluateAll(imgs => imgs.filter(i => !i.complete || i.naturalWidth === 0).map(i => i.src));
    assert.deepEqual(missing, []);
    await page.screenshot({ path: `/private/tmp/fable-${width}.png` });
    const api = await page.request.post(`${base}/api/generations`, { data: { concept: 'test' } });
    assert.equal(api.status(), 503);
    const hidden = await page.request.get(`${base}/.dev.vars`);
    assert.equal(hidden.status(), 404);
    await page.close();
  }
  assert.deepEqual(errors, []);
  console.log('PASS: desktop/mobile reader, artwork, disabled generation, API guard and hidden files; no browser errors.');
} finally { await browser.close(); }
