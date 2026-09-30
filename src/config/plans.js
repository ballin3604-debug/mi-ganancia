// ─────────────────────────────────────────────────────────────
// Planes Free / Pro / Premium — matriz oficial de funcionalidades.
// free: enganche (límites). pro: negocio único a fondo. premium: + sucursales.
// El trial de 14 días equivale a Pro.
// ─────────────────────────────────────────────────────────────

export const PLANS = {
  free: {
    id: 'free',
    name: 'Gratis',
    tagline: 'Para empezar',
    priceMonthly: 0,
    maxProducts: 100,
    maxUsers: 1,
    features: {
      scanner: false,
      advancedReports: false,
      pdfExport: false,
      multiUser: false,
      branches: false,
    },
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    tagline: 'Tu negocio a fondo · Bs 49/mes',
    priceMonthly: 49,
    maxProducts: 1000000,
    maxUsers: 5,
    features: {
      scanner: true,
      advancedReports: true,
      pdfExport: true,
      multiUser: true,
      branches: false,
    },
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    tagline: 'Sucursales y almacenes · Bs 99/mes',
    priceMonthly: 99,
    maxProducts: 1000000,
    maxUsers: 15,
    features: {
      scanner: true,
      advancedReports: true,
      pdfExport: true,
      multiUser: true,
      branches: true,
    },
  },
};

export const PLAN_ORDER = ['free', 'pro', 'premium'];

export function getPlan(id) {
  return PLANS[id] || PLANS.free;
}

// Plan efectivo: trial vigente o estado activo => plan contratado;
// vencido o sin suscripción => free (sin borrar nada).
export function effectivePlan(subscription) {
  if (!subscription) return PLANS.free;
  const now = new Date();
  if (subscription.status === 'trial') {
    const ends = subscription.trial_ends_at ? new Date(subscription.trial_ends_at) : null;
    if (!ends || ends > now) return getPlan(subscription.plan_id);
    return PLANS.free;
  }
  if (subscription.status === 'active') {
    const ends = subscription.current_period_end ? new Date(subscription.current_period_end) : null;
    if (!ends || ends > now) return getPlan(subscription.plan_id);
    return PLANS.free;
  }
  return PLANS.free;
}

export function daysLeft(subscription) {
  if (!subscription) return 0;
  const end = subscription.status === 'trial'
    ? subscription.trial_ends_at
    : subscription.current_period_end;
  if (!end) return 0;
  return Math.max(0, Math.ceil((new Date(end) - new Date()) / (1000 * 60 * 60 * 24)));
}
