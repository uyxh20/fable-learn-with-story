import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const base = process.env.FABLE_TEST_URL || 'http://localhost:8787';
try {
  for (const width of [320, 768]) for (const lang of ['en', 'fr', 'da', 'zh']) {
    const page = await browser.newPage({ viewport: { width, height: 844 } });
    await page.addInitScript(l => localStorage.setItem('fable-lang', l), lang);
    await page.goto(`${base}/#read/explanation/1`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const bounds = await page.locator('.cine-bar button, .cine-bar select').evaluateAll(els => els.map(el => {
      const r = el.getBoundingClientRect(); return { label: el.getAttribute('aria-label') || el.innerText, left: r.left, right: r.right };
    }));
    assert.ok(bounds.every(r => r.left >= 0 && r.right <= width), JSON.stringify({ width, lang, bounds }));
    await page.close();
  }
  console.log('PASS 320px and 768px: all four locales keep toolbar controls inside the viewport.');
} finally { await browser.close(); }
