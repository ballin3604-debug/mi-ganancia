import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const root = process.cwd();

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^\.\.\/context\/AuthContext$/, replacement: path.resolve(root, 'dev/mocks/f5/AuthContext.jsx') },
      { find: /^\.\.\/context\/BranchContext$/, replacement: path.resolve(root, 'dev/mocks/f5/BranchContext.jsx') },
      { find: /^\.\.\/services\/sales$/, replacement: path.resolve(root, 'dev/mocks/f6/services/sales.js') },
      { find: /^\.\.\/services\/expenses$/, replacement: path.resolve(root, 'dev/mocks/f6/services/expenses.js') },
      { find: /^\.\.\/services\/products$/, replacement: path.resolve(root, 'dev/mocks/f6/services/products.js') },
      { find: /^\.\.\/services\/businessSettings$/, replacement: path.resolve(root, 'dev/mocks/f6/services/businessSettings.js') },
      { find: /^\.\.\/services\/branchStock$/, replacement: path.resolve(root, 'dev/mocks/f5/services/branchStock.js') },
      { find: /^\.\.\/hooks\/useBranchStocks$/, replacement: path.resolve(root, 'dev/mocks/f5/hooks/useBranchStocks.js') },
    ],
  },
});
