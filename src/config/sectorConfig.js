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
  // Mostrar existencias y alertas de stock (el dueño puede ocultarlas).
  stock: true,
  // Botones de escaneo de códigos de barras (el dueño puede desactivarlos).
  scanner: true,
};

const LICORERA_SECTOR = {
  unitLabels: ['Unidad', 'Lata', 'Botella', 'Six-pack', 'Caja', 'Litro'],
  defaultUnit: 'Unidad',
  optionalFields: ['volume_ml', 'alcohol_degree', 'origin'],
  // En licorería los lotes rotan lento: avisa con 3 meses de anticipación.
  expiryWarningDays: 90,
  features: { ...SECTOR_FEATURES, configurablePresentations: true },
};

export const SECTOR_CONFIG_DEFAULTS = {
  default: {
    unitLabels: ['Unidad', 'Paquete', 'Caja'],
    defaultUnit: 'Unidad',
    optionalFields: [],
    expiryWarningDays: 30,
    features: { ...SECTOR_FEATURES },
  },
  licorera: LICORERA_SECTOR,
  agencia_licoreria: {
    ...LICORERA_SECTOR,
    // La agencia vende al por mayor: además del catálogo de licorería,
    // habilita clientes, cuentas por cobrar y recibo A4 por defecto.
    defaultReceiptFormat: 'sheet',
    features: {
      ...LICORERA_SECTOR.features,
      wholesale: true,
      customers: true,
      receivables: true,
      sheetReceipt: true,
    },
  },
  restaurante: {
    unitLabels: ['Plato', 'Porción', 'Unidad'],
    defaultUnit: 'Plato',
    optionalFields: [],
    expiryWarningDays: 30,
    features: { ...SECTOR_FEATURES, dishes: true },
  },
};

export function isLicorSector(businessCategory) {
  return businessCategory === 'licorera' || businessCategory === 'agencia_licoreria';
}

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
