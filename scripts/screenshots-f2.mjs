import { chromium } from 'playwright-core';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const PORT = 5199;
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = 'docs/audit/f2';
const PAGE_URL = `${BASE}/dev/showcase.html`;

function startServer() {
  return spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, BROWSER: 'none' },
  });
}

function killServer(child) {
  if (!child || child.killed) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    child.kill('SIGTERM');
  }
}

async function waitForServer(server, timeoutMs = 40000) {
  const start = Date.now();
  let exited = null;
  let output = '';
  server.stdout.on('data', (d) => { output += d.toString(); });
  server.stderr.on('data', (d) => { output += d.toString(); });
  server.on('exit', (code) => { exited = code; });
  while (Date.now() - start < timeoutMs) {
    if (exited !== null) {
      throw new Error(`vite dev termino antes (exit ${exited}). Salida:\n${output}`);
    }
    try {
      const res = await fetch(PAGE_URL);
      if (res.ok) return output;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`vite dev no respondio a tiempo. Salida:\n${output}`);
}

async function shot(page, target, fullPage = true) {
  await page.screenshot({ path: target, fullPage });
  console.log(`OK   -> ${path.relative(process.cwd(), target).replaceAll('\\', '/')}`);
}

async function newPage(browser, viewport) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, locale: 'es-BO' });
  const page = await context.newPage();
  return { context, page };
}

async function main() {
  for (const dir of ['desktop', 'mobile']) {
    await fs.mkdir(path.join(OUT, dir), { recursive: true });
  }

  const server = startServer();

  let browser;
  try {
    await waitForServer(server);
    console.log('Vite dev listo en', BASE);

    browser = await chromium.launch({ channel: 'msedge', headless: true });

    {
      const { context, page } = await newPage(browser, { width: 1440, height: 900 });
      await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForSelector('#estados', { timeout: 20000 });
      await page.waitForTimeout(1500);
      await shot(page, path.join(OUT, 'desktop', 'showcase.png'));

      await page.locator('#btn-primary').scrollIntoViewIfNeeded();
      await page.hover('#btn-primary');
      await page.waitForTimeout(400);
      await shot(page, path.join(OUT, 'desktop', 'estado-hover.png'), false);

      await page.locator('#input-demo').focus();
      await page.waitForTimeout(400);
      await shot(page, path.join(OUT, 'desktop', 'estado-focus.png'), false);
      await context.close();
    }

    {
      const { context, page } = await newPage(browser, { width: 1440, height: 900 });
      await page.goto(`${PAGE_URL}?view=logout`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(1500);
      await shot(page, path.join(OUT, 'desktop', 'logout-modal.png'), false);
      await context.close();
    }

    {
      const { context, page } = await newPage(browser, { width: 390, height: 844 });
      await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForSelector('#estados', { timeout: 20000 });
      await page.waitForTimeout(1500);
      await shot(page, path.join(OUT, 'mobile', 'showcase.png'));
      await context.close();
    }

    {
      const { context, page } = await newPage(browser, { width: 390, height: 844 });
      await page.goto(`${PAGE_URL}?view=logout`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(1500);
      await shot(page, path.join(OUT, 'mobile', 'logout-modal.png'), false);
      await context.close();
    }
  } finally {
    if (browser) await browser.close();
    killServer(server);
  }
}

main().catch((err) => {
  console.error(`ERROR: ${err.message}`);
  process.exit(1);
});
