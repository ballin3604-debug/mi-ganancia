import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  groupPurchasePriceAlerts,
  markProductPriceAlertsReviewed,
  subscribeToPurchasePriceAlerts,
  updateProductPriceFromAlert,
} from '../../services/purchasePriceAlerts';
import { clampNumberInput, blockInvalidNumberKeys } from '../../utils/numberInput';
import { AppIcon } from '../icons';

function formatBs(amount) {
  return `Bs ${Number(amount || 0).toFixed(2)}`;
}

function formatDate(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('es-BO', { day: '2-digit', month: 'short' });
}

function suggestSalePrice(alert) {
  const factor = Number(alert?.packageFactor || 1);
  const previousSale = Number(alert?.previousSalePrice || 0);
  if (!(previousSale > 0) || !(factor > 0)) return 0;
  const oldUnitCost = Number(alert?.oldPackagePrice || 0) / factor;
  const newUnitCost = Number(alert?.newPackagePrice || 0) / factor;
  return Math.max(0, Math.round((previousSale + (newUnitCost - oldUnitCost)) * 100) / 100);
}

function ProductThumb({ imageData, name }) {
  if (!imageData) {
    return (
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] text-[var(--mg-text-muted)]">
        <AppIcon name="paquete" size={16} />
      </span>
    );
  }
  return (
    <img
      src={imageData}
      alt={name || 'Producto'}
      loading="lazy"
      decoding="async"
      className="h-9 w-9 shrink-0 rounded-lg border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] object-cover"
    />
  );
}

export function PurchasePriceAlerts({ products = [], onNavigate }) {
  const { businessId, user } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [busyKey, setBusyKey] = useState(null);
  const [priceModal, setPriceModal] = useState(null);
  const [salePrice, setSalePrice] = useState('');
  const [priceError, setPriceError] = useState('');
  const [notice, setNotice] = useState('');
  const [savingPrice, setSavingPrice] = useState(false);

  useEffect(() => {
    if (!businessId) return undefined;
    return subscribeToPurchasePriceAlerts(businessId, setAlerts);
  }, [businessId]);

  const groups = useMemo(() => groupPurchasePriceAlerts(alerts), [alerts]);
  const suggestedPrice = priceModal ? suggestSalePrice(priceModal.latest) : 0;

  if (groups.length === 0) return null;

  async function handleReview(group) {
    if (!group.productId) return;
    setBusyKey(group.key);
    setNotice('');
    try {
      await markProductPriceAlertsReviewed(businessId, group.productId, user?.uid);
      setNotice(`“${group.productName}” marcado como revisado.`);
    } catch (err) {
      console.error(err);
      window.alert('No se pudo marcar la alerta como revisada.');
    } finally {
      setBusyKey(null);
    }
  }

  function openPriceModal(group) {
    const product = products.find((row) => row.id === group.productId);
    setPriceModal(group);
    setSalePrice(String(product?.price ?? group.latest?.previousSalePrice ?? ''));
    setPriceError('');
    setNotice('');
  }

  async function handleUpdatePrice(event) {
    event.preventDefault();
    if (!priceModal?.productId) return;
    const price = Number(salePrice);
    if (!(price > 0)) {
      setPriceError('Ingresá un precio de venta mayor a 0.');
      return;
    }
    setSavingPrice(true);
    setPriceError('');
    try {
      await updateProductPriceFromAlert({
        businessId,
        productId: priceModal.productId,
        salePrice: price,
        userId: user?.uid,
      });
      setNotice(`Precio de “${priceModal.productName}” actualizado a ${formatBs(price)}.`);
      setPriceModal(null);
    } catch (err) {
      console.error(err);
      setPriceError(err.message || 'No se pudo actualizar el precio.');
    } finally {
      setSavingPrice(false);
    }
  }

  return (
    <>
      <section className="rounded-3xl border border-[var(--mg-gold-border)] bg-[var(--mg-bg-surface)] p-5 shadow-[var(--mg-shadow-sm)]">
        <div className="mb-1 flex items-start justify-between gap-3">
          <h3 className="flex items-center gap-2 text-sm font-black leading-snug text-[var(--mg-brand-text)]">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--mg-gold-bg)] text-[var(--mg-gold-text)]">
              <AppIcon name="alerta" size={16} />
            </span>
            Productos con Alteraciones en Precios de Compra
          </h3>
          <span className="shrink-0 rounded-full border border-[var(--mg-gold-border)] bg-[var(--mg-gold-bg)] px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-[var(--mg-gold-text)]">
            {groups.length} {groups.length === 1 ? 'alerta' : 'alertas'}
          </span>
        </div>
        <p className="mb-3 text-[11px] text-[var(--mg-text-muted)]">
          El precio por caja o paquete cambió respecto al precio de compra actual del producto. Revisalo antes de vender.
        </p>

        {notice && (
          <p className="mb-3 rounded-xl border border-[var(--mg-success-border)] bg-[var(--mg-success-bg)] px-3 py-2 text-[11px] font-bold text-[var(--mg-success-text)]">
            {notice}
          </p>
        )}

        <ul className="space-y-2.5">
          {groups.slice(0, 6).map((group) => {
            const latest = group.latest;
            const product = products.find((row) => row.id === group.productId);
            const isUp = latest.differenceAmount > 0;
            const direction = isUp ? '↑' : '↓';
            const tone = isUp ? 'text-[var(--mg-danger)]' : 'text-[var(--mg-success-text)]';
            const bgTone = isUp
              ? 'border-[var(--mg-danger-border)] bg-[var(--mg-danger-bg)]'
              : 'border-[var(--mg-success-border)] bg-[var(--mg-success-bg)]';
            const busy = busyKey === group.key;
            return (
              <li key={group.key} className="rounded-2xl border border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] p-3">
                <div className="flex items-start gap-2.5">
                  <div className="flex shrink-0 flex-col items-center gap-1">
                    <ProductThumb imageData={product?.imageData || product?.image_url} name={group.productName} />
                    <span className={`flex h-6 w-6 items-center justify-center rounded-lg border text-sm font-black ${bgTone} ${tone}`}>
                      {direction}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate text-xs font-black text-[var(--mg-text-primary)]">{group.productName}</p>
                      {group.count > 1 && (
                        <span className="rounded-full bg-[var(--mg-bg-surface)] px-1.5 py-0.5 text-[9px] font-black text-[var(--mg-text-muted)]">
                          {group.count} cambios
                        </span>
                      )}
                    </div>
                    <p className="truncate text-[10px] font-semibold text-[var(--mg-text-muted)]">
                      {[group.productCode, latest.supplier, latest.packageFactor > 1 ? `Caja x${latest.packageFactor}` : 'Unidad']
                        .filter(Boolean)
                        .join(' · ')}
                    </p>

                    <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                      <div className="rounded-lg border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] px-2 py-1">
                        <p className="text-[8px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">Precio compra anterior</p>
                        <p className="text-[11px] font-black text-[var(--mg-text-secondary)]">{formatBs(latest.oldPackagePrice)}</p>
                      </div>
                      <div className={`rounded-lg border px-2 py-1 ${bgTone}`}>
                        <p className={`text-[8px] font-extrabold uppercase tracking-wider ${tone}`}>Precio compra actual</p>
                        <p className={`text-[11px] font-black ${tone}`}>{formatBs(latest.newPackagePrice)}</p>
                      </div>
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[9px]">
                      <span className={`rounded-full border px-1.5 py-0.5 font-black ${bgTone} ${tone}`}>
                        {isUp ? '+' : ''}{formatBs(latest.differenceAmount)} · {isUp ? '+' : ''}{latest.differencePct.toFixed(1)}%
                      </span>
                      {latest.createdAt && (
                        <span className="font-semibold text-[var(--mg-text-faint)]">{formatDate(latest.createdAt)}</span>
                      )}
                      {latest.proformaNumber && (
                        <span className="font-semibold text-[var(--mg-text-faint)]">Proforma {latest.proformaNumber}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => handleReview(group)}
                    disabled={busy || !group.productId}
                    className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-xl border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] px-3 text-[11px] font-bold text-[var(--mg-text-secondary)] transition-colors hover:bg-[var(--mg-bg-section)] disabled:opacity-50"
                  >
                    <AppIcon name="check" size={14} />
                    {busy ? 'Marcando...' : 'Marcar como revisado'}
                  </button>
                  <button
                    type="button"
                    onClick={() => openPriceModal(group)}
                    disabled={!group.productId}
                    className="mg-btn-primary inline-flex min-h-[38px] items-center justify-center gap-1.5 px-3 text-[11px] disabled:opacity-50"
                  >
                    <AppIcon name="editar" size={14} />
                    Actualizar precio de venta
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        {groups.length > 6 && (
          <p className="mt-2 text-center text-[10px] font-bold text-[var(--mg-text-muted)]">
            Y {groups.length - 6} productos más con alteraciones.
          </p>
        )}

        <button
          type="button"
          onClick={() => onNavigate && onNavigate('/compras')}
          className="mt-3 min-h-[44px] w-full rounded-xl border border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] py-2.5 text-xs font-bold text-[var(--mg-text-secondary)] transition-colors hover:bg-[var(--mg-bg-section)]"
        >
          Ver proformas de compra →
        </button>
      </section>

      {priceModal && (
        <div
          className="fixed inset-0 z-[95] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => setPriceModal(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Actualizar precio de venta"
            className="w-full max-w-md overflow-hidden rounded-t-3xl bg-[var(--mg-bg-surface)] shadow-2xl mg-slide-up sm:rounded-3xl"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="flex items-center gap-3 border-b border-[var(--mg-separator)] px-4 py-3.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--mg-brand)] text-[var(--mg-brand-contrast)]">
                <AppIcon name="etiqueta" size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-base font-black text-[var(--mg-brand-text)]">Actualizar precio de venta</h3>
                <p className="truncate text-[11px] font-semibold text-[var(--mg-text-muted)]">{priceModal.productName}</p>
              </div>
              <button
                type="button"
                onClick={() => setPriceModal(null)}
                aria-label="Cerrar"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)]"
              >
                <AppIcon name="cerrar" size={15} />
              </button>
            </header>

            <form onSubmit={handleUpdatePrice} className="p-4">
              <div className="rounded-xl border border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] p-3 text-[11px] font-semibold text-[var(--mg-text-secondary)]">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[9px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">Precio compra anterior</p>
                    <p className="text-sm font-black text-[var(--mg-text-secondary)]">{formatBs(priceModal.latest.oldPackagePrice)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">Precio compra actual</p>
                    <p className="text-sm font-black text-[var(--mg-text-primary)]">{formatBs(priceModal.latest.newPackagePrice)}</p>
                  </div>
                </div>
                <p className="mt-1.5 text-[10px] font-semibold text-[var(--mg-text-muted)]">
                  {priceModal.latest.packageFactor > 1
                    ? `Compra por caja x${priceModal.latest.packageFactor}. Costo actual por unidad: ${formatBs(priceModal.latest.newPackagePrice / priceModal.latest.packageFactor)}.`
                    : `Costo actual por unidad: ${formatBs(priceModal.latest.newPackagePrice)}.`}
                  {Number(priceModal.latest.previousSalePrice) > 0
                    ? ` Precio de venta actual: ${formatBs(priceModal.latest.previousSalePrice)}.`
                    : ''}
                </p>
              </div>

              {suggestedPrice > 0 && (
                <div className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-[var(--mg-success-border)] bg-[var(--mg-success-bg)] px-3 py-2">
                  <p className="text-[10px] font-bold text-[var(--mg-success-text)]">
                    Para conservar tu ganancia anterior por unidad: <strong>{formatBs(suggestedPrice)}</strong>
                  </p>
                  <button
                    type="button"
                    onClick={() => setSalePrice(String(suggestedPrice))}
                    className="shrink-0 rounded-lg border border-[var(--mg-success-border)] bg-[var(--mg-bg-surface)] px-2 py-1 text-[10px] font-black text-[var(--mg-success-text)]"
                  >
                    Usar
                  </button>
                </div>
              )}

              {priceError && (
                <p className="mt-2 rounded-xl border border-[var(--mg-danger-border)] bg-[var(--mg-danger-bg)] px-3 py-2 text-[11px] font-bold text-[var(--mg-danger)]">
                  {priceError}
                </p>
              )}

              <div className="mt-3">
                <label className="mb-1 block text-[10px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">
                  Nuevo precio de venta por unidad (Bs)
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max="999999"
                  step="0.01"
                  autoFocus
                  value={salePrice}
                  onChange={(event) => setSalePrice(clampNumberInput(event.target.value, { max: 999999 }))}
                  onKeyDown={blockInvalidNumberKeys}
                  placeholder="0.00"
                  className="mg-input text-right text-lg font-black text-[var(--mg-accent-text)]"
                />
              </div>

              <div className="mt-4 flex gap-2">
                <button type="button" onClick={() => setPriceModal(null)} className="mg-btn-tertiary flex-1 !py-2.5 text-sm">
                  Cancelar
                </button>
                <button type="submit" disabled={savingPrice} className="mg-btn-primary flex-[1.4] !py-2.5 text-sm disabled:opacity-50">
                  {savingPrice ? 'Guardando...' : 'Actualizar precio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default PurchasePriceAlerts;
