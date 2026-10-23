import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const root = process.cwd();
const m7 = (p) => path.resolve(root, `dev/mocks/f7/${p}`);
const m8 = (p) => path.resolve(root, `dev/mocks/f8/${p}`);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^\.\.\/context\/AuthContext$/, replacement: m7('AuthContext.jsx') },
      { find: /^\.\.\/context\/BusinessContext$/, replacement: m7('BusinessContext.jsx') },
      { find: /^\.\.\/services\/sales$/, replacement: m8('services/sales.js') },
      { find: /^\.\.\/services\/localDb$/, replacement: m8('services/localDb.js') },
      { find: /^\.\.\/services\/syncEngine$/, replacement: m8('services/syncEngine.js') },
      { find: /^\.\.\/hooks\/useSyncStatus$/, replacement: m8('hooks/useSyncStatus.js') },
    ],
  },
});
