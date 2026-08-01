import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBusiness } from '../context/BusinessContext';
import { saveBusinessSettings } from '../services/businessSettings';
import { useImageUpload } from '../hooks/useImageUpload';
import { signOut } from '../services/auth';
import { exportFullBackup } from '../services/backup';
import { getCategoryById } from '../config/businessCategories';
import {
  regenerateJoinCode, regenerateOwnerCode, createOwnerCode,
  getBusinessMembers, updateMemberRole, MAX_MEMBERS,
} from '../services/cashier';

export default function Settings() {
  const { businessId, admin, user, updateOwnRole } = useAuth();
  const navigate = useNavigate();
  const { business, settings, refreshSettings } = useBusiness();
  const { pickImage, pickQR } = useImageUpload();

  const [slogan, setSlogan] = useState(settings?.slogan || '');
  const [phone, setPhone] = useState(settings?.phone || '');
  const [logoData, setLogoData] = useState(settings?.logoData || '');
  const [qrData, setQrData] = useState(settings?.qrData || '');
  const [businessCategory, setBusinessCategory] = useState(settings?.businessCategory || 'tienda');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [joinCode, setJoinCode] = useState(business?.joinCode || '');
  const [ownerCode, setOwnerCode] = useState(business?.ownerCode || '');
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [ownerCopied, setOwnerCopied] = useState(false);
  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [roleUpdating, setRoleUpdating] = useState(null);
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupMsg, setBackupMsg] = useState('');

  async function handleBackup() {
    setBackupLoading(true);
    setBackupMsg('');
    try {
      const counts = await exportFullBackup(businessId, business?.name || settings?.businessName || '');
      setBackupMsg(`✓ Respaldo descargado: ${counts.productos} productos, ${counts.ventas} ventas, ${counts.compras} compras, ${counts.fiados} fiados, ${counts.egresos} egresos.`);
    } catch (err) {
      console.error(err);
      setBackupMsg(err.code === 'OFFLINE'
        ? '⚠️ ' + err.message
        : '⚠️ No se pudo generar el respaldo. Revisá tu conexión e intentá de nuevo.');
    } finally {
      setBackupLoading(false);
    }
  }

  const logoRef = useRef(null);
  const qrRef = useRef(null);

  // Sync when settings/business load from context (they load async)
  useEffect(() => {
    if (settings?.slogan) setSlogan(settings.slogan);
    if (settings?.phone) setPhone(settings.phone);
    if (settings?.logo_data || settings?.logoData) setLogoData(settings.logo_data || settings.logoData);
    if (settings?.qr_data || settings?.qrData) setQrData(settings.qr_data || settings.qrData);
    if (settings?.business_category || settings?.businessCategory) setBusinessCategory(settings.business_category || settings.businessCategory);
    if (business?.joinCode) setJoinCode(business.joinCode);
    if (business?.ownerCode) setOwnerCode(business.ownerCode);
  }, [settings, business]);

  // Load team members
  useEffect(() => {
    if (!businessId) return;
    setMembersLoading(true);
    getBusinessMembers(businessId)
      .then(setMembers)
      .finally(() => setMembersLoading(false));
  }, [businessId]);

  async function handleCopyCode() {
    try {
      await navigator.clipboard.writeText(joinCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    } catch (_) {
      alert(`Código: ${joinCode}`);
    }
  }

  async function handleRegenerateCode() {
    if (!window.confirm('¿Generar un nuevo código de cajero? El anterior dejará de funcionar.')) return;
    setCodeLoading(true);
    try {
      const newCode = await regenerateJoinCode(businessId, business?.name || '', joinCode);
      setJoinCode(newCode);
    } catch (err) {
      console.error(err);
      alert('Error al generar código. Intenta de nuevo.');
    } finally {
      setCodeLoading(false);
    }
  }

  async function handleOwnerCode() {
    if (ownerCode && !window.confirm('¿Generar un nuevo código de dueño? El anterior dejará de funcionar.')) return;
    setCodeLoading(true);
    try {
      const newCode = ownerCode
        ? await regenerateOwnerCode(businessId, business?.name || '', ownerCode)
        : await createOwnerCode(businessId, business?.name || '');
      setOwnerCode(newCode);
    } catch (err) {
      console.error(err);
      alert('Error al generar código. Intenta de nuevo.');
    } finally {
      setCodeLoading(false);
    }
  }

  async function handleCopyOwnerCode() {
    try {
      await navigator.clipboard.writeText(ownerCode);
      setOwnerCopied(true);
      setTimeout(() => setOwnerCopied(false), 2000);
    } catch (_) {
      alert(`Código dueño: ${ownerCode}`);
    }
  }

  async function handleToggleRole(member) {
    const newRole = member.role === 'owner' ? 'cashier' : 'owner';
    const label = newRole === 'owner' ? 'dueño' : 'cajero';
    if (!window.confirm(`¿Cambiar a ${member.displayName} a ${label}?`)) return;
    setRoleUpdating(member.id);
    try {
      await updateMemberRole(members, member.id, newRole);
      setMembers((prev) => prev.map((m) => m.id === member.id ? { ...m, role: newRole } : m));
      if (member.id === user?.uid) {
        updateOwnRole(newRole);
      }
    } catch (err) {
      alert(err.message || 'Error al actualizar rol.');
    } finally {
      setRoleUpdating(null);
    }
  }

  async function handleImagePick(e, setter, maxSize) {
    const file = e.target.files?.[0];
    if (!file) return;
    const data = await pickImage(file, maxSize);
    if (data) setter(data);
    e.target.value = '';
  }

  async function handleQRPick(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const data = await pickQR(file);
    if (data) setQrData(data);
    e.target.value = '';
  }

  async function handleSave() {
    setSaving(true);
    try {
      const data = { 
        slogan, 
        phone, 
        logo_data: logoData, 
        qr_data: qrData, 
        business_category: businessCategory 
      };
      await saveBusinessSettings(businessId, data);
      refreshSettings(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error(err);
      alert('Error al guardar. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 space-y-5 pb-10">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-[var(--mg-text-primary)]">Configuración</h2>
        <p className="text-[var(--mg-text-faint)] text-xs">Personaliza tu negocio y recibos</p>
      </div>

      {/* Business info (read-only) */}
      {(() => {
        const cat = getCategoryById(businessCategory);
        return (
          <div className={`bg-gradient-to-r ${cat.theme.settingsCard} rounded-2xl p-4 text-white`}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">{cat.emoji}</span>
              <p className="text-white/70 text-xs uppercase tracking-wide font-semibold">{cat.name}</p>
            </div>
            <p className="text-xl font-black">{business?.name || '—'}</p>
            <p className="text-white/60 text-xs mt-0.5">ID: {businessId?.slice(0, 8)}...</p>
          </div>
        );
      })()}

      {/* Logo */}
      <div className="bg-[var(--mg-bg-surface)] rounded-2xl p-4 border border-[var(--mg-border)] space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">🏪</span>
          <div>
            <p className="font-bold text-[var(--mg-text-primary)]">Logo del negocio</p>
            <p className="text-[var(--mg-text-faint)] text-xs">Aparece en el recibo impreso</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {logoData ? (
            <img src={logoData} alt="Logo" className="w-20 h-20 rounded-2xl object-contain border-2 border-[var(--mg-accent-border)] bg-[var(--mg-bg-elevated)] shrink-0" />
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-[var(--mg-bg-elevated)] flex items-center justify-center text-3xl shrink-0 border-2 border-dashed border-gray-300">
              🏪
            </div>
          )}
          <div className="flex-1 space-y-2">
            <button
              onClick={() => logoRef.current?.click()}
              className="w-full bg-[var(--mg-accent)] border-2 border-[var(--mg-accent-border)] text-white font-bold py-2.5 rounded-xl text-sm active:scale-95"
            >
              📁 {logoData ? 'Cambiar logo' : 'Subir logo'}
            </button>
            {logoData && (
              <button
                onClick={() => setLogoData('')}
                className="w-full bg-[var(--mg-danger-bg)] text-red-400 font-semibold py-2 rounded-xl text-xs active:scale-95"
              >
                Quitar logo
              </button>
            )}
          </div>
        </div>
        <input ref={logoRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => handleImagePick(e, setLogoData, 250)} />
      </div>

      {/* Slogan */}
      <div className="bg-[var(--mg-bg-surface)] rounded-2xl p-4 border border-[var(--mg-border)] space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">✨</span>
          <div>
            <p className="font-bold text-[var(--mg-text-primary)]">Slogan del negocio</p>
            <p className="text-[var(--mg-text-faint)] text-xs">Se muestra bajo el nombre en el recibo</p>
          </div>
        </div>
        <input
          type="text"
          value={slogan}
          onChange={(e) => setSlogan(e.target.value)}
          placeholder='Ej: "La mejor tienda del barrio"'
          className="w-full border-2 border-[var(--mg-border)] rounded-xl px-4 py-3 focus:outline-none focus:border-[var(--mg-accent-border)] text-base"
          maxLength={80}
        />
      </div>

      {/* Teléfono */}
      <div className="bg-[var(--mg-bg-surface)] rounded-2xl p-4 border border-[var(--mg-border)] space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">📞</span>
          <div>
            <p className="font-bold text-[var(--mg-text-primary)]">Teléfono / WhatsApp</p>
            <p className="text-[var(--mg-text-faint)] text-xs">Aparece en el recibo para contacto</p>
          </div>
        </div>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Ej: +591 70000000"
          className="w-full border-2 border-[var(--mg-border)] rounded-xl px-4 py-3 focus:outline-none focus:border-[var(--mg-accent-border)] text-base"
          maxLength={20}
        />
      </div>

      {/* QR de pago */}
      <div className="bg-[var(--mg-bg-surface)] rounded-2xl p-4 border border-[var(--mg-border)] space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">📱</span>
          <div>
            <p className="font-bold text-[var(--mg-text-primary)]">QR de cobro</p>
            <p className="text-[var(--mg-text-faint)] text-xs">Sube tu QR de Tigo Money, QR Bolivia, etc.</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {qrData ? (
            <img src={qrData} alt="QR" className="w-24 h-24 rounded-2xl object-contain border-2 border-[var(--mg-accent-border)] bg-[var(--mg-bg-elevated)] shrink-0 p-1" />
          ) : (
            <div className="w-24 h-24 rounded-2xl bg-[var(--mg-bg-elevated)] flex flex-col items-center justify-center shrink-0 border-2 border-dashed border-gray-300 gap-1">
              <span className="text-2xl">📱</span>
              <span className="text-[var(--mg-text-faint)] text-xs">Sin QR</span>
            </div>
          )}
          <div className="flex-1 space-y-2">
            <button
              onClick={() => qrRef.current?.click()}
              className="w-full bg-[var(--mg-info-bg)] border-2 border-[var(--mg-accent-border)] text-[var(--mg-accent)] font-bold py-2.5 rounded-xl text-sm active:scale-95"
            >
              📁 {qrData ? 'Cambiar QR' : 'Subir QR de cobro'}
            </button>
            {qrData && (
              <button
                onClick={() => setQrData('')}
                className="w-full bg-[var(--mg-danger-bg)] text-red-400 font-semibold py-2 rounded-xl text-xs active:scale-95"
              >
                Quitar QR
              </button>
            )}
          </div>
        </div>
        <input ref={qrRef} type="file" accept="image/*" className="hidden"
          onChange={handleQRPick} />
        <p className="text-gray-300 text-xs">
          El QR aparecerá al final del recibo para que el cliente escanee y pague.
        </p>
      </div>

      {/* ── Equipo ────────────────────────────────────────────────────────── */}
      <div className="bg-[var(--mg-bg-surface)] rounded-2xl border border-[var(--mg-border)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--mg-border)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">👥</span>
            <p className="font-bold text-[var(--mg-text-primary)]">Equipo</p>
          </div>
          <span className={`text-xs font-bold px-2 py-1 rounded-full ${
            members.length >= MAX_MEMBERS ? 'bg-[var(--mg-danger-bg)] text-[var(--mg-danger)]' : 'bg-[var(--mg-info-bg)] text-[var(--mg-accent)]'
          }`}>
            {members.length}/{MAX_MEMBERS} usuarios
          </span>
        </div>

        {/* Member list */}
        {membersLoading ? (
          <div className="flex justify-center py-6">
            <div className="w-6 h-6 border-4 border-[var(--mg-accent-border)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="divide-y divide-[var(--mg-separator)]">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                <img src={m.photoURL || ''} alt=""
                  onError={(e) => { e.target.style.display = 'none'; }}
                  className="w-9 h-9 rounded-full border-2 border-[var(--mg-border)] shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--mg-text-primary)] truncate">{m.displayName}</p>
                  <p className="text-xs text-[var(--mg-text-faint)] truncate">{m.email}</p>
                </div>
                <button
                  onClick={() => handleToggleRole(m)}
                  disabled={roleUpdating === m.id}
                  className={`text-xs font-bold px-2.5 py-1 rounded-full border-2 active:scale-95 transition-all disabled:opacity-50 shrink-0 ${
                    m.role === 'owner'
                      ? 'bg-amber-50 border-amber-300 text-amber-700'
                      : 'bg-[var(--mg-info-bg)] border-blue-300 text-[var(--mg-accent)]'
                  }`}
                >
                  {roleUpdating === m.id ? '...' : m.role === 'owner' ? '👑 Dueño' : '🔑 Cajero'}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Códigos de invitación */}
        <div className="p-4 space-y-3 border-t border-[var(--mg-border)] bg-[var(--mg-bg-elevated)]/50">
          <p className="text-xs font-bold text-[var(--mg-text-muted)] uppercase tracking-wide">Códigos de invitación</p>

          {/* Código cajero */}
          <div>
            <p className="text-xs text-[var(--mg-text-faint)] mb-1">Para cajeros</p>
            {joinCode ? (
              <div className="flex gap-2">
                <div className="flex-1 bg-[var(--mg-info-bg)] border-2 border-[var(--mg-accent-border)] rounded-xl px-3 py-2 text-center">
                  <p className="text-xl font-black text-[var(--mg-accent)] tracking-widest">{joinCode}</p>
                </div>
                <button onClick={handleCopyCode}
                  className="bg-blue-500 text-white font-bold px-3 rounded-xl text-xs active:scale-95">
                  {codeCopied ? '✓' : '📋'}
                </button>
                <button onClick={handleRegenerateCode} disabled={codeLoading}
                  className="bg-[var(--mg-border)] text-[var(--mg-text-secondary)] font-bold px-3 rounded-xl text-xs active:scale-95 disabled:opacity-50">
                  🔄
                </button>
              </div>
            ) : (
              <button onClick={handleRegenerateCode} disabled={codeLoading}
                className="w-full bg-blue-500 text-white font-bold py-2 rounded-xl text-sm active:scale-95 disabled:opacity-50">
                {codeLoading ? '...' : 'Generar código cajero'}
              </button>
            )}
          </div>

          {/* Código dueño */}
          <div>
            <p className="text-xs text-[var(--mg-text-faint)] mb-1">Para dueños adicionales</p>
            {ownerCode ? (
              <div className="flex gap-2">
                <div className="flex-1 bg-amber-50 border-2 border-amber-300 rounded-xl px-3 py-2 text-center">
                  <p className="text-xl font-black text-amber-700 tracking-widest">{ownerCode}</p>
                </div>
                <button onClick={handleCopyOwnerCode}
                  className="bg-amber-500 text-white font-bold px-3 rounded-xl text-xs active:scale-95">
                  {ownerCopied ? '✓' : '📋'}
                </button>
                <button onClick={handleOwnerCode} disabled={codeLoading}
                  className="bg-[var(--mg-border)] text-[var(--mg-text-secondary)] font-bold px-3 rounded-xl text-xs active:scale-95 disabled:opacity-50">
                  🔄
                </button>
              </div>
            ) : (
              <button onClick={handleOwnerCode} disabled={codeLoading}
                className="w-full bg-amber-500 text-white font-bold py-2 rounded-xl text-sm active:scale-95 disabled:opacity-50">
                {codeLoading ? '...' : 'Generar código dueño 👑'}
              </button>
            )}
          </div>

          <p className="text-[var(--mg-text-faint)] text-xs text-center">
            Máx. {MAX_MEMBERS} usuarios por negocio · Toca el rol para cambiarlo
          </p>
        </div>
      </div>

      {/* Vista previa del recibo */}
      {(logoData || slogan || qrData) && (
        <div className="bg-[var(--mg-bg-elevated)] rounded-2xl p-4 border-2 border-dashed border-[var(--mg-border)]">
          <p className="text-xs font-bold text-[var(--mg-text-faint)] uppercase tracking-wide mb-3 text-center">Vista previa del encabezado del recibo</p>
          <div className="bg-[var(--mg-bg-surface)] rounded-xl p-4 text-center shadow-sm">
            {logoData && (
              <img src={logoData} alt="Logo" className="w-14 h-14 rounded-xl object-contain mx-auto mb-2 border border-[var(--mg-border)]" />
            )}
            <p className="font-black text-[var(--mg-text-primary)] text-base">{business?.name || 'Mi Negocio'}</p>
            {slogan && <p className="text-[var(--mg-text-faint)] text-xs italic mt-1">"{slogan}"</p>}
            {phone && <p className="text-[var(--mg-text-faint)] text-xs mt-1">📞 {phone}</p>}
            {qrData && (
              <div className="mt-3">
                <p className="text-xs text-[var(--mg-text-faint)] mb-1">QR de cobro ✓</p>
                <img src={qrData} alt="QR" className="w-16 h-16 object-contain mx-auto border border-[var(--mg-border)] rounded-lg p-1" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Guardar */}
      <button
        onClick={handleSave}
        disabled={saving}
        className={`w-full font-bold py-4 rounded-2xl text-base active:scale-95 transition-all shadow-md ${
          saved
            ? 'bg-gradient-to-r from-teal-500 to-emerald-600 text-white'
            : 'bg-[var(--mg-accent)] text-white'
        } disabled:opacity-50`}
      >
        {saving ? 'Guardando...' : saved ? '✓ ¡Guardado correctamente!' : 'Guardar configuración'}
      </button>

      {/* Respaldo / Exportar todo */}
      <div className="bg-[var(--mg-bg-surface)] rounded-2xl p-4 border border-[var(--mg-border)] space-y-3">
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-xl bg-[var(--mg-gold-bg)] border border-[var(--mg-gold-border)] text-[var(--mg-gold-text)] flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </span>
          <div className="min-w-0">
            <p className="font-bold text-[var(--mg-text-primary)] text-sm">Respaldo de tus datos</p>
            <p className="text-[var(--mg-text-muted)] text-xs">Descargá una copia completa de tu negocio.</p>
          </div>
        </div>

        <p className="text-xs text-[var(--mg-text-faint)] leading-relaxed">
          Baja a tu celular un archivo con todo: productos, ventas, compras, fiados, egresos y clientes.
          Guardalo en un lugar seguro (WhatsApp, correo, Drive). Te recomendamos hacerlo cada semana.
        </p>

        <button
          type="button"
          onClick={handleBackup}
          disabled={backupLoading}
          className="w-full bg-[var(--mg-accent)] hover:bg-[var(--mg-accent-hover)] text-white font-bold py-3 rounded-xl text-sm active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
        >
          {backupLoading ? (
            <>
              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Preparando respaldo…
            </>
          ) : (
            <>📥 Exportar todo</>
          )}
        </button>

        {backupMsg && (
          <p className={`text-xs font-semibold leading-relaxed ${backupMsg.startsWith('✓') ? 'text-[var(--mg-success-text)]' : 'text-[var(--mg-warning)]'}`}>
            {backupMsg}
          </p>
        )}
      </div>

      {/* Panel Admin (solo visible para admin) */}
      {admin && (
        <button
          onClick={() => navigate('/admin')}
          className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold py-3.5 rounded-2xl text-sm active:scale-95 transition-all shadow-md"
        >
          👑 Ir al Panel de Administración
        </button>
      )}

      {/* Cerrar sesión */}
      <button onClick={signOut} className="w-full text-gray-300 text-sm py-2">
        Cerrar sesión
      </button>
    </div>
  );
}
