import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const buildSwSource = path.join(scriptsDir, 'build-sw.js');
const STAGING_MARKER = '<meta name="mg-environment" content="staging" />';
const PRODUCTION_HTML = '<!doctype html><html><head><title>Mi Ganancia</title><meta name="mg-build-mode" content="production" /></head></html>';
const STAGING_HTML = `<!doctype html><html><head>${STAGING_MARKER}<title>[STAGING] Mi Ganancia</title><meta name="mg-build-mode" content="staging" /></head></html>`;
const DEVELOPMENT_HTML = '<!doctype html><html><head><title>Mi Ganancia</title><meta name="mg-build-mode" content="development" /></head></html>';
const HTML_WITHOUT_BUILD_MODE = '<!doctype html><html><head><title>Mi Ganancia</title></head></html>';
const SW_SOURCE = [
  "const CACHE_NAME = 'mi-ganancia-0';",
  'const STATIC_ASSETS = ["/"];',
].join('\n');

const tempDirs = [];

function makeTempProject({ html, sw } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mg-build-sw-'));
  tempDirs.push(root);
  fs.mkdirSync(path.join(root, 'scripts'));
  fs.mkdirSync(path.join(root, 'dist'));
  fs.copyFileSync(buildSwSource, path.join(root, 'scripts', 'build-sw.js'));
  if (typeof html === 'string') {
    fs.writeFileSync(path.join(root, 'dist', 'index.html'), html, 'utf8');
  }
  if (typeof sw === 'string') {
    fs.writeFileSync(path.join(root, 'dist', 'sw.js'), sw, 'utf8');
  }
  return root;
}

function runBuildSw(root, args, envOverrides = {}) {
  return spawnSync(process.execPath, [path.join(root, 'scripts', 'build-sw.js'), ...args], {
    cwd: root,
    env: { ...process.env, VITE_APP_ENV: '', ...envOverrides },
    encoding: 'utf8',
  });
}

afterEach(() => {
  while (tempDirs.length) {
    fs.rmSync(tempDirs.pop(), { recursive: true, force: true });
  }
});

describe('build-sw.js required files', () => {
  it('fails when dist/index.html is missing instead of skipping validation', () => {
    const root = makeTempProject({ sw: SW_SOURCE });

    const result = runBuildSw(root, ['--mode', 'production']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('no existe dist/index.html');
  });

  it('fails when dist/sw.js is missing', () => {
    const root = makeTempProject({ html: PRODUCTION_HTML });

    const result = runBuildSw(root, ['--mode', 'production']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Service Worker file not found');
  });
});

describe('build-sw.js mode consistency', () => {
  it('does not echo an invalid VITE_APP_ENV value', () => {
    const root = makeTempProject({ html: PRODUCTION_HTML, sw: SW_SOURCE });
    const invalidValue = 'synthetic-invalid-environment-value';

    const result = runBuildSw(root, ['--mode', 'production'], { VITE_APP_ENV: invalidValue });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('VITE_APP_ENV inválido');
    expect(result.stderr).not.toContain(invalidValue);
  });

  it('fails when staging mode is used with a production index.html', () => {
    const root = makeTempProject({ html: PRODUCTION_HTML, sw: SW_SOURCE });

    const result = runBuildSw(root, ['--mode', 'staging']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('no tiene la marca de staging');
  });

  it('does not create a Vite build-mode marker when it is absent', () => {
    const root = makeTempProject({ html: HTML_WITHOUT_BUILD_MODE, sw: SW_SOURCE });

    const result = runBuildSw(root, ['--mode', 'production']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('marca de modo generada por Vite');
    expect(fs.readFileSync(path.join(root, 'dist', 'index.html'), 'utf8')).toBe(HTML_WITHOUT_BUILD_MODE);
    expect(fs.readFileSync(path.join(root, 'dist', 'sw.js'), 'utf8')).toBe(SW_SOURCE);
  });

  it('refuses to relabel development provenance as production', () => {
    const root = makeTempProject({ html: DEVELOPMENT_HTML, sw: SW_SOURCE });

    const result = runBuildSw(root, ['--mode', 'production']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('marca de modo generada por Vite');
    expect(fs.readFileSync(path.join(root, 'dist', 'index.html'), 'utf8')).toBe(DEVELOPMENT_HTML);
    expect(fs.readFileSync(path.join(root, 'dist', 'sw.js'), 'utf8')).toBe(SW_SOURCE);
  });

  it('fails when production mode is used with a staging index.html', () => {
    const root = makeTempProject({ html: STAGING_HTML, sw: SW_SOURCE });

    const result = runBuildSw(root, ['--mode', 'production']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('es de staging');
  });

  it('writes the staging cache prefix and BUILD_MODE into the service worker', () => {
    const root = makeTempProject({ html: STAGING_HTML, sw: SW_SOURCE });

    const result = runBuildSw(root, ['--mode', 'staging']);

    expect(result.status).toBe(0);
    const sw = fs.readFileSync(path.join(root, 'dist', 'sw.js'), 'utf8');
    expect(fs.readFileSync(path.join(root, 'dist', 'index.html'), 'utf8')).toBe(STAGING_HTML);
    expect(sw).toContain("const BUILD_MODE = 'staging';");
    expect(sw).toMatch(/const CACHE_NAME = 'mi-ganancia-staging-\d+';/);
  });

  it('writes the production service worker without changing Vite provenance', () => {
    const root = makeTempProject({ html: PRODUCTION_HTML, sw: SW_SOURCE });

    const result = runBuildSw(root, ['--mode', 'production']);

    expect(result.status).toBe(0);
    const sw = fs.readFileSync(path.join(root, 'dist', 'sw.js'), 'utf8');
    expect(fs.readFileSync(path.join(root, 'dist', 'index.html'), 'utf8')).toBe(PRODUCTION_HTML);
    expect(sw).toContain("const BUILD_MODE = 'production';");
    expect(sw).toMatch(/const CACHE_NAME = 'mi-ganancia-\d+';/);
  });
});
