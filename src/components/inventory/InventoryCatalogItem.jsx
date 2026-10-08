import { formatBs } from '../../utils/currency';
import ProductCatalogCard, { StockLabel } from '../ProductCatalogCard';

function expiryInfo(nearestExpiry) {
  if (!nearestExpiry?.date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysLeft = Math.ceil((nearestExpiry.date - today) / (1000 * 60 * 60 * 24));
  if (daysLeft < 0) return { label: 'Vencido', cls: 'bg-red-600 text-white' };
  if (daysLeft <= 30) return { label: `${daysLeft}d para vencer`, cls: 'bg-amber-500 text-white' };
  return null;
}

// Tarjeta de inventario con el mismo look & feel que Ventas
// (ProductCatalogCard) + ficha ampliada al pasar el puntero (solo desktop,
// 100% CSS sin animaciones JS para que el scroll se sienta firme).
export function InventoryCatalogItem({ product, nearestExpiry, categoryColor, onSelect }) {
  const price = Number(product.price || 0);
  const supplierPrice = Number(product.supplierPrice || 0);
  const profit = supplierPrice > 0 ? price - supplierPrice : null;
  const marginPct = supplierPrice > 0 ? Math.round((profit / supplierPrice) * 100) : null;
  const exp = expiryInfo(nearestExpiry);
  const isOut = product.stock === 0;
  const isLow = !isOut && product.stock <= (product.minStock || 5);
  const packSize = Number(product.packageSize || 0);
  const hasPack = packSize > 1 && product.packPrice !== '' && product.packPrice !== null && product.packPrice !== undefined && Number(product.packPrice) > 0;

  return (
    // hover:z-30 → la tarjeta (y su ficha) suben por encima del encabezado,
    // las pills de categorías y la tarjeta de valorización al pasar el puntero.
    <div className="relative group/inv hover:z-30">
      <ProductCatalogCard
        product={product}
        priceLabel={formatBs(price)}
        metaLabel={
          <span className="flex items-center gap-1.5 flex-wrap">
            <StockLabel stock={product.stock} minStock={product.minStock} />
            {hasPack && (
              <span className="inline-flex items-center mt-1.5 px-2 py-0.5 rounded-full border text-[10px] font-black bg-[var(--mg-accent-bg)] text-[var(--mg-accent)] border-[var(--mg-accent-border)]">
                📦 {(product.packLabel || 'Paquete').trim() || 'Paquete'} x{packSize}
              </span>
            )}
            {exp && (
              <span className={`inline-flex items-center mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-black ${exp.cls}`}>
                ⏰ {exp.label}
              </span>
            )}
          </span>
        }
        onSelect={() => onSelect(product)}
      />

      {/* Ficha ampliada: solo en dispositivos CON puntero (hover real).
          En celular táctil nunca aparece para no tapar los productos. */}
      <div className="hidden [@media(hover:hover)]:group-hover/inv:block absolute left-1/2 -translate-x-1/2 bottom-full mb-3 z-40 w-72 bg-[var(--mg-bg-surface)] rounded-[26px] p-4 border border-[var(--mg-border)] shadow-2xl pointer-events-none">
        <div className="relative w-full h-44 rounded-2xl bg-[var(--mg-bg-elevated)] overflow-hidden flex items-center justify-center p-2 mb-3 border border-[var(--mg-separator)]">
          {product.imageData ? (
            <img src={product.imageData} alt={product.name} loading="lazy" decoding="async" className="w-full h-full object-contain" />
          ) : (
            <span className="text-5xl">📦</span>
          )}
        </div>

        <div className="space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h4 className="font-extrabold text-[var(--mg-text-primary)] text-sm truncate">{product.name}</h4>
              {product.brand && (
                <p className="text-[10px] font-bold text-[var(--mg-text-muted)] uppercase tracking-wider">
                  {product.brand}
                </p>
              )}
              {product.barcode && (
                <p className="text-[10px] font-mono font-bold text-[var(--mg-text-muted)] mt-0.5">
                  🏷️ {product.barcode}
                </p>
              )}
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${categoryColor || 'bg-blue-50 text-blue-700'}`}>
              {product.category || 'Otros'}
            </span>
          </div>

          <div className="pt-2 border-t border-[var(--mg-separator)] flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-[var(--mg-text-muted)] uppercase tracking-wider block">
                Precio Venta
              </span>
              <p className="text-base font-black text-[var(--mg-accent)]">{formatBs(price)}</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold text-[var(--mg-text-muted)] uppercase tracking-wider block">
                Stock Disponible
              </span>
              <p className={`text-sm font-black ${isOut ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-emerald-600'}`}>
                {product.stock} {product.unitLabel || 'und'}
              </p>
            </div>
          </div>

          {marginPct !== null && (
            <div className="bg-[var(--mg-accent-bg)] p-2 rounded-xl text-[11px] font-bold text-[var(--mg-accent)] flex items-center justify-between border border-[var(--mg-accent-border)]">
              <span>Margen est. ganancia:</span>
              <span className="font-black">+{marginPct}% ({formatBs(profit)})</span>
            </div>
          )}

          {exp && (
            <p className={`text-[11px] font-black text-center rounded-xl py-1.5 ${exp.cls}`}>
              ⏰ {exp.label}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
