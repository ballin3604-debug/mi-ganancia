import { chromium } from 'playwright-core';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const PHASE = process.argv[2] === 'after' ? 'after' : 'before';
const PORT = 5199;
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = path.join('docs', 'audit', 'f4', PHASE);

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 834, height: 1112 },
  { name: 'mobile', width: 390, height: 844 },
];

function startServer() {
  return spawn(process.execPath, [
    'node_modules/vite/bin/vite.js',
    '--config',
    'vite.config.f4.mjs',
    '--port',
    String(PORT),
    '--strictPort',
    '--host',
    '127.0.0.1',
  ], {
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
      const res = await fetch(`${BASE}/dev/f4.html`);
      if (res.ok) return output;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`vite dev no respondio a tiempo. Salida:\n${output}`);
}

async function shot(page, target, fullPage) {
  await page.screenshot({ path: target, fullPage });
  console.log(`OK   -> ${path.relative(process.cwd(), target).replaceAll('\\', '/')}`);
}

async function main() {
  for (const viewport of VIEWPORTS) {
    for (const role of ['owner', 'cashier']) {
      await fs.mkdir(path.join(OUT, role), { recursive: true });
    }
  }

  const server = startServer();
  let browser;

  try {
    await waitForServer(server);
    console.log('Vite dev listo en', BASE, '· fase', PHASE);

    browser = await chromium.launch({ channel: 'msedge', headless: true });

    for (const viewport of VIEWPORTS) {
      for (const role of ['owner', 'cashier']) {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          deviceScaleFactor: 1,
          locale: 'es-BO',
        });
        const page = await context.newPage();
        const errors = [];
        page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
        page.on('pageerror', (err) => errors.push(err.message));

        await page.goto(`${BASE}/dev/f4.html?role=${role}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForSelector(role === 'owner' ? 'text=Resumen del día' : 'text=Nueva venta', { timeout: 20000 });
        await page.waitForTimeout(1800);
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(400);

        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        if (overflow > 1) throw new Error(`${role} ${viewport.name}: desborde horizontal de ${overflow}px`);

        await shot(page, path.join(OUT, role, `${viewport.name}-fold.png`), false);
        await shot(page, path.join(OUT, role, `${viewport.name}.png`), true);

        if (viewport.name === 'desktop' && role === 'owner') {
          const qrButton = page.getByRole('button', { name: 'Ver código QR de cobro' });
          if (await qrButton.count()) {
            await qrButton.click();
            await page.waitForSelector('text=QR de Cobro', { timeout: 5000 });
            await page.waitForTimeout(300);
            await shot(page, path.join(OUT, role, 'desktop-qr.png'), false);
            await page.keyboard.press('Escape');
            await page.waitForTimeout(200);
          }
        }

        if (viewport.name === 'desktop' && role === 'cashier') {
          const receiptRow = page.locator('li button').filter({ hasText: 'Consumidor final' }).first();
          if (await receiptRow.count()) {
            await receiptRow.click();
            await page.waitForTimeout(300);
            await shot(page, path.join(OUT, role, 'desktop-receipt.png'), false);
          }
        }

        if (errors.length) {
          console.log(`Consola ${role} ${viewport.name}: ${[...new Set(errors)].join(' | ')}`);
        }
        await context.close();
      }
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
