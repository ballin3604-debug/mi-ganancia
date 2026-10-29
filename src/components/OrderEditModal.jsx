import { useEffect, useMemo, useState } from 'react';
import { AppIcon } from './icons';
import { formatBs } from '../utils/currency';
import { getSellOptions, presShortLabel } from '../utils/presentations';
import { generateUUID } from '../services/localDb';

function toDate(value) {
  if (!value) return null;
  if (value.toDate) return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function lineKey(line) {
  return `${line.productId}|${line.presentationId || line.presentation || ''}|${line.variant || ''}`;
}

function lineBase(line) {
  return Number(line.quantity || 0) * Math.max(1, Number(line.presentationFactor || 1));
}

function QuantityStepper({ value, onMinus, onPlus, minusDisabled, plusDisabled }) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={onMinus}
        disabled={minusDisabled}
        aria-label="Quitar uno"
        className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] text-base font-black text-[var(--mg-text-primary)] active:scale-90 disabled:opacity-40"
      >
        −
      </button>
      <span className="w-7 text-center text-sm font-black tabular-nums text-[var(--mg-text-primary)]">{value}</span>
      <button
        type="button"
        onClick={onPlus}
        disabled={plusDisabled}
        aria-label="Agregar uno"
        className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--mg-brand)] text-base font-black text-[var(--mg-brand-contrast)] active:scale-90 disabled:opacity-40"
      >
        +
      </button>
    </div>
  );
}

export default function OrderEditModal({
  sale,
  saleNumber,
  items = [],
  products = [],
  loading = false,
  saving = false,
  error = '',
  initialCancel = false,
  onClose,
  onSave,
  onCancelOrder,
}) {
  const [lines, setLines] = useState(items);
  const [search, setSearch] = useState('');
  const [reason, setReason] = useState('');
  const [cancelMode, setCancelMode] = useState(initialCancel);
  const [cancelReason, setCancelReason] = useState('');
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    setLines(items);
  }, [items]);

  useEffect(() => {
    setCancelMode(initialCancel);
  }, [initialCancel, sale?.id]);

  const originalBaseByProduct = useMemo(() => {
    const map = {};
    items.forEach((line) => {
      if (!line.productId) return;
      map[line.productId] = (map[line.productId] || 0) + lineBase(line);
    });
    return map;
  }, [items]);

  const productsById = useMemo(
    () => Object.fromEntries(products.map((product) => [product.id, product])),
    [products]
  );

  const total = lines.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.price || 0), 0);
  const totalBefore = Number(sale?.total || 0);
  const itemCount = lines.reduce((sum, line) => sum + lineBase(line), 0);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return products
      .filter((product) => {
        if (product.isDish && product.isAvailable === false) return false;
        if (!product.isDish && Number(product.stock || 0) <= 0) return false;
        if (!query) return true;
        return `${product.name || ''} ${product.brand || ''} ${product.category || ''}`
          .toLowerCase()
          .includes(query);
      })
      .slice(0, 10);
  }, [products, search]);

  function availableBaseFor(productId) {
    const product = productsById[productId];
    if (!product || product.isDish) return Infinity;
    return Number(product.stock || 0) + Number(originalBaseByProduct[productId] || 0);
  }

  function proposedBaseFor(productId, candidateLines = lines) {
    return candidateLines
      .filter((line) => line.productId === productId)
      .reduce((sum, line) => sum + lineBase(line), 0);
  }

  function changeQuantity(lineId, delta) {
    setLocalError('');
    const line = lines.find((item) => item.id === lineId);
    if (!line) return;
    if (delta > 0) {
      const product = productsById[line.productId];
      if (!product) {
        setLocalError('Este producto ya no está disponible en el inventario.');
        return;
      }
      if (!product.isDish) {
        const available = availableBaseFor(line.productId);
        const proposed = proposedBaseFor(line.productId) + lineBase({ ...line, quantity: 1 });
        if (proposed > available + 0.0001) {
          setLocalError(`No hay más stock de ${product.name}.`);
          return;
        }
      }
    }
    setLines((prev) => prev.map((item) => (
      item.id === lineId
        ? { ...item, quantity: Math.max(1, Number(item.quantity || 1) + delta) }
        : item
    )));
  }

  function removeLine(lineId) {
    setLocalError('');
    setLines((prev) => prev.filter((line) => line.id !== lineId));
  }

  function addProductOption(product, option) {
    setLocalError('');
    if (!product || !option) return;
    if (!product.isDish) {
      const available = availableBaseFor(product.id);
      const proposed = proposedBaseFor(product.id) + Number(option.factor || 1);
      if (proposed > available + 0.0001) {
        setLocalError(`No hay más stock de ${product.name}.`);
        return;
      }
    }
    const candidate = {
      id: generateUUID(),
      productId: product.id,
      productName: product.name,
      productBrand: product.brand || '',
      category: product.category || 'Otros',
      imageUrl: product.imageData || '',
      quantity: 1,
      price: Number(option.price || product.price || 0),
      supplierPrice: product.supplierPrice ?? product.supplier_price ?? null,
      presentation: presShortLabel(product, option.presId, option.variant, option.presentationId),
      presentationId: option.presentationId || null,
      presentationFactor: Number(option.factor || 1),
      variant: option.variant || '',
    };
    const key = lineKey(candidate);
    setLines((prev) => {
      const existing = prev.find((line) => lineKey(line) === key);
      if (existing) {
        return prev.map((line) => (
          line.id === existing.id ? { ...line, quantity: Number(line.quantity || 0) + 1 } : line
        ));
      }
      return [...prev, candidate];
    });
    setSearch('');
  }

  function handleSave() {
    setLocalError('');
    if (lines.length === 0) {
      setLocalError('El pedido necesita al menos un producto. Si quieres anularlo, usa “Cancelar pedido”.');
      return;
    }
    onSave(lines, reason.trim());
  }

  function handleCancel() {
    setLocalError('');
    onCancelOrder(cancelReason.trim());
  }

  const saleDate = toDate(sale?.createdAt || sale?.created_at);
  const timeLabel = saleDate
    ? saleDate.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })
    : '';
  const orderLabel = saleNumber ? `#${String(saleNumber).padStart(4, '0')}` : '';
  const errorMessage = localError || error;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={saving ? undefined : onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] shadow-2xl sm:rounded-3xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--mg-separator)] p-4 sm:p-5">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--mg-text-muted)]">
              {cancelMode ? 'Cancelar pedido' : 'Editar pedido'}
            </p>
            <h2 className="truncate text-lg font-black tracking-tight text-[var(--mg-brand-text)]">
              {cancelMode ? 'Anular pedido' : 'Modificar pedido'} {orderLabel}
            </h2>
            <p className="mt-0.5 text-[11px] font-semibold text-[var(--mg-text-secondary)]">
              {timeLabel ? `${timeLabel} · ` : ''}{sale?.sellerName || sale?.seller_name || 'Cajero'}
              {sale?.clientName || sale?.client_name ? ` · ${sale.clientName || sale.client_name}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Cerrar"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)] transition-colors hover:text-[var(--mg-text-primary)] disabled:opacity-40"
          >
            <AppIcon name="cerrar" size={15} />
          </button>
        </div>

        {cancelMode ? (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              <div className="rounded-2xl border border-[var(--mg-danger-border)] bg-[var(--mg-danger-bg)] p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--mg-danger-border)] bg-[var(--mg-bg-surface)] text-[var(--mg-danger)]">
                    <AppIcon name="alerta" size={19} />
                  </span>
                  <div>
                    <p className="text-sm font-black text-[var(--mg-danger)]">Esta acción anula el pedido completo</p>
                    <p className="mt-1 text-xs font-semibold leading-relaxed text-[var(--mg-text-secondary)]">
                      Los productos vuelven al inventario y el pedido deja de contar en las ventas del día.
                      La cancelación queda registrada en la bitácora.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] p-3.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-bold text-[var(--mg-text-secondary)]">Total del pedido</span>
                  <span className="text-xl font-black text-[var(--mg-brand-text)] tabular-nums">{formatBs(totalBefore)}</span>
                </div>
                <p className="mt-1 text-[11px] font-semibold text-[var(--mg-text-muted)]">
                  {items.length} {items.length === 1 ? 'producto' : 'productos'} en el pedido original.
                </p>
              </div>

              <label className="mt-4 block">
                <span className="text-[10px] font-black uppercase tracking-wider text-[var(--mg-text-muted)]">Motivo (opcional)</span>
                <textarea
                  value={cancelReason}
                  onChange={(event) => setCancelReason(event.target.value)}
                  rows={2}
                  maxLength={180}
                  placeholder="Ej: el cliente se arrepintió, pedido duplicado..."
                  className="mg-input mt-1.5 w-full resize-none text-sm"
                />
              </label>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {['Cliente canceló', 'Pedido duplicado', 'Error de cobro', 'Se fue sin pagar'].map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setCancelReason(option)}
                    className="rounded-full border border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] px-2.5 py-1 text-[11px] font-bold text-[var(--mg-text-secondary)] transition-colors hover:border-[var(--mg-danger-border)] hover:text-[var(--mg-danger)]"
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div className="shrink-0 border-t border-[var(--mg-separator)] bg-[var(--mg-bg-surface)] p-4 sm:p-5">
              {errorMessage ? (
                <p className="mb-3 rounded-xl border border-[var(--mg-danger-border)] bg-[var(--mg-danger-bg)] px-3 py-2 text-xs font-bold text-[var(--mg-danger)]">
                  {errorMessage}
                </p>
              ) : null}
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setCancelMode(false)}
                  disabled={saving}
                  className="flex-1 rounded-2xl border border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] py-3 text-xs font-black text-[var(--mg-text-secondary)] active:scale-95 disabled:opacity-50"
                >
                  Volver a editar
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={saving || loading}
                  className="flex flex-[1.4] items-center justify-center gap-1.5 rounded-2xl bg-[var(--mg-danger)] py-3 text-xs font-black text-white shadow-md active:scale-95 disabled:opacity-50"
                >
                  {saving ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <AppIcon name="cancelar" size={14} color="#fff" />}
                  Sí, cancelar pedido
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-16 text-sm font-bold text-[var(--mg-text-muted)]">
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--mg-brand)] border-t-transparent" />
                  Cargando el pedido...
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {lines.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] p-6 text-center">
                        <p className="text-sm font-black text-[var(--mg-text-primary)]">El pedido quedó vacío</p>
                        <p className="mt-1 text-xs font-semibold text-[var(--mg-text-muted)]">
                          Agrega un producto o cancela el pedido completo.
                        </p>
                      </div>
                    ) : lines.map((line) => {
                      const product = productsById[line.productId];
                      const factor = Math.max(1, Number(line.presentationFactor || 1));
                      return (
                        <div key={line.id} className="rounded-2xl border border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] p-3">
                          <div className="flex items-start gap-2.5">
                            {product?.imageData || line.imageUrl ? (
                              <img
                                src={product?.imageData || line.imageUrl}
                                alt={line.productName}
                                className="h-10 w-10 shrink-0 rounded-xl object-cover"
                              />
                            ) : (
                              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--mg-bg-surface)] text-[var(--mg-text-faint)]">
                                <AppIcon name="paquete" size={17} />
                              </span>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-black text-[var(--mg-text-primary)]">{line.productName}</p>
                              <p className="mt-0.5 text-[11px] font-semibold text-[var(--mg-text-muted)]">
                                {line.presentation ? `${line.presentation} · ` : ''}{formatBs(line.price)}
                                {factor > 1 ? ` · x${factor} unidades base` : ''}
                              </p>
                              {product && !product.isDish ? (
                                <p className="mt-0.5 text-[10px] font-bold text-[var(--mg-text-faint)]">
                                  Stock actual: {Math.max(0, Number(product.stock || 0))} unidades base
                                </p>
                              ) : null}
                            </div>
                            <button
                              type="button"
                              onClick={() => removeLine(line.id)}
                              aria-label="Retirar producto"
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[var(--mg-text-muted)] transition-colors hover:bg-[var(--mg-danger-bg)] hover:text-[var(--mg-danger)]"
                            >
                              <AppIcon name="eliminar" size={15} />
                            </button>
                          </div>
                          <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-[var(--mg-separator)] pt-2.5">
                            <QuantityStepper
                              value={line.quantity}
                              onMinus={() => changeQuantity(line.id, -1)}
                              onPlus={() => changeQuantity(line.id, 1)}
                              minusDisabled={line.quantity <= 1}
                              plusDisabled={!product}
                            />
                            <span className="text-sm font-black tabular-nums text-[var(--mg-brand-text)]">
                              {formatBs(Number(line.quantity || 0) * Number(line.price || 0))}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-5">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--mg-text-muted)]">Añadir producto</p>
                    <div className="relative mt-1.5">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--mg-text-muted)]">
                        <AppIcon name="search" size={16} />
                      </span>
                      <input
                        type="text"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Buscar en el menú..."
                        className="mg-input min-h-[44px] pl-9 text-sm"
                      />
                    </div>

                    <div className="mt-2 space-y-2">
                      {filteredProducts.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-[var(--mg-border)] px-3 py-3 text-center text-xs font-semibold text-[var(--mg-text-muted)]">
                          No encontramos productos disponibles.
                        </p>
                      ) : filteredProducts.map((product) => {
                        const options = getSellOptions(product);
                        return (
                          <div key={product.id} className="rounded-2xl border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] p-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <p className="min-w-0 truncate text-xs font-black text-[var(--mg-text-primary)]">{product.name}</p>
                              <span className="shrink-0 text-[10px] font-bold text-[var(--mg-text-muted)]">
                                {product.isDish ? 'Plato' : `Stock ${Math.max(0, Number(product.stock || 0))}`}
                              </span>
                            </div>
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              {options.map((option) => (
                                <button
                                  key={option.key}
                                  type="button"
                                  onClick={() => addProductOption(product, option)}
                                  className="rounded-xl border border-[var(--mg-brand-border)] bg-[var(--mg-brand-bg)] px-2.5 py-1.5 text-[11px] font-bold text-[var(--mg-brand-text)] active:scale-95"
                                >
                                  {option.label}{option.factor > 1 ? ` x${option.factor}` : ''} · {formatBs(option.price)}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <label className="mt-4 block">
                    <span className="text-[10px] font-black uppercase tracking-wider text-[var(--mg-text-muted)]">Motivo del cambio (opcional)</span>
                    <input
                      type="text"
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      maxLength={180}
                      placeholder="Ej: el cliente pidió cambiar una bebida"
                      className="mg-input mt-1.5 w-full text-sm"
                    />
                  </label>
                </>
              )}
            </div>

            <div className="shrink-0 border-t border-[var(--mg-separator)] bg-[var(--mg-bg-surface)] p-4 sm:p-5">
              {errorMessage ? (
                <p className="mb-3 rounded-xl border border-[var(--mg-danger-border)] bg-[var(--mg-danger-bg)] px-3 py-2 text-xs font-bold text-[var(--mg-danger)]">
                  {errorMessage}
                </p>
              ) : null}
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-[var(--mg-text-muted)]">Nuevo total</p>
                  <p className="text-2xl font-black tabular-nums text-[var(--mg-brand-text)]">{formatBs(total)}</p>
                  <p className="text-[10px] font-semibold text-[var(--mg-text-muted)]">
                    Antes {formatBs(totalBefore)} · {Math.round(itemCount)} {Math.round(itemCount) === 1 ? 'unidad' : 'unidades'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCancelMode(true)}
                  className="flex min-h-[36px] items-center gap-1 rounded-xl border border-[var(--mg-danger-border)] bg-[var(--mg-danger-bg)] px-2.5 py-1.5 text-[11px] font-black text-[var(--mg-danger)] active:scale-95"
                >
                  <AppIcon name="cancelar" size={13} /> Cancelar pedido
                </button>
              </div>
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={saving}
                  className="flex-1 rounded-2xl border border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] py-3 text-xs font-black text-[var(--mg-text-secondary)] active:scale-95 disabled:opacity-50"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || loading || lines.length === 0}
                  className="flex flex-[1.4] items-center justify-center gap-1.5 rounded-2xl bg-[var(--mg-brand)] py-3 text-xs font-black text-[var(--mg-brand-contrast)] shadow-md active:scale-95 disabled:opacity-50"
                >
                  {saving ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <AppIcon name="guardar" size={14} />}
                  Guardar cambios
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
