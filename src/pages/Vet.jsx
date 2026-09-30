import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBusiness } from '../context/BusinessContext';
import {
  getOwners, saveOwner, getPets, savePet, deletePet,
  getRecords, saveRecord, getPrescriptions, savePrescription,
  getVaccinations, saveVaccination, getReminders, saveReminder, petAge,
} from '../services/vet';
import { PetFormModal, RecordFormModal, PrescriptionFormModal, VaccinationFormModal, ReminderFormModal } from '../components/vet/VetModals';
import PatientDetail from '../components/vet/PatientDetail';
import RemindersTab from '../components/vet/RemindersTab';
import { printPetCard, printPrescription } from '../components/vet/PrintDocs';

function speciesEmoji(s) {
  return s === 'gato' ? '🐱' : s === 'otro' ? '🐾' : '🐶';
}

export default function Vet() {
  const { businessId } = useAuth();
  const { business } = useBusiness();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'recordatorios' ? 'recordatorios' : 'pacientes';

  const [owners, setOwners] = useState([]);
  const [pets, setPets] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [speciesFilter, setSpeciesFilter] = useState('todas');

  const [selectedPetId, setSelectedPetId] = useState(null);
  const [records, setRecords] = useState([]);
  const [vaccinations, setVaccinations] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const [modal, setModal] = useState(null); // pet | record | prescription | vaccination | reminder | editPet
  const [editingPet, setEditingPet] = useState(null);

  const ownersById = useMemo(() => Object.fromEntries(owners.map((o) => [o.id, o])), [owners]);
  const petsById = useMemo(() => Object.fromEntries(pets.map((p) => [p.id, p])), [pets]);
  const selectedPet = petsById[selectedPetId] || null;
  const selectedOwner = selectedPet ? ownersById[selectedPet.ownerId] : null;

  const fetchBase = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const [o, p, r] = await Promise.all([
        getOwners(businessId), getPets(businessId), getReminders(businessId),
      ]);
      setOwners(o);
      setPets(p);
      setReminders(r);
    } catch (err) {
      console.error(err);
      alert(err.message || 'Error al cargar. Revisa tu conexión.');
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => { fetchBase(); }, [fetchBase]);

  const fetchDetail = useCallback(async (petId) => {
    if (!businessId || !petId) return;
    setDetailLoading(true);
    try {
      const [rec, vac, pre] = await Promise.all([
        getRecords(businessId, petId),
        getVaccinations(businessId, petId),
        getPrescriptions(businessId, petId),
      ]);
      setRecords(rec);
      setVaccinations(vac);
      setPrescriptions(pre);
    } catch (err) {
      console.error(err);
    } finally {
      setDetailLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    if (selectedPetId) fetchDetail(selectedPetId);
  }, [selectedPetId, fetchDetail]);

  const pendingCount = reminders.filter((r) => r.status === 'pending').length;

  const filteredPets = useMemo(() => {
    const q = search.toLowerCase().trim();
    return pets
      .filter((p) => speciesFilter === 'todas' || p.species === speciesFilter)
      .filter((p) => {
        if (!q) return true;
        const owner = ownersById[p.ownerId];
        return p.name.toLowerCase().includes(q)
          || (p.breed || '').toLowerCase().includes(q)
          || (owner?.name || '').toLowerCase().includes(q)
          || (owner?.phone || '').includes(q);
      });
  }, [pets, search, speciesFilter, ownersById]);

  // ── Guardados ──
  async function handleSavePet({ pet, ownerMode, ownerId, newOwner }) {
    let finalOwnerId = pet.ownerId || null;
    if (!pet.id) {
      if (ownerMode === 'new' && (newOwner.name || newOwner.phone)) {
        const created = await saveOwner(businessId, newOwner);
        finalOwnerId = created.id;
        setOwners((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      } else if (ownerMode === 'exist') {
        finalOwnerId = ownerId || null;
      }
    }
    const saved = await savePet(businessId, { ...pet, ownerId: finalOwnerId });
    await fetchBase();
    setModal(null);
    setEditingPet(null);
    setSelectedPetId(saved.id);
  }

  async function handleDeletePet(pet) {
    if (!window.confirm(`¿Eliminar a "${pet.name}" con todo su historial?`)) return;
    try {
      await deletePet(pet.id);
      setSelectedPetId(null);
      await fetchBase();
    } catch (err) {
      alert(err.message || 'No se pudo eliminar.');
    }
  }

  function handleAction(action) {
    if (action === 'whatsapp' || action === 'carnet') return; // lo maneja el detalle
    setModal(action);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-[var(--mg-accent-border)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Vista detalle ──
  if (selectedPet) {
    return (
      <div className="p-4 lg:p-6 pb-24 mg-fade-in w-full mx-auto max-w-3xl">
        {detailLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-8 h-8 border-4 border-[var(--mg-accent-border)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <PatientDetail
            pet={selectedPet}
            owner={selectedOwner}
            records={records}
            vaccinations={vaccinations}
            prescriptions={prescriptions}
            reminders={reminders.filter((r) => r.petId === selectedPet.id)}
            onBack={() => setSelectedPetId(null)}
            onEdit={(p) => { setEditingPet(p); setModal('editPet'); }}
            onDelete={handleDeletePet}
            onAction={(a) => {
              if (a === 'carnet') {
                printPetCard({ pet: selectedPet, owner: selectedOwner, businessName: business?.name, vaccinations });
                return;
              }
              if (a === 'whatsapp') return;
              handleAction(a);
            }}
            onPrintCarnet={() => printPetCard({ pet: selectedPet, owner: selectedOwner, businessName: business?.name, vaccinations })}
            onPrintReceta={(pres) => printPrescription({ pet: selectedPet, owner: selectedOwner, businessName: business?.name, prescription: pres })}
          />
        )}

        {modal === 'editPet' && (
          <PetFormModal
            businessId={businessId} owners={owners} initialPet={editingPet}
            onSave={handleSavePet} onClose={() => { setModal(null); setEditingPet(null); }}
          />
        )}
        {modal === 'record' && (
          <RecordFormModal
            petName={selectedPet.name}
            onSave={async (d) => { await saveRecord(businessId, selectedPet.id, d); setModal(null); fetchDetail(selectedPet.id); }}
            onClose={() => setModal(null)}
          />
        )}
        {modal === 'prescription' && (
          <PrescriptionFormModal
            petName={selectedPet.name}
            onSave={async (d) => { await savePrescription(businessId, selectedPet.id, d); setModal(null); fetchDetail(selectedPet.id); }}
            onClose={() => setModal(null)}
          />
        )}
        {modal === 'vaccination' && (
          <VaccinationFormModal
            petName={selectedPet.name}
            onSave={async (d) => { await saveVaccination(businessId, selectedPet.id, d); setModal(null); fetchDetail(selectedPet.id); fetchBase(); }}
            onClose={() => setModal(null)}
          />
        )}
        {modal === 'reminder' && (
          <ReminderFormModal
            petName={selectedPet.name}
            onSave={async (d) => { await saveReminder(businessId, selectedPet.id, d); setModal(null); fetchBase(); }}
            onClose={() => setModal(null)}
          />
        )}
      </div>
    );
  }

  // ── Vista lista ──
  return (
    <div className="p-4 lg:p-6 pb-24 mg-fade-in w-full mx-auto max-w-5xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-[var(--mg-text-primary)] tracking-tight">
            🐾 Mascotas
          </h2>
          <p className="text-[var(--mg-text-muted)] text-xs font-semibold mt-0.5">
            Pacientes, historial, recetas y recordatorios
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModal('pet')}
          className="bg-[var(--mg-accent)] hover:bg-[var(--mg-accent-hover)] text-white px-4 py-2.5 rounded-2xl font-extrabold text-xs shadow-md transition-all flex items-center gap-1.5 shrink-0 min-h-[42px]"
        >
          <span className="text-lg leading-none">+</span>
          <span>Paciente</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-[var(--mg-bg-surface)] p-1 rounded-[20px] border border-[var(--mg-border)] shadow-xs flex items-center gap-1.5">
        {[
          { id: 'pacientes', label: `🐶 Pacientes (${pets.length})` },
          { id: 'recordatorios', label: `⏰ Recordatorios (${pendingCount})` },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSearchParams(t.id === 'pacientes' ? {} : { tab: 'recordatorios' })}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-extrabold transition-all active:scale-95 min-h-[40px] ${
              activeTab === t.id
                ? 'bg-[var(--mg-accent)] text-white shadow-xs'
                : 'bg-transparent text-[var(--mg-text-muted)] hover:bg-[var(--mg-bg-elevated)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'recordatorios' ? (
        <RemindersTab
          reminders={reminders}
          petsById={petsById}
          ownersById={ownersById}
          onChanged={fetchBase}
        />
      ) : (
        <>
          <div className="flex gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="🔍 Buscar mascota, raza, dueño o teléfono…"
              className="flex-1 min-w-0 border-2 border-[var(--mg-border)] rounded-2xl px-4 py-2.5 focus:outline-none focus:border-[var(--mg-accent-border)] text-sm"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {[{ id: 'todas', label: 'Todas' }, { id: 'perro', label: '🐶 Perros' }, { id: 'gato', label: '🐱 Gatos' }, { id: 'otro', label: '🐾 Otros' }].map((f) => (
              <button
                key={f.id} type="button" onClick={() => setSpeciesFilter(f.id)}
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${speciesFilter === f.id ? 'bg-[var(--mg-accent)] text-white shadow-sm' : 'bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)]'}`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {filteredPets.length === 0 ? (
            <div className="text-center py-12 bg-[var(--mg-bg-surface)] rounded-[22px] border border-[var(--mg-border)] p-6">
              <p className="text-4xl mb-2">🐾</p>
              <p className="font-extrabold text-[var(--mg-text-primary)] text-sm">
                {pets.length === 0 ? 'Registra tu primer paciente' : 'Sin resultados'}
              </p>
              <p className="text-xs text-[var(--mg-text-muted)] mt-1">
                {pets.length === 0 ? 'Toca "+ Paciente" para empezar.' : 'Prueba con otro nombre o limpia la búsqueda.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredPets.map((p) => {
                const owner = ownersById[p.ownerId];
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPetId(p.id)}
                    className="text-left bg-[var(--mg-bg-surface)] rounded-[22px] border border-[var(--mg-border)] p-3.5 flex items-center gap-3 hover:shadow-md transition-all active:scale-[0.98]"
                  >
                    {p.photoUrl ? (
                      <img src={p.photoUrl} alt={p.name} className="w-14 h-14 rounded-2xl object-cover shrink-0 border border-[var(--mg-border)]" />
                    ) : (
                      <div className="w-14 h-14 rounded-2xl bg-[var(--mg-bg-elevated)] border border-[var(--mg-border)] flex items-center justify-center text-3xl shrink-0">
                        {speciesEmoji(p.species)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-[var(--mg-text-primary)] truncate">{p.name}</p>
                      <p className="text-[11px] font-bold text-[var(--mg-text-muted)] truncate">
                        {p.breed || p.species}{petAge(p.birthdate) ? ` · ${petAge(p.birthdate)}` : ''}
                      </p>
                      <p className="text-[11px] text-[var(--mg-text-secondary)] font-semibold truncate mt-0.5">
                        👤 {owner?.name || 'Sin dueño'}
                      </p>
                    </div>
                    <span className="text-[var(--mg-text-faint)] shrink-0">›</span>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {modal === 'pet' && (
        <PetFormModal
          businessId={businessId} owners={owners}
          onSave={handleSavePet} onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
