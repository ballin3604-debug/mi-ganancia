import { StockLabel } from './ProductCatalogCard';
import { getAvailablePackages } from '../utils/presentations';

// Meta de Ventas: stock a la izquierda y paquetes completos a la derecha.
// El badge es corto (📦 8) para no competir con el botón de agregar.
export default function ProductAvailabilityMeta({ product, packageOption, showStock = true }) {
  if (!showStock) return null;

  const factor = Number(packageOption?.factor || 0);
  const hasPack = factor > 1;
  const availablePackages = hasPack ? getAvailablePackages(product?.stock, factor) : 0;
  const packLabel = packageOption?.label || 'Paquete';

  return (
    <span className={`flex items-center gap-2 ${hasPack ? 'justify-between' : ''}`}>
      <StockLabel
        stock={product?.stock}
        minStock={product?.minStock}
        isDish={product?.isDish}
        isAvailable={product?.isAvailable}
      />
      {hasPack && (
        <span
          title={`${packLabel} x${factor} · ${availablePackages} disponibles`}
          aria-label={`${availablePackages} ${packLabel} de ${factor} disponibles`}
          className="inline-flex shrink-0 items-center mt-1.5 rounded-full border px-2 py-0.5 text-[10px] font-black tabular-nums bg-[var(--mg-accent-bg)] text-[var(--mg-accent-text)] border-[var(--mg-accent-border)]"
        >
          📦 {availablePackages}
        </span>
      )}
    </span>
  );
}
