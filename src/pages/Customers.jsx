import { useState, useEffect, useMemo } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBusiness } from '../context/BusinessContext';
import { getCustomers, addCustomer, updateCustomer, deleteCustomer } from '../services/customers';
import { getDebts } from '../services/debts';
import { formatBs } from '../utils/currency';
import SwipeableCard from '../components/SwipeableCard';
import LoadingSpinner from '../components/LoadingSpinner';
import { AppIcon } from '../components/icons';

const EMPTY_FORM = {
    name: '',
    nit: '',
    phone: '',
    address: '',
    birthday: '',
    notes: '',
    credit_limit: '',
};

function normalizeName(value) {
    return String(value || '').trim().toLowerCase();
}

export default function Customers() {
    const { businessId } = useAuth();
    const { sectorConfig } = useBusiness();
    const hasCustomers = !!sectorConfig?.features?.customers;
    const hasReceivables = !!sectorConfig?.features?.receivables;

    const [customers, setCustomers] = useState([]);
    const [debts, setDebts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState(null);
    const [formData, setFormData] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (businessId) loadData();
    }, [businessId]);

    async function loadData() {
        setLoading(true);
        try {
            const [customerList, debtList] = await Promise.all([
                getCustomers(businessId),
                hasReceivables ? getDebts(businessId) : Promise.resolve([]),
            ]);
            setCustomers(customerList);
            setDebts(debtList);
        } catch (error) {
            console.error('Error al cargar clientes:', error);
        } finally {
            setLoading(false);
        }
    }

    // Saldo pendiente por cliente (fiados activos). Se compara por nombre
    // porque la tabla de deudas guarda el nombre y no el id del cliente.
    const pendingByName = useMemo(() => {
        const map = new Map();
        debts
            .filter((d) => d.status === 'pending')
            .forEach((d) => {
                const key = normalizeName(d.clientName);
                if (!key) return;
                map.set(key, (map.get(key) || 0) + (Number(d.amount) || 0));
            });
        return map;
    }, [debts]);

    const totalPending = useMemo(
        () => Array.from(pendingByName.values()).reduce((sum, value) => sum + value, 0),
        [pendingByName]
    );

    const filteredCustomers = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return customers;
        return customers.filter((c) => (
            (c.name || '').toLowerCase().includes(q)
            || (c.nit || '').toLowerCase().includes(q)
            || (c.phone || '').toLowerCase().includes(q)
            || (c.address || '').toLowerCase().includes(q)
        ));
    }, [customers, search]);

    function openModal(customer = null) {
        if (customer) {
            setEditingCustomer(customer);
            setFormData({
                name: customer.name || '',
                nit: customer.nit || '',
                phone: customer.phone || '',
                address: customer.address || '',
                birthday: customer.birthday || '',
                notes: customer.notes || '',
                credit_limit: customer.credit_limit ?? customer.creditLimit ?? '',
            });
        } else {
            setEditingCustomer(null);
            setFormData(EMPTY_FORM);
        }
        setIsModalOpen(true);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        if (!formData.name.trim() || saving) return;

        setSaving(true);
        try {
            if (editingCustomer) {
                await updateCustomer(editingCustomer.id, formData);
            } else {
                await addCustomer(businessId, formData);
            }
            setIsModalOpen(false);
            await loadData();
        } catch (error) {
            console.error('Error al guardar cliente:', error);
            alert(`Error al guardar: ${error.message}`);
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(id) {
        if (!confirm('¿Seguro que deseas eliminar este cliente?')) return;
        try {
            await deleteCustomer(id);
            await loadData();
        } catch (error) {
            console.error('Error al eliminar cliente:', error);
        }
    }

    if (!hasCustomers) return <Navigate to="/" replace />;
    if (loading) return <LoadingSpinner />;

    return (
        <div className="mx-auto w-full max-w-3xl space-y-3.5 p-3.5 pb-24 mg-fade-in sm:p-5 lg:p-6">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h2 className="text-xl font-black tracking-tight text-[var(--mg-text-primary)] sm:text-2xl">
                        Directorio de clientes
                    </h2>
                    <p className="mt-0.5 text-xs font-semibold text-[var(--mg-text-muted)]">
                        Datos de contacto y crédito para ventas al por mayor
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => openModal()}
                    className="flex min-h-[42px] shrink-0 items-center gap-1.5 rounded-2xl bg-[var(--mg-accent)] px-4 py-2.5 text-xs font-extrabold text-white shadow-md transition-all hover:bg-[var(--mg-accent-hover)] active:scale-95"
                >
                    <AppIcon name="agregar" size={15} color="#fff" />
                    Nuevo
                </button>
            </div>

            {hasReceivables && (
                <Link
                    to="/cxc"
                    className="flex items-center justify-between gap-3 rounded-[22px] border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] p-4 shadow-xs transition-all hover:shadow-md"
                >
                    <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--mg-danger-bg)] text-[var(--mg-danger)]">
                            <AppIcon name="fiado" size={20} />
                        </span>
                        <div>
                            <p className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">
                                Total por cobrar
                            </p>
                            <p className="text-xl font-black tracking-tight text-[var(--mg-danger)]">
                                {formatBs(totalPending)}
                            </p>
                        </div>
                    </div>
                    <span className="flex items-center gap-1 text-xs font-extrabold text-[var(--mg-accent)]">
                        Ver CxC
                        <AppIcon name="siguiente" size={14} />
                    </span>
                </Link>
            )}

            <div className="rounded-[22px] border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] p-3.5 shadow-xs">
                <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--mg-text-muted)]">
                        <AppIcon name="search" size={16} />
                    </span>
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Buscar por nombre, NIT/CI, teléfono o dirección…"
                        className="min-h-[40px] w-full rounded-xl border border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] py-2 pl-10 pr-10 text-xs font-semibold text-[var(--mg-text-primary)] placeholder:text-[var(--mg-text-muted)] transition-all focus:border-[var(--mg-accent)] focus:outline-none"
                    />
                    {search && (
                        <button
                            type="button"
                            onClick={() => setSearch('')}
                            className="absolute right-2.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] text-[10px] font-bold text-[var(--mg-text-muted)] transition-all hover:text-[var(--mg-text-primary)]"
                            title="Limpiar búsqueda"
                        >
                            ✕
                        </button>
                    )}
                </div>
            </div>

            {customers.length > 0 && (
                <p className="text-center text-xs text-[var(--mg-text-faint)]">
                    ← Desliza un cliente para editar o borrar
                </p>
            )}

            <div className="space-y-2.5">
                {filteredCustomers.length === 0 ? (
                    <div className="rounded-[22px] border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] p-6 text-center shadow-xs">
                        <p className="text-4xl">{customers.length === 0 ? '👥' : '🔍'}</p>
                        <p className="mt-2 text-sm font-extrabold text-[var(--mg-text-primary)]">
                            {customers.length === 0 ? 'Aún no tienes clientes guardados' : 'Sin resultados'}
                        </p>
                        <p className="mt-1 text-xs text-[var(--mg-text-muted)]">
                            {customers.length === 0
                                ? 'Agrega tu primer cliente para venderle al fiado con recibo.'
                                : 'Prueba con otro nombre, NIT o teléfono.'}
                        </p>
                    </div>
                ) : (
                    filteredCustomers.map((c) => {
                        const pending = pendingByName.get(normalizeName(c.name)) || 0;
                        const creditLimit = Number(c.credit_limit ?? c.creditLimit ?? 0);
                        const overLimit = creditLimit > 0 && pending > creditLimit;
                        return (
                            <SwipeableCard key={c.id} onEdit={() => openModal(c)} onDelete={() => handleDelete(c.id)}>
                                <div className="group flex items-start justify-between gap-3 rounded-2xl border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] p-4 shadow-sm">
                                    <div className="flex min-w-0 flex-1 items-start gap-3">
                                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[var(--mg-accent-border)] bg-[var(--mg-accent-bg)] text-sm font-black text-[var(--mg-accent)]">
                                            {(c.name || '?').charAt(0).toUpperCase()}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="truncate text-base font-bold text-[var(--mg-text-primary)]">{c.name}</span>
                                                {pending > 0 && (
                                                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black ${
                                                        overLimit
                                                            ? 'border-red-200 bg-[var(--mg-danger-bg)] text-[var(--mg-danger)]'
                                                            : 'border-amber-200 bg-amber-50 text-amber-700'
                                                    }`}>
                                                        Debe {formatBs(pending)}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs font-medium text-[var(--mg-text-muted)]">
                                                {c.nit && <span>CI/NIT: {c.nit}</span>}
                                                {c.phone && <span>📞 {c.phone}</span>}
                                                {c.address && <span>📍 {c.address}</span>}
                                                {c.birthday && <span>🎂 {c.birthday}</span>}
                                                {creditLimit > 0 && (
                                                    <span className={overLimit ? 'font-bold text-[var(--mg-danger)]' : ''}>
                                                        Límite: {formatBs(creditLimit)}
                                                    </span>
                                                )}
                                            </div>
                                            {c.notes && (
                                                <p className="mt-1.5 rounded-lg border border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] px-2 py-1 text-[11px] font-medium text-[var(--mg-text-secondary)]">
                                                    {c.notes}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-1 transition-opacity duration-200 lg:opacity-0 lg:group-hover:opacity-100">
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); openModal(c); }}
                                            className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-500 transition-all hover:bg-[var(--mg-accent-bg)] hover:text-[var(--mg-accent-text)] active:scale-95"
                                            title="Editar cliente"
                                        >
                                            <AppIcon name="editar" size={16} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }}
                                            className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-400 transition-all hover:bg-red-50 hover:text-[var(--mg-danger)] active:scale-95"
                                            title="Eliminar cliente"
                                        >
                                            <AppIcon name="eliminar" size={16} />
                                        </button>
                                    </div>
                                </div>
                            </SwipeableCard>
                        );
                    })
                )}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
                    <div className="mg-slide-up flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-[var(--mg-bg-base)] shadow-2xl sm:rounded-3xl">
                        <div className="flex items-center justify-between border-b border-[var(--mg-separator)] bg-[var(--mg-bg-elevated)] p-5">
                            <h3 className="text-lg font-black tracking-tight text-[var(--mg-text-primary)]">
                                {editingCustomer ? 'Editar cliente' : 'Nuevo cliente'}
                            </h3>
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] text-lg font-bold text-[var(--mg-text-muted)] transition-all active:scale-95"
                            >
                                ✕
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-3.5 overflow-y-auto p-5">
                            <div>
                                <label className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">Nombre completo *</label>
                                <input type="text" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full rounded-xl border border-[var(--mg-border)] bg-[var(--mg-bg-input)] px-4 py-3 text-sm font-semibold text-[var(--mg-text-primary)] outline-none transition-all focus:ring-2 focus:ring-[var(--mg-accent)]" placeholder="Ej. Juan Pérez" />
                            </div>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div>
                                    <label className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">CI / NIT</label>
                                    <input type="text" value={formData.nit} onChange={e => setFormData({ ...formData, nit: e.target.value })} className="w-full rounded-xl border border-[var(--mg-border)] bg-[var(--mg-bg-input)] px-4 py-3 text-sm font-semibold text-[var(--mg-text-primary)] outline-none transition-all focus:ring-2 focus:ring-[var(--mg-accent)]" placeholder="Ej. 4938201" />
                                </div>
                                <div>
                                    <label className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">Teléfono</label>
                                    <input type="tel" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="w-full rounded-xl border border-[var(--mg-border)] bg-[var(--mg-bg-input)] px-4 py-3 text-sm font-semibold text-[var(--mg-text-primary)] outline-none transition-all focus:ring-2 focus:ring-[var(--mg-accent)]" placeholder="Ej. 77712345" />
                                </div>
                            </div>
                            <div>
                                <label className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">Dirección</label>
                                <input type="text" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} className="w-full rounded-xl border border-[var(--mg-border)] bg-[var(--mg-bg-input)] px-4 py-3 text-sm font-semibold text-[var(--mg-text-primary)] outline-none transition-all focus:ring-2 focus:ring-[var(--mg-accent)]" placeholder="Ej. Calle 1 #123, zona central" />
                            </div>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div>
                                    <label className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">Cumpleaños</label>
                                    <input type="date" value={formData.birthday} onChange={e => setFormData({ ...formData, birthday: e.target.value })} className="w-full rounded-xl border border-[var(--mg-border)] bg-[var(--mg-bg-input)] px-4 py-3 text-sm font-semibold text-[var(--mg-text-primary)] outline-none transition-all focus:ring-2 focus:ring-[var(--mg-accent)]" />
                                </div>
                                <div>
                                    <label className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">Límite de crédito (Bs)</label>
                                    <input type="number" min="0" step="0.01" value={formData.credit_limit} onChange={e => setFormData({ ...formData, credit_limit: e.target.value })} className="w-full rounded-xl border border-[var(--mg-border)] bg-[var(--mg-bg-input)] px-4 py-3 text-sm font-semibold text-[var(--mg-text-primary)] outline-none transition-all focus:ring-2 focus:ring-[var(--mg-accent)]" placeholder="0 = sin límite" />
                                </div>
                            </div>
                            <div>
                                <label className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">Notas</label>
                                <textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} rows={2} className="w-full resize-none rounded-xl border border-[var(--mg-border)] bg-[var(--mg-bg-input)] px-4 py-3 text-sm font-medium text-[var(--mg-text-primary)] outline-none transition-all focus:ring-2 focus:ring-[var(--mg-accent)]" placeholder="Ej. Paga los viernes, entregar por la tarde…" />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 rounded-xl bg-[var(--mg-bg-elevated)] py-3.5 font-semibold text-[var(--mg-text-secondary)] transition-all active:scale-95">
                                    Cancelar
                                </button>
                                <button type="submit" disabled={saving} className="flex-1 rounded-xl bg-[var(--mg-accent)] py-3.5 font-semibold text-white shadow-md transition-all active:scale-95 disabled:opacity-50">
                                    {saving ? 'Guardando…' : 'Guardar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
