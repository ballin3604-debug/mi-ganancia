import { describe, expect, it } from 'vitest';
import { buildMonthlyPerformance } from './ownerPulseMetrics';

describe('buildMonthlyPerformance', () => {
  it('muestra únicamente meses con ventas y calcula su ingreso, costo, egreso y utilidad', () => {
    const sales = [
      { id: 'sale-jul', createdAt: new Date(2026, 6, 10), total: 100, branchId: 'main' },
      { id: 'sale-sept', createdAt: new Date(2026, 8, 5), total: 200, branchId: 'main' },
    ];
    const items = [
      { saleId: 'sale-jul', supplier_price: 20, quantity: 2 },
      { saleId: 'sale-sept', supplier_price: 50, quantity: 1 },
    ];
    const expenses = [
      { createdAt: new Date(2026, 6, 15), amount: 10, branch_id: 'main' },
      { createdAt: new Date(2026, 7, 15), amount: 500, branch_id: 'main' },
    ];

    const monthly = buildMonthlyPerformance(sales, items, expenses);

    expect(monthly.map((month) => month.key)).toEqual(['2026-07', '2026-09']);
    expect(monthly[0]).toMatchObject({ income: 100, cogs: 40, exp: 10, net: 50 });
    expect(monthly[1]).toMatchObject({ income: 200, cogs: 50, exp: 0, net: 150 });
  });

  it('incluye el mes de una venta fiada, aunque no cuente como ingreso cobrado', () => {
    const monthly = buildMonthlyPerformance([
      { id: 'fiado', createdAt: new Date(2026, 9, 1), total: 80, paymentMethod: 'fiado' },
    ], [], []);

    expect(monthly).toHaveLength(1);
    expect(monthly[0]).toMatchObject({ key: '2026-10', income: 0, net: 0 });
  });

  it('filtra las ventas según la sucursal seleccionada', () => {
    const sales = [
      { id: 'sale-a', createdAt: new Date(2026, 8, 5), total: 100, branchId: 'branch-a' },
      { id: 'sale-b', createdAt: new Date(2026, 9, 5), total: 200, branchId: 'branch-b' },
    ];

    const monthly = buildMonthlyPerformance(sales, [], [], 'branch-a');

    expect(monthly.map((month) => month.key)).toEqual(['2026-09']);
    expect(monthly[0].income).toBe(100);
  });

  it('devuelve una lista vacía si todavía no hay ventas', () => {
    expect(buildMonthlyPerformance([], [], [])).toEqual([]);
  });
});
