import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const state = vi.hoisted(() => ({ saved: null }));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    businessId: 'b1',
    user: { uid: 'u1' },
    sellerName: 'Caja 1',
    hasPermission: () => true,
  }),
}));

vi.mock('../../context/BusinessContext', () => ({
  useBusiness: () => ({
    tipoNegocio: 'tienda',
    sectorConfig: { features: { scanner: false, configurablePresentations: false } },
  }),
}));

vi.mock('../../context/BranchContext', () => ({
  useBranches: () => ({
    branches: [{ id: 'br1', name: 'Casa matriz', isMain: true }],
    activeBranchId: 'br1',
  }),
}));

vi.mock('../../services/suppliers', () => ({
  subscribeToSuppliers: () => () => {},
  addSupplier: vi.fn(async () => {}),
}));

vi.mock('../../services/purchaseProformas', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getProformaDraft: vi.fn(async () => null),
    saveProformaDraft: vi.fn(async () => {}),
    clearProformaDraft: vi.fn(async () => {}),
    savePurchaseProforma: vi.fn(async (businessId, payload) => {
      state.saved = { businessId, payload };
      return {
        proformaId: 'pf-1',
        number: payload.header.number,
        date: payload.header.date,
        supplier: payload.header.supplier,
        receivedBy: payload.header.receivedBy,
        itemCount: payload.items.length,
        units: 1,
        packages: 1,
        total: 20,
        totalExtra: 0,
        discount: 0,
        beforeDiscount: 20,
        alerts: 0,
        items: [],
      };
    }),
  };
});

const { default: ProformaForm } = await import('./ProformaForm');

function renderForm(overrides = {}) {
  return render(
    <ProformaForm
      products={[]}
      categories={['Bebidas']}
      replenishments={[]}
      onCancel={vi.fn()}
      onSaved={vi.fn()}
      {...overrides}
    />
  );
}

describe('producto nuevo desde la proforma', () => {
  beforeEach(() => {
    state.saved = null;
    window.scrollTo = vi.fn();
  });

  it('tiene una acción visible y crea el producto al guardar', async () => {
    const onSaved = vi.fn();
    renderForm({ onSaved });

    const newProductButton = await screen.findByRole('button', { name: 'NUEVO PRODUCTO' });
    fireEvent.click(newProductButton);

    expect(screen.getByRole('dialog', { name: 'Nuevo producto para la proforma' })).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Nombre del producto'), {
      target: { value: 'Cerveza Nueva 620 ml' },
    });
    fireEvent.change(screen.getByLabelText('Precio de venta de la unidad'), {
      target: { value: '12' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar a la proforma' }));

    expect((await screen.findAllByText('Cerveza Nueva 620 ml')).length).toBeGreaterThan(0);

    const priceInputs = screen.getAllByLabelText('Precio de compra del momento por unidad de Cerveza Nueva 620 ml');
    fireEvent.change(priceInputs[0], { target: { value: '20' } });
    fireEvent.click(screen.getByRole('button', { name: /GUARDAR Y PROCESAR/ }));

    await waitFor(() => expect(state.saved).toBeTruthy());
    const item = state.saved.payload.items[0];
    expect(item.isNewProduct).toBe(true);
    expect(item.productName).toBe('Cerveza Nueva 620 ml');
    expect(item.salePrice).toBe('12');
    expect(item.newProduct).toMatchObject({
      name: 'Cerveza Nueva 620 ml',
      category: 'Otros',
      price: 12,
    });
    expect(item.packagePrice).toBe('20');
    expect(onSaved).toHaveBeenCalledTimes(1);
  });
});
