import { useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { updatePurchaseProformaLine } from '../../services/purchaseProformas';
import { clampIntegerInput, clampNumberInput, blockInvalidNumberKeys } from '../../utils/numberInput';
import { AppIcon } from '../icons';
import {
  buildLinePresentationOptions,
  findPresentationOption,
  presentationOptionLabel,
  roundPurchasePrice,
} from './proformaUi';

function formatBs(amount) {
  return `Bs ${Number(amount || 0).toFixed(2)}`;
}

function formatQty(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return '0';
  if (Number.isInteger(number)) return String(number);
  return number.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function currentQuantityLabel(line) {
  const quantity = Number(line.quantity || 0);
  const packs = Number(line.packageCount || 0);
  const size = Number(line.packageSize || 0);
  if (line.purchaseUnitType === 'package' && packs > 0 && size > 0) {
    return `${formatQty(packs)} × ${size} = ${formatQty(quantity)} und.`;
  }
  return `${formatQty(quantity)} und.`;
}

export default function ProformaLineEditModal({ line, product, onClose, onSaved }) {
  const { businessId } = useAuth();
  const options = useMemo(
    () => buildLinePresentationOptions(product, line),
    [product, line],
  );

  const initialFactor = Number(line.packageSize || 0) > 1 ? Number(line.packageSize) : 1;
  const initialQty = Number(line.packageCount || 0) > 0
    ? Number(line.packageCount)
    : Number(line.quantity || 0);
  const initialPrice = Number(line.packagePrice || 0) > 0
    ? Number(line.packagePrice)
    : roundPurchasePrice(Number(line.supplierPrice || 0) * initialFactor);
  const initialOption = findPresentationOption(options, {
    factor: initialFactor,
    name: line.presentationName,
  });

  const [presentationKey, setPresentationKey] = useState(initialOption?.key || 'unit');
  const [presentationName, setPresentationName] = useState(
    String(line.presentationName || initialOption?.name || 'Unidad'),
  );
  const [factor, setFactor] = useState(String(initialFactor));
  const [quantity, setQuantity] = useState(String(initialQty));
  const [price, setPrice] = useState(initialPrice > 0 ? String(initialPrice) : '');
  const [lotCode, setLotCode] = useState(String(line.lotCode || ''));
  const [expiryDate, setExpiryDate] = useState(String(line.expiryDate || ''));
  const [noExpiry, setNoExpiry] = useState(!line.expiryDate);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const numericFactor = Math.max(1, Number(factor) || 1);
  const numericQuantity = Number(quantity) || 0;
  const numericPrice = Number(price) || 0;
  const newUnits = numericQuantity * numericFactor;
  const oldUnits = Number(line.quantity || 0);
  const delta = newUnits - oldUnits;
  const unitCost = numericFactor > 0 ? numericPrice / numericFactor : 0;
  const baseTotal = numericQuantity * numericPrice;
  const presentationLabel = numericFactor > 1
    ? (presentationName.trim() || 'Paquete')
    : 'Unidad';

  function handlePresentationChange(value) {
    const option = options.find((row) => row.key === value);
    if (!option) return;
    setPresentationKey(value);
    if (value === 'custom') return;
    setPresentationName(option.name);
    setFactor(String(option.factor || 1));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (!(numericQuantity > 0)) {
      setError('La cantidad debe ser mayor a 0.');
      return;
    }
    if (!(numericPrice > 0)) {
      setError('El precio de compra debe ser mayor a 0.');
      return;
    }
    if (numericFactor > 1 && !presentationName.trim()) {
      setError('Escribí el nombre de la presentación (por ejemplo, Chipa).');
      return;
    }

    setSaving(true);
    try {
      const result = await updatePurchaseProformaLine(businessId, line.id, {
        factor: numericFactor,
        presentationName: presentationLabel,
        packageQty: numericQuantity,
        packagePrice: numericPrice,
        lotCode,
        expiryDate: noExpiry ? '' : expiryDate,
      });
      onSaved?.(result);
    } catch (err) {
      console.error(err);
      setError(err.message || 'No pudimos corregir la línea. Intentá de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[95] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Corregir línea de proforma"
        className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-[var(--mg-bg-surface)] shadow-2xl mg-slide-up sm:rounded-3xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center gap-3 border-b border-[var(--mg-separator)] px-4 py-3.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--mg-brand)] text-[var(--mg-brand-contrast)]">
            <AppIcon name="editar" size={19} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-black tracking-tight text-[var(--mg-brand-text)]">Corregir línea</h2>
            <p className="truncate text-[11px] font-semibold text-[var(--mg-text-muted)]">
              {line.productName} · {currentQuantityLabel(line)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)]"
          >
            <AppIcon name="cerrar" size={15} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
            {error && (
              <div className="rounded-xl border border-[var(--mg-danger-border)] bg-[var(--mg-danger-bg)] px-3 py-2 text-xs font-bold text-[var(--mg-danger)]">
                {error}
              </div>
            )}

            <div className="rounded-xl border border-[var(--mg-brand-border)] bg-[var(--mg-brand-bg)] px-3 py-2 text-[11px] font-semibold leading-relaxed text-[var(--mg-brand-text)]">
              Cambiá la presentación y la cantidad. El stock se ajusta solo por la diferencia
              y el costo del producto queda actualizado.
            </div>

            <div>
              <label className="mb-1 block text-xs font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">
                Presentación comprada
              </label>
              <select
                value={presentationKey}
                onChange={(event) => handlePresentationChange(event.target.value)}
                aria-label="Presentación de compra"
                className="mg-input text-sm font-bold"
              >
                {options.map((option) => (
                  <option key={option.key} value={option.key}>
                    {presentationOptionLabel(option)}
                  </option>
                ))}
              </select>
            </div>

            {presentationKey === 'custom' && (
              <div className="grid grid-cols-[1fr_96px] gap-2">
                <div>
                  <label className="mb-1 block text-[10px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">
                    Nombre de la presentación
                  </label>
                  <input
                    type="text"
                    value={presentationName}
                    onChange={(event) => setPresentationName(event.target.value)}
                    placeholder="Ej: Chipa"
                    aria-label="Nombre de la presentación"
                    className="mg-input !px-3 text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">
                    Unidades
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="9999"
                    step="1"
                    value={factor}
                    onChange={(event) => setFactor(clampIntegerInput(event.target.value, { min: 1, max: 9999 }))}
                    onKeyDown={(event) => blockInvalidNumberKeys(event, { allowDecimal: false })}
                    aria-label="Unidades por presentación"
                    className="mg-input !px-2 text-center text-sm font-black"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-[10px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">
                  Cantidad de {presentationLabel.toLowerCase()}
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max="999999"
                  step="0.01"
                  value={quantity}
                  onChange={(event) => setQuantity(clampNumberInput(event.target.value, { max: 999999 }))}
                  onKeyDown={blockInvalidNumberKeys}
                  aria-label={`Cantidad de ${presentationLabel.toLowerCase()}`}
                  className="mg-input text-center text-sm font-black"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">
                  Precio por {presentationLabel.toLowerCase()} (Bs)
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  max="9999999"
                  step="1"
                  value={price}
                  onChange={(event) => setPrice(clampIntegerInput(event.target.value, { max: 9999999 }))}
                  onKeyDown={(event) => blockInvalidNumberKeys(event, { allowDecimal: false })}
                  aria-label={`Precio por ${presentationLabel.toLowerCase()}`}
                  className="mg-input text-right text-sm font-black text-[var(--mg-accent-text)]"
                />
              </div>
            </div>

            <div className="rounded-xl border border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] p-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-[var(--mg-text-muted)]">
                Ajuste de inventario
              </p>
              <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] font-semibold text-[var(--mg-text-secondary)]">
                <span>Antes: <strong className="text-[var(--mg-text-primary)]">{formatQty(oldUnits)} und.</strong></span>
                <span>Ahora: <strong className="text-[var(--mg-text-primary)]">{formatQty(newUnits)} und.</strong></span>
                <span>Diferencia: <strong className={delta < 0 ? 'text-[var(--mg-danger)]' : 'text-[var(--mg-success-text)]'}>
                  {delta >= 0 ? '+' : ''}{formatQty(delta)} und.
                </strong></span>
                <span>Costo unitario: <strong className="text-[var(--mg-text-primary)]">{formatBs(unitCost)}</strong></span>
                <span className="col-span-2">Base de la línea: <strong className="text-[var(--mg-brand-text)]">{formatBs(baseTotal)}</strong></span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-[10px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">
                  Lote
                </label>
                <input
                  type="text"
                  value={lotCode}
                  onChange={(event) => setLotCode(event.target.value)}
                  placeholder="Opcional"
                  aria-label="Lote"
                  className="mg-input !px-3 text-xs font-bold"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">
                  Vencimiento
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="date"
                    value={expiryDate}
                    disabled={noExpiry}
                    onChange={(event) => setExpiryDate(event.target.value)}
                    aria-label="Vencimiento"
                    className="mg-input min-w-0 flex-1 !px-2 text-[11px] font-bold disabled:opacity-40"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setNoExpiry((current) => !current);
                      if (!noExpiry) setExpiryDate('');
                    }}
                    className={`inline-flex min-h-[34px] shrink-0 items-center justify-center rounded-lg border px-2 text-[10px] font-black ${
                      noExpiry
                        ? 'border-[var(--mg-brand-border)] bg-[var(--mg-brand-bg)] text-[var(--mg-brand-text)]'
                        : 'border-[var(--mg-border)] text-[var(--mg-text-muted)]'
                    }`}
                    title="Sin vencimiento"
                  >
                    S/V
                  </button>
                </div>
              </div>
            </div>
          </div>

          <footer className="flex gap-2 border-t border-[var(--mg-separator)] bg-[var(--mg-bg-surface)] p-3.5">
            <button type="button" onClick={onClose} className="mg-btn-tertiary flex-1 !py-2.5 text-sm" disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="mg-btn-primary flex-[1.4] !py-2.5 text-sm" disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar corrección'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
