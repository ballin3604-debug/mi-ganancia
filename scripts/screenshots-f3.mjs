import { chromium } from 'playwright-core';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const PORT = 5199;
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = 'docs/audit/f3';
const PAGE_URL = `${BASE}/dev/f3.html`;

function startServer() {
  return spawn(process.execPath, [
    'node_modules/vite/bin/vite.js',
    '--config',
    'vite.config.f3.mjs',
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
      const res = await fetch(PAGE_URL);
      if (res.ok) return output;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`vite dev no respondio a tiempo. Salida:\n${output}`);
}

async function shot(page, target) {
  await page.screenshot({ path: target, fullPage: false });
  console.log(`OK   -> ${path.relative(process.cwd(), target).replaceAll('\\', '/')}`);
}

async function newPage(browser, viewport, videoOpts = {}) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, locale: 'es-BO', ...videoOpts });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  return { context, page, errors };
}

async function checkNoOverflow(page, label) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 1) {
    throw new Error(`${label}: desborde horizontal de ${overflow}px`);
  }
}

async function checkTouchTargets(page, label) {
  const box = await page.locator('button[aria-label="Abrir menú"]').boundingBox();
  if (!box || box.width < 44 || box.height < 44) {
    throw new Error(`${label}: boton de menu menor a 44x44 (${box?.width}x${box?.height})`);
  }
  const tabs = await page.locator('nav[aria-label="Accesos rápidos"] a').all();
  for (const tab of tabs) {
    const b = await tab.boundingBox();
    if (!b || b.height < 44) {
      throw new Error(`${label}: tab inferior menor a 44px de alto (${b?.height})`);
    }
  }
}

async function main() {
  for (const dir of ['desktop', 'tablet', 'mobile']) {
    await fs.mkdir(path.join(OUT, dir), { recursive: true });
  }

  const server = startServer();
  let browser;

  try {
    await waitForServer(server);
    console.log('Vite dev listo en', BASE);

    browser = await chromium.launch({ channel: 'msedge', headless: true });

    {
      const { context, page, errors } = await newPage(browser, { width: 1440, height: 900 });
      await page.goto(`${PAGE_URL}?route=/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForSelector('nav[aria-label="Navegación principal"]', { timeout: 20000 });
      await page.waitForTimeout(1200);
      await shot(page, path.join(OUT, 'desktop', 'sidebar-inicio.png'));
      await checkNoOverflow(page, 'desktop inicio');

      await page.goto(`${PAGE_URL}?route=/inventario`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForSelector('nav[aria-label="Navegación principal"]', { timeout: 20000 });
      await page.waitForTimeout(900);
      await shot(page, path.join(OUT, 'desktop', 'sidebar-inventario.png'));

      await page.locator('button[aria-label="Contraer menú"]').focus();
      await page.waitForTimeout(300);
      await shot(page, path.join(OUT, 'desktop', 'sidebar-focus.png'));

      if (errors.length) console.log('Consola desktop:', [...new Set(errors)].join(' | '));
      await context.close();
    }

    {
      const { context, page, errors } = await newPage(browser, { width: 1440, height: 900 });
      await page.addInitScript(() => localStorage.setItem('mg-sidebar-open', 'false'));
      await page.goto(`${PAGE_URL}?route=/inventario`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForSelector('nav[aria-label="Navegación principal"]', { timeout: 20000 });
      await page.waitForTimeout(900);
      await shot(page, path.join(OUT, 'desktop', 'sidebar-colapsada.png'));
      await checkNoOverflow(page, 'desktop colapsada');
      if (errors.length) console.log('Consola desktop colapsada:', [...new Set(errors)].join(' | '));
      await context.close();
    }

    {
      const { context, page, errors } = await newPage(browser, { width: 834, height: 1112 });
      await page.goto(`${PAGE_URL}?route=/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForSelector('nav[aria-label="Accesos rápidos"]', { timeout: 20000 });
      await page.waitForTimeout(900);
      await shot(page, path.join(OUT, 'tablet', 'header-tabbar.png'));
      await checkNoOverflow(page, 'tablet');

      await page.locator('button[aria-label="Abrir menú"]').click();
      await page.waitForTimeout(600);
      const locked = await page.evaluate(() => document.body.style.overflow === 'hidden');
      if (!locked) throw new Error('tablet: el drawer no bloqueo el scroll del body');
      await checkTouchTargets(page, 'tablet drawer abierto');
      await shot(page, path.join(OUT, 'tablet', 'drawer.png'));
      if (errors.length) console.log('Consola tablet:', [...new Set(errors)].join(' | '));
      await context.close();
    }

    {
      const { context, page, errors } = await newPage(browser, { width: 390, height: 844 });
      await page.goto(`${PAGE_URL}?route=/ventas`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForSelector('nav[aria-label="Accesos rápidos"]', { timeout: 20000 });
      await page.waitForTimeout(900);
      await shot(page, path.join(OUT, 'mobile', 'header-tabbar-ventas.png'));
      await checkNoOverflow(page, 'mobile');
      await checkTouchTargets(page, 'mobile');

      await page.locator('button[aria-label="Abrir menú"]').click();
      await page.waitForTimeout(600);
      await shot(page, path.join(OUT, 'mobile', 'drawer.png'));
      const activeRows = await page.locator('nav[aria-label="Secciones"] a[aria-current="page"]').count();
      if (activeRows !== 1) throw new Error(`mobile drawer: se esperaba 1 fila activa, hay ${activeRows}`);
      if (errors.length) console.log('Consola mobile:', [...new Set(errors)].join(' | '));
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
