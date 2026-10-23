import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const root = process.cwd();
const m = (p) => path.resolve(root, `dev/mocks/f7/${p}`);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^\.\.\/context\/AuthContext$/, replacement: m('AuthContext.jsx') },
      { find: /^\.\.\/\.\.\/context\/AuthContext$/, replacement: m('AuthContext.jsx') },
      { find: /^\.\.\/context\/BusinessContext$/, replacement: m('BusinessContext.jsx') },
      { find: /^\.\.\/\.\.\/context\/BusinessContext$/, replacement: m('BusinessContext.jsx') },
      { find: /^\.\.\/context\/BranchContext$/, replacement: m('BranchContext.jsx') },
      { find: /^\.\.\/\.\.\/context\/BranchContext$/, replacement: m('BranchContext.jsx') },
      { find: /^\.\.\/services\/expenses$/, replacement: m('services/expenses.js') },
      { find: /^\.\.\/\.\.\/services\/expenses$/, replacement: m('services/expenses.js') },
      { find: /^\.\.\/services\/cashier$/, replacement: m('services/cashier.js') },
      { find: /^\.\.\/\.\.\/services\/cashier$/, replacement: m('services/cashier.js') },
      { find: /^\.\.\/services\/branches$/, replacement: m('services/branches.js') },
      { find: /^\.\.\/services\/branchStock$/, replacement: m('services/branchStock.js') },
      { find: /^\.\.\/\.\.\/services\/branchStock$/, replacement: m('services/branchStock.js') },
      { find: /^\.\.\/services\/products$/, replacement: m('services/products.js') },
      { find: /^\.\.\/\.\.\/services\/products$/, replacement: m('services/products.js') },
      { find: /^\.\.\/services\/categories$/, replacement: m('services/categories.js') },
      { find: /^\.\.\/services\/businessSettings$/, replacement: m('services/businessSettings.js') },
      { find: /^\.\.\/services\/backup$/, replacement: m('services/backup.js') },
      { find: /^\.\.\/services\/payments$/, replacement: m('services/payments.js') },
      { find: /^\.\.\/hooks\/useImageUpload$/, replacement: m('hooks/useImageUpload.js') },
      { find: /^\.\.\/\.\.\/hooks\/useImageUpload$/, replacement: m('hooks/useImageUpload.js') },
      { find: /^\.\.\/hooks\/useBranchStocks$/, replacement: m('hooks/useBranchStocks.js') },
    ],
  },
});
