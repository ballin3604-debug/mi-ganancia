import {
  computeProformaItem,
  getProformaItemFactor,
  getProformaItemQuantity,
  getProformaItemUnitCost,
  roundMoney,
} from '../../services/purchaseProformas';
import { clampIntegerInput, clampNumberInput, blockInvalidNumberKeys } from '../../utils/numberInput';
import { AppIcon } from '../icons';
import { buildPresentationOptions, getProformaPresentationLabel } from './proformaUi';

function formatBs(amount) {
  return `Bs ${Number(amount || 0).toFixed(2)}`;
}

function expiryTone(dateValue, warningDays) {
  if (!dateValue) return '';
  const expiry = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(expiry.getTime())) return '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysLeft = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
  if (daysLeft < 0) return 'text-[var(--mg-danger)]';
  if (daysLeft <= warningDays) return 'text-[var(--mg-gold-text)]';
  return 'text-[var(--mg-success-text)]';
}

export default function ProformaItemCard({
  item,
  index,
  extraShare = 0,
  requireExpiry = false,
  expiryWarningDays = 30,
  onChange,
  onRemove,
}) {
  const factor = getProformaItemFactor(item);
  const quantity = getProformaItemQuantity(item);
  const unitCost = getProformaItemUnitCost(item);
  const totals = computeProformaItem(item, extraShare);
  const presentationLabel = getProformaPresentationLabel(item);
  const presentationOptions = item.presentationOptions?.length
    ? item.presentationOptions
    : buildPresentationOptions({ presentations: item.newProduct?.presentations || [] });
  const customPresentation = item.presentationKey === 'custom';
  const salePrice = Number(item.salePrice || 0);
  const marginAmount = salePrice - totals.unitRealCost;
  const marginPct = salePrice > 0 ? (marginAmount / salePrice) * 100 : 0;
  const marginTone = marginAmount < 0 ? 'text-[var(--mg-danger)]' : 'text-[var(--mg-success-text)]';

  function changePresentation(value) {
    const option = presentationOptions.find((row) => row.key === value);
    if (!option) return;

    if (value === 'custom') {
      const hasFactor = factor > 1;
      onChange({
        presentationKey: 'custom',
        presentationName: hasFactor ? presentationLabel : '',
        factor: hasFactor ? factor : '',
        costMode: hasFactor ? 'package' : 'unit',
        costInput: hasFactor
          ? String(roundMoney(unitCost * factor))
          : (unitCost > 0 ? String(roundMoney(unitCost)) : item.costInput),
      });
      return;
    }

    const nextFactor = Number(option.factor || 0);
    const nextMode = nextFactor > 1 ? 'package' : 'unit';
    const nextInput = unitCost > 0
      ? String(roundMoney(nextMode === 'package' ? unitCost * nextFactor : unitCost))
      : item.costInput;

    onChange({
      presentationKey: option.key,
      presentationName: option.name,
      factor: nextFactor,
      costMode: nextMode,
      costInput: nextInput,
    });
  }

  function changeCostMode(mode) {
    if (mode === item.costMode) return;
    const currentUnitCost = getProformaItemUnitCost(item);
    const nextInput = currentUnitCost > 0
      ? String(roundMoney(mode === 'package' ? currentUnitCost * factor : currentUnitCost))
      : item.costInput;
    onChange({ costMode: mode, costInput: nextInput });
  }

  return (
    <article className="space-y-3 rounded-2xl border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] p-3.5 shadow-[var(--mg-shadow-sm)] sm:p-4">
      <header className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--mg-brand-bg)] text-xs font-black text-[var(--mg-brand-text)]">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate text-sm font-black text-[var(--mg-text-primary)]">{item.productName}</p>
            {item.isNewProduct && (
              <span className="rounded-full bg-[var(--mg-success-bg)] px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-[var(--mg-success-text)]">
                Nuevo
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-[11px] font-semibold text-[var(--mg-text-muted)]">
            {[item.productBrand, item.category, item.barcode].filter(Boolean).join(' · ') || 'Sin marca'}
          </p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          title="Quitar de la proforma"
          aria-label={`Quitar ${item.productName}`}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[var(--mg-border)] text-[var(--mg-text-muted)] transition-colors hover:border-[var(--mg-danger)] hover:text-[var(--mg-danger)] active:scale-90"
        >
          <AppIcon name="eliminar" size={15} />
        </button>
      </header>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <div className="col-span-2 sm:col-span-1">
          <label className="mb-1 block text-[10px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">
            Presentación de compra
          </label>
          <select
            value={item.presentationKey || 'unit'}
            onChange={(event) => changePresentation(event.target.value)}
            className="mg-input !px-3 !py-2.5 text-xs font-bold"
          >
            {presentationOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.key === 'custom'
                  ? 'Otra presentación'
                  : option.factor > 1 ? `${option.name} x${option.factor}` : option.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-[10px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">
            {factor > 1 ? `Cant. ${presentationLabel.toLowerCase()}` : 'Cantidad (unidades)'}
          </label>
          <input
            type="number"
            inputMode="numeric"
            min="0"
            max="999999"
            step="1"
            value={item.packCount}
            onChange={(event) => onChange({ packCount: clampIntegerInput(event.target.value, { max: 999999 }) })}
            onKeyDown={(event) => blockInvalidNumberKeys(event, { allowDecimal: false })}
            placeholder="1"
            className="mg-input !px-3 !py-2.5 text-center text-sm font-black"
          />
        </div>

        {factor > 1 && (
          <div>
            <label className="mb-1 block text-[10px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">
              Unidades sueltas
            </label>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              max="999999"
              step="1"
              value={item.looseUnits}
              onChange={(event) => onChange({ looseUnits: clampIntegerInput(event.target.value, { max: 999999 }) })}
              onKeyDown={(event) => blockInvalidNumberKeys(event, { allowDecimal: false })}
              placeholder="0"
              className="mg-input !px-3 !py-2.5 text-center text-sm font-bold"
            />
          </div>
        )}
      </div>

      {customPresentation && (
        <div className="grid grid-cols-2 gap-2.5 rounded-xl border border-dashed border-[var(--mg-border-hover)] bg-[var(--mg-bg-elevated)] p-2.5">
          <div>
            <label className="mb-1 block text-[10px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">
              Nombre
            </label>
            <input
              type="text"
              value={item.presentationName}
              onChange={(event) => onChange({ presentationName: event.target.value })}
              placeholder="Ej: Caja, Chipa"
              className="mg-input !px-3 !py-2 text-xs font-bold"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">
              Unidades que trae
            </label>
            <input
              type="number"
              inputMode="numeric"
              min="1"
              max="9999"
              step="1"
              value={item.factor}
              onChange={(event) => onChange({ factor: clampIntegerInput(event.target.value, { min: 1, max: 9999 }) })}
              onKeyDown={(event) => blockInvalidNumberKeys(event, { allowDecimal: false })}
              placeholder="24"
              className="mg-input !px-3 !py-2 text-center text-xs font-black"
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <div className="col-span-2 sm:col-span-1">
          <div className="mb-1 flex items-center justify-between gap-1">
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">
              {item.costMode === 'package' && factor > 1
                ? `Costo por ${presentationLabel.toLowerCase()}`
                : 'Costo por unidad'}
            </label>
            {factor > 1 && (
              <div className="flex rounded-md bg-[var(--mg-bg-elevated)] p-0.5">
                <button
                  type="button"
                  onClick={() => changeCostMode('package')}
                  className={`rounded px-1.5 py-0.5 text-[9px] font-black ${item.costMode === 'package' ? 'bg-[var(--mg-brand)] text-[var(--mg-brand-contrast)]' : 'text-[var(--mg-text-muted)]'}`}
                >
                  {presentationLabel}
                </button>
                <button
                  type="button"
                  onClick={() => changeCostMode('unit')}
                  className={`rounded px-1.5 py-0.5 text-[9px] font-black ${item.costMode !== 'package' ? 'bg-[var(--mg-brand)] text-[var(--mg-brand-contrast)]' : 'text-[var(--mg-text-muted)]'}`}
                >
                  Unidad
                </button>
              </div>
            )}
          </div>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            max="999999"
            step="0.01"
            value={item.costInput}
            onChange={(event) => onChange({ costInput: clampNumberInput(event.target.value, { max: 999999 }) })}
            onKeyDown={blockInvalidNumberKeys}
            placeholder="0.00"
            className="mg-input !px-3 !py-2.5 text-sm font-black text-[var(--mg-accent-text)]"
          />
          {factor > 1 && unitCost > 0 && (
            <p className="mt-1 text-[10px] font-semibold text-[var(--mg-text-muted)]">
              {formatBs(unitCost)} por unidad
            </p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-[10px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">
            Precio venta unidad
          </label>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            max="999999"
            step="0.01"
            value={item.salePrice}
            onChange={(event) => onChange({ salePrice: clampNumberInput(event.target.value, { max: 999999 }) })}
            onKeyDown={blockInvalidNumberKeys}
            placeholder="0.00"
            className="mg-input !px-3 !py-2.5 text-sm font-black text-[var(--mg-accent-text)]"
          />
        </div>

        <div>
          <label className="mb-1 block text-[10px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">
            Lote
          </label>
          <input
            type="text"
            value={item.lotCode}
            onChange={(event) => onChange({ lotCode: event.target.value })}
            placeholder="Opcional"
            className="mg-input !px-3 !py-2.5 text-xs font-bold uppercase"
          />
        </div>

        <div>
          <label className="mb-1 block text-[10px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">
            Vencimiento {requireExpiry && <span className="text-[var(--mg-danger)]">*</span>}
          </label>
          <input
            type="date"
            value={item.expiryDate}
            onChange={(event) => onChange({ expiryDate: event.target.value })}
            className={`mg-input !px-2.5 !py-2.5 text-xs font-bold ${expiryTone(item.expiryDate, expiryWarningDays)}`}
          />
          {requireExpiry && !item.expiryDate && (
            <p className="mt-1 text-[10px] font-bold text-[var(--mg-danger)]">Obligatorio para licorería</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--mg-bg-elevated)] px-3 py-2">
        <span className="text-[11px] font-bold text-[var(--mg-text-secondary)]">
          {quantity} und. base
          {factor > 1 && item.packCount ? ` · ${item.packCount} x ${factor}` : ''}
          {factor > 1 && item.looseUnits ? ` + ${item.looseUnits} sueltas` : ''}
        </span>
        <span className="flex flex-wrap items-center gap-3">
          <span className={`text-[11px] font-black ${marginTone}`}>
            Margen {marginPct.toFixed(1)}%
          </span>
          <span className="text-xs font-black text-[var(--mg-brand-text)]">
            {formatBs(totals.totalCost)}
          </span>
        </span>
      </div>
    </article>
  );
}
