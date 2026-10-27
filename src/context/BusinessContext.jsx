import { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';
import { useAuth } from './AuthContext';
import { getBusinessSettings, getBusinessSectorConfig } from '../services/businessSettings';
import { DEFAULT_CATEGORY_ID } from '../config/businessCategories';

const BusinessContext = createContext(null);

// La tabla business_settings usa snake_case (logo_data, qr_data,
// business_category) pero las pantallas leen camelCase. Exponemos ambas formas
// para que el logo, el QR de cobro y el tema por rubro estén disponibles apenas
// se carga el negocio, y no solo después de guardar en esa misma sesión.
const DEFAULT_FOOTER = '¡Gracias por su compra! Conserve su recibo.';

function normalizeSettings(raw) {
  if (!raw) return {};
  const logoData = raw.logo_data ?? raw.logoData ?? '';
  const qrData = raw.qr_data ?? raw.qrData ?? '';
  const businessCategory = raw.business_category ?? raw.businessCategory ?? DEFAULT_CATEGORY_ID;
  const legalName = raw.legal_name ?? raw.legalName ?? '';
  const nit = raw.nit ?? '';
  const city = raw.city ?? '';
  const address = raw.address ?? '';
  const footerMessage = raw.footer_message ?? raw.footerMessage ?? '';
  // Por defecto el QR sí se imprime al final del ticket (comportamiento actual).
  const showQrRaw = raw.show_qr ?? raw.showQrOnTicket ?? raw.showQr;
  const showQrOnTicket = showQrRaw === undefined || showQrRaw === null ? true : !!showQrRaw;

  return {
    ...raw,
    logo_data: logoData,
    qr_data: qrData,
    business_category: businessCategory,
    logoData,
    qrData,
    businessCategory,
    legal_name: legalName,
    legalName,
    nit,
    city,
    address,
    footer_message: footerMessage,
    footerMessage,
    show_qr: showQrOnTicket,
    showQrOnTicket,
    showQr: showQrOnTicket,
    defaultFooterMessage: DEFAULT_FOOTER,
  };
}

export { DEFAULT_FOOTER };

export function BusinessProvider({ children }) {
  const { businessId } = useAuth();
  const [business, setBusiness] = useState(null);
  const [settings, setSettings] = useState({});

  useEffect(() => {
    if (!businessId) {
      setBusiness(null);
      setSettings({});
      return;
    }

    if (!supabase || !isSupabaseConfigured) {
      console.error('Falta VITE_SUPABASE_URL. BusinessContext sin conexión.');
      setBusiness(null);
      setSettings({});
      return;
    }

    // Si businessId cambia dos veces seguido (p.ej. cambio rápido de negocio
    // en la misma sesión), una respuesta más lenta del primer fetch podía
    // resolver DESPUÉS de la segunda y pisar el estado con datos del
    // negocio equivocado. 'ignore' evita aplicar una respuesta que ya no
    // corresponde al businessId actual.
    let ignore = false;

    Promise.all([
      supabase.from('businesses').select('*').eq('id', businessId).single(),
      getBusinessSettings(businessId),
    ]).then(([res, s]) => {
      if (ignore) return;
      if (res.error) {
        console.error('BusinessContext: no se pudo cargar el negocio:', res.error);
      } else if (res.data) {
        setBusiness(res.data);
      }
      setSettings(normalizeSettings(s));
    }).catch((err) => {
      if (ignore) return;
      console.error('BusinessContext: error cargando negocio/ajustes:', err);
    });

    return () => {
      ignore = true;
    };
  }, [businessId]);

  function refreshSettings(newSettings) {
    setSettings((prev) => normalizeSettings({ ...prev, ...newSettings }));
  }

  async function refreshBusiness() {
    if (!businessId) return;
    if (!supabase) {
      console.error('Falta VITE_SUPABASE_URL. No se puede refrescar el negocio.');
      return;
    }
    try {
      const res = await supabase.from('businesses').select('*').eq('id', businessId).single();
      if (res.error) {
        console.error('BusinessContext refreshBusiness: no se pudo recargar el negocio:', res.error);
        return;
      }
      if (res.data) setBusiness(res.data);
    } catch (err) {
      console.error('BusinessContext refreshBusiness:', err);
    }
  }

  const sectorConfig = getBusinessSectorConfig(settings);

  return (
    <BusinessContext.Provider value={{ business, settings, sectorConfig, refreshSettings, refreshBusiness }}>
      {children}
    </BusinessContext.Provider>
  );
}

export function useBusiness() {
  return useContext(BusinessContext);
}
