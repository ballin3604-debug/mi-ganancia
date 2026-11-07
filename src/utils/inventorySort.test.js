import { describe, it, expect } from 'vitest';
import { sortInventoryRows } from './inventorySort';

const products = [
  { id: 'a', name: 'Coca Cola', category: 'Bebidas', stock: 10, price: 5 },
  { id: 'b', name: 'Whisky', category: 'Licores', stock: 2, price: 100 },
  { id: 'c', name: 'Pan', category: 'Panadería', stock: 50, price: 1 },
];

describe('sortInventoryRows', () => {
  it('ordena de mayor a menor por valor total', () => {
    const rows = sortInventoryRows(products, { key: 'valorTotal', dir: 'desc' });

    expect(rows.map((p) => p.id)).toEqual(['b', 'a', 'c']);
  });

  it('ordena de mayor a menor por stock', () => {
    const rows = sortInventoryRows(products, { key: 'stock', dir: 'desc' });

    expect(rows.map((p) => p.id)).toEqual(['c', 'a', 'b']);
  });

  it('ordena por nombre de la A a la Z', () => {
    const rows = sortInventoryRows(products, { key: 'producto', dir: 'asc' });

    expect(rows.map((p) => p.id)).toEqual(['a', 'c', 'b']);
  });

  it('respeta el orden original cuando no hay criterio', () => {
    expect(sortInventoryRows(products, null)).toBe(products);
  });

  it('mantiene estables los empates', () => {
    const tied = [
      { id: 'x', name: 'X', stock: 5, price: 2 },
      { id: 'y', name: 'Y', stock: 5, price: 2 },
    ];

    expect(sortInventoryRows(tied, { key: 'valorTotal', dir: 'desc' }).map((p) => p.id))
      .toEqual(['x', 'y']);
  });
});
