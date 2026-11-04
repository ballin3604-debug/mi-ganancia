import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { addProduct } from '../services/products';

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
    localStorage.removeItem('mg-product-form-draft');
    vi.mocked(addProduct).mockClear();
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

  it('permite crear con cero paquetes y lo convierte a unidades al guardar', async () => {
    renderPage();
    fireEvent.click((await screen.findAllByRole('button', { name: 'Nuevo Producto' }))[0]);

    fireEvent.change(screen.getByPlaceholderText('Ej: Coca-Cola 2L'), { target: { value: 'Agua' } });
    fireEvent.change(screen.getByText('Precio venta por paquete (Bs) *').parentElement.querySelector('input'), { target: { value: '48' } });
    fireEvent.change(screen.getByText('Unidades por paquete *').parentElement.querySelector('input'), { target: { value: '12' } });

    fireEvent.click(screen.getByRole('button', { name: 'Guardar producto' }));
    await waitFor(() => expect(addProduct).toHaveBeenCalled());
    expect(addProduct).toHaveBeenCalledWith('b1', expect.objectContaining({
      name: 'Agua',
      price: 0,
      packPrice: '48',
      packageSize: '12',
      stock: 0,
    }));
  });

  it('convierte paquetes iniciales y su costo a unidades de inventario', async () => {
    renderPage();
    fireEvent.click((await screen.findAllByRole('button', { name: 'Nuevo Producto' }))[0]);

    fireEvent.change(screen.getByPlaceholderText('Ej: Coca-Cola 2L'), { target: { value: 'Gaseosa' } });
    fireEvent.change(screen.getByText('Precio venta por paquete (Bs) *').parentElement.querySelector('input'), { target: { value: '60' } });
    fireEvent.change(screen.getByText('Unidades por paquete *').parentElement.querySelector('input'), { target: { value: '6' } });
    fireEvent.change(screen.getByText('¿Cuántos paquetes tienes? *').parentElement.querySelector('input'), { target: { value: '2' } });
    fireEvent.change(screen.getByText('Costo por paquete (opcional)').parentElement.querySelector('input'), { target: { value: '30' } });

    fireEvent.click(screen.getByRole('button', { name: 'Guardar producto' }));
    await waitFor(() => expect(addProduct).toHaveBeenCalled());
    expect(addProduct).toHaveBeenCalledWith('b1', expect.objectContaining({
      stock: 12,
      supplierPrice: 5,
      packPrice: '60',
      packageSize: '6',
    }));
  });

  it('guarda el paquete como única opción de venta si el precio unitario se deja vacío', async () => {
    state.sectorConfig = {
      defaultUnit: 'Botella',
      unitLabels: ['Botella', 'Six-pack', 'Caja'],
      features: { dishes: false, stock: true, configurablePresentations: true },
    };
    renderPage();
    fireEvent.click((await screen.findAllByRole('button', { name: 'Nuevo Producto' }))[0]);

    fireEvent.change(screen.getByPlaceholderText('Ej: Coca-Cola 2L'), { target: { value: 'Bebida' } });
    fireEvent.change(screen.getByText('Precio venta por paquete (Bs) *').parentElement.querySelector('input'), { target: { value: '60' } });
    fireEvent.change(screen.getByText('Unidades por paquete *').parentElement.querySelector('input'), { target: { value: '6' } });

    fireEvent.click(screen.getByRole('button', { name: 'Guardar producto' }));
    await waitFor(() => expect(addProduct).toHaveBeenCalled());
    expect(addProduct).toHaveBeenCalledWith('b1', expect.objectContaining({
      price: 0,
      presentations: [
        { id: 'base-unit', name: 'Botella', factor: 1, price: 0, isBase: true },
        { id: 'new-package', name: 'Paquete', factor: 6, price: 60, isBase: false },
      ],
    }));
  });
});
