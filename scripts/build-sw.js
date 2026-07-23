import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distDir = path.resolve(__dirname, '../dist');
const swPath = path.resolve(distDir, 'sw.js');

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

try {
  if (fs.existsSync(swPath)) {
    const content = fs.readFileSync(swPath, 'utf8');
    const timestamp = Date.now();
    const newCacheName = `mi-ganancia-${timestamp}`;

    // Get all files in dist directory to build the precache list dynamically
    const allFiles = getAllFiles(distDir);
    const assets = allFiles
      .filter((file) => file !== 'sw.js' && !file.endsWith('.map'))
      .map((file) => `/${file}`);

    // Ensure root path '/' is in precache list for offline root load
    if (!assets.includes('/')) {
      assets.unshift('/');
    }

    // Replace the CACHE_NAME and STATIC_ASSETS line
    const updatedContent = content
      .replace(/const CACHE_NAME = '[^']*';/, `const CACHE_NAME = '${newCacheName}';`)
      .replace(/const STATIC_ASSETS = \[[^\]]*\];/, `const STATIC_ASSETS = ${JSON.stringify(assets, null, 2)};`);

    fs.writeFileSync(swPath, updatedContent, 'utf8');
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
