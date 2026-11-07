import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DataTable from './DataTable';

const columns = [
  { key: 'nombre', label: 'Nombre', sortable: true },
  { key: 'stock', label: 'Stock', align: 'right', sortable: true, sortValue: (row) => row.stock },
];

const rows = [
  { id: 'a', nombre: 'Arroz', stock: 5 },
  { id: 'b', nombre: 'Aceite', stock: 20 },
];

function productNames() {
  return screen.getAllByRole('row')
    .slice(1)
    .map((row) => row.cells[0]?.textContent)
    .filter(Boolean);
}

describe('DataTable', () => {
  it('ordena al hacer clic en el encabezado, como una hoja de cálculo', () => {
    render(<DataTable columns={columns} rows={rows} getRowKey={(row) => row.id} />);

    expect(productNames()).toEqual(['Arroz', 'Aceite']);

    fireEvent.click(screen.getByText('Stock'));
    expect(productNames()).toEqual(['Arroz', 'Aceite']);

    fireEvent.click(screen.getByText('Stock'));
    expect(productNames()).toEqual(['Aceite', 'Arroz']);
  });

  it('permite controlar el orden desde el reporte', () => {
    const onSortChange = vi.fn();
    render(
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.id}
        sort={{ key: 'stock', dir: 'asc' }}
        onSortChange={onSortChange}
      />
    );

    fireEvent.click(screen.getByText('Stock'));

    expect(onSortChange).toHaveBeenCalledWith({ key: 'stock', dir: 'desc' });
  });
});
