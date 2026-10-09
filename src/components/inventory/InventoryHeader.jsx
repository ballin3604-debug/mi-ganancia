import React from 'react';
import { motion } from 'motion/react';
import { AppIcon } from '../icons';

export function InventoryHeader({
  totalProducts,
  search,
  onSearchChange,
  categories,
  selectedCategory,
  onCategoryChange,
  categoryCounts = {},
  filterExpiry,
  onExpiryFilterChange,
  filterRecent,
  onRecentFilterToggle,
  filterLowStock,
  onLowStockFilterToggle,
  lowStockCount = 0,
  onOpenAddProduct,
  onOpenCatManager,
  onOpenScanner,
  expiryCounts = { porVencer: 0, vencidos: 0 },
}) {
  return (
    <div className="space-y-4">
      {/* Top Header Bar: Title & Primary Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl sm:text-2xl font-black text-[var(--mg-text-primary)] tracking-tight">
              Catálogo de Inventario
            </h2>
            <span className="bg-[var(--mg-accent-bg)] text-[var(--mg-accent)] border border-[var(--mg-accent-border)] text-[11px] font-black px-2.5 py-0.5 rounded-full shadow-2xs">
              {totalProducts} {totalProducts === 1 ? 'producto' : 'productos'}
            </span>
          </div>
          <p className="text-xs text-[var(--mg-text-muted)] font-medium mt-0.5">
            Gestión visual de existencias, precios y categorías
          </p>
        </div>

        {/* Buttons Row */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Gestor de Categorías */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.96 }}
            type="button"
            onClick={onOpenCatManager}
            className="bg-[var(--mg-bg-surface)] hover:bg-[var(--mg-bg-elevated)] text-[var(--mg-text-primary)] border border-[var(--mg-border)] rounded-2xl px-3.5 py-2 font-extrabold text-xs active:scale-95 transition-all flex items-center gap-1.5 shadow-2xs min-h-[40px]"
            title="Gestionar categorías"
          >
            <AppIcon name="etiqueta" size={14} />
            <span>Categorías</span>
          </motion.button>

          {/* Nuevo Producto Button (Redesigned & Prominent) */}
          <motion.button
            whileHover={{ scale: 1.03, y: -1 }}
            whileTap={{ scale: 0.96 }}
            type="button"
            onClick={onOpenAddProduct}
            className="bg-gradient-to-r from-[var(--mg-accent)] to-blue-600 hover:brightness-110 text-white rounded-2xl px-4 py-2 font-black text-xs shadow-md hover:shadow-lg transition-all flex items-center gap-2 min-h-[40px] border border-blue-400/20"
          >
            <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center leading-none">
              <AppIcon name="agregar" size={14} color="#fff" />
            </span>
            <span>Nuevo Producto</span>
          </motion.button>
        </div>
      </div>

      {/* Redesigned Search & Filters Toolbar */}
      <div className="bg-[var(--mg-bg-surface)] rounded-[24px] p-3.5 border border-[var(--mg-border)] shadow-xs space-y-3">
        {/* Compact Search Bar & Quick Alerts Row */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
          {/* Sleek Compact Search Bar + scanner */}
          <div className="flex gap-2 w-full md:max-w-sm">
            <div className="relative flex-1 min-w-0">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--mg-text-muted)] pointer-events-none flex">
                <AppIcon name="search" size={12} />
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Buscar nombre, marca o código..."
                className="w-full bg-[var(--mg-bg-elevated)] border border-[var(--mg-border)] rounded-xl pl-8 pr-8 py-2 text-xs text-[var(--mg-text-primary)] font-bold placeholder:text-[var(--mg-text-muted)] placeholder:font-normal focus:outline-none focus:border-[var(--mg-accent)] focus:ring-2 focus:ring-[var(--mg-accent)]/10 transition-all min-h-[36px]"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 bg-[var(--mg-bg-surface)] border border-[var(--mg-border)] rounded-full text-[var(--mg-text-muted)] hover:text-[var(--mg-text-primary)] text-[9px] font-bold flex items-center justify-center transition-all"
                  title="Limpiar búsqueda"
                >
                  ✕
                </button>
              )}
            </div>
            {onOpenScanner && (
              <button
                type="button"
                onClick={onOpenScanner}
                title="Escanear código de barras"
                aria-label="Escanear código de barras"
                className="w-9 h-9 shrink-0 rounded-xl bg-[var(--mg-accent)] hover:bg-[var(--mg-accent-hover)] text-white shadow flex items-center justify-center active:scale-90 transition-all"
              >
                <AppIcon name="scan" size={20} color="#fff" />
              </button>
            )}
          </div>

          {/* Quick Filter Status Badges */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pt-0.5">
            <button
              type="button"
              onClick={onLowStockFilterToggle}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-extrabold border transition-all active:scale-95 shrink-0 flex items-center gap-1 min-h-[32px] ${
                filterLowStock
                  ? 'bg-red-50 text-red-700 border-red-300 shadow-2xs'
                  : 'bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)] border-[var(--mg-border)] hover:border-[var(--mg-border-hover)]'
              }`}
            >
              <AppIcon name="reloj" size={12} />
              <span>Por reponer</span>
              {lowStockCount > 0 && (
                <span className="bg-red-200/80 text-red-900 text-[9px] px-1.5 py-0.5 rounded-full font-black ml-0.5">
                  {lowStockCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => onExpiryFilterChange(filterExpiry === 'porVencer' ? 'todos' : 'porVencer')}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-extrabold border transition-all active:scale-95 shrink-0 flex items-center gap-1 min-h-[32px] ${
                filterExpiry === 'porVencer'
                  ? 'bg-[var(--mg-warning-bg)] text-[var(--mg-warning)] border-amber-300 shadow-2xs'
                  : 'bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)] border-[var(--mg-border)] hover:border-[var(--mg-border-hover)]'
              }`}
            >
              <AppIcon name="reloj" size={12} />
              <span>Por vencer</span>
              {expiryCounts.porVencer > 0 && (
                <span className="bg-amber-200/80 text-amber-900 text-[9px] px-1.5 py-0.5 rounded-full font-black ml-0.5">
                  {expiryCounts.porVencer}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => onExpiryFilterChange(filterExpiry === 'vencidos' ? 'todos' : 'vencidos')}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-extrabold border transition-all active:scale-95 shrink-0 flex items-center gap-1 min-h-[32px] ${
                filterExpiry === 'vencidos'
                  ? 'bg-[var(--mg-danger-bg)] text-[var(--mg-danger)] border-red-300 shadow-2xs'
                  : 'bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)] border-[var(--mg-border)] hover:border-[var(--mg-border-hover)]'
              }`}
            >
              <AppIcon name="cerrar" size={12} />
              <span>Vencidos</span>
              {expiryCounts.vencidos > 0 && (
                <span className="bg-red-200/80 text-red-900 text-[9px] px-1.5 py-0.5 rounded-full font-black ml-0.5">
                  {expiryCounts.vencidos}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={onRecentFilterToggle}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-extrabold border transition-all active:scale-95 shrink-0 flex items-center gap-1 min-h-[32px] ${
                filterRecent
                  ? 'bg-[var(--mg-accent-bg)] text-[var(--mg-accent)] border-[var(--mg-accent-border)] shadow-2xs'
                  : 'bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)] border-[var(--mg-border)] hover:border-[var(--mg-border-hover)]'
              }`}
            >
              <AppIcon name="agregar" size={12} />
              <span>Recién comprado</span>
            </button>
          </div>
        </div>

        {/* Redesigned Category Selector (Pills Carousel with Animated Glider & Item Counts) */}
        <div className="pt-1 border-t border-[var(--mg-separator)]">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1">
            {categories.map((cat) => {
              const isActive = selectedCategory === cat;
              const count = categoryCounts[cat] ?? 0;

              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => onCategoryChange(cat)}
                  className="relative px-3.5 py-1.5 rounded-2xl text-[11px] font-extrabold transition-all active:scale-95 shrink-0 flex items-center gap-1.5 select-none min-h-[32px]"
                >
                  {/* Gliding animated background indicator */}
                  {isActive && (
                    <motion.div
                      layoutId="activeCategoryPill"
                      className="absolute inset-0 bg-[var(--mg-accent)] rounded-2xl shadow-xs"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}

                  <span className={`relative z-10 transition-colors ${isActive ? 'text-white font-black' : 'text-[var(--mg-text-secondary)]'}`}>
                    {cat}
                  </span>

                  <span
                    className={`relative z-10 text-[9px] font-black px-1.5 py-0.5 rounded-full transition-colors ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)] border border-[var(--mg-border)]'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
