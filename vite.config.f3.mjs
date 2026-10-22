import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const root = process.cwd();

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^\.\.\/context\/AuthContext$/, replacement: path.resolve(root, 'dev/mocks/AuthContext.jsx') },
      { find: /^\.\.\/context\/BusinessContext$/, replacement: path.resolve(root, 'dev/mocks/BusinessContext.jsx') },
    ],
  },
});
