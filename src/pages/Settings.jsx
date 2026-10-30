import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { useBusiness } from '../context/BusinessContext';
import { saveBusinessSettings, renameBusiness, getBusinessSectorConfig } from '../services/businessSettings';
import { useImageUpload } from '../hooks/useImageUpload';
import { exportFullBackup } from '../services/backup';
import { DEFAULT_CATEGORY_ID, BUSINESS_CATEGORIES, getCategoryById } from '../config/businessCategories';
import { getReceiptFormat, setReceiptFormat, RECEIPT_FORMATS } from '../utils/receiptFormat';
import { AppIcon } from '../components/icons';
import { TicketPreview } from '../components/settings/TicketPreview';
import { ThemePicker } from '../components/settings/ThemePicker';
import { UpgradeModal } from '../components/UpgradeScreen';
import { usePlan } from '../hooks/usePlan';

/* ─────────────────────────────────────────────
   Ajustes · formato lista (liviano, estilo iOS)
   Una sola columna, filas de 56px, editores
   colapsables. Nada de tarjetas pesadas.
   ───────────────────────────────────────────── */

function Chevron() {
  return (
    <svg className="w-[18px] h-[18px] text-[var(--mg-text-faint)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="w-[18px] h-[18px] text-[var(--mg-text-faint)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  );
}

function IconBox({ icon, tint }) {
  return (
    <span className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${tint}`}>
      <AppIcon name={icon} size={20} color="currentColor" />
    </span>
  );
}

function Toggle({ on, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={(e) => { e.stopPropagation(); onChange(!on); }}
      className={`h-7 w-[52px] shrink-0 rounded-full p-0.5 transition-colors ${on ? 'bg-[var(--mg-success)]' : 'bg-[var(--mg-border-hover)]'}`}
    >
      <span className={`block h-6 w-6 rounded-full bg-[var(--mg-bg-surface)] shadow transition-transform ${on ? 'translate-x-[24px]' : 'translate-x-0'}`} />
    </button>
  );
}

function SectionCard({ icon, title, description, badge, children }) {
  return (
    <section className="bg-[var(--mg-bg-surface)] rounded-[26px] border border-[var(--mg-border)] shadow-[var(--mg-shadow-sm)] overflow-hidden">
      <div className="flex items-start gap-3 px-4 sm:px-5 py-4 border-b border-[var(--mg-separator)] bg-[var(--mg-bg-elevated)]/35">
        <span className="w-10 h-10 rounded-2xl bg-[var(--mg-brand-bg)] text-[var(--mg-brand-text)] flex items-center justify-center shrink-0">
          <AppIcon name={icon} size={19} color="currentColor" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-black tracking-tight text-[var(--mg-text-primary)]">{title}</h2>
            {badge}
          </div>
          {description && (
            <p className="text-[11px] font-medium leading-snug text-[var(--mg-text-muted)] mt-0.5">{description}</p>
          )}
        </div>
      </div>
      <div className="divide-y divide-[var(--mg-separator)]">{children}</div>
    </section>
  );
}

export default function Settings() {
  const { businessId, admin, user, role } = useAuth();
  const navigate = useNavigate();
  const { business, settings, refreshSettings, refreshBusiness } = useBusiness();
  const { pickImage, pickLogo, pickQR } = useImageUpload();
  const { plan, planId, loading: planLoading } = usePlan();

  // ── Valores guardados ──
  const savedSlogan = settings?.slogan || '';
  const savedPhone = settings?.phone || '';
  const savedLogo = settings?.logoData || '';
  const savedQr = settings?.qrData || '';
  const savedCategory = settings?.businessCategory || DEFAULT_CATEGORY_ID;
  const savedLegalName = settings?.legalName || '';
  const savedNit = settings?.nit || '';
  const savedCity = settings?.city || '';
  const savedAddress = settings?.address || '';
  const savedFooter = settings?.footerMessage || '';
  const savedShowQr = settings?.showQrOnTicket ?? true;
  const savedShowStock = settings?.sector_config?.features?.stock !== false;

  // ── Estados editables ──
  const [slogan, setSlogan] = useState(savedSlogan);
  const [phone, setPhone] = useState(savedPhone);
  const [logoData, setLogoData] = useState(savedLogo);
  const [qrData, setQrData] = useState(savedQr);
  const [businessCategory, setBusinessCategory] = useState(savedCategory);
  const [legalName, setLegalName] = useState(savedLegalName);
  const [nit, setNit] = useState(savedNit);
  const [city, setCity] = useState(savedCity);
  const [address, setAddress] = useState(savedAddress);
  const [footerMessage, setFooterMessage] = useState(savedFooter);
  const [showQrOnTicket, setShowQrOnTicket] = useState(savedShowQr);
  const [showStock, setShowStock] = useState(savedShowStock);

  // ── UI de lista ──
  const [openId, setOpenId] = useState(null);
  const [query, setQuery] = useState('');
  const [showRubroModal, setShowRubroModal] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showPlans, setShowPlans] = useState(false);

  // Nombre (guardado inmediato, no va al bulk-save)
  const [nameDraft, setNameDraft] = useState('');
  const [nameSaving, setNameSaving] = useState(false);

  // Formato recibo (por dispositivo, inmediato)
  const [receiptFormat, setReceiptFormatState] = useState(() => getReceiptFormat());

  // Guardado / respaldo
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupMsg, setBackupMsg] = useState('');

  const logoRef = useRef(null);
  const qrRef = useRef(null);

  useEffect(() => {
    setSlogan(savedSlogan);
    setPhone(savedPhone);
    setLogoData(savedLogo);
    setQrData(savedQr);
    setBusinessCategory(savedCategory);
    setLegalName(savedLegalName);
    setNit(savedNit);
    setCity(savedCity);
    setAddress(savedAddress);
    setFooterMessage(savedFooter);
    setShowQrOnTicket(savedShowQr);
    setShowStock(savedShowStock);
  }, [savedSlogan, savedPhone, savedLogo, savedQr, savedCategory, savedLegalName, savedNit, savedCity, savedAddress, savedFooter, savedShowQr, savedShowStock]);

  const changedFields = useMemo(() => {
    const d = [];
    if (slogan !== savedSlogan) d.push('slogan');
    if (phone !== savedPhone) d.push('teléfono');
    if (logoData !== savedLogo) d.push('logo');
    if (qrData !== savedQr) d.push('qr');
    if (businessCategory !== savedCategory) d.push('rubro');
    if (legalName !== savedLegalName) d.push('razón social');
    if (nit !== savedNit) d.push('nit');
    if (city !== savedCity) d.push('ciudad');
    if (address !== savedAddress) d.push('dirección');
    if (footerMessage !== savedFooter) d.push('mensaje');
    if (showQrOnTicket !== savedShowQr) d.push('qr visible');
    if (showStock !== savedShowStock) d.push('stock');
    return d;
  }, [slogan, phone, logoData, qrData, businessCategory, legalName, nit, city, address, footerMessage, showQrOnTicket, showStock,
    savedSlogan, savedPhone, savedLogo, savedQr, savedCategory, savedLegalName, savedNit, savedCity, savedAddress, savedFooter, savedShowQr, savedShowStock]);

  const hasChanges = changedFields.length > 0;
  const isSearching = query.trim().length > 0;

  useEffect(() => {
    if (!hasChanges) return;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasChanges]);

  const currentCat = getCategoryById(businessCategory);
  const sectorConfig = getBusinessSectorConfig(settings);
  const isRestaurantMode = !!sectorConfig?.features?.dishes;

  function toggle(id) {
    setOpenId((prev) => (prev === id ? null : id));
    if (id === 'nombre') setNameDraft(business?.name || '');
  }

  // ── Búsqueda ──
  const INDEX = {
    nombre: 'nombre tienda negocio titulo',
    rubro: 'rubro categoria categoria giro tipo comercio',
    logo: 'logo imagen foto marca',
    slogan: 'slogan frase lema',
    telefono: 'telefono whatsapp celular contacto numero llamar',
    qr: 'qr cobro pago tigo bcp qr simple imagen',
    legal: 'razon social legal fiscal factura nombre',
    nit: 'nit tributario impuestos factura',
    ciudad: 'ciudad departamento ubicacion sede',
    direccion: 'direccion domicilio casa matriz ubicacion',
    pie: 'pie mensaje gracias footer ticket',
    formato: 'formato recibo termico hoja a4 impresion impresora',
    verqr: 'mostrar qr ticket imprimir visible',
    stock: 'stock inventario existencias mostrar ocultar restaurante platos',
    vista: 'vista previa ejemplo probar imprimir test',
    respaldo: 'respaldo copia seguridad exportar descargar json backup',
    admin: 'admin panel administracion',
    tema: 'tema apariencia colores oscuro claro gourmet clasico yuzen pastel rosa azul diseno diseño estilo',
  };
  const q = query.trim().toLowerCase();
  function visible(id) {
    if (!isSearching) return true;
    const hay = `${id} ${INDEX[id] || ''} ${rowValue(id)}`.toLowerCase();
    return q.split(/\s+/).every((w) => hay.includes(w));
  }
  function rowValue(id) {
    switch (id) {
      case 'nombre': return business?.name || '';
      case 'rubro': return currentCat.name;
      case 'logo': return logoData ? 'agregado' : 'sin logo';
      case 'slogan': return slogan || '';
      case 'telefono': return phone || '';
      case 'qr': return qrData ? 'agregado' : 'sin qr';
      case 'legal': return legalName || '';
      case 'nit': return nit || '';
      case 'ciudad': return city || '';
      case 'direccion': return address || '';
      case 'pie': return footerMessage || 'gracias por su compra';
      case 'formato': return receiptFormat === 'sheet' ? 'hoja a4' : 'ticket termico 80mm';
      case 'verqr': return showQrOnTicket ? 'sí' : 'no';
      case 'stock': return showStock ? 'visible' : 'oculto';
      default: return '';
    }
  }
  const expanded = (id) => isSearching || openId === id;

  // ── Handlers ──
  async function handleBackup() {
    setBackupLoading(true);
    setBackupMsg('');
    try {
      const counts = await exportFullBackup(businessId, business?.name || settings?.businessName || '');
      setBackupMsg(`✓ ${counts.productos} productos · ${counts.ventas} ventas · ${counts.compras} compras · ${counts.egresos} egresos.`);
    } catch (err) {
      setBackupMsg(err.code === 'OFFLINE' ? '⚠️ ' + err.message : '⚠️ No se pudo generar el respaldo. Revisá tu conexión.');
    } finally {
      setBackupLoading(false);
    }
  }

  async function handleImagePick(e, setter, maxSize) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = maxSize === 250 ? await pickLogo(file) : await pickImage(file, maxSize);
      if (data) setter(data);
    } catch (err) {
      console.error('Error al leer la imagen:', err);
      alert('No se pudo leer la imagen. Probá con otra foto (JPG o PNG).');
    } finally {
      e.target.value = '';
    }
  }
  async function handleQRPick(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await pickQR(file);
      if (data) setQrData(data);
    } catch (err) {
      console.error('Error al leer el QR:', err);
      alert('No se pudo leer la imagen del QR. Probá con otra foto.');
    } finally {
      e.target.value = '';
    }
  }
  function handleDiscard() {
    setSlogan(savedSlogan); setPhone(savedPhone); setLogoData(savedLogo);
    setQrData(savedQr); setBusinessCategory(savedCategory); setLegalName(savedLegalName);
    setNit(savedNit); setCity(savedCity); setAddress(savedAddress);
    setFooterMessage(savedFooter); setShowQrOnTicket(savedShowQr);
    setShowStock(savedShowStock);
  }
  async function handleSave() {
    setSaving(true);
    try {
      const currentSectorConfig = settings?.sector_config || settings?.sectorConfig || {};
      const nextSectorConfig = {
        ...currentSectorConfig,
        features: {
          ...(currentSectorConfig.features || {}),
          stock: showStock,
        },
      };
      const data = {
        slogan, phone, logo_data: logoData, qr_data: qrData,
        business_category: businessCategory, legal_name: legalName.trim(),
        nit: nit.trim(), city: city.trim(), address: address.trim(),
        footer_message: footerMessage.trim(), show_qr: showQrOnTicket,
        sector_config: nextSectorConfig,
      };
      await saveBusinessSettings(businessId, data);
      refreshSettings(data);
      setSaved(true);
      setOpenId(null);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error(err);
      alert('Error al guardar. Intentá de nuevo.');
    } finally {
      setSaving(false);
    }
  }
  async function handleSaveName() {
    if (nameDraft.trim().length < 2 || nameSaving) return;
    setNameSaving(true);
    try {
      await renameBusiness(businessId, nameDraft.trim());
      await refreshBusiness();
      setOpenId(null);
    } catch (err) {
      alert(err.message || 'No se pudo guardar el nombre.');
    } finally {
      setNameSaving(false);
    }
  }
  function chooseFormat(id) {
    setReceiptFormat(id);
    setReceiptFormatState(id);
  }

  const inputCls = 'mg-input text-sm font-medium !py-2 !rounded-lg';
  const hintCls = 'text-[11px] text-[var(--mg-text-muted)] leading-snug';

  function Row({ id, icon, tint, title, value, right, onOpen, disabled = false, badge }) {
    if (!visible(id)) return null;
    const isOpen = !disabled && openId === id && !onOpen;
    return (
      <div>
        <button
          type="button"
          disabled={disabled}
          aria-disabled={disabled}
          onClick={() => {
            if (disabled) return;
            if (onOpen) onOpen();
            else toggle(id);
          }}
          className={`w-full flex items-center gap-3.5 px-4 sm:px-5 min-h-[72px] py-3 text-left transition-colors ${
            disabled ? 'cursor-default opacity-75' : 'active:bg-[var(--mg-bg-elevated)]'
          }`}
        >
          <IconBox icon={icon} tint={tint} />
          <span className="flex-1 min-w-0">
            <span className="flex items-center gap-2 flex-wrap">
              <span className="block text-sm font-bold text-[var(--mg-text-primary)] leading-tight">{title}</span>
              {badge && (
                <span className="rounded-full border border-[var(--mg-gold-border)] bg-[var(--mg-gold-bg)] px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-[var(--mg-gold-text)]">
                  {badge}
                </span>
              )}
            </span>
            <span className="block text-xs text-[var(--mg-text-muted)] truncate font-medium mt-0.5">{value}</span>
          </span>
          {right || (disabled ? <LockIcon /> : <Chevron />)}
        </button>
        {isOpen && <Editor id={id} />}
      </div>
    );
  }

  function Editor({ id }) {
    switch (id) {
      case 'nombre':
        return (
          <div className="px-3 pb-3 pt-1 border-t border-[var(--mg-separator)] bg-[var(--mg-bg-elevated)]/40">
            <input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} maxLength={60} placeholder="Ej: Tienda Don Freddy" className={inputCls} autoFocus={!isSearching} />
            <div className="flex gap-2 mt-2">
              <button type="button" onClick={handleSaveName} disabled={nameDraft.trim().length < 2 || nameSaving} className="mg-btn-primary !py-2 text-xs flex-1 disabled:opacity-50">
                {nameSaving ? 'Guardando…' : 'Guardar nombre'}
              </button>
            </div>
          </div>
        );
      case 'rubro':
        return (
          <div className="px-3 pb-3 pt-2 border-t border-[var(--mg-separator)] bg-[var(--mg-bg-elevated)]/40 space-y-2">
            <button type="button" onClick={() => setShowRubroModal(true)} className="w-full flex items-center gap-2 bg-[var(--mg-bg-surface)] border border-[var(--mg-border)] rounded-lg px-3 py-2 text-sm font-semibold active:scale-[0.99]">
              <span className="text-base">{currentCat.emoji}</span>
              <span className="flex-1 text-left truncate">{currentCat.name}</span>
              <span className="text-xs font-bold text-[var(--mg-accent-text)]">Cambiar</span>
            </button>
            <div className="text-[11px] leading-snug text-[var(--mg-text-muted)]">
              <p className="font-semibold text-[var(--mg-text-secondary)]">Configuración base preparada para este rubro:</p>
              <p>Unidades disponibles: {sectorConfig.unitLabels.join(', ')}</p>
              <p>Unidad por defecto: {sectorConfig.defaultUnit}</p>
              {sectorConfig.optionalFields.length > 0 && (
                <p>Campos opcionales futuros: volumen, graduación alcohólica y procedencia.</p>
              )}
              <p className="mt-1 text-[var(--mg-text-faint)]">Las funciones específicas del rubro se habilitarán en próximas fases.</p>
            </div>
          </div>
        );
      case 'logo':
        return (
          <div className="px-3 pb-3 pt-2 border-t border-[var(--mg-separator)] bg-[var(--mg-bg-elevated)]/40 flex items-center gap-3">
            {logoData
              ? <img src={logoData} alt="Logo" className="w-12 h-12 rounded-lg object-contain border border-[var(--mg-border)]" />
              : <span className="w-12 h-12 rounded-lg bg-[var(--mg-bg-section)] border border-dashed border-[var(--mg-border)] flex items-center justify-center"><AppIcon name="tienda" size={18} /></span>}
            <div className="flex-1 flex gap-2">
              <button type="button" onClick={() => logoRef.current?.click()} className="mg-btn-secondary !py-2 text-xs flex-1">{logoData ? 'Cambiar' : 'Subir'}</button>
              {logoData && <button type="button" onClick={() => setLogoData('')} className="px-3 py-2 rounded-lg text-xs font-bold text-[var(--mg-danger)] bg-[var(--mg-danger-bg)]">Quitar</button>}
            </div>
          </div>
        );
      case 'slogan':
        return (
          <div className="px-3 pb-3 pt-2 border-t border-[var(--mg-separator)] bg-[var(--mg-bg-elevated)]/40">
            <input value={slogan} onChange={(e) => setSlogan(e.target.value)} maxLength={80} placeholder='Ej: "La mejor tienda del barrio"' className={inputCls} />
          </div>
        );
      case 'telefono':
        return (
          <div className="px-3 pb-3 pt-2 border-t border-[var(--mg-separator)] bg-[var(--mg-bg-elevated)]/40">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} inputMode="tel" placeholder="Ej: +591 70000000" className={inputCls} />
          </div>
        );
      case 'qr':
        return (
          <div className="px-3 pb-3 pt-2 border-t border-[var(--mg-separator)] bg-[var(--mg-bg-elevated)]/40 flex items-center gap-3">
            {qrData
              ? <img src={qrData} alt="QR" className="w-12 h-12 rounded-lg object-contain border border-[var(--mg-border)] bg-white p-0.5" />
              : <span className="w-12 h-12 rounded-lg bg-[var(--mg-bg-section)] border border-dashed border-[var(--mg-border)] flex items-center justify-center"><AppIcon name="qr" size={18} /></span>}
            <div className="flex-1 flex gap-2">
              <button type="button" onClick={() => qrRef.current?.click()} className="mg-btn-secondary !py-2 text-xs flex-1">{qrData ? 'Cambiar' : 'Subir'}</button>
              {qrData && <button type="button" onClick={() => setQrData('')} className="px-3 py-2 rounded-lg text-xs font-bold text-[var(--mg-danger)] bg-[var(--mg-danger-bg)]">Quitar</button>}
            </div>
          </div>
        );
      case 'legal':
        return (
          <div className="px-3 pb-3 pt-2 border-t border-[var(--mg-separator)] bg-[var(--mg-bg-elevated)]/40">
            <input value={legalName} onChange={(e) => setLegalName(e.target.value)} maxLength={120} placeholder="Ej: Comercial Alan S.R.L." className={inputCls} />
          </div>
        );
      case 'nit':
        return (
          <div className="px-3 pb-3 pt-2 border-t border-[var(--mg-separator)] bg-[var(--mg-bg-elevated)]/40">
            <input value={nit} onChange={(e) => setNit(e.target.value)} maxLength={30} inputMode="numeric" placeholder="Ej: 1029384019" className={inputCls} />
          </div>
        );
      case 'ciudad':
        return (
          <div className="px-3 pb-3 pt-2 border-t border-[var(--mg-separator)] bg-[var(--mg-bg-elevated)]/40">
            <input value={city} onChange={(e) => setCity(e.target.value)} maxLength={80} placeholder="Ej: Santa Cruz de la Sierra" className={inputCls} />
          </div>
        );
      case 'direccion':
        return (
          <div className="px-3 pb-3 pt-2 border-t border-[var(--mg-separator)] bg-[var(--mg-bg-elevated)]/40">
            <input value={address} onChange={(e) => setAddress(e.target.value)} maxLength={200} placeholder="Ej: Av. San Martín #1420" className={inputCls} />
          </div>
        );
      case 'pie':
        return (
          <div className="px-3 pb-3 pt-2 border-t border-[var(--mg-separator)] bg-[var(--mg-bg-elevated)]/40">
            <input value={footerMessage} onChange={(e) => setFooterMessage(e.target.value)} maxLength={160} placeholder="¡Gracias por su compra!" className={inputCls} />
          </div>
        );
      case 'formato':
        return (
          <div className="border-t border-[var(--mg-separator)] bg-[var(--mg-bg-elevated)]/40">
            {[
              { id: RECEIPT_FORMATS.THERMAL, t: 'Ticket térmico', s: 'Rollo 80mm · impresora de tickets' },
              { id: RECEIPT_FORMATS.SHEET, t: 'Recibo en hoja', s: 'Carta / A4 · ideal para PDF y WhatsApp' },
            ].map((op) => {
              const act = receiptFormat === op.id;
              return (
                <button key={op.id} type="button" onClick={() => chooseFormat(op.id)} className="w-full flex items-center gap-3 px-3 py-2.5 text-left active:bg-white">
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px] font-semibold">{op.t}</span>
                    <span className="block text-[11px] text-[var(--mg-text-muted)]">{op.s}</span>
                  </span>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 ${act ? 'bg-[var(--mg-accent)] text-white' : 'border border-[var(--mg-border)] text-transparent'}`}>✓</span>
                </button>
              );
            })}
            <p className={`px-3 pb-2.5 ${hintCls}`}>Se guarda solo en este dispositivo.</p>
          </div>
        );
      case 'respaldo':
        return (
          <div className="px-3 pb-3 pt-2 border-t border-[var(--mg-separator)] bg-[var(--mg-bg-elevated)]/40 space-y-2">
            <p className={hintCls}>Archivo .JSON con productos, ventas, compras, egresos y clientes. Hacelo cada semana.</p>
            <button type="button" onClick={handleBackup} disabled={backupLoading} className="mg-btn-primary !py-2.5 text-xs w-full disabled:opacity-50 flex items-center justify-center gap-2">
              {backupLoading ? 'Preparando…' : 'Exportar todos los datos (.JSON)'}
            </button>
            {backupMsg && (
              <p className={`text-[11px] font-bold leading-snug rounded-lg px-2.5 py-2 border ${backupMsg.startsWith('✓') ? 'border-[var(--mg-success-border)] bg-[var(--mg-success-bg)] text-[var(--mg-success-text)]' : 'border-[var(--mg-gold-border)] bg-[var(--mg-gold-bg)] text-[var(--mg-gold-text)]'}`}>
                {backupMsg}
              </p>
            )}
          </div>
        );
      default:
        return null;
    }
  }

  const showNegocio = ['nombre', 'rubro', 'logo', 'slogan', 'telefono', 'qr'].some(visible);
  const showFiscal = ['legal', 'nit', 'ciudad', 'direccion'].some(visible);
  const showTicket = isSearching
    ? ['formato', 'verqr', 'vista', 'pie'].some(visible)
    : true;
  const showDatos = isSearching
    ? ['respaldo', 'admin'].some(visible)
    : true;
  const showApariencia = visible('tema');
  const showOperacion = isRestaurantMode && visible('stock');

  return (
    <div className="max-w-5xl mx-auto px-4 pt-4 pb-32">
      {/* ── HERO ── */}
      <section className="relative overflow-hidden rounded-[30px] border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] shadow-[var(--mg-shadow-sm)]">
        <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-[var(--mg-brand-bg)] blur-2xl" />
        <div className="pointer-events-none absolute -left-12 bottom-0 h-44 w-44 rounded-full bg-[var(--mg-accent-bg)] blur-2xl" />
        <div className="relative p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 sm:w-[76px] sm:h-[76px] rounded-[24px] overflow-hidden border border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] flex items-center justify-center shrink-0 shadow-sm">
              {logoData ? (
                <img src={logoData} alt={`Logo de ${business?.name || 'Mi negocio'}`} className="w-full h-full object-contain p-1.5" />
              ) : (
                <span className="w-12 h-12 rounded-2xl bg-[var(--mg-brand)] text-[var(--mg-brand-contrast)] flex items-center justify-center">
                  <AppIcon name="tienda" size={25} />
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--mg-text-muted)]">
                Ajustes del negocio
              </p>
              <h1 className="mt-1 text-2xl sm:text-3xl font-black tracking-tight text-[var(--mg-text-primary)] leading-tight truncate">
                {business?.name || 'Mi negocio'}
              </h1>
              <p className="mt-1 text-xs font-semibold text-[var(--mg-text-muted)] truncate">
                {currentCat.emoji} {currentCat.name} · {role === 'cashier' ? 'Cajero' : 'Dueño'}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--mg-accent-border)] bg-[var(--mg-accent-bg)] px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[var(--mg-accent-text)]">
                  <AppIcon name="plan" size={12} /> Plan {plan.name}
                </span>
                {hasChanges && (
                  <span className="rounded-full border border-[var(--mg-gold-border)] bg-[var(--mg-gold-bg)] px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[var(--mg-gold-text)]">
                    {changedFields.length} sin guardar
                  </span>
                )}
                {saved && (
                  <span className="rounded-full border border-[var(--mg-success-border)] bg-[var(--mg-success-bg)] px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[var(--mg-success-text)]">
                    Guardado ✓
                  </span>
                )}
              </div>
            </div>
            {!planLoading && planId !== 'premium' && (
              <button
                type="button"
                onClick={() => setShowPlans(true)}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-[var(--mg-accent-border)] bg-[var(--mg-accent-bg)] px-3 py-2 text-[11px] font-black text-[var(--mg-accent-text)] active:scale-95 transition-all"
              >
                <AppIcon name="plan" size={14} />
                <span className="hidden sm:inline">Mejorar plan</span>
              </button>
            )}
          </div>

          {/* Buscador */}
          <div className="relative mt-5">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--mg-text-muted)]">
              <AppIcon name="search" size={17} />
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar ajuste… (QR, NIT, recibo…)"
              className="mg-input !py-3 !pl-11 !pr-10 text-sm font-medium !rounded-2xl"
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} aria-label="Limpiar búsqueda" className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-[var(--mg-bg-section)] text-xs font-bold text-[var(--mg-text-muted)]">✕</button>
            )}
          </div>
        </div>
      </section>

      <input ref={logoRef} type="file" accept="image/*" aria-label="Seleccionar logo" className="hidden" onChange={(e) => handleImagePick(e, setLogoData, 250)} />
      <input ref={qrRef} type="file" accept="image/*" aria-label="Seleccionar QR" className="hidden" onChange={handleQRPick} />

      <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        {/* ── MI NEGOCIO ── */}
        {showNegocio && (
          <SectionCard
            icon="tienda"
            title="Mi negocio"
            description="Identidad, contacto y marca que ve tu equipo."
          >
            <Row id="nombre" icon="tienda" tint="bg-[var(--mg-accent-bg)] text-[var(--mg-accent-text)]" title="Nombre" value={business?.name || 'Sin nombre'} />
            <Row id="rubro" icon="etiqueta" tint="bg-[var(--mg-gold-bg)] text-[var(--mg-gold-text)]" title="Rubro" value={`${currentCat.emoji} ${currentCat.name}`} />
            <Row
              id="logo" icon="galeria" tint="bg-[var(--mg-brand-bg)] text-[var(--mg-brand-text)]" title="Logo" value={logoData ? 'Agregado · visible en la app' : 'Sin logo'}
              right={logoData
                ? <img src={logoData} alt="" className="w-10 h-10 rounded-xl object-contain border border-[var(--mg-border)]" />
                : <Chevron />}
            />
            <Row id="slogan" icon="texto" tint="bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)]" title="Slogan" value={slogan || 'Añadir frase del recibo…'} />
            <Row id="telefono" icon="llamar" tint="bg-[var(--mg-success-bg)] text-[var(--mg-success-text)]" title="Teléfono / WhatsApp" value={phone || 'Añadir número…'} />
            <Row
              id="qr" icon="qr" tint="bg-[var(--mg-brand-bg)] text-[var(--mg-brand-text)]" title="QR de cobro" value={qrData ? 'Agregado' : 'Sin QR · Tigo, BCP, BNB…'}
              right={qrData
                ? <img src={qrData} alt="" className="w-10 h-10 rounded-xl object-contain border border-[var(--mg-border)] bg-white" />
                : <Chevron />}
            />
          </SectionCard>
        )}

        {/* ── OPERACIÓN (SOLO RESTAURANTE) ── */}
        {showOperacion && (
          <SectionCard
            icon="paquete"
            title="Operación del restaurante"
            description="Elegí qué información querés ver al trabajar."
          >
            <div className="w-full flex items-center gap-3.5 px-4 sm:px-5 min-h-[72px] py-3">
              <IconBox icon="paquete" tint="bg-[var(--mg-brand-bg)] text-[var(--mg-brand-text)]" />
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-bold leading-tight text-[var(--mg-text-primary)]">Mostrar stock</span>
                <span className="block text-xs text-[var(--mg-text-muted)] font-medium mt-0.5">
                  Si lo desactivás, ocultás existencias y alertas. Tus datos no se borran.
                </span>
              </span>
              <Toggle on={showStock} onChange={setShowStock} />
            </div>
          </SectionCard>
        )}

        {/* ── TICKET ── */}
        {showTicket && (
          <SectionCard
            icon="recibo"
            title="Ticket y recibos"
            description="Formato de impresión y mensaje de despedida."
          >
            <Row id="formato" icon="recibo" tint="bg-[var(--mg-accent-bg)] text-[var(--mg-accent-text)]" title="Formato del recibo" value={receiptFormat === 'sheet' ? 'Hoja A4' : 'Térmico 80mm'} />
            {visible('verqr') && (
              <div>
                <div className="w-full flex items-center gap-3.5 px-4 sm:px-5 min-h-[72px] py-3">
                  <IconBox icon="qr" tint="bg-[var(--mg-brand-bg)] text-[var(--mg-brand-text)]" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-bold leading-tight">QR al final del ticket</span>
                    <span className="block text-xs text-[var(--mg-text-muted)] font-medium mt-0.5">{qrData ? 'Se imprime si está activado' : 'Primero subí un QR'}</span>
                  </span>
                  <Toggle on={showQrOnTicket} onChange={setShowQrOnTicket} />
                </div>
              </div>
            )}
            {visible('vista') && (
              <div>
                <button type="button" onClick={() => setShowPreview(true)} className="w-full flex items-center gap-3.5 px-4 sm:px-5 min-h-[72px] py-3 text-left active:bg-[var(--mg-bg-elevated)]">
                  <IconBox icon="detalle" tint="bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)]" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-bold leading-tight">Vista previa</span>
                    <span className="block text-xs text-[var(--mg-text-muted)] font-medium mt-0.5">Ver ejemplo e imprimir prueba</span>
                  </span>
                  <Chevron />
                </button>
              </div>
            )}
            <Row id="pie" icon="texto" tint="bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)]" title="Mensaje final del ticket" value={footerMessage || '¡Gracias por su compra!'} />
            <p className="px-4 sm:px-5 py-3 text-[11px] font-medium text-[var(--mg-text-muted)]">
              El formato se guarda solo en este dispositivo.
            </p>
          </SectionCard>
        )}

        {/* ── FACTURACIÓN (PRÓXIMAMENTE) ── */}
        {showFiscal && (
          <SectionCard
            icon="carnet"
            title="Facturación y dirección"
            description="Datos fiscales para facturas y reportes."
            badge={(
              <span className="rounded-full border border-[var(--mg-gold-border)] bg-[var(--mg-gold-bg)] px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-[var(--mg-gold-text)]">
                ¡Próximamente!
              </span>
            )}
          >
            <Row id="legal" icon="carnet" tint="bg-[var(--mg-accent-bg)] text-[var(--mg-accent-text)]" title="Razón social" value="Disponible muy pronto" disabled badge="Próximamente" />
            <Row id="nit" icon="recibo" tint="bg-[var(--mg-accent-bg)] text-[var(--mg-accent-text)]" title="NIT" value="Disponible muy pronto" disabled badge="Próximamente" />
            <Row id="ciudad" icon="sucursales" tint="bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)]" title="Ciudad" value="Disponible muy pronto" disabled badge="Próximamente" />
            <Row id="direccion" icon="sucursales" tint="bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)]" title="Dirección" value="Disponible muy pronto" disabled badge="Próximamente" />
            <div className="px-4 sm:px-5 py-3 bg-[var(--mg-gold-bg)]/30">
              <p className="text-[11px] font-medium leading-snug text-[var(--mg-gold-text)]">
                Estamos preparando la facturación con NIT y dirección fiscal. Muy pronto vas a poder completar estos datos desde aquí.
              </p>
            </div>
          </SectionCard>
        )}

        {/* ── DATOS ── */}
        {showDatos && (
          <SectionCard
            icon="respaldo"
            title="Datos y respaldo"
            description="Tu información, siempre bajo tu control."
          >
            <Row id="respaldo" icon="respaldo" tint="bg-[var(--mg-gold-bg)] text-[var(--mg-gold-text)]" title="Respaldo" value="Exportar .JSON" />
            {admin && visible('admin') && (
              <div>
                <button type="button" onClick={() => navigate('/admin')} className="w-full flex items-center gap-3.5 px-4 sm:px-5 min-h-[72px] py-3 text-left active:bg-[var(--mg-bg-elevated)]">
                  <IconBox icon="plan" tint="bg-[var(--mg-brand-bg)] text-[var(--mg-brand-text)]" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-bold leading-tight">Panel de administración</span>
                    <span className="block text-xs text-[var(--mg-text-muted)] font-medium mt-0.5">Planes, pagos y control</span>
                  </span>
                  <Chevron />
                </button>
              </div>
            )}
            <div className="px-4 sm:px-5 py-3">
              <p className="text-[11px] font-medium text-[var(--mg-text-muted)] truncate">
                Sesión: {user?.displayName || user?.email || 'Usuario'}
              </p>
            </div>
          </SectionCard>
        )}
      </div>

      {/* ── APARIENCIA ── */}
      {showApariencia && (
        <div className="mt-5">
          <SectionCard
            icon="galeria"
            title="Apariencia"
            description="Elegí el look de tu app. Se aplica al instante en este dispositivo."
          >
            <div className="p-4 sm:p-5">
              <ThemePicker bare />
            </div>
          </SectionCard>
        </div>
      )}

      {isSearching && !showNegocio && !showFiscal && !showTicket && !showDatos && !showApariencia && !showOperacion && (
        <p className="text-center text-sm text-[var(--mg-text-muted)] mt-10">Sin resultados para “{query}”.</p>
      )}

      {/* ── Barra de guardado liviana ── */}
      <AnimatePresence>
        {(hasChanges || saved) && (
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            className="fixed bottom-20 lg:bottom-6 left-4 right-4 max-w-xl mx-auto z-40"
          >
            <div className="bg-[var(--mg-bg-surface)]/95 backdrop-blur border border-[var(--mg-border)] rounded-2xl pl-4 pr-2 py-2 shadow-lg flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full shrink-0 ${saved ? 'bg-[var(--mg-success)]' : 'bg-[var(--mg-gold)] animate-pulse'}`} />
              <p className="flex-1 min-w-0 text-xs font-bold truncate">
                {saved ? <span className="text-[var(--mg-success-text)]">Guardado ✓</span> : <span>{changedFields.length} sin guardar</span>}
              </p>
              {!saved && (
                <button type="button" onClick={handleDiscard} disabled={saving} className="text-xs font-bold text-[var(--mg-text-muted)] px-2 py-2 disabled:opacity-50">
                  Descartar
                </button>
              )}
              {!saved && (
                <button type="button" onClick={handleSave} disabled={saving} className="mg-btn-primary !py-2 !px-4 text-xs !rounded-xl disabled:opacity-50">
                  {saving ? 'Guardando…' : 'Guardar'}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modal rubro (lista) ── */}
      <AnimatePresence>
        {showRubroModal && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 mg-backdrop-in sm:items-center" role="dialog" aria-modal="true" aria-label="Rubro comercial" onClick={() => setShowRubroModal(false)}>
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[var(--mg-bg-surface)] w-full max-w-sm rounded-2xl border border-[var(--mg-border)] shadow-xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--mg-separator)]">
                <p className="text-sm font-extrabold">Rubro comercial</p>
                <button type="button" onClick={() => setShowRubroModal(false)} className="w-7 h-7 rounded-full bg-[var(--mg-bg-elevated)] text-xs font-bold">✕</button>
              </div>
              <div className="max-h-[55vh] overflow-y-auto divide-y divide-[var(--mg-separator)]">
                {BUSINESS_CATEGORIES.map((cat) => {
                  const act = cat.id === businessCategory;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => { setBusinessCategory(cat.id); setShowRubroModal(false); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left active:bg-[var(--mg-bg-elevated)]"
                    >
                      <span className="text-lg">{cat.emoji}</span>
                      <span className="flex-1 text-[13px] font-semibold truncate">{cat.name}</span>
                      {act && <span className="text-[var(--mg-accent-text)] text-sm font-black">✓</span>}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Planes ── */}
      {showPlans && (
        <UpgradeModal
          title="Mejorá tu plan"
          feature={null}
          onClose={() => setShowPlans(false)}
        />
      )}

      {/* ── Vista previa (sheet) ── */}
      <AnimatePresence>
        {showPreview && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 mg-backdrop-in sm:items-center" role="dialog" aria-modal="true" aria-label="Vista previa del ticket" onClick={() => setShowPreview(false)}>
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[var(--mg-bg-base)] w-full max-w-sm rounded-2xl border border-[var(--mg-border)] shadow-xl overflow-hidden max-h-[88vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between px-4 py-3 sticky top-0 bg-[var(--mg-bg-base)]/95 backdrop-blur border-b border-[var(--mg-separator)] z-10">
                <p className="text-sm font-extrabold">Vista previa</p>
                <button type="button" onClick={() => setShowPreview(false)} className="w-7 h-7 rounded-full bg-[var(--mg-bg-elevated)] border border-[var(--mg-border)] text-xs font-bold">✕</button>
              </div>
              <div className="p-4">
                <TicketPreview
                  businessName={business?.name || ''}
                  slogan={slogan} phone={phone} address={address} city={city}
                  legalName={legalName} nit={nit} footerMessage={footerMessage}
                  showQrOnTicket={showQrOnTicket} logoData={logoData} qrData={qrData}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
