export function getSellOptions(product) {
  if (!product) return [];

  const configured = Array.isArray(product.presentations) ? product.presentations : [];
  if (configured.length > 0) {
    const bases = configured.filter((presentation) => presentation?.isBase);
    if (bases.length !== 1
      || Number(bases[0].factor) !== 1
      || Number(bases[0].price) !== Number(product.price)) return [];
    try {
      validatePresentationDefinitions(configured, {
        baseName: bases[0].name,
        basePrice: bases[0].price,
      });
    } catch {
      return [];
    }
    return [...configured]
      .sort((a, b) => Number(!!b?.isBase) - Number(!!a?.isBase))
      .filter((presentation) => (
        presentation
        && String(presentation.id || '').trim()
        && typeof presentation.name === 'string'
        && presentation.name.trim()
        && Number.isFinite(Number(presentation.factor))
        && Number(presentation.factor) > 0
        && Number.isFinite(Number(presentation.price))
        && Number(presentation.price) > 0
      ))
      .map((presentation) => {
        const name = presentation.name.trim();
        const factor = Number(presentation.factor);
        const price = Number(presentation.price);
        const presentationId = String(presentation.id || '');
        return {
          key: `${product.id}|presentation|${presentationId}`,
          presId: 'configured',
          presentationId,
          variant: '',
          label: name,
          tag: `${name}${factor > 1 ? ` (x${factor})` : ''} · ${formatMoney(price)}`,
          price,
          factor,
          isBase: !!presentation.isBase,
          icon: factor > 1 ? '📦' : '🔹',
        };
      });
  }

  const unitLabel = (product.unitLabel || '').trim() || 'Unidad';
  const unitPrice = Number(product.price || 0);
  const options = [
    {
      key: `${product.id}|unit|unico`,
      presId: 'unit',
      presentationId: null,
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
      presentationId: null,
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
        presentationId: null,
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

export function presShortLabel(product, presId, variant, presentationId = null) {
  if (presentationId) {
    const presentation = (product?.presentations || []).find((item) => String(item.id) === String(presentationId));
    if (presentation) {
      const factor = Number(presentation.factor || 1);
      return `${presentation.name}${factor > 1 ? ` x${factor}` : ''}`;
    }
  }

  const unitLabel = (product?.unitLabel || '').trim() || 'Unidad';
  const packLabel = (product?.packLabel || '').trim() || 'Paquete';
  const packSize = Number(product?.packageSize || 0);
  if (presId === 'pack' && packSize > 1) {
    const temp = variant === 'caliente' ? ' caliente' : variant === 'frio' ? ' fría' : '';
    return `${packLabel}${temp} x${packSize}`;
  }
  return unitLabel;
}

export function validatePresentationDefinitions(presentations, { baseName, basePrice }) {
  if (!Array.isArray(presentations) || presentations.length === 0) {
    throw new Error('Agrega al menos la presentación de unidad base.');
  }

  const clean = presentations.map((presentation, index) => {
    const name = String(presentation?.isBase ? baseName : presentation?.name || '').trim();
    const factor = Number(presentation?.factor);
    const price = presentation?.isBase ? Number(basePrice) : Number(presentation?.price);
    const id = String(presentation?.id || `presentation-${index + 1}`).trim();
    if (!name) throw new Error(`La presentación ${index + 1} necesita un nombre.`);
    if (!id) throw new Error(`La presentación ${name} necesita un identificador.`);
    if (!Number.isFinite(factor) || factor <= 0) throw new Error(`El factor de ${name} debe ser mayor que cero.`);
    if (!Number.isFinite(price) || price <= 0) throw new Error(`El precio de ${name} debe ser mayor que cero.`);
    return {
      id,
      name,
      factor,
      price,
      isBase: !!presentation?.isBase,
    };
  });

  if (clean.filter((presentation) => presentation.isBase).length !== 1) {
    throw new Error('Debe existir exactamente una unidad base.');
  }
  if (clean.some((presentation) => presentation.isBase && presentation.factor !== 1)) {
    throw new Error('La unidad base debe tener factor 1.');
  }

  const ids = new Set();
  const names = new Set();
  clean.forEach((presentation) => {
    const nameKey = presentation.name.toLocaleLowerCase();
    if (ids.has(presentation.id)) throw new Error('Hay presentaciones con identificadores repetidos.');
    if (names.has(nameKey)) throw new Error(`La presentación "${presentation.name}" está repetida.`);
    ids.add(presentation.id);
    names.add(nameKey);
  });

  return clean.sort((a, b) => Number(b.isBase) - Number(a.isBase));
}

export function ensureBasePresentation(form, defaultUnit = 'Unidad') {
  const presentations = Array.isArray(form?.presentations) ? form.presentations : [];
  if (presentations.some((presentation) => presentation?.isBase)) return form;

  const baseName = String(form?.unitLabel || defaultUnit || 'Unidad').trim() || 'Unidad';
  const next = [{
    id: 'base-unit',
    name: baseName,
    factor: 1,
    price: form?.price || '',
    isBase: true,
  }, ...presentations.filter((presentation) => !presentation?.isBase)];

  if (presentations.length === 0 && form?.sellPack && Number(form.packageSize) > 1 && Number(form.packPrice) > 0) {
    const packName = String(form.packLabel || 'Paquete').trim() || 'Paquete';
    next.push({
      id: 'legacy-pack-frio',
      name: `${packName} fría`,
      factor: Number(form.packageSize),
      price: Number(form.packPrice),
      isBase: false,
    });
    if (Number(form.packPriceHot) > 0 && Number(form.packPriceHot) !== Number(form.packPrice)) {
      next.push({
        id: 'legacy-pack-caliente',
        name: `${packName} caliente`,
        factor: Number(form.packageSize),
        price: Number(form.packPriceHot),
        isBase: false,
      });
    }
  }

  return { ...form, unitLabel: baseName, presentations: next };
}

export function validateSellSelection(product, item) {
  const quantity = Number(item?.quantity);
  const factor = Number(item?.factor);
  const price = Number(item?.unitPrice);
  if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isInteger(quantity)) {
    throw new Error('La cantidad de venta debe ser un entero mayor que cero.');
  }
  if (!Number.isFinite(factor) || factor <= 0) {
    throw new Error('El factor de conversión debe ser mayor que cero.');
  }
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error('El precio de la presentación no es válido.');
  }

  if (item.presentationId !== undefined && item.presentationId !== null) {
    const definitions = Array.isArray(product?.presentations) ? product.presentations : [];
    const bases = definitions.filter((presentation) => presentation?.isBase);
    if (bases.length !== 1
      || Number(bases[0].factor) !== 1
      || Number(bases[0].price) !== Number(product?.price)) {
      throw new Error('La unidad base del producto no está configurada correctamente.');
    }
    validatePresentationDefinitions(definitions, {
      baseName: bases[0].name,
      basePrice: bases[0].price,
    });
    const configured = definitions
      .find((presentation) => String(presentation.id) === String(item.presentationId));
    const expectedLabel = configured
      ? `${String(configured.name).trim()}${factor > 1 ? ` x${factor}` : ''}`
      : '';
    if (!configured
      || Number(configured.factor) !== factor
      || Number(configured.price) !== price
      || expectedLabel !== String(item.presLabel || '').trim()) {
      throw new Error('La presentación seleccionada ya no coincide con el producto. Actualiza el carrito.');
    }
    return;
  }

  const options = getSellOptions(product);
  const legacyMatch = options.find((option) => (
    (item.presId === undefined || option.presId === item.presId)
    && (item.variant === undefined || option.variant === item.variant)
    && Number(option.factor) === factor
    && Number(option.price) === price
  ));
  if (!legacyMatch
    && item.presId === undefined
    && (item.variant === undefined || item.variant === '')
    && !(Number(product?.packageSize || product?.package_size || 0) > 1)) {
    return;
  }
  if (!legacyMatch) throw new Error('La presentación seleccionada no es válida para este producto.');
}

export function calculateBaseQuantity(quantity, factor) {
  const qty = Number(quantity);
  const conversion = Number(factor);
  if (!Number.isFinite(qty) || qty <= 0 || !Number.isInteger(qty)) {
    throw new Error('La cantidad debe ser un entero mayor que cero.');
  }
  if (!Number.isFinite(conversion) || conversion <= 0) {
    throw new Error('El factor de conversión debe ser mayor que cero.');
  }
  return qty * conversion;
}

export function calculatePurchaseBaseQuantity(packageCount, factor) {
  return calculateBaseQuantity(packageCount, factor);
}

export function formatMoney(n) {
  return `Bs ${Number(n || 0).toFixed(2)}`;
}
