import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { environmentHtmlPlugin } from './src/config/buildModeHtml.js';
import { validateBuildEnvironment } from './src/config/environmentRules.js';

export default defineConfig(({ command, mode }) => {
  if (command === 'build') {
    const buildEnv = loadEnv(mode, process.cwd(), '');
    const validation = validateBuildEnvironment({ mode, env: buildEnv });

    if (validation.errors.length) {
      throw new Error(`[${mode}] Configuración inválida: ${validation.error}`);
    }
  }

  return {
    plugins: [react(), environmentHtmlPlugin(mode, command)],
  };
});
