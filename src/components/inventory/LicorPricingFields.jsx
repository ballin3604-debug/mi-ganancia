import { clampNumberInput, clampIntegerInput, blockInvalidNumberKeys } from '../../utils/numberInput';
import {
  getLicorCategoryConfig,
  getLicorPurchaseFactorFromForm,
  getLicorPurchaseLabel,
} from '../../config/licorCatalog';

function NumberField({ label, value, onChange, placeholder = '0.00', className = '', ariaLabel, integer = false }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">
        {label}
      </label>
      <input
        type="number"
        aria-label={ariaLabel || label}
        value={value}
        onChange={(e) => onChange(
          integer
            ? clampIntegerInput(e.target.value, { max: 999999 })
            : clampNumberInput(e.target.value, { max: 999999 })
        )}
        onKeyDown={(e) => blockInvalidNumberKeys(e, { allowDecimal: !integer })}
        placeholder={integer ? '0' : placeholder}
        min="0"
        max="999999"
        step={integer ? '1' : '0.01'}
        className={`mg-input text-sm font-black text-[var(--mg-accent-text)] ${className}`}
      />
    </div>
  );
}

// Precios de venta/compra específicos de licorería. Las presentaciones y la
// unidad de compra salen del catálogo fijo de la categoría elegida.
export function LicorPricingFields({ form, setField, category }) {
  const config = getLicorCategoryConfig(category);
  const prices = form.licorPrices || {};
  const factors = form.licorFactors || {};
  const extras = config.sell.filter((preset) => preset.key !== 'unidad');
  const purchaseUnit = config.purchase.askUnit
    ? (form.licorPurchaseUnit || 'caja')
    : config.purchase.unit;
  const purchaseLabel = getLicorPurchaseLabel(category, purchaseUnit);
  const purchaseFactor = getLicorPurchaseFactorFromForm(form, category);

  function setPrice(key, value) {
    setField('licorPrices', { ...prices, [key]: value });
  }

  function setFactor(key, value) {
    setField('licorFactors', { ...factors, [key]: value });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-3 rounded-2xl border border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] p-3.5">
        <div>
          <h3 className="text-xs font-extrabold text-[var(--mg-text-primary)]">Precios de venta</h3>
          <p className="mt-1 text-[11px] font-semibold text-[var(--mg-text-muted)]">
            Cargá solo las presentaciones que vendés. El stock siempre se cuenta en unidades sueltas.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <NumberField
            label="Unidad (Bs) *"
            ariaLabel="Precio Unidad"
            value={form.price}
            onChange={(value) => setField('price', value)}
            placeholder="0.00"
          />

          {extras.map((preset) => (
            <div key={preset.key}>
              <div className="mb-1 flex items-center justify-between gap-2">
                <label className="text-xs font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">
                  {preset.name} (Bs)
                </label>
                <label className="flex items-center gap-1 text-[10px] font-bold text-[var(--mg-text-muted)]">
                  x
                  <input
                    type="number"
                    aria-label={`Unidades por ${preset.name}`}
                    value={factors[preset.key] ?? ''}
                    onChange={(e) => setFactor(preset.key, clampNumberInput(e.target.value, { min: 0, max: 9999 }))}
                    onKeyDown={blockInvalidNumberKeys}
                    placeholder={preset.factor ? String(preset.factor) : '6'}
                    min="0"
                    max="9999"
                    step="1"
                    className="w-14 rounded-lg border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] px-1.5 py-0.5 text-center text-[10px] font-black text-[var(--mg-text-primary)]"
                  />
                  und.
                </label>
              </div>
              <input
                type="number"
                aria-label={`Precio ${preset.name}`}
                value={prices[preset.key] ?? ''}
                onChange={(e) => setPrice(preset.key, clampNumberInput(e.target.value, { max: 999999 }))}
                onKeyDown={blockInvalidNumberKeys}
                placeholder="0.00"
                min="0"
                max="999999"
                step="0.01"
                className="mg-input text-sm font-black text-[var(--mg-accent-text)]"
              />
            </div>
          ))}
        </div>

        <p className="text-[11px] font-semibold text-[var(--mg-text-muted)]">
          Dejá en blanco lo que no vendas. La unidad es obligatoria.
        </p>
      </div>

      <div className="space-y-3 rounded-2xl border border-[var(--mg-gold-border)] bg-[var(--mg-gold-bg)] p-3.5">
        <div>
          <h3 className="text-xs font-extrabold text-[var(--mg-text-primary)]">Precio de compra</h3>
          <p className="mt-1 text-[11px] font-semibold text-[var(--mg-text-muted)]">
            Se compra por {purchaseLabel.toLowerCase()}. Guardamos el costo por unidad para calcular la ganancia.
          </p>
        </div>

        {config.purchase.askUnit && (
          <div className="grid grid-cols-2 gap-2">
            {['caja', 'paquete'].map((unit) => (
              <button
                key={unit}
                type="button"
                aria-pressed={purchaseUnit === unit}
                onClick={() => setField('licorPurchaseUnit', unit)}
                className={`rounded-xl border-2 px-3 py-2 text-xs font-extrabold transition-all active:scale-[0.98] ${
                  purchaseUnit === unit
                    ? 'border-[var(--mg-gold)] bg-[var(--mg-bg-surface)] text-[var(--mg-gold-text)]'
                    : 'border-[var(--mg-border)] bg-[var(--mg-bg-surface)] text-[var(--mg-text-muted)]'
                }`}
              >
                {unit === 'caja' ? '📦 Caja' : '🛍️ Paquete'}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label={`Costo por ${purchaseLabel.toLowerCase()} (Bs)`}
            ariaLabel={`Costo por ${purchaseLabel.toLowerCase()}`}
            value={form.supplierPrice}
            onChange={(value) => setField('supplierPrice', value)}
            placeholder="0"
            integer
          />
          <div>
            <label className="mb-1 block text-xs font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">
              Unidades por {purchaseLabel.toLowerCase()}
            </label>
            <input
              type="number"
              aria-label={`Unidades por ${purchaseLabel.toLowerCase()}`}
              value={form.licorPurchaseFactor ?? ''}
              onChange={(e) => setField('licorPurchaseFactor', clampNumberInput(e.target.value, { min: 0, max: 9999 }))}
              onKeyDown={blockInvalidNumberKeys}
              placeholder={purchaseFactor > 1 ? String(purchaseFactor) : 'Ej: 10'}
              min="0"
              max="9999"
              step="1"
              className="mg-input text-sm font-black"
            />
          </div>
        </div>

        <p className="text-[11px] font-semibold text-[var(--mg-text-muted)]">
          {purchaseFactor > 1
            ? `Se usan ${purchaseFactor} unidades por ${purchaseLabel.toLowerCase()}. Cambialo si tu proveedor usa otro empaque.`
            : `Indicá cuántas unidades trae la ${purchaseLabel.toLowerCase()}.`}
        </p>
      </div>
    </div>
  );
}
