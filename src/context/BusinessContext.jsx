import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from './AuthContext';
import { getBusinessSettings } from '../services/businessSettings';
import { DEFAULT_CATEGORY_ID } from '../config/businessCategories';

const BusinessContext = createContext(null);

// La tabla business_settings usa snake_case (logo_data, qr_data,
// business_category) pero las pantallas leen camelCase. Exponemos ambas formas
// para que el logo, el QR de cobro y el tema por rubro estén disponibles apenas
// se carga el negocio, y no solo después de guardar en esa misma sesión.
function normalizeSettings(raw) {
  if (!raw) return {};
  const logoData = raw.logo_data ?? raw.logoData ?? '';
  const qrData = raw.qr_data ?? raw.qrData ?? '';
  const businessCategory = raw.business_category ?? raw.businessCategory ?? DEFAULT_CATEGORY_ID;

  return {
    ...raw,
    logo_data: logoData,
    qr_data: qrData,
    business_category: businessCategory,
    logoData,
    qrData,
    businessCategory,
  };
}

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
      if (res.data) setBusiness(res.data);
      setSettings(normalizeSettings(s));
    });

    return () => {
      ignore = true;
    };
  }, [businessId]);

  function refreshSettings(newSettings) {
    setSettings((prev) => normalizeSettings({ ...prev, ...newSettings }));
  }

  return (
    <BusinessContext.Provider value={{ business, settings, refreshSettings }}>
      {children}
    </BusinessContext.Provider>
  );
}

export function useBusiness() {
  return useContext(BusinessContext);
}
