import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProductAvailabilityMeta from './ProductAvailabilityMeta';

function renderMeta(props) {
  return render(
    <ProductAvailabilityMeta
      product={{ id: 'p1', stock: 96, minStock: 5 }}
      {...props}
    />
  );
}

describe('ProductAvailabilityMeta', () => {
  it('muestra los paquetes abreviados a la derecha con stock 96 y factor 12', () => {
    const { container } = renderMeta({ packageOption: { label: 'Paquete', factor: 12 } });

    const meta = container.firstChild;
    expect(meta.className).toContain('justify-between');
    expect(screen.getByText('Stock 96')).toBeTruthy();
    expect(screen.getByLabelText('8 Paquete de 12 disponibles')).toBeTruthy();
    expect(screen.getByLabelText('8 Paquete de 12 disponibles').textContent).toContain('📦 8');
  });

  it('no muestra paquetes cuando no hay presentación de compra', () => {
    renderMeta({ packageOption: undefined });

    expect(screen.getByText('Stock 96')).toBeTruthy();
    expect(screen.queryByLabelText(/disponibles/)).toBeNull();
  });

  it('oculta stock y paquetes cuando el negocio no muestra existencias', () => {
    const { container } = renderMeta({
      packageOption: { label: 'Paquete', factor: 12 },
      showStock: false,
    });

    expect(container.firstChild).toBeNull();
  });
});
