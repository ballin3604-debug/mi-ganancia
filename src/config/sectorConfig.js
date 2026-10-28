// ─────────────────────────────────────────────────────────────
// Configuración base por rubro (sector).
//
// Fases A-B: define defaults por rubro y habilita presentaciones configurables
// solo para licorerías. Lotes y variantes frío/ambiente siguen desactivados.
//
// La configuración se resuelve a partir de business_category y, en el
// futuro, podrá mezclarse con overrides guardados en business_settings.
// ─────────────────────────────────────────────────────────────

export const SECTOR_FEATURES = {
  // Permitir definir varias presentaciones por producto (unidad, six-pack, caja).
  configurablePresentations: false,
  // Trazabilidad por lotes y fechas de vencimiento por lote.
  trackLots: false,
  // Presentaciones frías / a temperatura ambiente.
  coldVariants: false,
  // Platos de cocina que se venden sin inventario (modo restaurante).
  dishes: false,
};

export const SECTOR_CONFIG_DEFAULTS = {
  default: {
    unitLabels: ['Unidad', 'Paquete', 'Caja'],
    defaultUnit: 'Unidad',
    optionalFields: [],
    features: { ...SECTOR_FEATURES },
  },
  licorera: {
    unitLabels: ['Unidad', 'Lata', 'Botella', 'Six-pack', 'Caja', 'Litro'],
    defaultUnit: 'Unidad',
    optionalFields: ['volume_ml', 'alcohol_degree', 'origin'],
    features: { ...SECTOR_FEATURES, configurablePresentations: true },
  },
  restaurante: {
    unitLabels: ['Plato', 'Porción', 'Unidad'],
    defaultUnit: 'Plato',
    optionalFields: [],
    features: { ...SECTOR_FEATURES, dishes: true },
  },
};

/**
 * Devuelve la configuración de sector para un rubro, mezclando overrides.
 * Si el rubro no tiene configuración específica, cae al default genérico.
 */
export function getSectorConfig(businessCategory, overrides = {}) {
  const base = SECTOR_CONFIG_DEFAULTS[businessCategory] || SECTOR_CONFIG_DEFAULTS.default;
  return {
    ...base,
    ...overrides,
    features: {
      ...base.features,
      ...(overrides.features || {}),
    },
  };
}
