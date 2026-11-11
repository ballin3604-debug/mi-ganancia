import { useMemo, useState } from 'react';
import { LICOR_CATEGORIES, getLicorCategoryConfig, getLicorSellPresets } from '../../config/licorCatalog';
import { clampIntegerInput, clampNumberInput, blockInvalidNumberKeys } from '../../utils/numberInput';
import { validatePresentationDefinitions } from '../../utils/presentations';
import { AppIcon } from '../icons';

function normalize(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

export default function NewProformaProductModal({
  initialName = '',
  initialBarcode = '',
  categories = [],
  products = [],
  isLicoreria = false,
  presentationsEnabled = false,
  onClose,
  onAdd,
}) {
  const categoryOptions = useMemo(() => {
    const list = [...(categories || []), ...(isLicoreria ? LICOR_CATEGORIES : [])];
    return [...new Set(list.filter(Boolean))];
  }, [categories, isLicoreria]);

  const [form, setForm] = useState({
    name: initialName,
    category: categoryOptions[0] || 'Cervezas',
    barcode: initialBarcode,
    brand: '',
    price: '',
  });
  const [presetValues, setPresetValues] = useState({});
  const [error, setError] = useState('');

  const presets = getLicorSellPresets(form.category).filter((preset) => preset.key !== 'unidad');

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function setPresetValue(key, field, value) {
    setPresetValues((current) => ({
      ...current,
      [key]: { ...(current[key] || {}), [field]: value },
    }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    setError('');

    const name = form.name.trim();
    const barcode = form.barcode.trim();
    const unitPrice = Number(form.price || 0);

    if (!name) {
      setError('Escribí el nombre del producto.');
      return;
    }
    if (!(unitPrice > 0)) {
      setError('Ingresá el precio de venta de la unidad.');
      return;
    }

    const nameKey = normalize(name);
    const barcodeKey = normalize(barcode);
    const duplicateName = products.find((product) => normalize(product.name) === nameKey);
    if (duplicateName) {
      setError(`Ya existe "${duplicateName.name}". Cerralo y buscalo en la lista.`);
      return;
    }
    if (barcodeKey) {
      const duplicateBarcode = products.find((product) => normalize(product.barcode) === barcodeKey);
      if (duplicateBarcode) {
        setError(`Ese código de barras ya pertenece a "${duplicateBarcode.name}".`);
        return;
      }
    }

    const presentations = [{
      id: 'licor-unidad',
      name: 'Unidad',
      factor: 1,
      price: unitPrice,
      isBase: true,
    }];

    if (presentationsEnabled) {
      for (const preset of presets) {
        const row = presetValues[preset.key] || {};
        const price = Number(row.price || 0);
        if (!(price > 0)) continue;
        const factor = Number(row.factor || preset.factor || 0);
        if (!Number.isFinite(factor) || factor <= 1) {
          setError(`Indicá cuántas unidades trae ${preset.name}.`);
          return;
        }
        presentations.push({
          id: `licor-${preset.key}`,
          name: preset.name,
          factor,
          price,
          isBase: false,
        });
      }
    }

    try {
      validatePresentationDefinitions(presentations, {
        baseName: 'Unidad',
        basePrice: unitPrice,
      });
    } catch (validationError) {
      setError(validationError.message || 'Revisá las presentaciones del producto.');
      return;
    }

    const config = getLicorCategoryConfig(form.category);
    const preferredPresetKey = config.purchase.factorFrom?.[0];
    const preferredPreset = presets.find((preset) => preset.key === preferredPresetKey);
    const preferredRow = preferredPreset ? presetValues[preferredPreset.key] || {} : {};
    const preferredFactor = Number(preferredRow.factor || preferredPreset?.factor || 0);

    onAdd({
      name,
      category: form.category,
      barcode,
      brand: form.brand.trim(),
      price: unitPrice,
      presentations,
    }, preferredFactor);
  }

  return (
    <div
      className="fixed inset-0 z-[95] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Nuevo producto para la proforma"
        className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-[var(--mg-bg-surface)] shadow-2xl mg-slide-up sm:rounded-3xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center gap-3 border-b border-[var(--mg-separator)] px-4 py-3.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--mg-brand)] text-[var(--mg-brand-contrast)]">
            <AppIcon name="nuevoProducto" size={19} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-black tracking-tight text-[var(--mg-brand-text)]">Nuevo producto</h2>
            <p className="text-[11px] font-semibold text-[var(--mg-text-muted)]">
              Se creará al guardar la proforma, con sus presentaciones y stock.
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

            <div>
              <label className="mb-1 block text-xs font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">
                Nombre del producto *
              </label>
              <input
                type="text"
                autoFocus
                value={form.name}
                onChange={(event) => setField('name', event.target.value)}
                placeholder="Ej: Cerveza Paceña 620 ml"
                className="mg-input text-sm font-bold"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">
                  Categoría
                </label>
                <select
                  value={form.category}
                  onChange={(event) => setField('category', event.target.value)}
                  className="mg-input !px-3 text-xs font-bold"
                >
                  {categoryOptions.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">
                  Marca
                </label>
                <input
                  type="text"
                  value={form.brand}
                  onChange={(event) => setField('brand', event.target.value)}
                  placeholder="Opcional"
                  className="mg-input !px-3 text-xs font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">
                  Código de barras
                </label>
                <input
                  type="text"
                  value={form.barcode}
                  onChange={(event) => setField('barcode', event.target.value)}
                  placeholder="Opcional"
                  className="mg-input !px-3 text-xs font-bold"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">
                  Precio venta unidad (Bs) *
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max="999999"
                  step="0.01"
                  value={form.price}
                  onChange={(event) => setField('price', clampNumberInput(event.target.value, { max: 999999 }))}
                  onKeyDown={blockInvalidNumberKeys}
                  placeholder="0.00"
                  className="mg-input !px-3 text-sm font-black text-[var(--mg-accent-text)]"
                />
              </div>
            </div>

            {presentationsEnabled && (
              <div className="space-y-2.5 rounded-2xl border border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] p-3">
                <div>
                  <h3 className="text-xs font-extrabold text-[var(--mg-text-primary)]">Presentaciones de venta</h3>
                  <p className="mt-0.5 text-[11px] font-semibold text-[var(--mg-text-muted)]">
                    Cargá solo las que vendés. El stock siempre se cuenta en unidades sueltas.
                  </p>
                </div>
                {presets.map((preset) => {
                  const row = presetValues[preset.key] || {};
                  return (
                    <div key={preset.key} className="grid grid-cols-[1fr_72px_1fr] items-end gap-2">
                      <div>
                        <label className="mb-1 block text-[10px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">
                          {preset.name} (Bs)
                        </label>
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          max="999999"
                          step="0.01"
                          value={row.price ?? ''}
                          onChange={(event) => setPresetValue(preset.key, 'price', clampNumberInput(event.target.value, { max: 999999 }))}
                          onKeyDown={blockInvalidNumberKeys}
                          placeholder="0.00"
                          className="mg-input !px-2.5 !py-2 text-xs font-black"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">
                          x und.
                        </label>
                        <input
                          type="number"
                          inputMode="numeric"
                          min="1"
                          max="9999"
                          step="1"
                          value={row.factor ?? (preset.factor || '')}
                          onChange={(event) => setPresetValue(preset.key, 'factor', clampIntegerInput(event.target.value, { min: 1, max: 9999 }))}
                          onKeyDown={(event) => blockInvalidNumberKeys(event, { allowDecimal: false })}
                          placeholder={preset.factor ? String(preset.factor) : '6'}
                          className="mg-input !px-2 !py-2 text-center text-xs font-bold"
                        />
                      </div>
                      <p className="pb-2 text-[10px] font-semibold leading-tight text-[var(--mg-text-muted)]">
                        Se suma como presentación de venta.
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <footer className="flex gap-2 border-t border-[var(--mg-separator)] bg-[var(--mg-bg-surface)] p-3.5">
            <button type="button" onClick={onClose} className="mg-btn-tertiary flex-1 !py-2.5 text-sm">
              Cancelar
            </button>
            <button type="submit" className="mg-btn-primary flex-[1.4] !py-2.5 text-sm">
              Agregar a la proforma
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
