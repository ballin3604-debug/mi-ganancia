import { petAge } from '../../services/vet';

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function openPrintDoc(title, bodyHtml) {
  const win = window.open('', '_blank', 'width=640,height=800');
  if (!win) {
    alert('Activa las ventanas emergentes para imprimir.');
    return;
  }
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: system-ui, sans-serif; color: #0f172a; padding: 24px; }
  .card { border: 2px solid #1670C2; border-radius: 20px; overflow: hidden; max-width: 520px; margin: 0 auto; }
  .head { background: #1670C2; color: #fff; padding: 16px 20px; display: flex; align-items: center; gap: 12px; }
  .head h1 { font-size: 20px; }
  .head p { font-size: 12px; opacity: 0.85; }
  .body { padding: 18px 20px; }
  .row { display: flex; justify-content: space-between; padding: 7px 0; border-bottom: 1px dashed #cbd5e1; font-size: 14px; }
  .row b { color: #0c3457; }
  .sec { margin-top: 14px; }
  .sec h3 { font-size: 13px; text-transform: uppercase; color: #1670C2; margin-bottom: 6px; }
  .item { background: #f1f5f9; border-radius: 10px; padding: 8px 10px; margin-bottom: 6px; font-size: 13px; }
  .foot { text-align: center; font-size: 11px; color: #64748b; margin-top: 14px; }
  .qr { display: block; margin: 12px auto 0; width: 110px; height: 110px; }
  @media print { body { padding: 0; } }
</style></head><body>${bodyHtml}
<script>window.onload = () => setTimeout(() => window.print(), 300);<\/script>
</body></html>`);
  win.document.close();
}

export function printPetCard({ pet, owner, businessName, vaccinations = [] }) {
  const qrData = encodeURIComponent(`MASCOTA:${pet.name}|${pet.species}|${pet.breed || ''}|${pet.chip_code || pet.chipCode || ''}|${owner?.phone || ''}`);
  const vacRows = vaccinations.slice(0, 8).map((v) => {
    const f = v.date_applied || v.dateApplied || '';
    const n = v.next_due || v.nextDue || '—';
    return `<div class="row"><span>${esc(v.vaccine_name || v.vaccineName)}</span><span><b>${esc(f)}</b> → ${esc(n)}</span></div>`;
  }).join('') || '<p style="font-size:13px;color:#64748b;">Sin vacunas registradas.</p>';

  openPrintDoc(`Carnet - ${pet.name}`, `
    <div class="card">
      <div class="head"><span style="font-size:34px;">🐾</span><div><h1>${esc(pet.name)}</h1><p>${esc(businessName || 'Carnet de mascota')}</p></div></div>
      <div class="body">
        <div class="row"><span>Especie / Raza</span><b>${esc(pet.species)}${pet.breed ? ` · ${esc(pet.breed)}` : ''}</b></div>
        <div class="row"><span>Edad</span><b>${esc(petAge(pet.birthdate)) || '—'}</b></div>
        <div class="row"><span>Sexo / Color</span><b>${esc(pet.sex || '—')} · ${esc(pet.color || '—')}</b></div>
        <div class="row"><span>Dueño</span><b>${esc(owner?.name || '—')}</b></div>
        <div class="row"><span>Teléfono</span><b>${esc(owner?.phone || '—')}</b></div>
        ${pet.chip_code || pet.chipCode ? `<div class="row"><span>Chip</span><b>${esc(pet.chip_code || pet.chipCode)}</b></div>` : ''}
        <div class="sec"><h3>💉 Vacunas</h3>${vacRows}</div>
        <img class="qr" src="https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${qrData}" alt="QR" />
        <p class="foot">Presenta este carnet en cada visita · ${esc(new Date().toLocaleDateString('es-BO'))}</p>
      </div>
    </div>`);
}

export function printPrescription({ pet, owner, businessName, prescription }) {
  const items = (prescription.items || []).map((it, i) => `
    <div class="item"><b>${i + 1}. ${esc(it.name)}</b><br/>
    Dosis: ${esc(it.dosage || '—')} · Frecuencia: ${esc(it.frequency || '—')} · Duración: ${esc(it.duration || '—')}</div>
  `).join('');
  const f = prescription.created_at?.toDate ? prescription.created_at.toDate() : new Date(prescription.createdAt || Date.now());

  openPrintDoc(`Receta - ${pet.name}`, `
    <div class="card">
      <div class="head"><span style="font-size:34px;">💊</span><div><h1>Receta veterinaria</h1><p>${esc(businessName || '')} · ${esc(f.toLocaleDateString('es-BO'))}</p></div></div>
      <div class="body">
        <div class="row"><span>Paciente</span><b>${esc(pet.name)} (${esc(pet.species)}${pet.breed ? ` · ${esc(pet.breed)}` : ''})</b></div>
        <div class="row"><span>Dueño</span><b>${esc(owner?.name || '—')} · ${esc(owner?.phone || '')}</b></div>
        <div class="sec"><h3>Indicaciones</h3>${items}</div>
        ${prescription.notes ? `<div class="sec"><h3>Notas</h3><p style="font-size:13px;">${esc(prescription.notes)}</p></div>` : ''}
        <div class="sec" style="margin-top:26px;display:flex;justify-content:space-between;">
          <div style="text-align:center;"><p>___________________</p><p style="font-size:11px;">Firma veterinario</p></div>
          <div style="text-align:center;"><p>___________________</p><p style="font-size:11px;">Sello</p></div>
        </div>
      </div>
    </div>`);
}
