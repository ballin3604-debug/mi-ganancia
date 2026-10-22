import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { useBusiness } from '../context/BusinessContext';
import { saveBusinessSettings, renameBusiness } from '../services/businessSettings';
import { useImageUpload } from '../hooks/useImageUpload';
import { exportFullBackup } from '../services/backup';
import { DEFAULT_CATEGORY_ID, BUSINESS_CATEGORIES, getCategoryById } from '../config/businessCategories';
import { getReceiptFormat, setReceiptFormat, RECEIPT_FORMATS } from '../utils/receiptFormat';
import { AppIcon } from '../components/icons';
import { TicketPreview } from '../components/settings/TicketPreview';

/* ─────────────────────────────────────────────
   Ajustes · formato lista (liviano, estilo iOS)
   Una sola columna, filas de 56px, editores
   colapsables. Nada de tarjetas pesadas.
   ───────────────────────────────────────────── */

function Chevron() {
  return (
    <svg className="w-4 h-4 text-[var(--mg-text-faint)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

function IconBox({ icon, tint }) {
  return (
    <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${tint}`}>
      <AppIcon name={icon} size={15} />
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
      className={`h-6 w-11 shrink-0 rounded-full p-0.5 transition-colors ${on ? 'bg-[var(--mg-success)]' : 'bg-[var(--mg-border-hover)]'}`}
    >
      <span className={`block h-5 w-5 rounded-full bg-[var(--mg-bg-surface)] shadow transition-transform ${on ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );
}

export default function Settings() {
  const { businessId, admin, user, role } = useAuth();
  const navigate = useNavigate();
  const { business, settings, refreshSettings, refreshBusiness } = useBusiness();
  const { pickImage, pickQR } = useImageUpload();

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

  // ── UI de lista ──
  const [openId, setOpenId] = useState(null);
  const [query, setQuery] = useState('');
  const [showRubroModal, setShowRubroModal] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

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
  }, [savedSlogan, savedPhone, savedLogo, savedQr, savedCategory, savedLegalName, savedNit, savedCity, savedAddress, savedFooter, savedShowQr]);

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
    return d;
  }, [slogan, phone, logoData, qrData, businessCategory, legalName, nit, city, address, footerMessage, showQrOnTicket,
    savedSlogan, savedPhone, savedLogo, savedQr, savedCategory, savedLegalName, savedNit, savedCity, savedAddress, savedFooter, savedShowQr]);

  const hasChanges = changedFields.length > 0;
  const isSearching = query.trim().length > 0;

  useEffect(() => {
    if (!hasChanges) return;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasChanges]);

  const currentCat = getCategoryById(businessCategory);

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
    vista: 'vista previa ejemplo probar imprimir test',
    respaldo: 'respaldo copia seguridad exportar descargar json backup',
    admin: 'admin panel administracion',
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
    setSlogan(savedSlogan); setPhone(savedPhone); setLogoData(savedLogo);
    setQrData(savedQr); setBusinessCategory(savedCategory); setLegalName(savedLegalName);
    setNit(savedNit); setCity(savedCity); setAddress(savedAddress);
    setFooterMessage(savedFooter); setShowQrOnTicket(savedShowQr);
  }
  async function handleSave() {
    setSaving(true);
    try {
      const data = {
        slogan, phone, logo_data: logoData, qr_data: qrData,
        business_category: businessCategory, legal_name: legalName.trim(),
        nit: nit.trim(), city: city.trim(), address: address.trim(),
        footer_message: footerMessage.trim(), show_qr: showQrOnTicket,
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

  function Row({ id, icon, tint, title, value, right, onOpen }) {
    if (!visible(id)) return null;
    const isOpen = openId === id && !onOpen;
    return (
      <div>
        <button
          type="button"
          onClick={() => (onOpen ? onOpen() : toggle(id))}
          className="w-full flex items-center gap-3 px-3 min-h-[56px] py-2 text-left active:bg-[var(--mg-bg-elevated)] transition-colors"
        >
          <IconBox icon={icon} tint={tint} />
          <span className="flex-1 min-w-0">
            <span className="block text-[13px] font-semibold text-[var(--mg-text-primary)] leading-tight">{title}</span>
            <span className="block text-xs text-[var(--mg-text-muted)] truncate font-medium">{value}</span>
          </span>
          {right || <Chevron />}
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
          <div className="px-3 pb-3 pt-2 border-t border-[var(--mg-separator)] bg-[var(--mg-bg-elevated)]/40">
            <button type="button" onClick={() => setShowRubroModal(true)} className="w-full flex items-center gap-2 bg-[var(--mg-bg-surface)] border border-[var(--mg-border)] rounded-lg px-3 py-2 text-sm font-semibold active:scale-[0.99]">
              <span className="text-base">{currentCat.emoji}</span>
              <span className="flex-1 text-left truncate">{currentCat.name}</span>
              <span className="text-xs font-bold text-[var(--mg-accent)]">Cambiar</span>
            </button>
          </div>
        );
      case 'logo':
        return (
          <div className="px-3 pb-3 pt-2 border-t border-[var(--mg-separator)] bg-[var(--mg-bg-elevated)]/40 flex items-center gap-3">
            {logoData
              ? <img src={logoData} alt="Logo" className="w-12 h-12 rounded-lg object-contain border border-[var(--mg-border)] bg-white p-0.5" />
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
  const showFiscal = ['legal', 'nit', 'ciudad', 'direccion', 'pie'].some(visible);
  const showTicket = isSearching
    ? ['formato', 'verqr', 'vista'].some(visible)
    : true;
  const showDatos = isSearching
    ? ['respaldo', 'admin'].some(visible)
    : true;

  return (
    <div className="max-w-xl mx-auto px-4 pt-4 pb-32">
      {/* Encabezado liviano */}
      <h1 className="text-[22px] font-extrabold tracking-tight text-[var(--mg-text-primary)] leading-none">Ajustes</h1>
      <p className="text-xs text-[var(--mg-text-muted)] mt-1 font-medium truncate">
        {business?.name || 'Mi negocio'} · {role === 'cashier' ? 'Cajero' : 'Dueño'}
        {hasChanges && <span className="font-bold text-[var(--mg-gold-text)]"> · {changedFields.length} sin guardar</span>}
        {saved && <span className="font-bold text-[var(--mg-success-text)]"> · Guardado ✓</span>}
      </p>

      {/* Buscador */}
      <div className="relative mt-3">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--mg-text-muted)]">
          <AppIcon name="search" size={15} />
        </span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar ajuste… (QR, NIT, recibo…)"
          className="mg-input !py-2 !pl-9 text-sm !rounded-xl"
        />
        {query && (
          <button type="button" onClick={() => setQuery('')} aria-label="Limpiar búsqueda" className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[var(--mg-bg-section)] text-xs font-bold text-[var(--mg-text-muted)]">✕</button>
        )}
      </div>

      <input ref={logoRef} type="file" accept="image/*" aria-label="Seleccionar logo" className="hidden" onChange={(e) => handleImagePick(e, setLogoData, 250)} />
      <input ref={qrRef} type="file" accept="image/*" aria-label="Seleccionar QR" className="hidden" onChange={handleQRPick} />

      {/* ── MI NEGOCIO ── */}
      {showNegocio && (
        <>
          <p className="mg-section-title !mt-5 !px-1">Mi negocio</p>
          <div className="mg-list !rounded-2xl shadow-xs">
            <Row id="nombre" icon="tienda" tint="bg-[var(--mg-accent-bg)] text-[var(--mg-accent)]" title="Nombre" value={business?.name || 'Sin nombre'} />
            <Row id="rubro" icon="etiqueta" tint="bg-[var(--mg-gold-bg)] text-[var(--mg-gold-text)]" title="Rubro" value={`${currentCat.emoji} ${currentCat.name}`} />
            <Row
              id="logo" icon="galeria" tint="bg-[var(--mg-brand-bg)] text-[var(--mg-brand)]" title="Logo" value={logoData ? 'Agregado · sale en el recibo' : 'Sin logo'}
              right={logoData
                ? <img src={logoData} alt="" className="w-8 h-8 rounded-lg object-contain border border-[var(--mg-border)] bg-white" />
                : <Chevron />}
            />
            <Row id="slogan" icon="texto" tint="bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)]" title="Slogan" value={slogan || 'Añadir frase del recibo…'} />
            <Row id="telefono" icon="llamar" tint="bg-[var(--mg-success-bg)] text-[var(--mg-success-text)]" title="Teléfono / WhatsApp" value={phone || 'Añadir número…'} />
            <Row
              id="qr" icon="qr" tint="bg-[var(--mg-brand-bg)] text-[var(--mg-brand)]" title="QR de cobro" value={qrData ? 'Agregado' : 'Sin QR · Tigo, BCP, BNB…'}
              right={qrData
                ? <img src={qrData} alt="" className="w-8 h-8 rounded-lg object-contain border border-[var(--mg-border)] bg-white" />
                : <Chevron />}
            />
          </div>
        </>
      )}

      {/* ── FACTURACIÓN ── */}
      {showFiscal && (
        <>
          <p className="mg-section-title !mt-5 !px-1">Facturación y dirección</p>
          <div className="mg-list !rounded-2xl shadow-xs">
            <Row id="legal" icon="carnet" tint="bg-[var(--mg-accent-bg)] text-[var(--mg-accent)]" title="Razón social" value={legalName || 'Sin registrar'} />
            <Row id="nit" icon="recibo" tint="bg-[var(--mg-accent-bg)] text-[var(--mg-accent)]" title="NIT" value={nit || 'Sin registrar'} />
            <Row id="ciudad" icon="sucursales" tint="bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)]" title="Ciudad" value={city || 'Sin registrar'} />
            <Row id="direccion" icon="sucursales" tint="bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)]" title="Dirección" value={address || 'Sin registrar'} />
            <Row id="pie" icon="texto" tint="bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)]" title="Mensaje final del ticket" value={footerMessage || '¡Gracias por su compra!'} />
          </div>
        </>
      )}

      {/* ── TICKET ── */}
      {showTicket && (
        <>
          <p className="mg-section-title !mt-5 !px-1">Ticket</p>
          <div className="mg-list !rounded-2xl shadow-xs">
            <Row id="formato" icon="recibo" tint="bg-[var(--mg-accent-bg)] text-[var(--mg-accent)]" title="Formato del recibo" value={receiptFormat === 'sheet' ? 'Hoja A4' : 'Térmico 80mm'} />
            {visible('verqr') && (
              <div>
                <div className="w-full flex items-center gap-3 px-3 min-h-[56px] py-2">
                  <IconBox icon="qr" tint="bg-[var(--mg-brand-bg)] text-[var(--mg-brand)]" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px] font-semibold leading-tight">QR al final del ticket</span>
                    <span className="block text-xs text-[var(--mg-text-muted)] font-medium">{qrData ? 'Se imprime si está activado' : 'Primero subí un QR'}</span>
                  </span>
                  <Toggle on={showQrOnTicket} onChange={setShowQrOnTicket} />
                </div>
              </div>
            )}
            {visible('vista') && (
              <div>
                <button type="button" onClick={() => setShowPreview(true)} className="w-full flex items-center gap-3 px-3 min-h-[56px] py-2 text-left active:bg-[var(--mg-bg-elevated)]">
                  <IconBox icon="detalle" tint="bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)]" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px] font-semibold leading-tight">Vista previa</span>
                    <span className="block text-xs text-[var(--mg-text-muted)] font-medium">Ver ejemplo e imprimir prueba</span>
                  </span>
                  <Chevron />
                </button>
              </div>
            )}
          </div>
          <p className="text-[11px] text-[var(--mg-text-muted)] px-1 mt-1.5">El formato se guarda solo en este dispositivo.</p>
        </>
      )}

      {/* ── DATOS ── */}
      {showDatos && (
        <>
          <p className="mg-section-title !mt-5 !px-1">Datos</p>
          <div className="mg-list !rounded-2xl shadow-xs">
            <Row id="respaldo" icon="respaldo" tint="bg-[var(--mg-gold-bg)] text-[var(--mg-gold-text)]" title="Respaldo" value="Exportar .JSON" />
            {admin && visible('admin') && (
              <div>
                <button type="button" onClick={() => navigate('/admin')} className="w-full flex items-center gap-3 px-3 min-h-[56px] py-2 text-left active:bg-[var(--mg-bg-elevated)]">
                  <IconBox icon="plan" tint="bg-[var(--mg-brand-bg)] text-[var(--mg-brand)]" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px] font-semibold leading-tight">Panel de administración</span>
                    <span className="block text-xs text-[var(--mg-text-muted)] font-medium">Planes, pagos y control</span>
                  </span>
                  <Chevron />
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {isSearching && !showNegocio && !showFiscal && !showTicket && !showDatos && (
        <p className="text-center text-sm text-[var(--mg-text-muted)] mt-10">Sin resultados para “{query}”.</p>
      )}

      <p className="text-center text-[11px] text-[var(--mg-text-faint)] mt-8">
        Sesión: {user?.displayName || user?.email || 'Usuario'}
      </p>

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
              <span className={`w-2 h-2 rounded-full shrink-0 ${saved ? 'bg-[var(--mg-success)]' : 'bg-amber-500 animate-pulse'}`} />
              <p className="flex-1 min-w-0 text-xs font-bold truncate">
                {saved ? <span className="text-emerald-600">Guardado ✓</span> : <span>{changedFields.length} sin guardar</span>}
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
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 mg-backdrop-in" onClick={() => setShowRubroModal(false)}>
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
                      {act && <span className="text-[var(--mg-accent)] text-sm font-black">✓</span>}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Vista previa (sheet) ── */}
      <AnimatePresence>
        {showPreview && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 mg-backdrop-in" onClick={() => setShowPreview(false)}>
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
