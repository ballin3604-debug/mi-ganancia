import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const state = vi.hoisted(() => ({
  sectorConfig: {
    defaultUnit: 'Unidad',
    unitLabels: ['Unidad', 'Paquete', 'Caja'],
    features: { dishes: false, stock: true, configurablePresentations: false },
  },
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ businessId: 'b1', user: { uid: 'u1' }, role: 'owner', hasPermission: () => true }),
}));

vi.mock('../context/BusinessContext', () => ({
  useBusiness: () => ({ sectorConfig: state.sectorConfig, tipoNegocio: 'tienda' }),
}));

vi.mock('../context/BranchContext', () => ({
  useBranches: () => ({ branches: [{ id: 'br1', isMain: true }], activeBranchId: 'br1' }),
}));

vi.mock('../hooks/useBranchStocks', () => ({
  useBranchStocks: () => [],
}));

vi.mock('../hooks/useImageUpload', () => ({
  useImageUpload: () => ({ pickImage: vi.fn() }),
}));

vi.mock('../services/products', () => ({
  getProducts: async () => [],
  addProduct: vi.fn(),
  updateProduct: vi.fn(),
  deleteProduct: vi.fn(),
  subscribeToProducts: () => () => {},
  subscribeToReplenishments: () => () => {},
  updateReplenishmentExpiry: vi.fn(),
}));

vi.mock('../services/categories', () => ({
  getCategories: async () => [],
  getDefaultCategories: () => [],
  subscribeToCategories: () => () => {},
  addCategory: vi.fn(),
  removeCategory: vi.fn(),
  renameCategory: vi.fn(),
}));

vi.mock('../services/branchStock', () => ({
  toStockMap: () => new Map(),
  setBranchStock: vi.fn(),
  getBranchStocks: async () => [],
}));

const { default: Inventory } = await import('./Inventory');

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/inventario']}>
      <Inventory />
    </MemoryRouter>
  );
}

describe('Inventario', () => {
  beforeEach(() => {
    state.sectorConfig = {
      defaultUnit: 'Unidad',
      unitLabels: ['Unidad', 'Paquete', 'Caja'],
      features: { dishes: false, stock: true, configurablePresentations: false },
    };
  });

  it('renderiza sin errores con stock visible', async () => {
    renderPage();
    expect((await screen.findAllByText(/Inventario/i)).length).toBeGreaterThan(0);
    expect(screen.getByText('Por reponer')).toBeTruthy();
  });

  it('oculta el filtro de stock cuando el dueño lo desactiva', async () => {
    state.sectorConfig = {
      defaultUnit: 'Unidad',
      unitLabels: ['Unidad', 'Paquete', 'Caja'],
      features: { dishes: false, stock: false, configurablePresentations: false },
    };
    renderPage();
    expect((await screen.findAllByText(/Inventario/i)).length).toBeGreaterThan(0);
    expect(screen.queryByText('Por reponer')).toBeNull();
  });
});
