import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateBuildEnvironment } from '../src/config/environmentRules.js';

const SCAN_EXTENSIONS = new Set(['.js', '.html', '.json', '.css', '.map']);
const MIN_SCAN_VALUE_LENGTH = 8;
const KNOWN_MODES = new Set(['production', 'staging', 'test']);
const STAGING_TITLE_MARKER = '[STAGING]';
const PRODUCTION_FORBIDDEN_ENV_NAMES = [
  'VITE_STAGING_ADMIN_UID',
  'VITE_STAGING_SUPABASE_URL',
  'VITE_STAGING_SUPABASE_ANON_KEY',
  'VITE_STAGING_SUPABASE_PROJECT_REF',
];
const STAGING_FORBIDDEN_ENV_NAMES = [
  'VITE_ADMIN_UID',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
];

export function forbiddenEnvNames(mode) {
  return mode === 'production'
    ? PRODUCTION_FORBIDDEN_ENV_NAMES
    : STAGING_FORBIDDEN_ENV_NAMES;
}

export function requiredScanEnvNames(mode) {
  return forbiddenEnvNames(mode);
}

export function assertArtifact({ mode, html, sw }) {
  const errors = [];

  if (mode !== 'production' && mode !== 'staging') {
    return ['Modo inválido o ausente. Usa --mode production|staging.'];
  }
  if (typeof html !== 'string') {
    errors.push('Falta dist/index.html.');
  }
  if (typeof sw !== 'string') {
    errors.push('Falta dist/sw.js.');
  }
  if (errors.length) return errors;

  const htmlIsStaging = html.includes('name="mg-environment" content="staging"');
  if (htmlIsStaging !== (mode === 'staging')) {
    errors.push(`dist/index.html no corresponde al modo ${mode}.`);
  }

  const buildModeMarkers = [...html.matchAll(
    /<meta\b(?=[^>]*\sname\s*=\s*["']mg-build-mode["'])[^>]*>/gi,
  )];
  const markedBuildMode = buildModeMarkers.length === 1
    ? (buildModeMarkers[0][0].match(/\scontent\s*=\s*["']([^"']*)["']/i)?.[1] ?? '')
    : '';
  if (buildModeMarkers.length !== 1 || markedBuildMode !== mode) {
    errors.push('dist/index.html no conserva una marca única del modo real de Vite.');
  }

  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '';
  if (mode === 'production' && title.toUpperCase().includes(STAGING_TITLE_MARKER)) {
    errors.push('dist/index.html conserva el título [STAGING] de staging.');
  }

  const swMode = sw.match(/const BUILD_MODE = '([^']*)';/)?.[1] ?? '';
  if (!swMode) {
    errors.push('dist/sw.js no declara BUILD_MODE.');
  } else if (swMode !== mode) {
    const reportedMode = KNOWN_MODES.has(swMode) ? swMode : 'desconocido';
    errors.push(`dist/sw.js declara BUILD_MODE="${reportedMode}" y se esperaba "${mode}".`);
  }

  const cacheName = sw.match(/const CACHE_NAME = '([^']*)';/)?.[1] ?? '';
  if (!cacheName) {
    errors.push('dist/sw.js no declara CACHE_NAME.');
  } else if (mode === 'staging' && !cacheName.startsWith('mi-ganancia-staging-')) {
    errors.push('dist/sw.js no usa el prefijo de caché de staging.');
  } else if (
    mode === 'production'
    && (!cacheName.startsWith('mi-ganancia-') || cacheName.startsWith('mi-ganancia-staging-'))
  ) {
    errors.push('dist/sw.js no usa el prefijo de caché de producción.');
  }

  return errors;
}

export function findForbiddenValues({ files = [], forbidden = [] }) {
  const matches = [];
  const seen = new Set();
  const usable = forbidden
    .map(({ name, value }) => ({
      name,
      value: typeof value === 'string' ? value.trim() : '',
    }))
    .filter(({ value }) => value.length >= MIN_SCAN_VALUE_LENGTH);

  for (const file of files) {
    const content = typeof file.content === 'string' ? file.content : '';
    for (const { name, value } of usable) {
      if (!content.includes(value)) continue;
      const key = `${name}:${file.path}`;
      if (seen.has(key)) continue;
      seen.add(key);
      matches.push({ name, path: file.path });
    }
  }

  return matches;
}

export function missingRequiredEnvValues({ env = {}, names = [] }) {
  return names.filter((name) => envValue(env, name).length < MIN_SCAN_VALUE_LENGTH);
}

function readOption(argv, name) {
  const inline = argv.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);

  const index = argv.indexOf(name);
  return index >= 0 ? (argv[index + 1] || '') : '';
}

function readTextOrNull(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

function walkFiles(dir, base = dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, base, files);
    } else if (entry.isFile()) {
      files.push({
        path: path.relative(base, full).replaceAll('\\', '/'),
        full,
      });
    }
  }
  return files;
}

function envValue(env, name) {
  const value = env[name];
  return typeof value === 'string' ? value.trim() : '';
}

function readHostingPublicDirs(cwd) {
  let config;
  try {
    const raw = fs.readFileSync(path.join(cwd, 'firebase.json'), 'utf8').replace(/^\uFEFF/, '');
    config = JSON.parse(raw);
  } catch {
    return { error: 'No se pudo leer firebase.json para verificar hosting.public.' };
  }

  const hosting = Array.isArray(config.hosting)
    ? config.hosting
    : (config.hosting ? [config.hosting] : []);

  if (!hosting.length) {
    return { error: 'firebase.json no define hosting.public.' };
  }

  if (hosting.some((entry) => (
    !entry
    || typeof entry !== 'object'
    || typeof entry.public !== 'string'
    || !entry.public.trim()
  ))) {
    return { error: 'firebase.json no permite verificar hosting.public en todas las entradas.' };
  }

  const dirs = hosting.map((entry) => path.resolve(cwd, entry.public.trim()));

  return { dirs };
}

function canonicalPath(value) {
  const resolved = path.resolve(value);
  try {
    return fs.realpathSync.native(resolved);
  } catch {
    return resolved;
  }
}

function pathsEqual(left, right) {
  const leftPath = canonicalPath(left);
  const rightPath = canonicalPath(right);
  return process.platform === 'win32'
    ? leftPath.toLowerCase() === rightPath.toLowerCase()
    : leftPath === rightPath;
}

function resolveArtifactDir({ cwd, requested, config }) {
  if (config.error) {
    return { dir: path.resolve(cwd, requested || 'dist'), error: config.error };
  }

  if (requested) {
    const dir = path.resolve(cwd, requested);
    if (!config.dirs.some((publicDir) => pathsEqual(publicDir, dir))) {
      return {
        dir,
        error: 'El directorio validado no coincide con hosting.public de firebase.json.',
      };
    }
    return { dir };
  }

  if (config.dirs.length !== 1) {
    return {
      dir: config.dirs[0],
      error: 'firebase.json define varios directorios de publicación; usa --dir para indicar cuál se valida.',
    };
  }

  return { dir: config.dirs[0] };
}

function displayDir(cwd, dir) {
  const relative = path.relative(cwd, dir).replaceAll('\\', '/');
  return relative && !relative.startsWith('..') ? relative : dir;
}

export async function run(argv = process.argv.slice(2), options = {}) {
  const cwd = path.resolve(options.cwd || process.cwd());
  const processEnv = options.processEnv || process.env;
  const mode = readOption(argv, '--mode').trim().toLowerCase();
  const requestedDir = readOption(argv, '--dir').trim();
  const checkEnv = argv.includes('--env-check') || argv.includes('--require-env');
  const errors = [];

  if (mode !== 'production' && mode !== 'staging') {
    errors.push('Modo inválido o ausente. Usa --mode production|staging.');
    for (const error of errors) console.error(`[build-check] ${error}`);
    return 1;
  }

  const resolvedDir = resolveArtifactDir({
    cwd,
    requested: requestedDir,
    config: readHostingPublicDirs(cwd),
  });
  const dir = resolvedDir.dir;
  if (resolvedDir.error) errors.push(resolvedDir.error);

  const html = readTextOrNull(path.join(dir, 'index.html'));
  const sw = readTextOrNull(path.join(dir, 'sw.js'));
  errors.push(...assertArtifact({ mode, html, sw }));

  if (checkEnv) {
    const scanMode = mode === 'production' ? 'staging' : 'production';
    let currentEnv = {};
    let scanEnv = {};
    let envLoaded = true;

    try {
      const { loadEnv } = await import('vite');
      currentEnv = { ...loadEnv(mode, cwd, ''), ...processEnv };
      scanEnv = { ...loadEnv(scanMode, cwd, ''), ...processEnv };
    } catch {
      envLoaded = false;
      errors.push('No se pudo cargar la configuración de entorno para verificar el artefacto.');
    }

    if (envLoaded) {
      const declaredEnv = envValue(currentEnv, 'VITE_APP_ENV').toLowerCase();

      if (mode === 'staging' && declaredEnv && declaredEnv !== 'staging') {
        errors.push('VITE_APP_ENV no corresponde a un artefacto de staging.');
      }

      if (mode === 'production') {
        const validation = validateBuildEnvironment({ mode, env: currentEnv });
        errors.push(...validation.errors);
      }

      const requiredNames = requiredScanEnvNames(mode);
      for (const name of missingRequiredEnvValues({ env: scanEnv, names: requiredNames })) {
        errors.push(`Falta ${name} para verificar el artefacto de ${mode}.`);
      }

      if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
        const forbidden = requiredNames
          .map((name) => ({ name, value: envValue(scanEnv, name) }))
          .filter(({ value }) => value.length >= MIN_SCAN_VALUE_LENGTH);
        const files = walkFiles(dir)
          .filter((file) => SCAN_EXTENSIONS.has(path.extname(file.path).toLowerCase()))
          .map((file) => ({ path: file.path, content: fs.readFileSync(file.full, 'utf8') }));

        for (const match of findForbiddenValues({ files, forbidden })) {
          errors.push(`Valor de ${match.name} presente en ${match.path}.`);
        }
      }
    }
  }

  if (errors.length) {
    for (const error of errors) console.error(`[build-check] ${error}`);
    return 1;
  }

  console.log(`[build-check] ${displayDir(cwd, dir)} OK para ${mode}.`);
  return 0;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
const modulePath = path.resolve(fileURLToPath(import.meta.url));

if (invokedPath && invokedPath === modulePath) {
  run()
    .then((code) => { process.exitCode = code; })
    .catch((error) => {
      console.error(`[build-check] ${error.message}`);
      process.exitCode = 1;
    });
}
