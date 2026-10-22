import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULTS = {
  baseUrl: 'http://127.0.0.1:4173',
  out: 'docs/audit/baseline',
  channel: 'msedge',
};

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
];

const AUTH_SCREENS = [
  { name: 'inicio', url: '/' },
  { name: 'nueva-venta', url: '/ventas' },
  { name: 'inventario', url: '/inventario' },
];

function parseArgs(argv) {
  const opts = { ...DEFAULTS, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') opts.help = true;
    else if (arg === '--base-url') opts.baseUrl = argv[++i];
    else if (arg === '--out') opts.out = argv[++i];
    else if (arg === '--channel') opts.channel = argv[++i];
  }
  return opts;
}

function usage() {
  console.log(`Uso: node scripts/screenshots.mjs [opciones]

Opciones:
  --base-url <url>    URL base de la app en ejecución (default: ${DEFAULTS.baseUrl})
  --out <dir>         Carpeta de salida (default: ${DEFAULTS.out})
  --channel <nombre>  Canal de Chromium: msedge|chrome|chromium (default: ${DEFAULTS.channel})
  -h, --help          Muestra esta ayuda

Capturas públicas (siempre):
  onboarding.png      Primera apertura, sin localStorage previo
  login.png           Login, con mg_onboarding_done=1

Capturas autenticadas (solo si existen E2E_EMAIL y E2E_PASSWORD en el entorno):
  inicio.png, nueva-venta.png, inventario.png

Nunca se imprimen credenciales. Cada pantalla se guarda en <out>/<desktop|tablet|mobile>/<pantalla>.png`);
}

function rel(target) {
  return path.relative(process.cwd(), target).replaceAll('\\', '/');
}

async function snapshot(page, target, results, screen, viewport, reasonKey = screen) {
  await page.screenshot({ path: target });
  results.written.push(rel(target));
  console.log(`OK   ${viewport.name}/${reasonKey} -> ${rel(target)}`);
}

async function capturePublic(browser, viewport, opts, results) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    locale: 'es-BO',
  });
  const page = await context.newPage();

  try {
    await page.goto(opts.baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('text=Saltar', { timeout: 20000 });
    await snapshot(page, path.join(opts.out, viewport.name, 'onboarding.png'), results, 'onboarding', viewport);
  } catch (err) {
    results.skipped.push({ screen: 'onboarding', viewport: viewport.name, reason: err.message });
    console.log(`SKIP ${viewport.name}/onboarding -> ${err.message}`);
  }

  await context.close();
}

async function captureLogin(browser, viewport, opts, results) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    locale: 'es-BO',
  });
  await context.addInitScript(() => {
    try { localStorage.setItem('mg_onboarding_done', '1'); } catch { }
  });
  const page = await context.newPage();

  try {
    await page.goto(opts.baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('#correo', { timeout: 20000 });
    await snapshot(page, path.join(opts.out, viewport.name, 'login.png'), results, 'login', viewport);
  } catch (err) {
    results.skipped.push({ screen: 'login', viewport: viewport.name, reason: err.message });
    console.log(`SKIP ${viewport.name}/login -> ${err.message}`);
  }

  await context.close();
}

async function captureAuthenticated(browser, viewport, opts, results, creds) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    locale: 'es-BO',
  });
  await context.addInitScript(() => {
    try {
      localStorage.setItem('mg_onboarding_done', '1');
      localStorage.setItem('mg_welcome_done', '1');
      localStorage.setItem('mg_tutorial_done', '1');
    } catch { }
  });
  const page = await context.newPage();

  try {
    await page.goto(opts.baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('#correo', { timeout: 20000 });
    await page.fill('#correo', creds.email);
    await page.fill('#clave', creds.password);
    await page.click('button[type="submit"]');
    await page.waitForSelector('nav', { timeout: 30000 });
    await page.waitForTimeout(2500);

    for (const screen of AUTH_SCREENS) {
      await page.goto(`${opts.baseUrl}${screen.url}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForSelector('nav', { timeout: 30000 });
      await page.waitForTimeout(2500);
      await snapshot(page, path.join(opts.out, viewport.name, `${screen.name}.png`), results, screen.name, viewport);
    }
  } catch (err) {
    for (const screen of AUTH_SCREENS) {
      results.skipped.push({ screen: screen.name, viewport: viewport.name, reason: `auth: ${err.message}` });
      console.log(`SKIP ${viewport.name}/${screen.name} -> auth: ${err.message}`);
    }
  }

  await context.close();
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    usage();
    return;
  }

  const results = { written: [], skipped: [] };
  const creds = process.env.E2E_EMAIL && process.env.E2E_PASSWORD
    ? { email: process.env.E2E_EMAIL, password: process.env.E2E_PASSWORD }
    : null;

  if (!creds) {
    for (const viewport of VIEWPORTS) {
      for (const screen of AUTH_SCREENS) {
        results.skipped.push({
          screen: screen.name,
          viewport: viewport.name,
          reason: 'faltan E2E_EMAIL/E2E_PASSWORD en el entorno',
        });
      }
    }
  }

  for (const viewport of VIEWPORTS) {
    await fs.mkdir(path.join(opts.out, viewport.name), { recursive: true });
  }

  console.log(`Base URL: ${opts.baseUrl}`);
  console.log(`Salida:   ${opts.out}`);
  console.log(`Canal:    ${opts.channel}`);
  console.log('');

  const browser = await chromium.launch({ channel: opts.channel, headless: true });
  try {
    for (const viewport of VIEWPORTS) {
      await capturePublic(browser, viewport, opts, results);
      await captureLogin(browser, viewport, opts, results);
      if (creds) await captureAuthenticated(browser, viewport, opts, results, creds);
    }
  } finally {
    await browser.close();
  }

  console.log('');
  console.log(`Capturas escritas: ${results.written.length}`);
  console.log(`Pantallas omitidas: ${results.skipped.length}`);
  for (const item of results.skipped) {
    console.log(`  - ${item.viewport}/${item.screen}: ${item.reason}`);
  }

  if (results.written.length === 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(`ERROR: ${err.message}`);
  process.exit(1);
});
