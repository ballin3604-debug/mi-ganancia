import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import NewProformaProductModal from './NewProformaProductModal';

function renderModal(props = {}) {
  return render(
    <NewProformaProductModal
      categories={['Bebidas']}
      products={[]}
      onClose={vi.fn()}
      onAdd={vi.fn()}
      {...props}
    />
  );
}

describe('alta rápida de producto desde la proforma', () => {
  it('solo muestra nombre y precio de venta; marca y código quedan opcionales', () => {
    renderModal();

    expect(screen.getByLabelText('Nombre del producto')).toBeTruthy();
    expect(screen.getByLabelText('Precio de venta de la unidad')).toBeTruthy();
    expect(screen.getByLabelText('Categoría').value).toBe('Otros');
    expect(screen.queryByLabelText('Marca')).toBeNull();
    expect(screen.queryByLabelText('Código de barras')).toBeNull();
  });

  it('agrega el producto a la proforma con los datos mínimos', () => {
    const onAdd = vi.fn();
    renderModal({ onAdd });

    fireEvent.change(screen.getByLabelText('Nombre del producto'), {
      target: { value: 'Cerveza Nueva 620 ml' },
    });
    fireEvent.change(screen.getByLabelText('Precio de venta de la unidad'), {
      target: { value: '12' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar a la proforma' }));

    expect(onAdd).toHaveBeenCalledTimes(1);
    const [product, preferredFactor] = onAdd.mock.calls[0];
    expect(product).toMatchObject({
      name: 'Cerveza Nueva 620 ml',
      category: 'Otros',
      brand: '',
      barcode: '',
      price: 12,
    });
    expect(product.presentations).toEqual([
      { id: 'licor-unidad', name: 'Unidad', factor: 1, price: 12, isBase: true },
    ]);
    expect(preferredFactor).toBe(0);
  });

  it('abre los datos opcionales cuando el escáner ya trae un código', () => {
    renderModal({ initialBarcode: '7791234567890' });

    expect(screen.getByLabelText('Código de barras').value).toBe('7791234567890');
    expect(screen.getByLabelText('Marca')).toBeTruthy();
  });

  it('avisa si el nombre ya existe en el inventario', () => {
    const onAdd = vi.fn();
    renderModal({ products: [{ name: 'Cerveza Nueva 620 ml' }], onAdd });

    fireEvent.change(screen.getByLabelText('Nombre del producto'), {
      target: { value: 'Cerveza Nueva 620 ml' },
    });
    fireEvent.change(screen.getByLabelText('Precio de venta de la unidad'), {
      target: { value: '12' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar a la proforma' }));

    expect(onAdd).not.toHaveBeenCalled();
    expect(screen.getByText(/Ya existe "Cerveza Nueva 620 ml"/)).toBeTruthy();
  });
});
