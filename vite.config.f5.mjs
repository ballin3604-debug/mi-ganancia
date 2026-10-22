import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const root = process.cwd();

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^\.\.\/context\/AuthContext$/, replacement: path.resolve(root, 'dev/mocks/f5/AuthContext.jsx') },
      { find: /^\.\.\/context\/BusinessContext$/, replacement: path.resolve(root, 'dev/mocks/f5/BusinessContext.jsx') },
      { find: /^\.\.\/context\/BranchContext$/, replacement: path.resolve(root, 'dev/mocks/f5/BranchContext.jsx') },
      { find: /^\.\.\/services\/products$/, replacement: path.resolve(root, 'dev/mocks/f5/services/products.js') },
      { find: /^\.\.\/services\/sales$/, replacement: path.resolve(root, 'dev/mocks/f5/services/sales.js') },
      { find: /^\.\.\/services\/customers$/, replacement: path.resolve(root, 'dev/mocks/f5/services/customers.js') },
      { find: /^\.\.\/services\/categories$/, replacement: path.resolve(root, 'dev/mocks/f5/services/categories.js') },
      { find: /^\.\.\/services\/cashier$/, replacement: path.resolve(root, 'dev/mocks/f5/services/cashier.js') },
      { find: /^\.\.\/services\/cartDraft$/, replacement: path.resolve(root, 'dev/mocks/f5/services/cartDraft.js') },
      { find: /^\.\.\/services\/branchStock$/, replacement: path.resolve(root, 'dev/mocks/f5/services/branchStock.js') },
      { find: /^\.\.\/hooks\/useBranchStocks$/, replacement: path.resolve(root, 'dev/mocks/f5/hooks/useBranchStocks.js') },
      { find: /^\.\.\/components\/Receipt$/, replacement: path.resolve(root, 'dev/mocks/f5/Receipt.jsx') },
    ],
  },
});
