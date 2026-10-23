import { chromium } from 'playwright-core';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const logs = [];
page.on('console', (m) => logs.push(`${m.type()}: ${m.text()}`));
page.on('pageerror', (e) => logs.push(`pageerror: ${e.stack || e}`));
await page.goto('http://127.0.0.1:5203/dev/f7.html?view=expenses', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(3000);
console.log('BODY:', (await page.locator('body').innerText()).slice(0, 1000));
console.log('LOGS:\n' + logs.join('\n'));
await browser.close();
