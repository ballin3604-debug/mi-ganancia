// ─────────────────────────────────────────────────────────────
// Inicio del cajero: solo su trabajo, nada de la tienda.
// Ve: vender, sus recibos de hoy (con reimpresión) y avisos de stock.
// NO ve: totales del negocio, otros vendedores, costos, reportes ni ajustes.
// ─────────────────────────────────────────────────────────────
import { useState } from 'react';
import { motion } from 'motion/react';
import { formatBs } from '../utils/currency';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';
import { useBranches } from '../context/BranchContext';
import { AppIcon } from './icons';
import { SyncStatusBadge } from './SyncStatusBadge';
import OrderChangesCard from './OrderChangesCard';

function prettyName(raw) {
  const name = (raw || '').trim();
  if (!name) return 'Cajero';
  if (name.includes('@')) return name.split('@')[0];
  return name.split(' ')[0];
}

function ReceiptRow({ sale, items, expanded, onToggle, onSelectSale, onReimprint, printingSaleId }) {
  const date = sale.createdAt?.toDate ? sale.createdAt.toDate() : new Date(sale.createdAt || Date.now());
  const time = date.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
  return (
    <li className={`rounded-2xl border transition-colors overflow-hidden ${expanded ? 'bg-[var(--mg-accent-bg-soft)] border-[var(--mg-accent-border)]' : 'bg-[var(--mg-bg-surface)] border-[var(--mg-border)]'}`}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left cursor-pointer min-h-[52px]"
      >
        <span className="font-mono text-xs font-extrabold text-[var(--mg-text-muted)] shrink-0">{time}</span>
        <span className="flex-1 min-w-0 truncate text-sm font-bold text-[var(--mg-text-primary)]">
          {sale.clientName || 'Cliente Ocasional'}
        </span>
        <SyncStatusBadge status={sale.sync_status} className="hidden sm:inline-flex" />
        <span className="text-sm font-black text-[var(--mg-brand-text)] tabular-nums shrink-0">{formatBs(sale.total)}</span>
        <span className={`inline-flex w-7 h-7 items-center justify-center rounded-full border transition-all shrink-0 ${expanded ? 'bg-[var(--mg-accent)] text-white border-[var(--mg-accent)] rotate-180' : 'bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)] border-[var(--mg-border)]'}`}>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </button>
      {expanded && (
        <div className="px-4 pb-3.5">
          <div className="flex items-start justify-between gap-3 flex-wrap border-t border-[var(--mg-accent-border)] pt-3">
            <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
              {items.length > 0 ? (
                items.map((it, idx) => (
                  <span key={idx} className="bg-[var(--mg-bg-surface)] border border-[var(--mg-border)] px-2 py-1 rounded-md font-semibold text-[11px] text-[var(--mg-text-secondary)] tabular-nums">
                    {it.quantity}x {it.productName} ({formatBs(it.subtotal)})
                  </span>
                ))
              ) : (
                <span className="text-[var(--mg-text-muted)] font-medium text-xs">Cargando productos…</span>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {onSelectSale && (
                <button
                  type="button"
                  onClick={() => onSelectSale(sale)}
                  className="px-2.5 py-1.5 bg-[var(--mg-bg-surface)] hover:bg-[var(--mg-bg-elevated)] border border-[var(--mg-border)] text-[var(--mg-text-secondary)] text-[11px] font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1 min-h-[32px]"
                >
                  <AppIcon name="detalle" size={13} /> Detalle
                </button>
              )}
              {onReimprint && (
                <button
                  type="button"
                  onClick={() => onReimprint(sale)}
                  disabled={printingSaleId === sale.id}
                  className="px-2.5 py-1.5 bg-[var(--mg-accent)] hover:bg-[var(--mg-accent-hover)] text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1 min-h-[32px] disabled:opacity-50"
                >
                  <AppIcon name="recibo" size={13} color="#fff" /> {printingSaleId === sale.id ? 'Imprimiendo…' : 'Recibo'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </li>
  );
}

export function CashierHome({
  user,
  businessName,
  todayStr,
  sales,
  salesItemsMap = {},
  lowStock = [],
  totalCobrado = 0,
  totalCash = 0,
  totalQr = 0,
  onNavigate,
  onSelectSale,
  onReimprint,
  printingSaleId,
  orderChanges = [],
  salesById = {},
  saleNumberById = {},
  showOrderChanges = false,
}) {
  const [expandedId, setExpandedId] = useState(null);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [displayName, setDisplayName] = useState(
    () => user?.displayName || user?.email || ''
  );
  const { branches, activeBranch, selectBranch } = useBranches();
  const inWarehouse = activeBranch?.type === 'almacen';
  const sellBranches = branches.filter((b) => b.type !== 'almacen');
  const firstName = prettyName(displayName);
  const looksLikeEmail = (displayName || '').includes('@');

  async function handleSaveName() {
    const clean = nameDraft.trim().replace(/\s+/g, ' ').slice(0, 40);
    if (!clean || savingName) return;
    if (!supabase || !isSupabaseConfigured) {
      alert('Falta VITE_SUPABASE_URL. Configura tu archivo .env para guardar el nombre.');
      return;
    }
    setSavingName(true);
    try {
      const uid = user?.id || user?.uid;
      await supabase.auth.updateUser({ data: { displayName: clean } });
      if (uid) {
        try {
          await supabase.from('profiles').update({ name: clean }).eq('id', uid);
        } catch { /* si RLS lo bloquea, el saludo igual se actualiza */ }
      }
      setDisplayName(clean);
      setEditingName(false);
    } catch {
      alert('No se pudo guardar el nombre. Intenta de nuevo.');
    } finally {
      setSavingName(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="p-4 sm:p-6 space-y-6 max-w-3xl mx-auto pb-16"
    >
      {/* Saludo */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          {editingName ? (
            <div className="flex items-center gap-2">
              <input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                placeholder="Tu nombre (ej: Alan)"
                autoFocus
                maxLength={40}
                className="mg-input text-sm font-bold py-2 min-w-0"
              />
              <button
                type="button"
                onClick={handleSaveName}
                disabled={!nameDraft.trim() || savingName}
                className="px-3 py-2 rounded-xl bg-[var(--mg-accent)] hover:bg-[var(--mg-accent-hover)] text-white text-xs font-black shrink-0 disabled:opacity-50 min-h-[40px] transition-colors"
              >
                {savingName ? '…' : 'Listo'}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-[var(--mg-brand-text)] truncate">
                Hola, {firstName}
              </h1>
              <button
                type="button"
                onClick={() => { setNameDraft(looksLikeEmail ? '' : firstName); setEditingName(true); }}
                title={looksLikeEmail ? 'Pon tu nombre' : 'Cambiar nombre'}
                className="w-8 h-8 rounded-full bg-[var(--mg-bg-elevated)] border border-[var(--mg-border)] flex items-center justify-center text-[var(--mg-text-muted)] hover:text-[var(--mg-brand-text)] hover:border-[var(--mg-brand-border)] shrink-0 transition-colors"
              >
                <AppIcon name="editar" size={13} />
              </button>
            </div>
          )}
          <p className="text-xs text-[var(--mg-text-muted)] font-medium mt-1">
            {businessName} · {todayStr}
          </p>
          {user?.email && (
            <p className="text-[11px] text-[var(--mg-text-faint)] font-medium mt-0.5 truncate">
              Cuenta vinculada: {user.email}
            </p>
          )}
          {looksLikeEmail && !editingName && (
            <p className="text-[11px] font-bold text-[var(--mg-gold-text)] mt-1">
              Toca el lápiz y pon tu nombre para que salga en las ventas.
            </p>
          )}
        </div>
        <span className="text-[11px] font-black uppercase tracking-wider text-[var(--mg-success-text)] bg-[var(--mg-success-bg)] border border-[var(--mg-success-border)] px-3 py-1.5 rounded-full shrink-0">
          Mi turno
        </span>
      </div>

      {/* Acción principal */}
      {inWarehouse ? (
        <div className="w-full bg-[var(--mg-gold-bg)] border border-[var(--mg-gold-border)] rounded-3xl p-5 space-y-3">
          <p className="text-sm font-black text-[var(--mg-gold-text)]">
            Estás en {activeBranch?.name || 'un almacén'}: aquí no se vende
          </p>
          <div className="flex gap-2 flex-wrap">
            {sellBranches.map((b) => (
              <button
                key={b.id} type="button" onClick={() => { selectBranch(b.id); onNavigate('/ventas'); }}
                className="px-3 py-2 rounded-xl text-xs font-black bg-[var(--mg-accent)] hover:bg-[var(--mg-accent-hover)] text-white active:scale-95 transition-colors min-h-[40px]"
              >
                Vender en {b.name}
              </button>
            ))}
          </div>
        </div>
      ) : (
      <button
        type="button"
        onClick={() => onNavigate('/ventas')}
        className="w-full text-[var(--mg-brand-contrast)] rounded-3xl p-5 sm:p-6 flex items-center gap-4 text-left group active:scale-[0.99] transition-all"
        style={{ background: 'linear-gradient(135deg, var(--mg-brand) 0%, var(--mg-brand-hover) 100%)', boxShadow: 'var(--mg-shadow-md)' }}
      >
        <span className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
          <AppIcon name="carrito" size={24} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-lg font-black">Nueva venta</span>
          <span className="block text-xs opacity-80 font-medium mt-0.5">Toca, cobra y listo</span>
        </span>
        <span className="w-8 h-8 rounded-full bg-[var(--mg-gold)] flex items-center justify-center shrink-0 transition-transform group-hover:translate-x-0.5">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </span>
      </button>
      )}

      {/* Mi turno hoy */}
      <section>
        <h2 className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--mg-text-secondary)] mb-3 flex items-center gap-2">
          <span className="w-1 h-3.5 rounded-full bg-[var(--mg-brand)]" />
          Mi turno hoy
        </h2>
        {sales.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <div className="bg-[var(--mg-bg-surface)] rounded-2xl p-3.5 text-center border border-[var(--mg-border)]">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">Ventas</p>
              <p className="text-2xl font-black text-[var(--mg-text-primary)] mt-0.5 tabular-nums">{sales.length}</p>
            </div>
            <div className="bg-[var(--mg-brand-bg)] rounded-2xl p-3.5 text-center border border-[var(--mg-brand-border)]">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--mg-text-secondary)]">Cobrado</p>
              <p className="text-xl font-black text-[var(--mg-brand-text)] mt-0.5 tabular-nums">{formatBs(totalCobrado)}</p>
            </div>
            <div className="col-span-2 sm:col-span-1 bg-[var(--mg-bg-surface)] rounded-2xl p-3.5 text-center border border-[var(--mg-border)]">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">Efec / QR</p>
              <p className="text-sm font-black text-[var(--mg-text-primary)] mt-1 tabular-nums">
                {formatBs(totalCash)} <span className="text-[var(--mg-text-faint)] font-bold">/</span> {formatBs(totalQr)}
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-[var(--mg-bg-surface)] rounded-2xl p-6 text-center border border-[var(--mg-border)]">
            <AppIcon name="carrito" size={36} color="var(--mg-brand)" />
            <p className="text-sm font-bold text-[var(--mg-text-primary)] mt-2">Sin ventas todavía</p>
            <p className="text-xs text-[var(--mg-text-muted)] mt-0.5">Tu primera venta del día aparece aquí.</p>
          </div>
        )}
      </section>

      {/* Mis recibos */}
      {sales.length > 0 && (
        <section>
          <h2 className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--mg-text-secondary)] mb-3 flex items-center gap-2">
            <span className="w-1 h-3.5 rounded-full bg-[var(--mg-gold)]" />
            Mis recibos ({sales.length})
          </h2>
          <ul className="space-y-2">
            {[...sales]
              .sort((a, b) => {
                const da = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
                const db = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
                return db - da;
              })
              .map((sale) => (
                <ReceiptRow
                  key={sale.id}
                  sale={sale}
                  items={salesItemsMap[sale.id] || []}
                  expanded={expandedId === sale.id}
                  onToggle={() => setExpandedId(expandedId === sale.id ? null : sale.id)}
                  onSelectSale={onSelectSale}
                  onReimprint={onReimprint}
                  printingSaleId={printingSaleId}
                />
              ))}
          </ul>
        </section>
      )}

      {showOrderChanges ? (
        <OrderChangesCard
          changes={orderChanges}
          salesById={salesById}
          saleNumberById={saleNumberById}
          onOpen={() => onNavigate('/ventas?tab=bitacora')}
          compact
        />
      ) : null}

      {/* Aviso de stock (sin precios ni edición) */}
      {lowStock.length > 0 && (
        <section className="bg-[var(--mg-gold-bg)] border border-[var(--mg-gold-border)] rounded-2xl p-4">
          <p className="text-xs font-black text-[var(--mg-gold-text)] uppercase tracking-wider flex items-center gap-1.5">
            <AppIcon name="reloj" size={14} /> Por acabarse ({lowStock.length})
          </p>
          <p className="text-xs text-[var(--mg-text-secondary)] mt-1.5 font-medium">
            {lowStock.slice(0, 5).map((p) => p.name).join(' · ')}
            {lowStock.length > 5 ? ` y ${lowStock.length - 5} más` : ''}.
            Avisa al dueño para reponer.
          </p>
        </section>
      )}

    </motion.div>
  );
}
