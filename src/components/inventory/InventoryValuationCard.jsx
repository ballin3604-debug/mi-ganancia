import React, { useMemo } from 'react';
import { formatBs } from '../../utils/currency';
import { AppIcon } from '../icons';

export function InventoryValuationCard({ products, selectedCategory }) {
  // Calculate metrics based on selected category or all products
  const metrics = useMemo(() => {
    const categoryProducts = selectedCategory === 'Todas'
      ? products
      : products.filter((p) => (p.category || 'Otros') === selectedCategory);

    let totalCost = 0;
    let totalSalesValue = 0;
    let totalUnits = 0;
    const totalCount = categoryProducts.length;

    categoryProducts.forEach((p) => {
      const stock = Number(p.stock || 0);
      const price = Number(p.price || 0);
      const supplierPrice = Number(p.supplierPrice || 0);

      // Cost calculation: use supplier price if available, otherwise fallback to retail price
      const costPerUnit = supplierPrice > 0 ? supplierPrice : price;
      totalCost += stock * costPerUnit;
      totalSalesValue += stock * price;
      totalUnits += stock;
    });

    const potentialProfit = Math.max(0, totalSalesValue - totalCost);
    const profitMarginPct = totalCost > 0 ? Math.round((potentialProfit / totalCost) * 100) : 0;

    return {
      totalCost,
      totalSalesValue,
      totalUnits,
      totalCount,
      potentialProfit,
      profitMarginPct,
    };
  }, [products, selectedCategory]);

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-[var(--mg-bg-surface)] via-[var(--mg-bg-elevated)] to-[var(--mg-bg-surface)] rounded-[26px] p-4 sm:p-5 border border-[var(--mg-border)] shadow-xs">
      {/* Decorative subtle background accents */}
      <div className="absolute -top-12 -right-12 w-32 h-32 bg-[var(--mg-accent)]/5 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />

      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Left Side: Category Label & Dynamic Title */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 bg-[var(--mg-accent-bg)] text-[var(--mg-accent)] border border-[var(--mg-accent-border)] text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              <AppIcon name="reportes" size={12} />
              <span>Valorización de Inventario</span>
            </span>

            <span className="text-[11px] font-extrabold text-[var(--mg-text-muted)] bg-[var(--mg-bg-surface)] px-2 py-0.5 rounded-full border border-[var(--mg-border)]">
              {selectedCategory === 'Todas' ? 'Todo el Negocio' : `Categoría: ${selectedCategory}`}
            </span>
          </div>

          <h3 className="text-base sm:text-lg font-black text-[var(--mg-text-primary)] tracking-tight">
            {selectedCategory === 'Todas'
              ? 'Capital total en stock'
              : `Inversión en ${selectedCategory}`}
          </h3>

          <p className="text-xs font-semibold text-[var(--mg-text-muted)]">
            {metrics.totalCount} {metrics.totalCount === 1 ? 'producto' : 'productos'} •{' '}
            <span className="font-extrabold text-[var(--mg-text-primary)]">{metrics.totalUnits}</span> unidades en almacén
          </p>
        </div>

        {/* Right Side: Key Financial Totals */}
        <div className="flex items-center gap-3 sm:gap-6 bg-[var(--mg-bg-surface)]/80 backdrop-blur-xs p-3.5 rounded-[20px] border border-[var(--mg-border)] self-start sm:self-auto w-full sm:w-auto justify-between sm:justify-end">
          {/* Capital Invertido (Costo) */}
          <div className="space-y-0.5">
            <span className="text-[10px] font-extrabold text-[var(--mg-text-muted)] uppercase tracking-wider block">
              Inversión (Costo)
            </span>
            <p className="text-lg sm:text-xl font-black text-[var(--mg-text-primary)] tracking-tight">
              {formatBs(metrics.totalCost)}
            </p>
          </div>

          <div className="w-px h-8 bg-[var(--mg-separator)]" />

          {/* Valor Estimado en Ventas */}
          <div className="space-y-0.5 text-right">
            <span className="text-[10px] font-extrabold text-[var(--mg-text-muted)] uppercase tracking-wider block">
              Valor en Ventas
            </span>
            <p className="text-lg sm:text-xl font-black text-[var(--mg-accent)] tracking-tight">
              {formatBs(metrics.totalSalesValue)}
            </p>
            {metrics.profitMarginPct > 0 && (
              <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded-full border border-emerald-200 inline-block">
                +{metrics.profitMarginPct}% margen
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
