import { supabase } from './supabaseClient';

// ─────────────────────────────────────────────────────────────
// Módulo Veterinaria (mascotas caseras). Online-first como sucursales:
// las clínicas operan con wifi; sin conexión avisa y reintenta.
// Tablas: pet_owners, pets, clinical_records, prescriptions,
//         vaccinations, reminders (migración vet_module).
// ─────────────────────────────────────────────────────────────

function mapOwner(o) {
  if (!o) return o;
  return {
    ...o, businessId: o.business_id,
    createdAt: o.created_at ? { toDate: () => new Date(o.created_at) } : null,
  };
}

function mapPet(p) {
  if (!p) return p;
  return {
    ...p,
    businessId: p.business_id, ownerId: p.owner_id,
    birthdate: p.birthdate || '',
    createdAt: p.created_at ? { toDate: () => new Date(p.created_at) } : null,
  };
}

function mapRecord(r) {
  if (!r) return r;
  return {
    ...r,
    businessId: r.business_id, petId: r.pet_id,
    vetName: r.vet_name || '', visitDate: r.visit_date || '',
    createdAt: r.created_at ? { toDate: () => new Date(r.created_at) } : null,
  };
}

function mapPrescription(p) {
  if (!p) return p;
  return {
    ...p,
    businessId: p.business_id, petId: p.pet_id, recordId: p.record_id,
    createdAt: p.created_at ? { toDate: () => new Date(p.created_at) } : null,
  };
}

function mapVaccination(v) {
  if (!v) return v;
  return {
    ...v,
    businessId: v.business_id, petId: v.pet_id, productId: v.product_id,
    vaccineName: v.vaccine_name || '', dateApplied: v.date_applied || '',
    nextDue: v.next_due || '', vetName: v.vet_name || '',
    createdAt: v.created_at ? { toDate: () => new Date(v.created_at) } : null,
  };
}

function mapReminder(r) {
  if (!r) return r;
  return {
    ...r,
    businessId: r.business_id, petId: r.pet_id,
    dueDate: r.due_date || '', sentAt: r.sent_at || null,
    createdAt: r.created_at ? { toDate: () => new Date(r.created_at) } : null,
  };
}

function mustOnline() {
  if (!navigator.onLine) throw new Error('Sin conexión. Conéctate para usar el módulo veterinaria.');
}

// ── Dueños ──
export async function getOwners(businessId) {
  mustOnline();
  const { data, error } = await supabase.from('pet_owners').select('*')
    .eq('business_id', businessId).order('name');
  if (error) throw error;
  return (data || []).map(mapOwner);
}

export async function saveOwner(businessId, owner) {
  mustOnline();
  const body = {
    business_id: businessId,
    name: (owner.name || '').trim(),
    phone: (owner.phone || '').trim(),
    address: (owner.address || '').trim(),
    notes: (owner.notes || '').trim(),
  };
  if (!body.name) throw new Error('El dueño necesita un nombre.');
  if (owner.id) {
    const { error } = await supabase.from('pet_owners').update(body).eq('id', owner.id);
    if (error) throw error;
    return { ...owner, ...body };
  }
  const { data, error } = await supabase.from('pet_owners').insert(body).select().single();
  if (error) throw error;
  return mapOwner(data);
}

// ── Mascotas ──
export async function getPets(businessId) {
  mustOnline();
  const { data, error } = await supabase.from('pets').select('*')
    .eq('business_id', businessId).order('name');
  if (error) throw error;
  return (data || []).map(mapPet);
}

export async function savePet(businessId, pet) {
  mustOnline();
  const body = {
    business_id: businessId,
    owner_id: pet.ownerId || null,
    name: (pet.name || '').trim(),
    species: pet.species || 'perro',
    breed: (pet.breed || '').trim(),
    sex: pet.sex || '',
    birthdate: pet.birthdate || null,
    weight: pet.weight !== '' && pet.weight != null ? Number(pet.weight) : null,
    color: (pet.color || '').trim(),
    chip_code: (pet.chipCode || '').trim(),
    photo_url: pet.photoUrl || '',
    notes: (pet.notes || '').trim(),
  };
  if (!body.name) throw new Error('La mascota necesita un nombre.');
  if (pet.id) {
    const { error } = await supabase.from('pets').update(body).eq('id', pet.id);
    if (error) throw error;
    return { ...pet, ...body };
  }
  const { data, error } = await supabase.from('pets').insert(body).select().single();
  if (error) throw error;
  return mapPet(data);
}

export async function deletePet(id) {
  mustOnline();
  const { error } = await supabase.from('pets').delete().eq('id', id);
  if (error) throw error;
}

// ── Historial clínico ──
export async function getRecords(businessId, petId) {
  mustOnline();
  const { data, error } = await supabase.from('clinical_records').select('*')
    .eq('business_id', businessId).eq('pet_id', petId)
    .order('visit_date', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapRecord);
}

export async function saveRecord(businessId, petId, rec) {
  mustOnline();
  const body = {
    business_id: businessId,
    pet_id: petId,
    vet_name: (rec.vetName || '').trim(),
    visit_date: rec.visitDate || new Date().toISOString().slice(0, 10),
    reason: (rec.reason || '').trim(),
    diagnosis: (rec.diagnosis || '').trim(),
    treatment: (rec.treatment || '').trim(),
    weight: rec.weight !== '' && rec.weight != null ? Number(rec.weight) : null,
    temperature: rec.temperature !== '' && rec.temperature != null ? Number(rec.temperature) : null,
    notes: (rec.notes || '').trim(),
  };
  const { data, error } = await supabase.from('clinical_records').insert(body).select().single();
  if (error) throw error;
  return mapRecord(data);
}

// ── Recetas ──
export async function getPrescriptions(businessId, petId) {
  mustOnline();
  const { data, error } = await supabase.from('prescriptions').select('*')
    .eq('business_id', businessId).eq('pet_id', petId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapPrescription);
}

export async function savePrescription(businessId, petId, { recordId = null, items = [], notes = '' }) {
  mustOnline();
  const clean = (items || [])
    .map((i) => ({
      name: (i.name || '').trim(),
      product_id: i.productId || null,
      dosage: (i.dosage || '').trim(),
      frequency: (i.frequency || '').trim(),
      duration: (i.duration || '').trim(),
    }))
    .filter((i) => i.name);
  if (clean.length === 0) throw new Error('Agrega al menos un medicamento.');
  const { data, error } = await supabase.from('prescriptions').insert({
    business_id: businessId, pet_id: petId, record_id: recordId,
    items: clean, notes: (notes || '').trim(),
  }).select().single();
  if (error) throw error;
  return mapPrescription(data);
}

// ── Vacunas (crea recordatorio de próxima dosis automáticamente) ──
export async function getVaccinations(businessId, petId) {
  mustOnline();
  const { data, error } = await supabase.from('vaccinations').select('*')
    .eq('business_id', businessId).eq('pet_id', petId)
    .order('date_applied', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapVaccination);
}

export async function saveVaccination(businessId, petId, vac) {
  mustOnline();
  if (!vac.vaccineName?.trim()) throw new Error('Poné el nombre de la vacuna.');
  const body = {
    business_id: businessId,
    pet_id: petId,
    product_id: vac.productId || null,
    vaccine_name: vac.vaccineName.trim(),
    date_applied: vac.dateApplied || new Date().toISOString().slice(0, 10),
    next_due: vac.nextDue || null,
    vet_name: (vac.vetName || '').trim(),
    notes: (vac.notes || '').trim(),
  };
  const { data, error } = await supabase.from('vaccinations').insert(body).select().single();
  if (error) throw error;
  // Recordatorio automático de la próxima dosis
  if (body.next_due) {
    try {
      await saveReminder(businessId, petId, {
        type: 'vacuna',
        title: `Vacuna ${body.vaccine_name}`,
        dueDate: body.next_due,
        notes: '',
      });
    } catch (e) {
      console.warn('No se pudo crear el recordatorio:', e);
    }
  }
  return mapVaccination(data);
}

// ── Recordatorios ──
export async function getReminders(businessId) {
  mustOnline();
  const { data, error } = await supabase.from('reminders').select('*')
    .eq('business_id', businessId).order('due_date', { ascending: true }).limit(200);
  if (error) throw error;
  return (data || []).map(mapReminder);
}

export async function saveReminder(businessId, petId, rem) {
  mustOnline();
  if (!rem.title?.trim() || !rem.dueDate) throw new Error('Título y fecha son obligatorios.');
  const { data, error } = await supabase.from('reminders').insert({
    business_id: businessId,
    pet_id: petId,
    type: rem.type || 'control',
    title: rem.title.trim(),
    due_date: rem.dueDate,
    status: 'pending',
    notes: (rem.notes || '').trim(),
  }).select().single();
  if (error) throw error;
  return mapReminder(data);
}

export async function setReminderStatus(id, status) {
  mustOnline();
  const body = { status };
  if (status === 'sent') body.sent_at = new Date().toISOString();
  const { error } = await supabase.from('reminders').update(body).eq('id', id);
  if (error) throw error;
}

// ── WhatsApp al dueño ──
export function ownerWhatsApp(phone, message) {
  let digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 8) digits = `591${digits}`; // Bolivia sin código
  if (digits.startsWith('591591')) digits = digits.slice(3);
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function reminderMessage(petName, title, dueDate) {
  const f = dueDate ? new Date(`${dueDate}T00:00:00`).toLocaleDateString('es-BO', { day: 'numeric', month: 'long' }) : '';
  return `Hola 🐾, te recordamos que ${petName} tiene ${title}${f ? ` el ${f}` : ''}. Te esperamos en la veterinaria. ¡Gracias!`;
}

export function petAge(birthdate) {
  if (!birthdate) return '';
  const b = new Date(`${birthdate}T00:00:00`);
  const now = new Date();
  let years = now.getFullYear() - b.getFullYear();
  let months = now.getMonth() - b.getMonth();
  if (months < 0) { years -= 1; months += 12; }
  if (years <= 0) return `${months} ${months === 1 ? 'mes' : 'meses'}`;
  return `${years} ${years === 1 ? 'año' : 'años'}${months > 0 ? ` ${months}m` : ''}`;
}
