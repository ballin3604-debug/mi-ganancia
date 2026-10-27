import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  addReplenishment: vi.fn(),
  applyPurchaseStock: vi.fn(),
  getReplenishmentConcepts: vi.fn(),
  addReplenishmentConcepts: vi.fn(),
  subscribeToSuppliers: vi.fn(),
  addSupplier: vi.fn(),
  savePurchaseDraft: vi.fn(),
  clearPurchaseDraft: vi.fn(),
}));

vi.mock('../services/products', () => ({ addReplenishment: mocks.addReplenishment }));
vi.mock('../services/branchStock', () => ({ applyPurchaseStock: mocks.applyPurchaseStock }));
vi.mock('../services/replenishmentConcepts', () => ({
  getReplenishmentConcepts: mocks.getReplenishmentConcepts,
  addReplenishmentConcepts: mocks.addReplenishmentConcepts,
}));
vi.mock('../services/suppliers', () => ({
  subscribeToSuppliers: mocks.subscribeToSuppliers,
  addSupplier: mocks.addSupplier,
}));
vi.mock('../services/purchaseDraft', () => ({
  savePurchaseDraft: mocks.savePurchaseDraft,
  clearPurchaseDraft: mocks.clearPurchaseDraft,
}));
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'user-test' }, role: 'owner', hasPermission: () => true }),
}));
vi.mock('../context/BusinessContext', () => ({
  useBusiness: () => ({ business: {}, settings: {} }),
}));
vi.mock('../context/BranchContext', () => ({
  useBranches: () => ({ branches: [], activeBranchId: null }),
}));
vi.mock('./Receipt', () => ({ printReceipt: vi.fn() }));

import PurchaseForm from './PurchaseForm';

describe('compras con presentaciones configurables', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.addReplenishment.mockResolvedValue({ id: 'purchase-test' });
    mocks.applyPurchaseStock.mockResolvedValue(undefined);
    mocks.getReplenishmentConcepts.mockReturnValue(new Promise(() => {}));
    mocks.subscribeToSuppliers.mockReturnValue(() => {});
  });

  it('convierte el empaque comprado a unidades base y guarda el costo unitario', async () => {
    const product = {
      id: 'product-test',
      name: 'Bebida de prueba',
      price: 12,
      supplierPrice: 5,
      stock: 10,
      presentations: [
        { id: 'unit', name: 'Botella', factor: 1, price: 12, isBase: true },
        { id: 'six', name: 'Six-pack', factor: 6, price: 65, isBase: false },
      ],
    };
    render(<PurchaseForm businessId="business-test" product={product} />);

    fireEvent.click(screen.getByText('Por presentación'));
    fireEvent.change(screen.getByPlaceholderText('Ej: 10'), { target: { value: '3' } });
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'six' } });
    fireEvent.change(screen.getAllByPlaceholderText('0.00')[0], { target: { value: '42' } });
    fireEvent.change(screen.getAllByPlaceholderText('0.00')[1], { target: { value: '14' } });
    fireEvent.submit(screen.getByText('Confirmar compra').closest('form'));
    await waitFor(() => expect(mocks.addReplenishment).toHaveBeenCalledTimes(1));
    expect(mocks.applyPurchaseStock).toHaveBeenCalledWith(expect.objectContaining({
      qty: 18,
      fields: expect.objectContaining({
        supplierPrice: 7,
        presentations: [
          { id: 'unit', name: 'Botella', factor: 1, price: 14, isBase: true },
          { id: 'six', name: 'Six-pack', factor: 6, price: 65, isBase: false },
        ],
      }),
    }));
    expect(mocks.addReplenishment).toHaveBeenCalledWith('business-test', expect.objectContaining({
      quantity: 18,
      supplierPrice: 7,
      purchaseUnitType: 'package',
      packageSize: 6,
      packageCount: 3,
    }));
  });
});
