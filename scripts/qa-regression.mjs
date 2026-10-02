// Regression: ISSUE-001 through ISSUE-004, preference loss, tour dead end, keyboard interception, unnamed controls.
// Found by /qa on 2026-10-02.
// Report: .gstack/qa-reports/qa-report-fable-2026-10-02.md
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const base = process.env.FABLE_TEST_URL || 'http://localhost:8787';
const evidence = process.env.FABLE_QA_EVIDENCE;
if (evidence) await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [];
try {
  for (const width of [390, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    page.setDefaultTimeout(15000);
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.locator('textarea').waitFor();
    // Dismiss the first-visit tour before independently exercising the form.
    await page.waitForTimeout(1100);
    const closeGuide = page.getByRole('button', { name: 'Close guide', exact: true });
    if (await closeGuide.count()) await closeGuide.click();
    assert.equal(await page.getByRole('textbox', { name: 'What should we explain?' }).count(), 1);
    for (const lang of ['fr', 'da', 'zh', 'en']) {
      await page.getByRole('combobox', { name: 'Language' }).selectOption(lang);
      await page.getByRole('button', { name: 'Switch to light', exact: true }).click();
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.locator('textarea').waitFor();
      assert.equal(await page.getByRole('combobox').inputValue(), lang);
      assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
      await page.getByRole('button', { name: 'Switch to dark', exact: true }).click();
    }
    await page.getByRole('button', { name: 'Guide me', exact: true }).click();
    const guide = page.getByRole('dialog');
    await guide.getByRole('button', { name: 'Next', exact: true }).click();
    await guide.getByRole('button', { name: 'Next', exact: true }).click();
    assert.match(await guide.innerText(), /Explore the sample book/);
    if (evidence) await page.screenshot({ path: `${evidence}/tour-after-${width}.png` });
    await guide.getByRole('button', { name: 'Finish', exact: true }).click();
    assert.equal(await page.getByRole('dialog').count(), 0);
    await page.getByRole('button', { name: 'Guide me', exact: true }).click();
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('dialog').count(), 0);
    await page.locator('.cine-nowshowing').click();
    const language = page.getByRole('combobox', { name: 'Language' });
    await language.focus();
    await page.evaluate(() => {
      window.__qaKeys = [];
      window.addEventListener('keydown', event => window.__qaKeys.push({ key: event.key, prevented: event.defaultPrevented }));
    });
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => window.__qaKeys.some(event => event.key === 'ArrowDown' && !event.prevented)), true);
    await language.selectOption('fr');
    assert.equal(await language.inputValue(), 'fr');
    assert.equal(await page.locator('.cine').evaluate(el => el.scrollTop), 0);
    await language.selectOption('en');
    if (width >= 768) {
      const rail = page.getByRole('navigation', { name: 'Contents' });
      await rail.getByRole('button', { name: 'Title page' }).waitFor();
      assert.equal(await rail.getByRole('button', { name: 'The Hall of Affairs' }).count(), 1);
    } else {
      assert.equal(await page.locator('.cine-rail').isVisible(), false);
    }
    await page.getByRole('button', { name: 'Contents', exact: true }).click();
    const contents = page.getByRole('dialog', { name: 'Contents', exact: true });
    assert.equal(await contents.getByRole('button', { name: 'Close', exact: true }).evaluate(el => el === document.activeElement), true);
    await page.keyboard.press('Shift+Tab');
    assert.equal(await contents.locator('button').last().evaluate(el => el === document.activeElement), true);
    await page.keyboard.press('Tab');
    assert.equal(await contents.getByRole('button', { name: 'Close', exact: true }).evaluate(el => el === document.activeElement), true);
    if (evidence) await page.screenshot({ path: `${evidence}/contents-after-${width}.png` });
    await page.keyboard.press('Escape');
    assert.equal(await contents.count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Contents', exact: true }).evaluate(el => el === document.activeElement), true);
    console.log(`PASS ${width}px: saved preferences, tour completion/Escape, unintercepted keyboard selection, modal focus, accessible names.`);
    await page.close();
  }
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
