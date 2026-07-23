import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getCustomers, addCustomer, updateCustomer, deleteCustomer } from '../services/customers';
import SwipeableCard from '../components/SwipeableCard';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Customers() {
    const { businessId } = useAuth();
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState(null);

    // Estado del formulario (los campos solicitados)
    const [formData, setFormData] = useState({ name: '', address: '', phone: '', birthday: '' });

    useEffect(() => {
        if (businessId) loadCustomers();
    }, [businessId]);

    async function loadCustomers() {
        setLoading(true);
        try {
            const data = await getCustomers(businessId);
            // Ordenar alfabéticamente
            data.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            setCustomers(data);
        } catch (error) {
            console.error('Error al cargar clientes:', error);
        } finally {
            setLoading(false);
        }
    }

    function openModal(customer = null) {
        if (customer) {
            setEditingCustomer(customer);
            setFormData({
                name: customer.name || '',
                address: customer.address || '',
                phone: customer.phone || '',
                birthday: customer.birthday || ''
            });
        } else {
            setEditingCustomer(null);
            setFormData({ name: '', address: '', phone: '', birthday: '' });
        }
        setIsModalOpen(true);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        if (!formData.name.trim()) return;

        try {
            if (editingCustomer) {
                await updateCustomer(editingCustomer.id, formData);
            } else {
                await addCustomer(businessId, formData);
            }
            setIsModalOpen(false);
            loadCustomers();
        } catch (error) {
            console.error('Error al guardar cliente:', error);
            alert(`Error al guardar: ${error.message}`);
        }
    }

    async function handleDelete(id) {
        if (!confirm('¿Seguro que deseas eliminar este cliente?')) return;
        try {
            await deleteCustomer(id);
            loadCustomers();
        } catch (error) {
            console.error('Error al eliminar cliente:', error);
        }
    }

    if (loading) return <LoadingSpinner />;

    return (
        <div className="p-5 max-w-2xl mx-auto pb-24 mg-fade-in">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-[var(--mg-text-primary)] tracking-tight">Directorio</h2>
                <button onClick={() => openModal()} className="mg-btn-primary px-4 py-2 text-sm shadow-md">
                    + Nuevo
                </button>
            </div>

            {customers.length > 0 && (
                <p className="text-[var(--mg-text-faint)] text-xs text-center mb-3">← Desliza un cliente para editar o borrar</p>
            )}

            <div className="space-y-3">
                {customers.length === 0 ? (
                    <p className="text-[var(--mg-text-muted)] text-center mt-10">Aún no tienes clientes guardados.</p>
                ) : (
                    customers.map(c => (
                        <SwipeableCard key={c.id} onEdit={() => openModal(c)} onDelete={() => handleDelete(c.id)}>
                            <div className="group bg-[var(--mg-bg-surface)] p-4 border border-[var(--mg-border)] rounded-2xl flex items-start justify-between gap-3 shadow-sm">
                                <div className="flex flex-col gap-1 min-w-0">
                                    <span className="font-bold text-[var(--mg-text-primary)] text-base">{c.name}</span>
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                                        {c.phone && <span className="text-sm text-[var(--mg-text-muted)]">📞 {c.phone}</span>}
                                        {c.address && <span className="text-sm text-[var(--mg-text-muted)]">📍 {c.address}</span>}
                                        {c.birthday && <span className="text-sm text-[var(--mg-text-muted)]">🎂 {c.birthday}</span>}
                                    </div>
                                </div>
                                {/* Fallback para mouse — SwipeableCard solo responde a gestos táctiles,
                                    sin esto no había forma de editar/borrar clientes en desktop. */}
                                <div className="flex items-center gap-1 shrink-0 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200">
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); openModal(c); }}
                                        className="w-9 h-9 hover:bg-[var(--mg-accent-bg)] rounded-xl flex items-center justify-center text-gray-500 hover:text-[var(--mg-accent)] active:scale-95 transition-all shrink-0"
                                        title="Editar cliente"
                                    >
                                        ✏️
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }}
                                        className="w-9 h-9 hover:bg-red-50 rounded-xl flex items-center justify-center text-gray-400 hover:text-[var(--mg-danger)] active:scale-95 transition-all shrink-0"
                                        title="Eliminar cliente"
                                    >
                                        🗑️
                                    </button>
                                </div>
                            </div>
                        </SwipeableCard>
                    ))
                )}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-[var(--mg-bg-base)] w-full max-w-sm rounded-3xl p-6 shadow-2xl mg-slide-up">
                        <h3 className="text-xl font-bold mb-5 text-[var(--mg-text-primary)] tracking-tight">
                            {editingCustomer ? 'Editar Cliente' : 'Nuevo Cliente'}
                        </h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-[11px] font-bold text-[var(--mg-text-muted)] uppercase tracking-wider mb-1.5">Nombre Completo</label>
                                <input type="text" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full bg-[var(--mg-bg-input)] border border-[var(--mg-border)] rounded-xl px-4 py-3 text-[var(--mg-text-primary)] focus:ring-2 focus:ring-[var(--mg-accent)] outline-none transition-all" placeholder="Ej. Juan Pérez" />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-[var(--mg-text-muted)] uppercase tracking-wider mb-1.5">Teléfono</label>
                                <input type="tel" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="w-full bg-[var(--mg-bg-input)] border border-[var(--mg-border)] rounded-xl px-4 py-3 text-[var(--mg-text-primary)] focus:ring-2 focus:ring-[var(--mg-accent)] outline-none transition-all" placeholder="Ej. 77712345" />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-[var(--mg-text-muted)] uppercase tracking-wider mb-1.5">Dirección</label>
                                <input type="text" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} className="w-full bg-[var(--mg-bg-input)] border border-[var(--mg-border)] rounded-xl px-4 py-3 text-[var(--mg-text-primary)] focus:ring-2 focus:ring-[var(--mg-accent)] outline-none transition-all" placeholder="Ej. Calle 1 #123" />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-[var(--mg-text-muted)] uppercase tracking-wider mb-1.5">Fecha de Cumpleaños</label>
                                <input type="date" value={formData.birthday} onChange={e => setFormData({ ...formData, birthday: e.target.value })} className="w-full bg-[var(--mg-bg-input)] border border-[var(--mg-border)] rounded-xl px-4 py-3 text-[var(--mg-text-primary)] focus:ring-2 focus:ring-[var(--mg-accent)] outline-none transition-all" />
                            </div>
                            <div className="flex gap-3 pt-3">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3.5 rounded-xl font-semibold text-[var(--mg-text-secondary)] bg-[var(--mg-bg-elevated)] active:scale-95 transition-all">
                                    Cancelar
                                </button>
                                <button type="submit" className="flex-1 py-3.5 rounded-xl font-semibold text-white bg-[var(--mg-accent)] shadow-md active:scale-95 transition-all">
                                    Guardar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}