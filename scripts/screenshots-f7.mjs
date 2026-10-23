import { chromium } from 'playwright-core';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const PORT = 5203;
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = path.join('docs', 'audit', 'f7');

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 834, height: 1112 },
  { name: 'mobile', width: 390, height: 844 },
];

function startServer() {
  return spawn(process.execPath, [
    'node_modules/vite/bin/vite.js',
    '--config',
    'vite.config.f7.mjs',
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
      const res = await fetch(`${BASE}/dev/f7.html`);
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
  await page.goto(`${BASE}/dev/f7.html?view=${view}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector(waitFor, { timeout: 20000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => document.fonts.ready);
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

      await openView(page, 'expenses', 'h1');
      await checkOverflow(page, `${viewport.name} expenses`);
      await shot(page, path.join(OUT, `${viewport.name}-expenses.png`));

      const addButton = page.getByRole('button', { name: /^Registrar/ }).first();
      if (await addButton.count()) {
        await addButton.click();
        await page.getByRole('dialog', { name: /Registrar egreso|Editar egreso/ }).waitFor({ timeout: 10000 });
        await page.waitForTimeout(350);
        await checkOverflow(page, `${viewport.name} expenses-add`);
        await shot(page, path.join(OUT, `${viewport.name}-expenses-add.png`), false);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(250);
      }

      await openView(page, 'upgrade', '#payment-title');
      await checkOverflow(page, `${viewport.name} upgrade`);
      await shot(page, path.join(OUT, `${viewport.name}-upgrade.png`), false);

      await openView(page, 'team', 'h1');
      await checkOverflow(page, `${viewport.name} team`);
      await shot(page, path.join(OUT, `${viewport.name}-team.png`));

      await openView(page, 'branches', 'h1');
      await checkOverflow(page, `${viewport.name} branches`);
      await shot(page, path.join(OUT, `${viewport.name}-branches.png`));

      await openView(page, 'settings', 'h1');
      await checkOverflow(page, `${viewport.name} settings`);
      await shot(page, path.join(OUT, `${viewport.name}-settings.png`));

      await openView(page, 'inventory', 'text=Catálogo de Inventario');
      await checkOverflow(page, `${viewport.name} inventory`);
      await shot(page, path.join(OUT, `${viewport.name}-inventory.png`));

      await openView(page, 'admin', 'h1');
      await checkOverflow(page, `${viewport.name} admin`);
      await shot(page, path.join(OUT, `${viewport.name}-admin.png`));

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
