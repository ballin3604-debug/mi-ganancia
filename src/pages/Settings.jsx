import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { useBusiness } from '../context/BusinessContext';
import { saveBusinessSettings } from '../services/businessSettings';
import { useImageUpload } from '../hooks/useImageUpload';
import { exportFullBackup } from '../services/backup';
import { DEFAULT_CATEGORY_ID } from '../config/businessCategories';
import {
  regenerateJoinCode,
  regenerateOwnerCode,
  createOwnerCode,
  getBusinessMembers,
  updateMemberRole,
} from '../services/cashier';

// Subcomponentes de Ajustes
import { BusinessHeaderCard } from '../components/settings/BusinessHeaderCard';
import { TeamSection } from '../components/settings/TeamSection';
import { BackupSection } from '../components/settings/BackupSection';
import { UnsavedChangesBar } from '../components/settings/UnsavedChangesBar';

const TABS = [
  { id: 'negocio', icon: '🏪', label: 'Mi negocio' },
  { id: 'equipo', icon: '👥', label: 'Equipo' },
  { id: 'respaldo', icon: '📥', label: 'Respaldo' },
];

export default function Settings() {
  const { businessId, admin, user, updateOwnRole } = useAuth();
  const navigate = useNavigate();
  const { business, settings, refreshSettings } = useBusiness();
  const { pickImage, pickQR } = useImageUpload();

  // Valores guardados actualmente en el negocio (referencia para "hay cambios")
  const savedSlogan = settings?.slogan || '';
  const savedPhone = settings?.phone || '';
  const savedLogo = settings?.logoData || '';
  const savedQr = settings?.qrData || '';
  const savedCategory = settings?.businessCategory || DEFAULT_CATEGORY_ID;

  // Estados editables
  const [slogan, setSlogan] = useState(savedSlogan);
  const [phone, setPhone] = useState(savedPhone);
  const [logoData, setLogoData] = useState(savedLogo);
  const [qrData, setQrData] = useState(savedQr);
  const [businessCategory, setBusinessCategory] = useState(savedCategory);

  const [activeTab, setActiveTab] = useState('negocio');

  // Guardado
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Equipo y códigos
  const [joinCode, setJoinCode] = useState(business?.joinCode || '');
  const [ownerCode, setOwnerCode] = useState(business?.ownerCode || '');
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [ownerCopied, setOwnerCopied] = useState(false);
  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [roleUpdating, setRoleUpdating] = useState(null);

  // Respaldo
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupMsg, setBackupMsg] = useState('');

  // El negocio se carga de forma asíncrona: sincronizamos el formulario cuando
  // llegan los valores guardados (y después de cada guardado exitoso).
  useEffect(() => {
    setSlogan(savedSlogan);
    setPhone(savedPhone);
    setLogoData(savedLogo);
    setQrData(savedQr);
    setBusinessCategory(savedCategory);
  }, [savedSlogan, savedPhone, savedLogo, savedQr, savedCategory]);

  useEffect(() => {
    if (business?.joinCode) setJoinCode(business.joinCode);
    if (business?.ownerCode) setOwnerCode(business.ownerCode);
  }, [business]);

  useEffect(() => {
    if (!businessId) return;
    setMembersLoading(true);
    getBusinessMembers(businessId)
      .then(setMembers)
      .catch(console.error)
      .finally(() => setMembersLoading(false));
  }, [businessId]);

  // Cambios sin guardar
  const changedFields = useMemo(() => {
    const diffs = [];
    if (slogan !== savedSlogan) diffs.push('slogan');
    if (phone !== savedPhone) diffs.push('phone');
    if (logoData !== savedLogo) diffs.push('logo');
    if (qrData !== savedQr) diffs.push('qr');
    if (businessCategory !== savedCategory) diffs.push('rubro');
    return diffs;
  }, [slogan, phone, logoData, qrData, businessCategory,
      savedSlogan, savedPhone, savedLogo, savedQr, savedCategory]);

  const hasChanges = changedFields.length > 0;

  // Avisar si intenta cerrar la pestaña con cambios pendientes
  useEffect(() => {
    if (!hasChanges) return;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasChanges]);

  // ── Handlers ────────────────────────────────────────────────────────────
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

  async function handleCopyCode() {
    try {
      await navigator.clipboard.writeText(joinCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    } catch {
      alert(`Código: ${joinCode}`);
    }
  }

  async function handleCopyOwnerCode() {
    try {
      await navigator.clipboard.writeText(ownerCode);
      setOwnerCopied(true);
      setTimeout(() => setOwnerCopied(false), 2000);
    } catch {
      alert(`Código dueño: ${ownerCode}`);
    }
  }

  async function handleRegenerateCode() {
    setCodeLoading(true);
    try {
      const newCode = await regenerateJoinCode(businessId, business?.name || '', joinCode);
      setJoinCode(newCode);
    } catch (err) {
      console.error(err);
      alert('Error al generar código. Intentá de nuevo.');
    } finally {
      setCodeLoading(false);
    }
  }

  async function handleOwnerCode() {
    setCodeLoading(true);
    try {
      const newCode = ownerCode
        ? await regenerateOwnerCode(businessId, business?.name || '', ownerCode)
        : await createOwnerCode(businessId, business?.name || '');
      setOwnerCode(newCode);
    } catch (err) {
      console.error(err);
      alert('Error al generar código. Intentá de nuevo.');
    } finally {
      setCodeLoading(false);
    }
  }

  async function handleToggleRole(member) {
    const newRole = member.role === 'owner' ? 'cashier' : 'owner';
    setRoleUpdating(member.id);
    try {
      await updateMemberRole(members, member.id, newRole);
      setMembers((prev) => prev.map((m) => (m.id === member.id ? { ...m, role: newRole } : m)));
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

  function handleDiscard() {
    setSlogan(savedSlogan);
    setPhone(savedPhone);
    setLogoData(savedLogo);
    setQrData(savedQr);
    setBusinessCategory(savedCategory);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const data = {
        slogan,
        phone,
        logo_data: logoData,
        qr_data: qrData,
        business_category: businessCategory,
      };
      await saveBusinessSettings(businessId, data);
      refreshSettings(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error(err);
      alert('Error al guardar. Intentá de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6 pb-28">
      {/* Encabezado */}
      <div>
        <h1 className="text-2xl font-black text-[var(--mg-text-primary)] tracking-tight">
          Ajustes del negocio
        </h1>
        <p className="text-xs text-[var(--mg-text-muted)] mt-0.5">
          Identidad comercial, recibos, permisos de equipo y copias de seguridad
        </p>
      </div>

      {/* Pestañas */}
      <div
        role="tablist"
        className="flex items-center gap-1.5 bg-[var(--mg-bg-surface)] p-1.5 rounded-[20px] border border-[var(--mg-border)] shadow-2xs overflow-x-auto scrollbar-none"
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 min-w-[120px] py-3 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 min-h-[44px] ${
                isActive
                  ? 'bg-[var(--mg-accent)] text-white shadow-xs'
                  : 'text-[var(--mg-text-secondary)] hover:bg-[var(--mg-bg-elevated)]'
              }`}
            >
              <span>{tab.icon}</span>
              <span className="truncate">{tab.label}</span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {/* PESTAÑA 1 — MI NEGOCIO */}
        {activeTab === 'negocio' && (
          <motion.div
            key="negocio"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            <BusinessHeaderCard
              businessCategory={businessCategory}
              setBusinessCategory={setBusinessCategory}
              slogan={slogan}
              setSlogan={setSlogan}
              phone={phone}
              setPhone={setPhone}
              logoData={logoData}
              setLogoData={setLogoData}
              qrData={qrData}
              setQrData={setQrData}
              onImagePick={handleImagePick}
              onQRPick={handleQRPick}
            />
          </motion.div>
        )}

        {/* PESTAÑA 2 — EQUIPO Y ACCESOS */}
        {activeTab === 'equipo' && (
          <motion.div
            key="equipo"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            <TeamSection
              members={members}
              membersLoading={membersLoading}
              roleUpdating={roleUpdating}
              user={user}
              joinCode={joinCode}
              ownerCode={ownerCode}
              codeLoading={codeLoading}
              codeCopied={codeCopied}
              ownerCopied={ownerCopied}
              onCopyCode={handleCopyCode}
              onCopyOwnerCode={handleCopyOwnerCode}
              onRegenerateCode={handleRegenerateCode}
              onRegenerateOwnerCode={handleOwnerCode}
              onToggleRole={handleToggleRole}
            />
          </motion.div>
        )}

        {/* PESTAÑA 3 — RESPALDO Y CUENTA */}
        {activeTab === 'respaldo' && (
          <motion.div
            key="respaldo"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            <BackupSection
              backupLoading={backupLoading}
              backupMsg={backupMsg}
              onBackup={handleBackup}
              admin={admin}
              onNavigate={navigate}
              user={user}
              business={business}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Barra flotante de guardado */}
      <UnsavedChangesBar
        hasChanges={hasChanges}
        changesCount={changedFields.length}
        onSave={handleSave}
        onDiscard={handleDiscard}
        saving={saving}
        saved={saved}
      />
    </div>
  );
}
