import { chromium } from 'playwright-core';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const PORT = 5201;
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = path.join('docs', 'audit', 'f5');

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 834, height: 1112 },
  { name: 'mobile', width: 390, height: 844 },
];

function startServer() {
  return spawn(process.execPath, [
    'node_modules/vite/bin/vite.js',
    '--config',
    'vite.config.f5.mjs',
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
      const res = await fetch(`${BASE}/dev/f5.html`);
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

async function checkOverflow(page, label) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 1) throw new Error(`${label}: desborde horizontal de ${overflow}px`);
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const server = startServer();
  let browser;

  try {
    await waitForServer(server);
    browser = await chromium.launch({ channel: 'msedge', headless: true });

    for (const viewport of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: 1,
        locale: 'es-BO',
      });
      const page = await context.newPage();
      const errors = [];
      page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
      page.on('pageerror', (err) => errors.push(err.message));

      await page.goto(`${BASE}/dev/f5.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForSelector('text=Nueva venta', { timeout: 20000 });
      await page.waitForTimeout(900);
      await page.evaluate(() => document.fonts.ready);
      await checkOverflow(page, `${viewport.name} venta`);
      await shot(page, path.join(OUT, `${viewport.name}-venta.png`), false);

      const arroz = page.getByRole('button', { name: /Arroz 1kg/ });
      if (await arroz.count()) {
        await (viewport.name === 'mobile' ? arroz.first() : arroz.last()).click();
        await page.waitForTimeout(500);
        await checkOverflow(page, `${viewport.name} carrito`);
        await shot(page, path.join(OUT, `${viewport.name}-carrito.png`), false);
      }

      await page.goto(`${BASE}/dev/f5.html?tab=reporte`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1200);
      await page.evaluate(() => document.fonts.ready);
      await checkOverflow(page, `${viewport.name} reporte`);
      await shot(page, path.join(OUT, `${viewport.name}-reporte.png`), false);

      if (errors.length) {
        console.log(`Consola ${viewport.name}: ${[...new Set(errors)].join(' | ')}`);
      }
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
