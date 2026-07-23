import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from './AuthContext';
import { getBusinessSettings } from '../services/businessSettings';

const BusinessContext = createContext(null);

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
      setSettings(s);
    });

    return () => {
      ignore = true;
    };
  }, [businessId]);

  function refreshSettings(newSettings) {
    setSettings((prev) => ({ ...prev, ...newSettings }));
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
