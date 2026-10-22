import fs from 'node:fs';
import path from 'node:path';
import { cssVars } from '../src/design/tokens.js';

const target = path.resolve('src/styles/tokens.generated.css');
const banner = '/* GENERADO por scripts/gen-css-tokens.mjs desde src/design/tokens.js. No editar a mano. */';
const lines = [banner, '', ':root {'];
for (const [name, value] of Object.entries(cssVars)) {
  lines.push(`  ${name}: ${value};`);
}
lines.push('}', '');
const content = lines.join('\n');

if (process.argv.includes('--check')) {
  const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
  if (current !== content) {
    console.error(`DESACTUALIZADO: ${path.relative(process.cwd(), target)} no coincide con src/design/tokens.js`);
    console.error('Ejecuta: node scripts/gen-css-tokens.mjs');
    process.exit(1);
  }
  console.log(`OK: ${path.relative(process.cwd(), target)} coincide con tokens.js (${Object.keys(cssVars).length} variables)`);
} else {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
  console.log(`Escrito ${path.relative(process.cwd(), target)} (${Object.keys(cssVars).length} variables)`);
}
