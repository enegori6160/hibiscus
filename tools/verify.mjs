import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { chromium } from '../.verification/node_modules/playwright/index.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = resolve(root, 'dist');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const htmlFiles = (await readdir(dist)).filter(name => name.endsWith('.html'));
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const name of htmlFiles.filter(name => name !== '404.html')) {
      await page.goto(pathToFileURL(resolve(dist, name)).href);
      await page.waitForTimeout(100);
      assert.equal(await page.locator('meta[name="description"]').count(), 1, name);
      assert.equal(await page.locator('meta[name="google-adsense-account"]').getAttribute('content'), 'ca-pub-4931880787884929');
      assert.equal(await page.locator('script[src*="adsbygoogle"]').count(), 0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, name + ' overflows at ' + width);
      const hrefs = await page.locator('a[href]').evaluateAll(links => links.map(link => link.getAttribute('href')));
      for (const href of hrefs.filter(href => !/^(https?:|#|mailto:)/.test(href))) {
        assert.ok(htmlFiles.includes(href.split('#')[0]), name + ': missing ' + href);
      }
      if (name === 'index.html') await page.screenshot({ path: resolve(root, '.verification/game-' + width + '.png'), fullPage: true });
    }
  }
  await page.goto(pathToFileURL(resolve(dist, 'index.html')).href);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('currentCoins', '0');
    localStorage.setItem('playCount', '49');
    localStorage.setItem('soundEnabled', 'false');
  });
  await page.reload();
  // A saved zero must remain zero so the refill flow is reachable.
  assert.equal(await page.evaluate(() => window._game.coin), 0);
  assert.equal(await page.evaluate(() => window.AdService.getState().playCount), 49);
  await page.locator('#betButton').click();
  assert.equal(await page.locator('dialog').evaluate(el => el.open), true);
  await page.locator('[data-refill]').click();
  assert.equal(await page.evaluate(() => window._game.coin), 50);
  // Select REG deterministically from setting 1's disjoint probability ranges.
  await page.evaluate(() => { Math.random = () => 0.004; });
  await page.locator('#betButton').click();
  await page.locator('#lever').click();
  for (const id of ['#stop0', '#stop1', '#stop2']) await page.locator(id).click();
  await page.waitForFunction(() => !document.querySelector('#betButton').disabled);
  assert.equal(await page.evaluate(() => window._game.coin), 167);
  assert.match(await page.locator('#message').innerText(), /120/);
  assert.equal(await page.evaluate(() => window.AdService.getState().playCount), 50);
  assert.equal(await page.evaluate(() => window.AdService.isAnyAdOpen()), false);
  assert.equal(await page.evaluate(() => window.AdService.showInterstitialAd()), false);
  const coins = await page.evaluate(() => window._game.coin);
  await page.reload();
  assert.equal(await page.evaluate(() => window._game.coin), coins);
  assert.equal(await page.evaluate(() => window.AdService.getState().playCount), 50);
  await page.evaluate(() => { window._game.coin = 0; });
  await page.locator('#betButton').click();
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => window.AdService.isAnyAdOpen()), false);
  await page.locator('#betButton').click();
  await page.locator('[data-refill]').click();
  assert.equal(await page.evaluate(() => window._game.coin), 50);
  await page.locator('a[href="settings-guide.html"]').first().focus();
  await page.keyboard.press('Enter');
  await page.waitForURL('**/settings-guide.html');
  assert.ok(page.url().endsWith('settings-guide.html'));
  assert.deepEqual(errors, []);
  const ads = await readFile(resolve(dist, 'ads.txt'), 'utf8');
  assert.equal(ads.trim(), 'google.com, pub-4931880787884929, DIRECT, f08c47fec0942fa0');
  console.log('PASS: 9 pages at 3 widths, links, metadata, refill, round 50, persistence, keyboard navigation, no JS errors.');
} finally {
  await browser.close();
}
