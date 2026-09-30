// ─────────────────────────────────────────────────────────────
// Presentaciones de venta: unidad, paquete (chipa/caja), frío/caliente.
// Un producto se vende por UNIDAD (lata, botella suelta) y opcionalmente
// por PAQUETE (chipa x12, caja x6). El paquete puede tener precio distinto
// en frío vs caliente; la unidad tiene un solo precio.
// El stock siempre vive en UNIDADES BASE: vender 1 paquete descuenta N.
// ─────────────────────────────────────────────────────────────

// Opción de venta normalizada:
// { key, presId: 'unit'|'pack', variant: 'unico'|'frio'|'caliente',
//   label: 'Lata', tag: 'Lata fría', price, factor, unitsDesc: 'x12' }
export function getSellOptions(product) {
  if (!product) return [];
  const unitLabel = (product.unitLabel || '').trim() || 'Unidad';
  const unitPrice = Number(product.price || 0);
  const options = [
    {
      key: `${product.id}|unit|unico`,
      presId: 'unit',
      variant: 'unico',
      label: unitLabel,
      tag: `${unitLabel} · ${formatMoney(unitPrice)}`,
      price: unitPrice,
      factor: 1,
      icon: '🔹',
    },
  ];

  const packSize = Number(product.packageSize || 0);
  const packLabel = (product.packLabel || '').trim() || 'Paquete';
  const packFrio = product.packPrice !== '' && product.packPrice !== null && product.packPrice !== undefined
    ? Number(product.packPrice) : null;
  const packCaliente = product.packPriceHot !== '' && product.packPriceHot !== null && product.packPriceHot !== undefined
    ? Number(product.packPriceHot) : null;

  if (packSize > 1 && packFrio !== null && packFrio > 0) {
    options.push({
      key: `${product.id}|pack|frio`,
      presId: 'pack',
      variant: 'frio',
      label: packLabel,
      tag: `${packLabel} frío (x${packSize}) · ${formatMoney(packFrio)}`,
      price: packFrio,
      factor: packSize,
      icon: '📦',
    });
    if (packCaliente !== null && packCaliente > 0 && packCaliente !== packFrio) {
      options.push({
        key: `${product.id}|pack|caliente`,
        presId: 'pack',
        variant: 'caliente',
        label: packLabel,
        tag: `${packLabel} caliente (x${packSize}) · ${formatMoney(packCaliente)}`,
        price: packCaliente,
        factor: packSize,
        icon: '📦',
      });
    }
  }
  return options;
}

export function defaultSellOption(product) {
  return getSellOptions(product)[0];
}

// Texto corto para recibos y reportes: "Chipa fría x12"
export function presShortLabel(product, presId, variant) {
  const unitLabel = (product?.unitLabel || '').trim() || 'Unidad';
  const packLabel = (product?.packLabel || '').trim() || 'Paquete';
  const packSize = Number(product?.packageSize || 0);
  if (presId === 'pack' && packSize > 1) {
    const temp = variant === 'caliente' ? ' caliente' : variant === 'frio' ? ' fría' : '';
    return `${packLabel}${temp} x${packSize}`;
  }
  return unitLabel;
}

export function formatMoney(n) {
  return `Bs ${Number(n || 0).toFixed(2)}`;
}
