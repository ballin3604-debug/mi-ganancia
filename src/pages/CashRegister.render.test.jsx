import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    businessId: 'b1',
    user: { uid: 'u1' },
    sellerName: 'Ana Cajera',
    role: 'owner',
  }),
}));

vi.mock('../context/BranchContext', () => ({
  useBranches: () => ({
    branches: [{ id: 'br1', name: 'Sucursal Central', isMain: true }],
    activeBranch: { id: 'br1', name: 'Sucursal Central', isMain: true },
    activeBranchId: 'br1',
    selectBranch: vi.fn(),
  }),
}));

const { default: CashRegister } = await import('./CashRegister');

describe('Arqueo de caja', () => {
  it('renderiza el resumen y abre el conteo sin romperse', async () => {
    render(
      <MemoryRouter initialEntries={['/arqueo']}>
        <CashRegister />
      </MemoryRouter>
    );

    expect(await screen.findByText('Arqueo de caja')).toBeTruthy();
    expect(screen.getByText('Efectivo esperado')).toBeTruthy();
    expect(await screen.findByText('Arqueos recientes')).toBeTruthy();

    const openButton = screen.getByRole('button', { name: /realizar arqueo/i });
    await waitFor(() => expect(openButton.disabled).toBe(false));
    fireEvent.click(openButton);

    expect(await screen.findByText('Cierre del turno')).toBeTruthy();
    expect(screen.getByText('Efectivo contado')).toBeTruthy();
  });
});
