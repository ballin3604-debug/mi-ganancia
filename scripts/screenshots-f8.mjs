import { chromium } from 'playwright-core';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const PORT = 5204;
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = path.join('docs', 'audit', 'f8');

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 834, height: 1112 },
  { name: 'mobile', width: 390, height: 844 },
];

function startServer() {
  return spawn(process.execPath, [
    'node_modules/vite/bin/vite.js',
    '--config',
    'vite.config.f8.mjs',
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
    if (exited !== null) throw new Error(`vite dev termino antes (exit ${exited}). Salida:\n${output}`);
    try {
      const res = await fetch(`${BASE}/dev/f8.html`);
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

async function shot(page, target, fullPage = true) {
  await page.screenshot({ path: target, fullPage });
  console.log(`OK   -> ${path.relative(process.cwd(), target).replaceAll('\\', '/')}`);
}

async function openView(page, view, waitFor) {
  await page.goto(`${BASE}/dev/f8.html?view=${view}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector(waitFor, { timeout: 20000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });

  const server = startServer();
  let browser;
  const problems = [];

  try {
    await waitForServer(server);
    console.log('Vite dev listo en', BASE);

    browser = await chromium.launch({ channel: 'msedge', headless: true });

    for (const viewport of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: 1,
        locale: 'es-BO',
      });
      const page = await context.newPage();

      page.on('console', (msg) => {
        if (msg.type() === 'error') problems.push(`${viewport.name}: console: ${msg.text().slice(0, 300)}`);
      });
      page.on('pageerror', (err) => problems.push(`${viewport.name}: pageerror: ${String(err).slice(0, 300)}`));

      await openView(page, 'login', '#correo');
      await checkOverflow(page, `${viewport.name} login`);
      await shot(page, path.join(OUT, `${viewport.name}-login.png`));
      await page.getByRole('button', { name: 'Iniciar sesión' }).click();
      await page.getByRole('alert').filter({ hasText: 'Escribe tu correo electrónico.' }).waitFor({ timeout: 10000 });
      await checkOverflow(page, `${viewport.name} login-error`);
      await shot(page, path.join(OUT, `${viewport.name}-login-error.png`));

      await openView(page, 'onboarding', 'text=Vende en segundos');
      await checkOverflow(page, `${viewport.name} onboarding`);
      await shot(page, path.join(OUT, `${viewport.name}-onboarding-1.png`), false);
      await page.getByRole('button', { name: 'Continuar' }).click();
      await page.waitForSelector('text=Adiós cuaderno de stock', { timeout: 10000 });
      await page.waitForTimeout(350);
      await shot(page, path.join(OUT, `${viewport.name}-onboarding-2.png`), false);

      await openView(page, 'loading', 'text=Cargando');
      await checkOverflow(page, `${viewport.name} loading`);
      await shot(page, path.join(OUT, `${viewport.name}-loading.png`), false);

      await openView(page, 'splash', '.mg-splash');
      await page.waitForTimeout(700);
      await shot(page, path.join(OUT, `${viewport.name}-splash.png`), false);

      await openView(page, 'receipt', 'text=RECIBO');
      await checkOverflow(page, `${viewport.name} receipt`);
      await shot(page, path.join(OUT, `${viewport.name}-receipt.png`));

      if (viewport.name === 'desktop') {
        await page.evaluate(() => localStorage.setItem('mg_receipt_format', 'sheet'));
        const popupPromise = page.waitForEvent('popup', { timeout: 8000 }).catch(() => null);
        await page.getByRole('button', { name: 'Imprimir' }).click();
        const popup = await popupPromise;
        if (!popup) throw new Error('No se abrio la vista previa del recibo en hoja');
        await popup.waitForTimeout(120);
        await popup.screenshot({ path: path.join(OUT, 'desktop-receipt-sheet.png'), fullPage: true });
        console.log(`OK   -> ${path.join('docs', 'audit', 'f8', 'desktop-receipt-sheet.png')}`);
        await page.evaluate(() => localStorage.removeItem('mg_receipt_format'));
      }

      await openView(page, 'sync', '#sync-panel-title');
      await checkOverflow(page, `${viewport.name} sync`);
      await shot(page, path.join(OUT, `${viewport.name}-sync.png`), false);

      await context.close();
    }
  } finally {
    if (browser) await browser.close();
    killServer(server);
  }

  if (problems.length) {
    console.log('\nPROBLEMAS DETECTADOS:');
    for (const p of problems) console.log(' -', p);
    process.exitCode = 1;
  } else {
    console.log('\nSin errores de consola ni de pagina.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
