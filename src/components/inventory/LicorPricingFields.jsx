import { clampNumberInput, clampIntegerInput, blockInvalidNumberKeys } from '../../utils/numberInput';
import {
  getLicorCategoryConfig,
  getLicorPurchaseFactorFromForm,
  getLicorPurchaseLabel,
} from '../../config/licorCatalog';

function formatBs(value) {
  return Number(value || 0).toLocaleString('es-BO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function NumberField({ label, value, onChange, placeholder = '0.00', className = '', ariaLabel, integer = false }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-extrabold uppercase tracking-wider leading-tight text-[var(--mg-text-muted)]">
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

function UnitsField({ label, ariaLabel, value, onChange, placeholder }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-extrabold uppercase tracking-wider leading-tight text-[var(--mg-text-muted)]">
        {label}
      </label>
      <input
        type="number"
        aria-label={ariaLabel || label}
        value={value}
        onChange={(e) => onChange(clampIntegerInput(e.target.value, { min: 0, max: 9999 }))}
        onKeyDown={(e) => blockInvalidNumberKeys(e, { allowDecimal: false })}
        placeholder={placeholder}
        min="0"
        max="9999"
        step="1"
        className="mg-input text-xs font-black"
      />
    </div>
  );
}

// Precios de venta/compra específicos de licorería. La categoría define qué
// presentaciones se venden y en qué empaque se compra.
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
  const purchaseCost = Number(form.supplierPrice || 0);
  const saleUnitPrice = Number(form.price || 0);
  const unitCost = purchaseFactor > 1 && purchaseCost > 0 ? purchaseCost / purchaseFactor : 0;
  const margin = unitCost > 0 && saleUnitPrice > unitCost ? saleUnitPrice - unitCost : 0;

  function setPrice(key, value) {
    setField('licorPrices', { ...prices, [key]: value });
  }

  function setFactor(key, value) {
    setField('licorFactors', { ...factors, [key]: value });
  }

  const purchaseHelp = !form.licorPurchaseFactor && purchaseFactor > 1
    ? `Tomamos las ${purchaseFactor} unidades que cargaste arriba. Podés cambiarlo acá.`
    : purchaseFactor > 1
      ? `Se usan ${purchaseFactor} unidades por ${purchaseLabel.toLowerCase()}.`
      : `Indicá cuántas unidades trae la ${purchaseLabel.toLowerCase()}.`;
  const extraNames = extras.map((preset) => preset.name.toLowerCase());
  const extrasText = extraNames.length > 1
    ? `${extraNames.slice(0, -1).join(', ')} o ${extraNames[extraNames.length - 1]}`
    : extraNames[0];

  return (
    <div className="space-y-3">
      <div className="space-y-3 rounded-2xl border border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] p-3.5">
        <div>
          <h3 className="text-xs font-extrabold text-[var(--mg-text-primary)]">Precios de venta</h3>
          <p className="mt-1 text-[11px] font-semibold text-[var(--mg-text-muted)]">
            {extras.length > 0
              ? `Primero el precio de la unidad suelta. Al lado, lo que cobrás por ${extrasText}.`
              : 'Precio de la unidad suelta.'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className={`rounded-xl border-2 border-[var(--mg-accent-border)] bg-[var(--mg-accent-bg-soft)] p-2.5 ${extras.length === 0 ? 'col-span-2' : ''}`}>
            <NumberField
              label="Precio de venta por unidad *"
              ariaLabel="Precio de venta por unidad"
              value={form.price}
              onChange={(value) => setField('price', value)}
            />
            <p className="mt-1.5 text-[10px] font-bold text-[var(--mg-accent-text)]">
              Unidad suelta
            </p>
          </div>

          {extras.map((preset) => {
            const group = preset.factorGroup || null;
            const groupMembers = group ? extras.filter((p) => p.factorGroup === group) : [preset];
            const isFirstInGroup = !group || groupMembers[0]?.key === preset.key;
            const groupLabel = group === 'chipa' ? 'chipa' : group === 'caja' ? 'caja' : preset.name.toLowerCase();
            const groupFactorValue = group
              ? (groupMembers.map((member) => factors[member.key]).find((value) => value !== '' && value != null) ?? '')
              : (factors[preset.key] ?? '');
            const factor = Number(groupFactorValue || preset.factor || 0);
            const price = Number(prices[preset.key] || 0);
            const perUnit = factor > 1 && price > 0 ? price / factor : 0;

            function setGroupFactor(value) {
              if (!group) {
                setFactor(preset.key, value);
                return;
              }
              const next = { ...factors };
              groupMembers.forEach((member) => { next[member.key] = value; });
              setField('licorFactors', next);
            }

            return (
              <div
                key={preset.key}
                className="rounded-xl border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] p-2.5"
              >
                <NumberField
                  label={`Precio por ${preset.name.toLowerCase()} (Bs)`}
                  ariaLabel={`Precio por ${preset.name.toLowerCase()}`}
                  value={prices[preset.key] ?? ''}
                  onChange={(value) => setPrice(preset.key, value)}
                />
                <div className="mt-2">
                  {isFirstInGroup ? (
                    <UnitsField
                      label={`Unidades por ${groupLabel}`}
                      ariaLabel={group ? `Unidades por ${groupLabel} de venta` : `Unidades por ${groupLabel}`}
                      value={groupFactorValue}
                      onChange={setGroupFactor}
                      placeholder={preset.factor ? String(preset.factor) : 'Ej: 6'}
                    />
                  ) : (
                    <p className="rounded-lg border border-dashed border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] px-2 py-2 text-[10px] font-semibold text-[var(--mg-text-muted)]">
                      Misma cantidad que {groupLabel}: {groupFactorValue || preset.factor || '—'} und.
                    </p>
                  )}
                </div>
                {perUnit > 0 && (
                  <p className="mt-1 text-[10px] font-semibold text-[var(--mg-text-muted)]">
                    Bs {formatBs(perUnit)} por unidad
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-[11px] font-semibold text-[var(--mg-text-muted)]">
          Dejá en blanco lo que no vendas. El precio de la unidad es obligatorio.
        </p>
      </div>

      <div className="space-y-3 rounded-2xl border border-[var(--mg-gold-border)] bg-[var(--mg-gold-bg)] p-3.5">
        <div>
          <h3 className="text-xs font-extrabold text-[var(--mg-text-primary)]">Precio de compra</h3>
          <p className="mt-1 text-[11px] font-semibold text-[var(--mg-text-muted)]">
            Comprás por {purchaseLabel.toLowerCase()}. Anotá cuánto pagás y cuántas unidades trae.
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

        <div className="grid grid-cols-2 gap-2.5">
          <NumberField
            label={`Costo por ${purchaseLabel.toLowerCase()} (Bs)`}
            ariaLabel={`Costo por ${purchaseLabel.toLowerCase()}`}
            value={form.supplierPrice}
            onChange={(value) => setField('supplierPrice', value)}
            placeholder="0"
            integer
          />
          <UnitsField
            label={`Unidades por ${purchaseLabel.toLowerCase()}`}
            ariaLabel={`Unidades por ${purchaseLabel.toLowerCase()}`}
            value={form.licorPurchaseFactor ?? ''}
            onChange={(value) => setField('licorPurchaseFactor', value)}
            placeholder={purchaseFactor > 1 ? String(purchaseFactor) : 'Ej: 10'}
          />
        </div>

        <div className="rounded-xl border border-[var(--mg-gold-border)] bg-[var(--mg-bg-surface)] px-3 py-2">
          {unitCost > 0 ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-[var(--mg-text-secondary)]">Costo por unidad</span>
                <span className="text-sm font-black text-[var(--mg-gold-text)]">Bs {formatBs(unitCost)}</span>
              </div>
              {margin > 0 && (
                <div className="mt-1 flex items-center justify-between gap-2 border-t border-[var(--mg-border)] pt-1">
                  <span className="text-[10px] font-semibold text-[var(--mg-text-muted)]">Ganancia por unidad</span>
                  <span className="text-xs font-black text-[var(--mg-accent-text)]">Bs {formatBs(margin)}</span>
                </div>
              )}
              {saleUnitPrice > 0 && unitCost > saleUnitPrice && (
                <p className="mt-1 border-t border-[var(--mg-border)] pt-1 text-[10px] font-bold text-[var(--mg-danger)]">
                  Ojo: el costo por unidad es mayor que el precio de venta.
                </p>
              )}
            </>
          ) : (
            <p className="text-[11px] font-semibold text-[var(--mg-text-muted)]">
              Completá el costo y las unidades para ver cuánto te sale cada unidad.
            </p>
          )}
        </div>

        <p className="text-[11px] font-semibold text-[var(--mg-text-muted)]">
          {purchaseHelp}
        </p>
      </div>
    </div>
  );
}
