import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { addProduct, updateProduct } from '../services/products';

const state = vi.hoisted(() => ({
  tipoNegocio: 'tienda',
  products: [],
  categories: [],
  replenishments: [],
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
  useBusiness: () => ({ sectorConfig: state.sectorConfig, tipoNegocio: state.tipoNegocio }),
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
  getProducts: async () => state.products,
  addProduct: vi.fn(),
  updateProduct: vi.fn(),
  deleteProduct: vi.fn(),
  subscribeToProducts: () => () => {},
  subscribeToReplenishments: (businessId, callback) => {
    callback(state.replenishments);
    return () => {};
  },
  updateReplenishmentExpiry: vi.fn(),
}));

vi.mock('../services/categories', () => ({
  getCategories: async () => state.categories,
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

function dateInDays(days) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

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
    vi.mocked(updateProduct).mockClear();
    state.products = [];
    state.categories = [];
    state.replenishments = [];
    state.tipoNegocio = 'tienda';
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

  it('licorería: guarda precios por presentación y costo por caja', async () => {
    state.tipoNegocio = 'licorera';
    state.sectorConfig = {
      defaultUnit: 'Unidad',
      unitLabels: ['Unidad', 'Chipa', 'Caja'],
      features: { dishes: false, stock: true, configurablePresentations: true },
    };
    renderPage();
    fireEvent.click((await screen.findAllByRole('button', { name: 'Nuevo Producto' }))[0]);

    expect(screen.getByText('+ Gestionar categorías')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Vinos y tragos/ })).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText('Ej: Coca-Cola 2L'), { target: { value: 'Amstel' } });
    fireEvent.change(screen.getByLabelText('Precio Unidad'), { target: { value: '8' } });
    fireEvent.change(screen.getByLabelText('Precio Chipa'), { target: { value: '90' } });
    fireEvent.change(screen.getByLabelText('Precio Caja fría'), { target: { value: '170' } });
    fireEvent.change(screen.getByLabelText('Costo por caja'), { target: { value: '144' } });
    fireEvent.change(screen.getByText('Stock Actual *').parentElement.querySelector('input'), { target: { value: '24' } });

    fireEvent.click(screen.getByRole('button', { name: 'Guardar producto' }));
    await waitFor(() => expect(addProduct).toHaveBeenCalled());
    expect(addProduct).toHaveBeenCalledWith('b1', expect.objectContaining({
      name: 'Amstel',
      category: 'Cervezas',
      price: 8,
      stock: 24,
      supplierPrice: 6,
      packageSize: '24',
      unit: 'Unidad',
      presentations: [
        { id: 'licor-unidad', name: 'Unidad', factor: 1, price: 8, isBase: true },
        { id: 'licor-chipa', name: 'Chipa', factor: 12, price: 90, isBase: false },
        { id: 'licor-cajaFria', name: 'Caja fría', factor: 24, price: 170, isBase: false },
      ],
    }));
  });

  it('muestra los paquetes disponibles calculados desde el stock', async () => {
    state.products = [{
      id: 'p-cuadro',
      name: 'Cuadro',
      category: 'Cervezas',
      price: 8,
      stock: 192,
      minStock: 5,
      brand: '',
      barcode: null,
      isDish: false,
      unit: 'Unidad',
      unitLabel: 'Unidad',
      presentations: [
        { id: 'licor-unidad', name: 'Unidad', factor: 1, price: 8, isBase: true },
        { id: 'licor-chipa', name: 'Chipa', factor: 12, price: 90, isBase: false },
      ],
    }];
    renderPage();

    const badges = await screen.findAllByText(/Chipa x16 disp\./);
    expect(badges.length).toBeGreaterThan(0);
    expect(screen.queryByText(/192 und/)).toBeNull();
  });

  it('licorería: permite elegir una categoría nueva con la plantilla de cajas', async () => {
    state.tipoNegocio = 'licorera';
    state.sectorConfig = {
      defaultUnit: 'Unidad',
      unitLabels: ['Unidad', 'Chipa', 'Caja'],
      features: { dishes: false, stock: true, configurablePresentations: true },
    };
    state.categories = ['Micheladas'];
    renderPage();
    fireEvent.click((await screen.findAllByRole('button', { name: 'Nuevo Producto' }))[0]);

    const customButton = (await screen.findAllByRole('button', { name: /Micheladas/ }))
      .find((button) => button.hasAttribute('aria-pressed') && !button.closest('[role="group"]'));
    fireEvent.click(customButton);

    expect(screen.getByLabelText('Precio Unidad')).toBeTruthy();
    expect(screen.getByLabelText('Precio Caja caliente')).toBeTruthy();
    expect(screen.getByLabelText('Precio Caja fría')).toBeTruthy();
    expect(screen.queryByLabelText('Precio Chipa')).toBeNull();
    expect(screen.getByLabelText('Costo por caja')).toBeTruthy();
    expect(screen.getByLabelText('Unidades por caja')).toBeTruthy();
  });

  it('licorería: prellena el costo por caja en bolivianos enteros', async () => {
    state.tipoNegocio = 'licorera';
    state.sectorConfig = {
      defaultUnit: 'Unidad',
      unitLabels: ['Unidad', 'Chipa', 'Caja'],
      features: { dishes: false, stock: true, configurablePresentations: true },
    };
    // Costo por unidad con basura de coma flotante (típico tras comprar:
    // Bs 145,92 ÷ 24 unidades = 6,080000000000001).
    state.products = [{
      id: 'p1',
      name: 'Pilsener',
      category: 'Cervezas',
      price: 8,
      stock: 24,
      minStock: 5,
      brand: '',
      barcode: null,
      isDish: false,
      unit: 'Unidad',
      unitLabel: 'Unidad',
      supplierPrice: 6.0800000000000009,
      packageSize: '24',
      presentations: [
        { id: 'licor-unidad', name: 'Unidad', factor: 1, price: 8, isBase: true },
        { id: 'licor-cajaFria', name: 'Caja fría', factor: 24, price: 170, isBase: false },
      ],
    }];
    renderPage();
    await waitFor(() => expect(screen.getAllByText('Pilsener').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText('Pilsener')[0]);
    fireEvent.click(await screen.findByRole('button', { name: 'Editar Producto' }));

    const costField = await screen.findByLabelText('Costo por caja');
    expect(costField.value).toBe('146');
    fireEvent.change(costField, { target: { value: '145.92' } });
    expect(costField.value).toBe('146');
    expect(screen.getByLabelText('Unidades por caja')).toBeTruthy();
  });

  it('licorería: avisa vencimientos dentro de 3 meses', async () => {
    state.tipoNegocio = 'licorera';
    state.sectorConfig = {
      defaultUnit: 'Unidad',
      unitLabels: ['Unidad', 'Chipa', 'Caja'],
      expiryWarningDays: 90,
      features: { dishes: false, stock: true, configurablePresentations: true },
    };
    state.products = [
      {
        id: 'p-cerveza',
        name: 'Pilsener',
        category: 'Cervezas',
        price: 8,
        stock: 24,
        minStock: 5,
        brand: '',
        barcode: null,
        isDish: false,
        unit: 'Unidad',
        unitLabel: 'Unidad',
        presentations: [],
      },
      {
        id: 'p-whisky',
        name: 'Whisky',
        category: 'Destilados',
        price: 120,
        stock: 3,
        minStock: 1,
        brand: '',
        barcode: null,
        isDish: false,
        unit: 'Unidad',
        unitLabel: 'Unidad',
        presentations: [],
      },
    ];
    state.replenishments = [
      { id: 'r-cerveza', productId: 'p-cerveza', expiryDate: dateInDays(60), quantity: 24 },
      { id: 'r-whisky', productId: 'p-whisky', expiryDate: dateInDays(120), quantity: 3 },
    ];

    renderPage();
    await waitFor(() => expect(screen.getAllByText('Pilsener').length).toBeGreaterThan(0));

    expect((await screen.findAllByText(/\d+d para vencer/)).length).toBeGreaterThan(0);
    expect(screen.queryByText(/120d para vencer/)).toBeNull();
    expect(screen.getByRole('button', { name: /Por vencer/ }).textContent).toContain('1');
  });

  it('otros rubros: sigue avisando recién a 30 días', async () => {
    state.products = [{
      id: 'p-gaseosa',
      name: 'Gaseosa',
      category: 'Bebidas',
      price: 6,
      stock: 24,
      minStock: 5,
      brand: '',
      barcode: null,
      isDish: false,
      unit: 'Unidad',
      unitLabel: 'Unidad',
      presentations: [],
    }];
    state.replenishments = [
      { id: 'r-gaseosa', productId: 'p-gaseosa', expiryDate: dateInDays(60), quantity: 24 },
    ];

    renderPage();
    await waitFor(() => expect(screen.getAllByText('Gaseosa').length).toBeGreaterThan(0));

    expect(screen.queryByText(/\d+d para vencer/)).toBeNull();
    expect(screen.getByRole('button', { name: /Por vencer/ }).textContent).not.toContain('1');
  });

  it('licorería: usa el vencimiento cargado en el producto aunque no tenga compras', async () => {
    state.tipoNegocio = 'licorera';
    state.sectorConfig = {
      defaultUnit: 'Unidad',
      unitLabels: ['Unidad', 'Chipa', 'Caja'],
      expiryWarningDays: 90,
      features: { dishes: false, stock: true, configurablePresentations: true },
    };
    state.products = [{
      id: 'p-cerveza',
      name: 'Pilsener',
      category: 'Cervezas',
      price: 8,
      stock: 24,
      minStock: 5,
      brand: '',
      barcode: null,
      isDish: false,
      unit: 'Unidad',
      unitLabel: 'Unidad',
      presentations: [],
      expiryDate: dateInDays(60),
    }];
    state.replenishments = [];

    renderPage();
    await waitFor(() => expect(screen.getAllByText('Pilsener').length).toBeGreaterThan(0));

    expect((await screen.findAllByText(/\d+d para vencer/)).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Por vencer/ }).textContent).toContain('1');
  });

  it('permite cargar el vencimiento desde la ficha sin registrar una compra', async () => {
    state.products = [{
      id: 'p-casino',
      name: 'CASINO CHICO',
      category: 'Cigarros',
      price: 6,
      stock: 10,
      minStock: 5,
      brand: '',
      barcode: null,
      isDish: false,
      unit: 'Unidad',
      unitLabel: 'Unidad',
      presentations: [],
    }];

    renderPage();
    await waitFor(() => expect(screen.getAllByText('CASINO CHICO').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText('CASINO CHICO')[0]);
    fireEvent.click(await screen.findByRole('button', { name: 'Editar Producto' }));

    const expiryField = screen.getByText('Fecha de Vencimiento (opcional)').parentElement.querySelector('input');
    const expiry = dateInDays(60);
    fireEvent.change(expiryField, { target: { value: expiry } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar Cambios' }));

    await waitFor(() => expect(updateProduct).toHaveBeenCalled());
    expect(updateProduct).toHaveBeenCalledWith('p-casino', expect.objectContaining({
      expiryDate: expiry,
    }));
  });

  it('al recargar mientras se edita, actualiza el producto y no crea un duplicado', async () => {
    state.products = [{
      id: 'p-casino',
      name: 'CASINO CHICO',
      category: 'Cigarros',
      price: 6,
      stock: 10,
      minStock: 5,
      brand: '',
      barcode: null,
      isDish: false,
      unit: 'Unidad',
      unitLabel: 'Unidad',
      imageData: '',
      presentations: [],
    }];

    const first = renderPage();
    await waitFor(() => expect(screen.getAllByText('CASINO CHICO').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText('CASINO CHICO')[0]);
    fireEvent.click(await screen.findByRole('button', { name: 'Editar Producto' }));

    await waitFor(() => {
      const draft = JSON.parse(localStorage.getItem('mg-product-form-draft'));
      expect(draft.editingId).toBe('p-casino');
    });

    // Simula que el sistema cerró la app mientras buscaba la foto.
    first.unmount();
    renderPage();

    expect(await screen.findByText('Editar Producto')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar Cambios' }));

    await waitFor(() => expect(updateProduct).toHaveBeenCalled());
    expect(updateProduct).toHaveBeenCalledWith('p-casino', expect.objectContaining({
      name: 'CASINO CHICO',
    }));
    expect(addProduct).not.toHaveBeenCalled();
  });
});
