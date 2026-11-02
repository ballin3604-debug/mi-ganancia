import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { displayName: 'Dueño Test', email: 'dueno@test.com' }, role: 'owner' }),
}));

vi.mock('../context/BusinessContext', () => ({
  useBusiness: () => ({ business: { name: 'Negocio Test' }, settings: {}, sectorConfig: { features: {} } }),
}));

vi.mock('../hooks/useSyncStatus', () => ({
  useSyncStatus: () => ({ online: true, pendingCount: 0, errorCount: 0 }),
}));

vi.mock('../hooks/usePlan', () => ({
  usePlan: () => ({ can: () => true }),
}));

vi.mock('./SyncErrorPanel', () => ({ SyncErrorPanel: () => null }));
vi.mock('./LogoutModal', () => ({ LogoutModal: () => null }));
vi.mock('./Ayuda', () => ({ default: () => null }));

const { default: Layout } = await import('./Layout');

describe('Menú lateral', () => {
  it('muestra Arqueo de caja como acceso directo, no como grupo plegable', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<div>Inicio</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    const link = screen.getByRole('link', { name: 'Arqueo de caja' });
    expect(link.getAttribute('href')).toBe('/arqueo');
    expect(screen.queryByRole('button', { name: 'Arqueo de caja' })).toBeNull();
  });
});
