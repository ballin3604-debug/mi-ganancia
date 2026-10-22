import { chromium } from 'playwright-core';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

// Capturas autenticadas de F3. Requiere E2E_EMAIL y E2E_PASSWORD en el entorno
// (o en .env). Nunca imprime las credenciales. No crea cuentas ni modifica datos:
// solo inicia sesión y navega por las pantallas ya existentes.
const PORT = 5199;
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = 'docs/audit/f3-auth';

async function loadEnvFile() {
  try {
    const raw = await fs.readFile('.env', 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {}
}

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

async function waitForServer(timeoutMs = 40000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(BASE);
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('vite dev no respondio a tiempo');
}

async function shot(page, target) {
  await page.screenshot({ path: target, fullPage: false });
  console.log(`OK   -> ${path.relative(process.cwd(), target).replaceAll('\\', '/')}`);
}

async function login(page) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('input[type="email"]', { timeout: 20000 });
  await page.fill('input[type="email"]', process.env.E2E_EMAIL);
  await page.fill('input[type="password"]', process.env.E2E_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForSelector('button[aria-label="Abrir menú"], nav[aria-label="Navegación principal"]', { timeout: 30000 });
  await page.waitForTimeout(1800);
}

async function main() {
  await loadEnvFile();
  if (!process.env.E2E_EMAIL || !process.env.E2E_PASSWORD) {
    console.log('OMITIDO: define E2E_EMAIL y E2E_PASSWORD para capturas autenticadas de F3.');
    return;
  }

  for (const dir of ['desktop', 'tablet', 'mobile']) {
    await fs.mkdir(path.join(OUT, dir), { recursive: true });
  }

  const server = startServer();
  let browser;

  try {
    await waitForServer();
    browser = await chromium.launch({ channel: 'msedge', headless: true });

    {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'es-BO' });
      const page = await context.newPage();
      await login(page);
      await shot(page, path.join(OUT, 'desktop', 'inicio.png'));

      await page.goto(`${BASE}/inventario`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);
      await shot(page, path.join(OUT, 'desktop', 'inventario.png'));

      await page.locator('button[aria-label="Contraer menú"]').click();
      await page.waitForTimeout(500);
      await shot(page, path.join(OUT, 'desktop', 'sidebar-colapsada.png'));
      await context.close();
    }

    {
      const context = await browser.newContext({ viewport: { width: 834, height: 1112 }, locale: 'es-BO' });
      const page = await context.newPage();
      await login(page);
      await shot(page, path.join(OUT, 'tablet', 'header-tabbar.png'));
      await page.locator('button[aria-label="Abrir menú"]').click();
      await page.waitForTimeout(600);
      await shot(page, path.join(OUT, 'tablet', 'drawer.png'));
      await context.close();
    }

    {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-BO' });
      const page = await context.newPage();
      await login(page);
      await page.goto(`${BASE}/ventas`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);
      await shot(page, path.join(OUT, 'mobile', 'ventas-tabbar.png'));
      await page.locator('button[aria-label="Abrir menú"]').click();
      await page.waitForTimeout(600);
      await shot(page, path.join(OUT, 'mobile', 'drawer.png'));
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
