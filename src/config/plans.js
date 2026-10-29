// ─────────────────────────────────────────────────────────────
// Planes Pro / Premium — matriz oficial de funcionalidades.
// Pro: negocio único a fondo, sin anuncios y hasta 3 usuarios.
// Premium: sucursales, desempeño por sede y hasta 10 usuarios.
// El trial de 14 días equivale a Pro.
// ─────────────────────────────────────────────────────────────

export const PLANS = {
  pro: {
    id: 'pro',
    name: 'Pro',
    tagline: 'Tu negocio a fondo · Bs 49/mes',
    priceMonthly: 49,
    priceYearly: 490,
    maxProducts: 1000000,
    maxUsers: 3,
    features: {
      scanner: true,
      advancedReports: true,
      pdfExport: true,
      multiUser: true,
      branches: false,
      ads: false,
    },
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    tagline: 'Sucursales y almacenes · Bs 99/mes',
    priceMonthly: 99,
    priceYearly: 990,
    maxProducts: 1000000,
    maxUsers: 10,
    features: {
      scanner: true,
      advancedReports: true,
      pdfExport: true,
      multiUser: true,
      branches: true,
      ads: false,
    },
  },
};

export const PLAN_ORDER = ['pro', 'premium'];

export function getPlan(id) {
  return PLANS[id] || PLANS.pro;
}

// Plan efectivo: trial vigente o estado activo => plan contratado;
// vencido o sin suscripción => Pro (nunca se borran datos ni se
// bloquea la operación diaria).
export function effectivePlan(subscription) {
  if (!subscription) return PLANS.pro;
  const now = new Date();
  if (subscription.status === 'trial') {
    const ends = subscription.trial_ends_at ? new Date(subscription.trial_ends_at) : null;
    if (!ends || ends > now) return getPlan(subscription.plan_id);
    return PLANS.pro;
  }
  if (subscription.status === 'active') {
    const ends = subscription.current_period_end ? new Date(subscription.current_period_end) : null;
    if (!ends || ends > now) return getPlan(subscription.plan_id);
    return PLANS.pro;
  }
  return PLANS.pro;
}

export function daysLeft(subscription) {
  if (!subscription) return 0;
  const end = subscription.status === 'trial'
    ? subscription.trial_ends_at
    : subscription.current_period_end;
  if (!end) return 0;
  return Math.max(0, Math.ceil((new Date(end) - new Date()) / (1000 * 60 * 60 * 24)));
}
