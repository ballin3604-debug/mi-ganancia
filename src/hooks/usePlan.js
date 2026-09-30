import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabaseClient';
import { effectivePlan, daysLeft, getPlan } from '../config/plans';

// Lee la suscripción del negocio y expone plan efectivo + helpers de gating.
// Sin fila o vencida => Free (los datos nunca se bloquean, solo las funciones).
// billingReady=false si las tablas aún no existen (SQL sin correr): en ese
// modo legacy TODO queda abierto como antes, para no bloquear de golpe.
export function usePlan() {
  const { businessId } = useAuth();
  const [subscription, setSubscription] = useState(null);
  const [billingReady, setBillingReady] = useState(true);
  const [loading, setLoading] = useState(true);

  const fetchSub = useCallback(async () => {
    if (!businessId) {
      setSubscription(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('business_id', businessId)
        .maybeSingle();
      if (error) {
        const missing = error.code === '42P01' || error.code === 'PGRST205'
          || /does not exist|could not find/i.test(error.message || '');
        if (missing) setBillingReady(false);
        throw error;
      }
      setSubscription(data || null);
    } catch {
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    fetchSub();
  }, [fetchSub]);

  const plan = effectivePlan(subscription);
  const left = daysLeft(subscription);
  const isTrial = subscription?.status === 'trial' && left > 0;

  function can(feature) {
    return !!plan.features?.[feature];
  }

  return {
    subscription,
    plan,
    planId: plan.id,
    isTrial,
    trialDaysLeft: isTrial ? left : 0,
    periodDaysLeft: left,
    can,
    getPlan,
    refreshPlan: fetchSub,
    loading,
    billingReady,
  };
}
