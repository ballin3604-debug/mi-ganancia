import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const root = process.cwd();

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^\.\.\/context\/AuthContext$/, replacement: path.resolve(root, 'dev/mocks/f4/AuthContext.jsx') },
      { find: /^\.\.\/context\/BusinessContext$/, replacement: path.resolve(root, 'dev/mocks/f4/BusinessContext.jsx') },
      { find: /^\.\.\/context\/BranchContext$/, replacement: path.resolve(root, 'dev/mocks/f4/BranchContext.jsx') },
      { find: /^\.\.\/services\/sales$/, replacement: path.resolve(root, 'dev/mocks/f4/services/sales.js') },
      { find: /^\.\.\/services\/products$/, replacement: path.resolve(root, 'dev/mocks/f4/services/products.js') },
      { find: /^\.\.\/services\/expenses$/, replacement: path.resolve(root, 'dev/mocks/f4/services/expenses.js') },
      { find: /^\.\.\/services\/branchStock$/, replacement: path.resolve(root, 'dev/mocks/f4/services/branchStock.js') },
      { find: /^\.\.\/hooks\/useBranchStocks$/, replacement: path.resolve(root, 'dev/mocks/f4/hooks/useBranchStocks.js') },
      { find: /^\.\.\/\.\.\/hooks\/useSyncStatus$/, replacement: path.resolve(root, 'dev/mocks/f4/hooks/useSyncStatus.js') },
    ],
  },
});
