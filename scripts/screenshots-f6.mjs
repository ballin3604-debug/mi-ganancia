import { chromium } from 'playwright-core';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const PORT = 5202;
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = path.join('docs', 'audit', 'f6');

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 834, height: 1112 },
  { name: 'mobile', width: 390, height: 844 },
];

const REPORTS = ['profit', 'expenses', 'inventory', 'ranking', 'costoVendido'];

function iso(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const end = new Date();
const start = new Date(end);
start.setDate(end.getDate() - 5);
const range = `start=${iso(start)}&end=${iso(end)}`;

function startServer() {
  return spawn(process.execPath, [
    'node_modules/vite/bin/vite.js',
    '--config',
    'vite.config.f6.mjs',
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
  const started = Date.now();
  let exited = null;
  let output = '';
  server.stdout.on('data', (d) => { output += d.toString(); });
  server.stderr.on('data', (d) => { output += d.toString(); });
  server.on('exit', (code) => { exited = code; });
  while (Date.now() - started < timeoutMs) {
    if (exited !== null) {
      throw new Error(`vite dev termino antes (exit ${exited}). Salida:\n${output}`);
    }
    try {
      const res = await fetch(`${BASE}/dev/f6.html`);
      if (res.ok) return output;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`vite dev no respondio a tiempo. Salida:\n${output}`);
}

async function checkOverflow(page, label) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 1) throw new Error(`${label}: desborde horizontal de ${overflow}px`);
}

async function shot(page, target, fullPage = false) {
  await page.screenshot({ path: target, fullPage });
  console.log(`OK   -> ${path.relative(process.cwd(), target).replaceAll('\\', '/')}`);
}

async function openReport(page, type) {
  await page.goto(`${BASE}/dev/f6.html?type=${type}&${range}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('h1', { timeout: 20000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => document.fonts.ready);
}

async function captureKardex(page, viewport) {
  const opened = await page.evaluate(() => {
    const candidates = Array.from(document.querySelectorAll('p, button'));
    const target = candidates.find((node) => node.textContent.includes('Coca-Cola 2L') && node.getClientRects().length > 0);
    if (!target) return false;
    target.click();
    return true;
  });
  if (!opened) return;
  await page.getByRole('dialog', { name: /Kardex del producto/ }).waitFor({ timeout: 10000 });
  await page.waitForTimeout(350);
  await checkOverflow(page, `${viewport.name} kardex`);
  await shot(page, path.join(OUT, `${viewport.name}-inventory-kardex.png`));
  await page.getByLabel('Cerrar kardex').click();
  await page.waitForTimeout(250);
}

async function capturePdfPreview(page, context) {
  const popupPromise = context.waitForEvent('page');
  await page.getByRole('button', { name: /Exportar PDF/ }).click();
  const popup = await popupPromise;
  await popup.setViewportSize({ width: 900, height: 700 });
  await popup.waitForLoadState('domcontentloaded');
  await popup.waitForTimeout(600);
  await shot(popup, path.join(OUT, 'desktop-pdf-preview.png'), true);
  await popup.close();
}

async function captureDayDetail(page, viewport) {
  if (viewport.name === 'desktop') {
    await page.locator('tr[title="Ver detalle del día"]').first().click();
  } else {
    await page.locator('[role="button"]').filter({ hasText: /Vendido Bs/ }).filter({ visible: true }).first().click();
  }
  await page.getByRole('dialog', { name: /Detalle de ganancia/ }).waitFor({ timeout: 10000 });
  await page.waitForTimeout(350);
  await checkOverflow(page, `${viewport.name} detalle del día`);
  await shot(page, path.join(OUT, `${viewport.name}-profit-detail.png`));
  await page.getByLabel('Cerrar detalle del día').click();
  await page.waitForTimeout(250);
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
      await context.addInitScript(() => {
        window.print = () => {};
        window.close = () => {};
      });
      const page = await context.newPage();
      const errors = [];
      page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
      page.on('pageerror', (err) => errors.push(err.message));

      for (const report of REPORTS) {
        await openReport(page, report);
        await checkOverflow(page, `${viewport.name} ${report}`);
        await shot(page, path.join(OUT, `${viewport.name}-${report}.png`), viewport.name === 'mobile');

        if (report === 'inventory') await captureKardex(page, viewport);
        if (report === 'profit') await captureDayDetail(page, viewport);
      }

      if (viewport.name === 'desktop') {
        await openReport(page, 'profit');
        await capturePdfPreview(page, context);
      }

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
