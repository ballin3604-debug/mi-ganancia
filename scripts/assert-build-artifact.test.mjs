import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertArtifact,
  findForbiddenValues,
  forbiddenEnvNames,
  missingRequiredEnvValues,
  requiredScanEnvNames,
} from './assert-build-artifact.mjs';
import { environmentHtmlPlugin } from '../src/config/buildModeHtml.js';

const STAGING_MARKER = '<meta name="mg-environment" content="staging" />';
const PRODUCTION_HTML = '<!doctype html><html><head><title>Mi Ganancia</title><meta name="mg-build-mode" content="production" /></head><body></body></html>';
const STAGING_HTML = `<!doctype html><html><head>${STAGING_MARKER}<title>[STAGING] Mi Ganancia</title><meta name="mg-build-mode" content="staging" /></head><body></body></html>`;
const DEVELOPMENT_HTML = '<!doctype html><html><head><title>Mi Ganancia</title><meta name="mg-build-mode" content="development" /></head><body></body></html>';

// Valores sintéticos: no son credenciales ni proyectos reales.
const STAGING_REF = 's7t4g1n9r2e5f8a3c6b0';
const PRODUCTION_REF = 'p3r7o1d5u9c2t4i6o8n0';
const STAGING_URL = `https://${STAGING_REF}.supabase.co`;
const PRODUCTION_URL = `https://${PRODUCTION_REF}.supabase.co`;
const STAGING_KEY = 'synthetic-staging-anon-key-not-real';
const PRODUCTION_KEY = [
  Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
  Buffer.from(JSON.stringify({ role: 'anon' })).toString('base64url'),
  'synthetic-signature',
].join('.');
const STAGING_ADMIN_UID = '11111111-1111-4111-8111-111111111111';
const PRODUCTION_ADMIN_UID = '22222222-2222-4222-8222-222222222222';

function productionEnvFile({ appEnv = 'production', url = PRODUCTION_URL, anonKey = PRODUCTION_KEY } = {}) {
  return [
    `VITE_APP_ENV=${appEnv}`,
    `VITE_SUPABASE_URL=${url}`,
    `VITE_SUPABASE_ANON_KEY=${anonKey}`,
    `VITE_SUPABASE_PROJECT_REF=${PRODUCTION_REF}`,
    `VITE_ADMIN_UID=${PRODUCTION_ADMIN_UID}`,
  ].join('\n');
}

const PRODUCTION_ENV_FILE = productionEnvFile();
const STAGING_ENV_FILE = [
  'VITE_APP_ENV=staging',
  `VITE_STAGING_SUPABASE_URL=${STAGING_URL}`,
  `VITE_STAGING_SUPABASE_ANON_KEY=${STAGING_KEY}`,
  `VITE_STAGING_SUPABASE_PROJECT_REF=${STAGING_REF}`,
  `VITE_STAGING_ADMIN_UID=${STAGING_ADMIN_UID}`,
  `VITE_PRODUCTION_SUPABASE_PROJECT_REF=${PRODUCTION_REF}`,
].join('\n');
const SYNTHETIC_ENV_FILES = {
  '.env.production.local': PRODUCTION_ENV_FILE,
  '.env.staging.local': STAGING_ENV_FILE,
};
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scriptPath = path.join(repoRoot, 'scripts', 'assert-build-artifact.mjs');
const buildSwSourcePath = path.join(repoRoot, 'scripts', 'build-sw.js');
const tempDirs = [];

function swFor(mode, cacheName) {
  return [
    "const CACHE_NAME = '" + cacheName + "';",
    "const BUILD_MODE = '" + mode + "';",
    'const STATIC_ASSETS = ["/"];',
  ].join('\n');
}

function makeTempProject({
  html,
  sw,
  files = {},
  envFiles = {},
  publicDir = 'dist',
  config,
} = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mg-artifact-project-'));
  tempDirs.push(root);
  fs.writeFileSync(
    path.join(root, 'firebase.json'),
    JSON.stringify(config || { hosting: { public: publicDir } }, null, 2),
    'utf8',
  );

  const dist = path.join(root, publicDir);
  fs.mkdirSync(dist, { recursive: true });
  if (typeof html === 'string') {
    fs.writeFileSync(path.join(dist, 'index.html'), html, 'utf8');
  }
  if (typeof sw === 'string') {
    fs.writeFileSync(path.join(dist, 'sw.js'), sw, 'utf8');
  }
  for (const [relativePath, content] of Object.entries(files)) {
    const fullPath = path.join(dist, relativePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf8');
  }
  for (const [name, content] of Object.entries(envFiles)) {
    fs.writeFileSync(path.join(root, name), content, 'utf8');
  }

  return { root, dist };
}

function runInProject(root, args) {
  const childEnv = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.startsWith('VITE_')),
  );
  return spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: root,
    env: childEnv,
    encoding: 'utf8',
  });
}

function runBuildSwInProject(root, args) {
  const scriptsDir = path.join(root, 'scripts');
  fs.mkdirSync(scriptsDir, { recursive: true });
  const tempScriptPath = path.join(scriptsDir, 'build-sw.js');
  fs.copyFileSync(buildSwSourcePath, tempScriptPath);
  const childEnv = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.startsWith('VITE_')),
  );
  return spawnSync(process.execPath, [tempScriptPath, ...args], {
    cwd: root,
    env: childEnv,
    encoding: 'utf8',
  });
}

afterEach(() => {
  while (tempDirs.length) {
    fs.rmSync(tempDirs.pop(), { recursive: true, force: true });
  }
});

describe('Vite build provenance marker', () => {
  it.each(['production', 'staging', 'development'])('embeds the actual build mode %s', (mode) => {
    const plugin = environmentHtmlPlugin(mode, 'build');
    const html = plugin.transformIndexHtml('<!doctype html><html><head><title>Mi Ganancia</title></head><body></body></html>');
    const markers = [...html.matchAll(/<meta\b(?=[^>]*\sname="mg-build-mode")[^>]*>/gi)];

    expect(markers).toHaveLength(1);
    expect(markers[0][0]).toContain(`content="${mode}"`);
    expect(html.includes(STAGING_MARKER)).toBe(mode === 'staging');
  });

  it('replaces a source-provided marker with exactly one marker for the actual mode', () => {
    const source = '<!doctype html><html><head><meta name="mg-build-mode" content="production" /><title>Mi Ganancia</title></head></html>';
    const html = environmentHtmlPlugin('development', 'build').transformIndexHtml(source);
    const markers = [...html.matchAll(/<meta\b(?=[^>]*\sname="mg-build-mode")[^>]*>/gi)];

    expect(markers).toHaveLength(1);
    expect(markers[0][0]).toContain('content="development"');
  });

  it('does not add a build provenance marker while serving', () => {
    const html = environmentHtmlPlugin('production', 'serve')
      .transformIndexHtml('<!doctype html><html><head><title>Mi Ganancia</title></head></html>');

    expect(html).not.toContain('mg-build-mode');
  });
});

describe('assertArtifact required files', () => {
  it('accepts a valid staging artifact', () => {
    const errors = assertArtifact({
      mode: 'staging',
      html: STAGING_HTML,
      sw: swFor('staging', 'mi-ganancia-staging-123'),
    });

    expect(errors).toEqual([]);
  });

  it('accepts a valid production artifact', () => {
    const errors = assertArtifact({
      mode: 'production',
      html: PRODUCTION_HTML,
      sw: swFor('production', 'mi-ganancia-123'),
    });

    expect(errors).toEqual([]);
  });

  it('rejects a missing dist/index.html', () => {
    const errors = assertArtifact({
      mode: 'staging',
      html: null,
      sw: swFor('staging', 'mi-ganancia-staging-123'),
    });

    expect(errors).toContain('Falta dist/index.html.');
  });

  it('rejects a missing dist/sw.js', () => {
    const errors = assertArtifact({
      mode: 'production',
      html: PRODUCTION_HTML,
      sw: null,
    });

    expect(errors).toContain('Falta dist/sw.js.');
  });

  it('rejects an invalid or missing mode', () => {
    expect(assertArtifact({ mode: '', html: PRODUCTION_HTML, sw: swFor('production', 'mi-ganancia-1') }))
      .toEqual(['Modo inválido o ausente. Usa --mode production|staging.']);
    expect(assertArtifact({ mode: 'test', html: PRODUCTION_HTML, sw: swFor('production', 'mi-ganancia-1') }))
      .toEqual(['Modo inválido o ausente. Usa --mode production|staging.']);
  });
});

describe('assertArtifact HTML and service worker consistency', () => {
  it('rejects a staging build whose HTML lacks the staging marker', () => {
    const errors = assertArtifact({
      mode: 'staging',
      html: PRODUCTION_HTML,
      sw: swFor('staging', 'mi-ganancia-staging-123'),
    });

    expect(errors).toContain('dist/index.html no corresponde al modo staging.');
  });

  it('rejects a production build whose HTML has the staging marker', () => {
    const errors = assertArtifact({
      mode: 'production',
      html: STAGING_HTML,
      sw: swFor('production', 'mi-ganancia-123'),
    });

    expect(errors).toContain('dist/index.html no corresponde al modo production.');
  });

  it('rejects HTML without a Vite build-mode marker', () => {
    const html = '<!doctype html><html><head><title>Mi Ganancia</title></head><body></body></html>';
    const errors = assertArtifact({
      mode: 'production',
      html,
      sw: swFor('production', 'mi-ganancia-123'),
    });

    expect(errors).toContain('dist/index.html no conserva una marca única del modo real de Vite.');
  });

  it('rejects development provenance when the requested artifact mode is production', () => {
    const errors = assertArtifact({
      mode: 'production',
      html: DEVELOPMENT_HTML,
      sw: swFor('production', 'mi-ganancia-123'),
    });

    expect(errors).toContain('dist/index.html no conserva una marca única del modo real de Vite.');
  });

  it('rejects duplicate Vite build-mode markers', () => {
    const html = PRODUCTION_HTML.replace(
      '</head>',
      '<meta name="mg-build-mode" content="development" /></head>',
    );
    const errors = assertArtifact({
      mode: 'production',
      html,
      sw: swFor('production', 'mi-ganancia-123'),
    });

    expect(errors).toContain('dist/index.html no conserva una marca única del modo real de Vite.');
  });

  it('rejects a production title with [STAGING] even without the staging meta', () => {
    const html = '<!doctype html><html><head><title>[STAGING] Mi Ganancia</title><meta name="mg-build-mode" content="production" /></head><body></body></html>';
    const errors = assertArtifact({
      mode: 'production',
      html,
      sw: swFor('production', 'mi-ganancia-123'),
    });

    expect(errors).toContain('dist/index.html conserva el título [STAGING] de staging.');
    expect(errors).not.toContain('dist/index.html no corresponde al modo production.');
  });

  it('rejects a service worker with the wrong BUILD_MODE', () => {
    const errors = assertArtifact({
      mode: 'staging',
      html: STAGING_HTML,
      sw: swFor('production', 'mi-ganancia-staging-123'),
    });

    expect(errors.join(' ')).toContain('BUILD_MODE="production"');
    expect(errors.join(' ')).toContain('se esperaba "staging"');
  });

  it('does not print an unrecognized BUILD_MODE value', () => {
    const errors = assertArtifact({
      mode: 'production',
      html: PRODUCTION_HTML,
      sw: [
        `const CACHE_NAME = 'mi-ganancia-123';`,
        `const BUILD_MODE = '${STAGING_KEY}';`,
      ].join('\n'),
    });

    expect(errors.join(' ')).toContain('BUILD_MODE="desconocido"');
    expect(errors.join(' ')).not.toContain(STAGING_KEY);
  });

  it('rejects a service worker without BUILD_MODE', () => {
    const errors = assertArtifact({
      mode: 'production',
      html: PRODUCTION_HTML,
      sw: "const CACHE_NAME = 'mi-ganancia-123';",
    });

    expect(errors).toContain('dist/sw.js no declara BUILD_MODE.');
  });

  it('rejects a staging service worker with a production cache prefix', () => {
    const errors = assertArtifact({
      mode: 'staging',
      html: STAGING_HTML,
      sw: swFor('staging', 'mi-ganancia-123'),
    });

    expect(errors).toContain('dist/sw.js no usa el prefijo de caché de staging.');
  });

  it('rejects a production service worker with a staging cache prefix', () => {
    const errors = assertArtifact({
      mode: 'production',
      html: PRODUCTION_HTML,
      sw: swFor('production', 'mi-ganancia-staging-123'),
    });

    expect(errors).toContain('dist/sw.js no usa el prefijo de caché de producción.');
  });

  it('rejects a service worker without CACHE_NAME', () => {
    const errors = assertArtifact({
      mode: 'production',
      html: PRODUCTION_HTML,
      sw: "const BUILD_MODE = 'production';",
    });

    expect(errors).toContain('dist/sw.js no declara CACHE_NAME.');
  });
});

describe('forbidden environment values', () => {
  const productionForbidden = [
    { name: 'VITE_STAGING_SUPABASE_URL', value: STAGING_URL },
    { name: 'VITE_STAGING_SUPABASE_ANON_KEY', value: STAGING_KEY },
    { name: 'VITE_STAGING_SUPABASE_PROJECT_REF', value: STAGING_REF },
    { name: 'VITE_STAGING_ADMIN_UID', value: STAGING_ADMIN_UID },
  ];
  const stagingForbidden = [
    { name: 'VITE_SUPABASE_URL', value: PRODUCTION_URL },
    { name: 'VITE_SUPABASE_ANON_KEY', value: PRODUCTION_KEY },
    { name: 'VITE_ADMIN_UID', value: PRODUCTION_ADMIN_UID },
  ];

  it('selects the correct forbidden categories per mode', () => {
    expect(forbiddenEnvNames('production')).toEqual([
      'VITE_STAGING_ADMIN_UID',
      'VITE_STAGING_SUPABASE_URL',
      'VITE_STAGING_SUPABASE_ANON_KEY',
      'VITE_STAGING_SUPABASE_PROJECT_REF',
    ]);
    expect(forbiddenEnvNames('staging')).toEqual([
      'VITE_ADMIN_UID',
      'VITE_SUPABASE_URL',
      'VITE_SUPABASE_ANON_KEY',
    ]);
    expect(forbiddenEnvNames('staging')).not.toContain('VITE_PRODUCTION_SUPABASE_PROJECT_REF');
  });

  it('requires the same scan values that are forbidden per mode', () => {
    expect(requiredScanEnvNames('production')).toEqual(forbiddenEnvNames('production'));
    expect(requiredScanEnvNames('staging')).toEqual(forbiddenEnvNames('staging'));
  });

  it('reports missing or too-short required values by name only', () => {
    const missing = missingRequiredEnvValues({
      env: {
        VITE_STAGING_SUPABASE_URL: STAGING_URL,
        VITE_STAGING_SUPABASE_ANON_KEY: '',
        VITE_STAGING_SUPABASE_PROJECT_REF: ` ${STAGING_REF} `,
        VITE_STAGING_ADMIN_UID: 'short',
      },
      names: forbiddenEnvNames('production'),
    });

    expect(missing).toEqual([
      'VITE_STAGING_ADMIN_UID',
      'VITE_STAGING_SUPABASE_ANON_KEY',
    ]);
  });

  it('detects synthetic staging values in a production artifact', () => {
    const files = [
      { path: 'assets/app.js', content: `const url = "${STAGING_URL}"; const uid = "${STAGING_ADMIN_UID}";` },
      { path: 'index.html', content: `<meta content="${STAGING_KEY}">` },
    ];

    const matches = findForbiddenValues({ files, forbidden: productionForbidden });

    expect(matches).toEqual(expect.arrayContaining([
      { name: 'VITE_STAGING_SUPABASE_URL', path: 'assets/app.js' },
      { name: 'VITE_STAGING_ADMIN_UID', path: 'assets/app.js' },
      { name: 'VITE_STAGING_SUPABASE_ANON_KEY', path: 'index.html' },
    ]));
    for (const match of matches) {
      expect(JSON.stringify(match)).not.toContain(STAGING_KEY);
      expect(JSON.stringify(match)).not.toContain(STAGING_ADMIN_UID);
      expect(JSON.stringify(match)).not.toContain(STAGING_URL);
    }
  });

  it('detects synthetic production values in a staging artifact', () => {
    const files = [
      { path: 'assets/app.js', content: `const url = "${PRODUCTION_URL}"; const uid = "${PRODUCTION_ADMIN_UID}";` },
      { path: 'assets/app.js.map', content: `"sourcesContent":["${PRODUCTION_KEY}"]` },
    ];

    const matches = findForbiddenValues({ files, forbidden: stagingForbidden });

    expect(matches).toEqual(expect.arrayContaining([
      { name: 'VITE_SUPABASE_URL', path: 'assets/app.js' },
      { name: 'VITE_ADMIN_UID', path: 'assets/app.js' },
      { name: 'VITE_SUPABASE_ANON_KEY', path: 'assets/app.js.map' },
    ]));
  });

  it('does not treat the production project ref as forbidden in staging', () => {
    const files = [
      { path: 'assets/app.js', content: `const productionRef = "${PRODUCTION_REF}";` },
    ];

    const matches = findForbiddenValues({
      files,
      forbidden: forbiddenEnvNames('staging').map((name) => ({
        name,
        value: {
          VITE_SUPABASE_URL: PRODUCTION_URL,
          VITE_SUPABASE_ANON_KEY: PRODUCTION_KEY,
          VITE_ADMIN_UID: PRODUCTION_ADMIN_UID,
        }[name],
      })),
    });

    expect(matches).toEqual([]);
  });

  it('reports one match per variable and file and never includes the value', () => {
    const files = [
      { path: 'assets/app.js', content: `${STAGING_KEY} ${STAGING_KEY}` },
      { path: 'assets/vendor.js', content: STAGING_KEY },
    ];
    const forbidden = [{ name: 'VITE_STAGING_SUPABASE_ANON_KEY', value: STAGING_KEY }];

    const matches = findForbiddenValues({ files, forbidden });

    expect(matches).toEqual([
      { name: 'VITE_STAGING_SUPABASE_ANON_KEY', path: 'assets/app.js' },
      { name: 'VITE_STAGING_SUPABASE_ANON_KEY', path: 'assets/vendor.js' },
    ]);
    expect(JSON.stringify(matches)).not.toContain(STAGING_KEY);
  });

  it('ignores empty and very short values to avoid false positives', () => {
    const files = [{ path: 'assets/app.js', content: 'const x = "abc";' }];

    expect(findForbiddenValues({
      files,
      forbidden: [
        { name: 'VITE_STAGING_SUPABASE_ANON_KEY', value: '' },
        { name: 'VITE_STAGING_ADMIN_UID', value: 'abc' },
      ],
    })).toEqual([]);
  });
});

describe('run CLI checks', () => {
  it('accepts a clean production artifact with valid production config and scan data', () => {
    const { root } = makeTempProject({
      html: PRODUCTION_HTML,
      sw: swFor('production', 'mi-ganancia-123'),
      envFiles: SYNTHETIC_ENV_FILES,
    });

    const result = runInProject(root, ['--mode', 'production', '--env-check', '--require-env']);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('dist OK para production');
  });

  it('rejects development provenance when build-sw is asked to relabel it as production', () => {
    const { root, dist } = makeTempProject({
      html: DEVELOPMENT_HTML,
      sw: swFor('production', 'mi-ganancia-123'),
      envFiles: SYNTHETIC_ENV_FILES,
    });
    const htmlPath = path.join(dist, 'index.html');
    const swPath = path.join(dist, 'sw.js');
    const originalHtml = fs.readFileSync(htmlPath, 'utf8');
    const originalSw = fs.readFileSync(swPath, 'utf8');

    const buildSwResult = runBuildSwInProject(root, ['--mode', 'production']);

    expect(buildSwResult.status).toBe(1);
    expect(buildSwResult.stderr).toContain('marca de modo generada por Vite');
    expect(fs.readFileSync(htmlPath, 'utf8')).toBe(originalHtml);
    expect(fs.readFileSync(swPath, 'utf8')).toBe(originalSw);

    const predeployResult = runInProject(root, ['--mode', 'production', '--env-check', '--require-env']);

    expect(predeployResult.status).toBe(1);
    expect(predeployResult.stderr).toContain('marca única del modo real de Vite');
    expect(predeployResult.stderr).not.toContain(PRODUCTION_URL);
    expect(predeployResult.stderr).not.toContain(PRODUCTION_KEY);
  });

  it('rejects a clean production artifact when the production URL is missing', () => {
    const { root } = makeTempProject({
      html: PRODUCTION_HTML,
      sw: swFor('production', 'mi-ganancia-123'),
      envFiles: {
        '.env.production.local': productionEnvFile({ url: '' }),
        '.env.staging.local': STAGING_ENV_FILE,
      },
    });

    const result = runInProject(root, ['--mode', 'production', '--env-check', '--require-env']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('VITE_SUPABASE_URL');
    expect(result.stderr).not.toContain(PRODUCTION_URL);
    expect(result.stderr).not.toContain(PRODUCTION_KEY);
  });

  it('rejects a clean production artifact with an invalid anon key without printing it', () => {
    const invalidKey = 'synthetic-invalid-anon-key-sentinel';
    const { root } = makeTempProject({
      html: PRODUCTION_HTML,
      sw: swFor('production', 'mi-ganancia-123'),
      envFiles: {
        '.env.production.local': productionEnvFile({ anonKey: invalidKey }),
        '.env.staging.local': STAGING_ENV_FILE,
      },
    });

    const result = runInProject(root, ['--mode', 'production', '--env-check', '--require-env']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('VITE_SUPABASE_ANON_KEY');
    expect(result.stderr).not.toContain(invalidKey);
    expect(result.stderr).not.toContain(PRODUCTION_URL);
  });

  it('rejects VITE_APP_ENV=development in a clean production artifact without echoing values', () => {
    const { root } = makeTempProject({
      html: PRODUCTION_HTML,
      sw: swFor('production', 'mi-ganancia-123'),
      envFiles: {
        '.env.production.local': productionEnvFile({ appEnv: 'development' }),
        '.env.staging.local': STAGING_ENV_FILE,
      },
    });

    const result = runInProject(root, ['--mode', 'production', '--env-check', '--require-env']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('VITE_APP_ENV');
    expect(result.stderr).not.toContain('development');
    expect(result.stderr).not.toContain(PRODUCTION_URL);
    expect(result.stderr).not.toContain(PRODUCTION_KEY);
  });

  it('rejects invalid production config even when all scan values are available', () => {
    const invalidKey = 'synthetic-invalid-anon-key-sentinel';
    const { root } = makeTempProject({
      html: PRODUCTION_HTML,
      sw: swFor('production', 'mi-ganancia-123'),
      envFiles: {
        '.env.production.local': productionEnvFile({ url: '', anonKey: invalidKey }),
        '.env.staging.local': STAGING_ENV_FILE,
      },
    });

    const result = runInProject(root, ['--mode', 'production', '--env-check', '--require-env']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('VITE_SUPABASE_URL');
    expect(result.stderr).toContain('VITE_SUPABASE_ANON_KEY');
    expect(result.stderr).not.toContain(invalidKey);
    expect(result.stderr).not.toContain(PRODUCTION_URL);
    expect(result.stderr).not.toContain(PRODUCTION_KEY);
  });

  it('applies production config validation when only --require-env is passed', () => {
    const { root } = makeTempProject({
      html: PRODUCTION_HTML,
      sw: swFor('production', 'mi-ganancia-123'),
      envFiles: {
        '.env.production.local': productionEnvFile({ url: '' }),
        '.env.staging.local': STAGING_ENV_FILE,
      },
    });

    const result = runInProject(root, ['--mode', 'production', '--require-env']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('VITE_SUPABASE_URL');
  });

  it('fails closed when --env-check has no scan data', () => {
    const { root } = makeTempProject({
      html: PRODUCTION_HTML,
      sw: swFor('production', 'mi-ganancia-123'),
      envFiles: {
        '.env.production.local': PRODUCTION_ENV_FILE,
      },
    });

    const result = runInProject(root, ['--mode', 'production', '--env-check']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Falta VITE_STAGING_SUPABASE_URL');
    expect(result.stderr).toContain('Falta VITE_STAGING_ADMIN_UID');
  });

  it('accepts a clean staging artifact with scan data', () => {
    const { root } = makeTempProject({
      html: STAGING_HTML,
      sw: swFor('staging', 'mi-ganancia-staging-123'),
      envFiles: SYNTHETIC_ENV_FILES,
    });

    const result = runInProject(root, ['--mode', 'staging', '--env-check', '--require-env']);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('dist OK para staging');
  });

  it('rejects an intact staging artifact evaluated as production', () => {
    const { root } = makeTempProject({
      html: STAGING_HTML,
      sw: swFor('staging', 'mi-ganancia-staging-123'),
      envFiles: SYNTHETIC_ENV_FILES,
    });

    const result = runInProject(root, ['--mode', 'production', '--env-check', '--require-env']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('no corresponde al modo production');
  });

  it('rejects staging values in a production JS without printing them', () => {
    const { root } = makeTempProject({
      html: PRODUCTION_HTML,
      sw: swFor('production', 'mi-ganancia-123'),
      files: {
        'assets/app.js': [
          `const stagingUrl = "${STAGING_URL}";`,
          `const stagingKey = "${STAGING_KEY}";`,
          `const stagingAdmin = "${STAGING_ADMIN_UID}";`,
        ].join('\n'),
      },
      envFiles: SYNTHETIC_ENV_FILES,
    });

    const result = runInProject(root, ['--mode', 'production', '--env-check', '--require-env']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('VITE_STAGING_SUPABASE_URL');
    expect(result.stderr).toContain('VITE_STAGING_SUPABASE_ANON_KEY');
    expect(result.stderr).toContain('VITE_STAGING_ADMIN_UID');
    expect(result.stderr).toContain('assets/app.js');
    expect(result.stderr).not.toContain(STAGING_URL);
    expect(result.stderr).not.toContain(STAGING_KEY);
    expect(result.stderr).not.toContain(STAGING_ADMIN_UID);
    expect(result.stderr).not.toContain(STAGING_REF);
  });

  it.each([
    ['JSON', 'assets/environment.json', JSON.stringify({ url: STAGING_URL, key: STAGING_KEY })],
    ['CSS', 'assets/environment.css', `:root { --url: "${STAGING_URL}"; --key: "${STAGING_KEY}"; }`],
  ])('rejects staging contamination in production %s without printing values', (_type, filePath, content) => {
    const { root } = makeTempProject({
      html: PRODUCTION_HTML,
      sw: swFor('production', 'mi-ganancia-123'),
      files: { [filePath]: content },
      envFiles: SYNTHETIC_ENV_FILES,
    });

    const result = runInProject(root, ['--mode', 'production', '--env-check', '--require-env']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('VITE_STAGING_SUPABASE_URL');
    expect(result.stderr).toContain('VITE_STAGING_SUPABASE_ANON_KEY');
    expect(result.stderr).toContain(filePath);
    expect(result.stderr).not.toContain(STAGING_URL);
    expect(result.stderr).not.toContain(STAGING_KEY);
  });

  it('rejects the same contaminated artifact when scan variables are missing', () => {
    const { root } = makeTempProject({
      html: PRODUCTION_HTML,
      sw: swFor('production', 'mi-ganancia-123'),
      files: {
        'assets/app.js': `const stagingKey = "${STAGING_KEY}";`,
      },
      envFiles: {
        '.env.production.local': PRODUCTION_ENV_FILE,
      },
    });

    const result = runInProject(root, ['--mode', 'production', '--env-check', '--require-env']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Falta VITE_STAGING_SUPABASE_URL');
    expect(result.stderr).toContain('Falta VITE_STAGING_SUPABASE_ANON_KEY');
    expect(result.stderr).toContain('Falta VITE_STAGING_SUPABASE_PROJECT_REF');
    expect(result.stderr).toContain('Falta VITE_STAGING_ADMIN_UID');
    expect(result.stderr).not.toContain(STAGING_KEY);
    expect(result.stderr).not.toContain(STAGING_URL);
    expect(result.stderr).not.toContain(STAGING_ADMIN_UID);
  });

  it('rejects a production title with [STAGING] even without the staging meta', () => {
    const html = '<!doctype html><html><head><title>[STAGING] Mi Ganancia</title><meta name="mg-build-mode" content="production" /></head><body></body></html>';
    const { root } = makeTempProject({
      html,
      sw: swFor('production', 'mi-ganancia-123'),
      envFiles: SYNTHETIC_ENV_FILES,
    });

    const result = runInProject(root, ['--mode', 'production', '--env-check', '--require-env']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('conserva el título [STAGING]');
  });

  it('rejects missing required files', () => {
    const noHtml = makeTempProject({ sw: swFor('production', 'mi-ganancia-123') });
    const noSw = makeTempProject({ html: PRODUCTION_HTML });

    expect(runInProject(noHtml.root, ['--mode', 'production']).status).toBe(1);
    expect(runInProject(noSw.root, ['--mode', 'production']).status).toBe(1);
  });

  it('rejects a validated directory that does not match firebase.json', () => {
    const { root } = makeTempProject({
      html: PRODUCTION_HTML,
      sw: swFor('production', 'mi-ganancia-123'),
    });
    const other = path.join(root, 'other');
    fs.mkdirSync(other);
    fs.writeFileSync(path.join(other, 'index.html'), PRODUCTION_HTML, 'utf8');
    fs.writeFileSync(path.join(other, 'sw.js'), swFor('production', 'mi-ganancia-123'), 'utf8');

    const result = runInProject(root, ['--mode', 'production', '--dir', other]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('hosting.public de firebase.json');
  });

  it('uses hosting.public as the default validated directory', () => {
    const { root } = makeTempProject({
      html: PRODUCTION_HTML,
      sw: swFor('production', 'mi-ganancia-123'),
      publicDir: 'publish',
    });

    const result = runInProject(root, ['--mode', 'production']);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('publish OK para production');
  });

  it('fails when firebase.json cannot prove the publish directory', () => {
    const { root } = makeTempProject({
      html: PRODUCTION_HTML,
      sw: swFor('production', 'mi-ganancia-123'),
    });
    fs.rmSync(path.join(root, 'firebase.json'));

    const result = runInProject(root, ['--mode', 'production']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('firebase.json');
  });

  it('fails closed when firebase.json has multiple hosting publish directories', () => {
    const { root } = makeTempProject({
      html: PRODUCTION_HTML,
      sw: swFor('production', 'mi-ganancia-123'),
      publicDir: 'dist-one',
      config: {
        hosting: [
          { site: 'site-one', public: 'dist-one' },
          { site: 'site-two', public: 'dist-two' },
        ],
      },
    });

    const result = runInProject(root, ['--mode', 'production']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('varios directorios de publicación');
    expect(result.stdout).not.toContain('OK para production');
  });

  it('fails closed when any Firebase Hosting entry lacks public', () => {
    const { root } = makeTempProject({
      html: PRODUCTION_HTML,
      sw: swFor('production', 'mi-ganancia-123'),
      config: {
        hosting: [
          { site: 'site-one', public: 'dist' },
          { site: 'site-two' },
        ],
      },
    });

    const result = runInProject(root, ['--mode', 'production']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('no permite verificar hosting.public en todas las entradas');
    expect(result.stdout).not.toContain('OK para production');
  });
});

describe('firebase predeploy configuration', () => {
  it('matches the exact strict production predeploy command', () => {
    const config = JSON.parse(fs.readFileSync(path.join(repoRoot, 'firebase.json'), 'utf8'));
    const predeploy = [].concat(config.hosting.predeploy || []);

    expect(config.hosting.public).toBe('dist');
    expect(predeploy).toEqual([
      'node scripts/assert-build-artifact.mjs --mode production --env-check --require-env',
    ]);
  });
});
