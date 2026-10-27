import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distDir = path.resolve(__dirname, '../dist');
const swPath = path.resolve(distDir, 'sw.js');
const indexPath = path.resolve(distDir, 'index.html');
const VALID_MODES = new Set(['production', 'staging', 'test']);

function readMode(argv) {
  const inline = argv.find((arg) => arg.startsWith('--mode='));
  if (inline) return inline.slice('--mode='.length).trim().toLowerCase();

  const index = argv.indexOf('--mode');
  if (index >= 0) return (argv[index + 1] || '').trim().toLowerCase();
  return '';
}

const cliMode = readMode(process.argv.slice(2));
const envMode = (process.env.VITE_APP_ENV || '').trim().toLowerCase();

if (cliMode && !VALID_MODES.has(cliMode)) {
  console.error('[PWA BUILD] Modo CLI inválido. Usa production, staging o test.');
  process.exit(1);
}
if (envMode && !VALID_MODES.has(envMode)) {
  console.error('[PWA BUILD] VITE_APP_ENV inválido.');
  process.exit(1);
}
if (cliMode && envMode && cliMode !== envMode) {
  console.error('[PWA BUILD] Modo inconsistente entre CLI y VITE_APP_ENV.');
  process.exit(1);
}

const buildMode = cliMode || envMode || 'production';

// Recursive function to get all files in a directory
function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      getAllFiles(filePath, fileList);
    } else {
      const relPath = path.relative(distDir, filePath).replace(/\\/g, '/');
      fileList.push(relPath);
    }
  });
  return fileList;
}

if (!fs.existsSync(indexPath)) {
  console.error('[PWA BUILD] Error: no existe dist/index.html. Ejecuta vite build primero.');
  process.exit(1);
}

try {
  if (fs.existsSync(swPath)) {
    // El build de Vite y el del service worker deben coincidir. Si el HTML
    // dice staging pero el SW se construyó como production (o al revés),
    // se aborta en vez de publicar una mezcla silenciosa.
    const html = fs.readFileSync(indexPath, 'utf8');
    const htmlIsStaging = html.includes('name="mg-environment" content="staging"');
    if (buildMode === 'staging' && !htmlIsStaging) {
      console.error('[PWA BUILD] El modo es staging pero dist/index.html no tiene la marca de staging. ¿Se olvidó --mode staging en Vite?');
      process.exit(1);
    }
    if (buildMode !== 'staging' && htmlIsStaging) {
      console.error('[PWA BUILD] dist/index.html es de staging pero el modo del service worker no lo es.');
      process.exit(1);
    }

    const buildModeMarkers = [...html.matchAll(
      /<meta\b(?=[^>]*\sname\s*=\s*["']mg-build-mode["'])[^>]*>/gi,
    )];
    const markedBuildMode = buildModeMarkers.length === 1
      ? (buildModeMarkers[0][0].match(/\scontent\s*=\s*["']([^"']*)["']/i)?.[1] ?? '')
      : '';
    if (buildModeMarkers.length !== 1 || markedBuildMode !== buildMode) {
      console.error('[PWA BUILD] El modo solicitado no coincide con la marca de modo generada por Vite.');
      process.exit(1);
    }

    const content = fs.readFileSync(swPath, 'utf8');
    const timestamp = Date.now();
    const cachePrefix = buildMode === 'staging' ? 'mi-ganancia-staging' : 'mi-ganancia';
    const newCacheName = `${cachePrefix}-${timestamp}`;

    // Get all files in dist directory to build the precache list dynamically
    const allFiles = getAllFiles(distDir);
    const assets = allFiles
      .filter((file) => file !== 'sw.js' && !file.endsWith('.map'))
      .map((file) => `/${file}`);

    // Ensure root path '/' is in precache list for offline root load
    if (!assets.includes('/')) {
      assets.unshift('/');
    }

    // Replace the CACHE_NAME and STATIC_ASSETS line. BUILD_MODE deja el modo
    // visible en el SW generado; se elimina antes para que el script sea
    // idempotente si se ejecuta dos veces sobre el mismo dist.
    const withoutBuildMode = content.replace(/\nconst BUILD_MODE = '[^']*';/, '');
    const updatedContent = withoutBuildMode
      .replace(/const CACHE_NAME = '[^']*';/, `const CACHE_NAME = '${newCacheName}';\nconst BUILD_MODE = '${buildMode}';`)
      .replace(/const STATIC_ASSETS = \[[^\]]*\];/, `const STATIC_ASSETS = ${JSON.stringify(assets, null, 2)};`);

    fs.writeFileSync(swPath, updatedContent, 'utf8');
    console.log(`[PWA BUILD] Mode: ${buildMode}`);
    console.log(`[PWA BUILD] Pre-cache assets compiled: ${assets.length} files.`);
    console.log(`[PWA BUILD] Service Worker cache successfully versioned to: ${newCacheName}`);
  } else {
    console.error(`[PWA BUILD] Error: Service Worker file not found at ${swPath}`);
    process.exit(1);
  }
} catch (err) {
  console.error('[PWA BUILD] Exception during versioning and pre-caching:', err);
  process.exit(1);
}
