import { amountToWords } from '../utils/numberToWords';
import { getReceiptFormat, RECEIPT_FORMATS } from '../utils/receiptFormat';

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

const AUTO_PRINT_SCRIPT = `
  <script>
    window.onload = function() {
      window.print();
      setTimeout(function() { window.close(); }, 500);
    };
  <\/script>`;

// ─────────────────────────────────────────────────────────────────────────────
// FORMATO 1 — TICKET TÉRMICO 80mm (el de siempre)
// ─────────────────────────────────────────────────────────────────────────────
function buildThermalHtml(ctx) {
  const {
    business, settings, isPurchase, items, total, receiptNum, day, month, year, time,
    clientName, clientNit, sellerName, supplier, payLabel,
    montoRecibido, cambio, cleanExtraRows, productsSubtotal,
  } = ctx;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>${isPurchase ? 'Comprobante de Compra' : 'Recibo'} N° ${receiptNum}</title>
  <style>
    @page { size: 80mm auto; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', Courier, monospace, Arial, sans-serif;
      font-size: 11px; line-height: 1.3; color: #000; background: #fff;
      padding: 4mm 3mm; width: 74mm; max-width: 74mm;
    }
    .text-center { text-align: center; }
    .bold { font-weight: bold; }
    .header { margin-bottom: 4mm; text-align: center; }
    .biz-name { font-size: 14px; font-weight: bold; text-transform: uppercase; margin-bottom: 1.5mm; }
    .sub-info { font-size: 10px; }
    .separator { border-top: 1px dashed #000; margin: 3mm 0; }
    .info-row { display: flex; justify-content: space-between; margin-bottom: 0.8mm; font-size: 10.5px; }
    .info-val { font-weight: bold; }
    .table-header { display: flex; font-weight: bold; margin-bottom: 1.5mm; font-size: 10.5px; border-bottom: 1px dashed #000; padding-bottom: 1mm; }
    .table-row { display: flex; margin-bottom: 1.5mm; font-size: 10.5px; }
    .col-qty { width: 12%; text-align: left; }
    .col-desc { width: 50%; text-align: left; word-break: break-word; }
    .col-price { width: 18%; text-align: right; }
    .col-subtotal { width: 20%; text-align: right; font-weight: bold; }
    .totals { margin-top: 2mm; }
    .total-row { display: flex; justify-content: space-between; margin-bottom: 0.8mm; font-size: 10.5px; }
    .main-total { font-size: 13px; font-weight: bold; border-top: 1px dashed #000; padding-top: 2mm; margin-top: 1.5mm; }
    .footer { margin-top: 5mm; text-align: center; font-size: 10px; }
    .thanks { font-weight: bold; text-transform: uppercase; margin-bottom: 1mm; }
    @media print { body { width: 74mm; margin: 0; padding: 2mm 1mm; } }
  </style>
</head>
<body>
  <div class="header">
    <p class="biz-name">${escapeHtml(business?.name || 'MI NEGOCIO')}</p>
    ${settings?.slogan ? `<p class="sub-info italic">"${escapeHtml(settings.slogan)}"</p>` : ''}
    ${settings?.phone ? `<p class="sub-info">Tel/WhatsApp: ${escapeHtml(settings.phone)}</p>` : ''}
    ${settings?.address ? `<p class="sub-info">${escapeHtml(settings.address)}</p>` : ''}
  </div>

  <div class="separator"></div>

  <div class="info-row">
    <span>${isPurchase ? 'Nº Compra:' : 'Nº Venta:'}</span>
    <span class="info-val">${receiptNum}</span>
  </div>
  <div class="info-row">
    <span>Fecha:</span>
    <span class="info-val">${day}/${month}/${year} ${time}</span>
  </div>
  <div class="info-row">
    <span>${isPurchase ? 'Registrado por:' : 'Cajero:'}</span>
    <span class="info-val">${escapeHtml(sellerName || '—')}</span>
  </div>

  <div class="separator"></div>

  ${isPurchase ? `
  <div class="info-row">
    <span>Proveedor:</span>
    <span class="info-val">${escapeHtml(supplier || 'Sin proveedor')}</span>
  </div>
  ` : `
  <div class="info-row">
    <span>Cliente:</span>
    <span class="info-val">${escapeHtml(clientName || 'S/N')}</span>
  </div>
  <div class="info-row">
    <span>CI / NIT:</span>
    <span class="info-val">${escapeHtml(clientNit || '0')}</span>
  </div>
  `}

  <div class="separator"></div>

  <div class="table-header">
    <span class="col-qty">Cant</span>
    <span class="col-desc">Producto</span>
    <span class="col-price">${isPurchase ? 'Costo U.' : 'P.U.'}</span>
    <span class="col-subtotal">Subt</span>
  </div>

  ${items.map((item) => `
    <div class="table-row">
      <span class="col-qty">${escapeHtml(item.quantity)}</span>
      <span class="col-desc">
        ${escapeHtml(item.productName)}
        ${item.productBrand ? `<br/><span style="font-size:9.5px;color:#333;">${escapeHtml(item.productBrand)}</span>` : ''}
      </span>
      <span class="col-price">${Number(item.price).toFixed(2)}</span>
      <span class="col-subtotal">${Number(item.subtotal).toFixed(2)}</span>
    </div>
  `).join('')}

  <div class="separator"></div>

  <div class="totals">
    ${isPurchase ? `
    <div class="total-row">
      <span>Subtotal productos:</span>
      <span>Bs ${productsSubtotal.toFixed(2)}</span>
    </div>
    ${cleanExtraRows.map((r) => `
    <div class="total-row">
      <span>${escapeHtml(r.concept)}:</span>
      <span>Bs ${Number(r.amount).toFixed(2)}</span>
    </div>
    `).join('')}
    <div class="total-row main-total">
      <span>TOTAL COMPRA:</span>
      <span>Bs ${Number(total).toFixed(2)}</span>
    </div>
    ` : `
    <div class="total-row">
      <span>Subtotal:</span>
      <span>Bs ${Number(total).toFixed(2)}</span>
    </div>
    <div class="total-row">
      <span>Descuento:</span>
      <span>Bs 0.00</span>
    </div>
    <div class="total-row">
      <span>Pago con:</span>
      <span class="bold">${payLabel}</span>
    </div>
    <div class="total-row main-total">
      <span>TOTAL A PAGAR:</span>
      <span>Bs ${Number(total).toFixed(2)}</span>
    </div>
    `}
    ${!isPurchase && montoRecibido !== undefined && montoRecibido !== null ? `
    <div class="total-row" style="margin-top: 1.5mm;">
      <span>Efectivo Recibido:</span>
      <span>Bs ${Number(montoRecibido).toFixed(2)}</span>
    </div>
    <div class="total-row">
      <span>Cambio / Vuelto:</span>
      <span class="bold">Bs ${Number(cambio).toFixed(2)}</span>
    </div>
    ` : ''}
  </div>

  <div class="footer">
    <p class="thanks">${isPurchase ? 'Compra registrada' : '¡Gracias por su compra!'}</p>
    <p>Desarrollado por Mi Ganancia</p>
  </div>
${AUTO_PRINT_SCRIPT}
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// FORMATO 2 — RECIBO EN HOJA (carta / A4), estilo Mi Ganancia
// ─────────────────────────────────────────────────────────────────────────────
const MIN_TABLE_ROWS = 8;

function buildSheetHtml(ctx) {
  const {
    business, settings, isPurchase, items, total, receiptNum, day, month, year, time,
    clientName, clientNit, sellerName, supplier, payLabel, isFiado,
    montoRecibido, cambio, cleanExtraRows,
  } = ctx;

  const totalNum = Number(total) || 0;
  const aCuenta = isFiado ? 0 : totalNum;
  const saldo = isFiado ? totalNum : 0;

  // Filas vacías para que la tabla mantenga altura, como un talonario impreso
  const fillerCount = Math.max(0, MIN_TABLE_ROWS - items.length);

  const itemRows = items.map((item) => `
    <tr>
      <td class="c-detalle">
        <span class="i-nombre">${escapeHtml(item.productName)}</span>
        ${item.productBrand ? `<span class="i-marca">${escapeHtml(item.productBrand)}</span>` : ''}
      </td>
      <td class="c-centro">${escapeHtml(item.quantity)}</td>
      <td class="c-der">${Number(item.price).toFixed(2)}</td>
      <td class="c-der c-fuerte">${Number(item.subtotal).toFixed(2)}</td>
    </tr>`).join('');

  const extraRows = isPurchase ? cleanExtraRows.map((r) => `
    <tr>
      <td class="c-detalle"><span class="i-nombre">${escapeHtml(r.concept)}</span></td>
      <td class="c-centro">—</td>
      <td class="c-der">—</td>
      <td class="c-der c-fuerte">${Number(r.amount).toFixed(2)}</td>
    </tr>`).join('') : '';

  const fillerRows = Array.from({ length: fillerCount }).map(() => `
    <tr class="vacia"><td>&nbsp;</td><td></td><td></td><td></td></tr>`).join('');

  const ubicacion = settings?.address ? escapeHtml(settings.address) : '';
  const telefono = settings?.phone ? escapeHtml(settings.phone) : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>${isPurchase ? 'Comprobante de Compra' : 'Recibo'} N° ${receiptNum}</title>
  <style>
    @page { size: A4 portrait; margin: 11mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }

    :root {
      --azul: #1670C2;
      --azul-hondo: #0c3457;
      --azul-suave: #eef5fc;
      --oro: #b8801f;
      --oro-suave: #fdf4e3;
      --verde: #15803d;
      --verde-suave: #ecfdf3;
      --rojo: #b91c1c;
      --rojo-suave: #fef2f2;
      --texto: #0f172a;
      --tenue: #475569;
      --linea: #cbd5e1;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, system-ui, sans-serif;
      color: var(--texto);
      background: #fff;
      font-size: 13px;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
    }

    .hoja { max-width: 190mm; margin: 0 auto; }

    /* ── CABECERA: marca · RECIBO centrado · N° ── */
    .cabecera {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: center;
      gap: 14px;
      padding-bottom: 14px;
    }
    .marca { display: flex; align-items: center; gap: 12px; min-width: 0; }
    .logo {
      width: 60px; height: 60px; object-fit: contain; border-radius: 14px;
      border: 2px solid var(--azul-suave); padding: 4px; flex-shrink: 0;
    }
    .logo-vacio {
      width: 60px; height: 60px; border-radius: 14px; flex-shrink: 0;
      background: var(--azul); color: #fff; display: flex; align-items: center;
      justify-content: center; font-size: 26px; font-weight: 800;
    }
    .negocio { font-size: 20px; font-weight: 800; letter-spacing: -0.3px; color: var(--azul-hondo); line-height: 1.2; }
    .slogan { font-size: 12px; color: var(--tenue); font-style: italic; }

    .titulo-doc {
      font-size: 34px; font-weight: 800; letter-spacing: 6px;
      color: var(--azul); text-transform: uppercase; line-height: 1;
      text-align: center; white-space: nowrap;
    }
    .titulo-sub {
      text-align: center; font-size: 10px; font-weight: 700; color: var(--oro);
      letter-spacing: 2.5px; text-transform: uppercase; margin-top: 5px;
    }

    .caja-numero {
      justify-self: end;
      border: 2px solid var(--azul); border-radius: 14px;
      background: var(--azul-suave); padding: 9px 18px; text-align: center;
    }
    .caja-numero .rot { font-size: 9.5px; font-weight: 800; color: var(--azul); text-transform: uppercase; letter-spacing: 1.5px; }
    .caja-numero .val { font-size: 20px; font-weight: 800; color: var(--azul-hondo); letter-spacing: 1px; font-variant-numeric: tabular-nums; }

    .barra-marca { height: 4px; border-radius: 4px; background: linear-gradient(90deg, var(--azul) 0%, var(--azul) 62%, var(--oro) 62%, var(--oro) 100%); }

    /* ── DATOS DE LA OPERACIÓN ── */
    .bloque-datos { display: flex; gap: 14px; margin-top: 16px; align-items: stretch; }
    .datos { flex: 1; min-width: 0; }

    .linea-dato { display: flex; align-items: baseline; gap: 9px; margin-bottom: 10px; }
    .linea-dato .rotulo { font-size: 12px; font-weight: 800; color: var(--azul); white-space: nowrap; }
    .linea-dato .relleno {
      flex: 1; border-bottom: 1.5px solid var(--linea); padding: 0 5px 3px;
      font-size: 14px; font-weight: 700; color: var(--texto); min-height: 20px;
    }

    .fecha { display: flex; border: 2px solid var(--azul-suave); border-radius: 14px; overflow: hidden; flex-shrink: 0; align-self: flex-start; }
    .fecha div { text-align: center; padding: 7px 16px; border-right: 1px solid var(--azul-suave); }
    .fecha div:last-child { border-right: none; }
    .fecha .f-tit { font-size: 9px; font-weight: 800; color: var(--azul); text-transform: uppercase; letter-spacing: 1.2px; }
    .fecha .f-val { font-size: 19px; font-weight: 800; color: var(--azul-hondo); line-height: 1.2; }

    /* ── LA SUMA DE ── */
    .suma {
      margin-top: 4px; background: var(--oro-suave); border: 2px solid #f0d9a8;
      border-radius: 14px; padding: 10px 15px; display: flex; align-items: baseline; gap: 10px;
    }
    .suma .rotulo { font-size: 11.5px; font-weight: 800; color: var(--oro); text-transform: uppercase; letter-spacing: 1px; white-space: nowrap; }
    .suma .valor { font-size: 14.5px; font-weight: 700; color: var(--texto); }

    /* ── TABLA ── */
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    thead th {
      background: var(--azul); color: #fff; font-size: 11px; font-weight: 800;
      text-transform: uppercase; letter-spacing: 1.4px; padding: 10px 12px;
      border: 1px solid var(--azul);
    }
    thead th:first-child { text-align: left; }
    thead th:last-child { background: var(--azul-hondo); border-color: var(--azul-hondo); }
    tbody td { border: 1px solid var(--linea); padding: 8px 12px; font-size: 13px; height: 30px; }
    tbody tr:nth-child(even) td { background: var(--azul-suave); }
    tbody tr.vacia td { height: 30px; }
    .c-centro { text-align: center; font-weight: 700; font-variant-numeric: tabular-nums; }
    .c-der { text-align: right; font-variant-numeric: tabular-nums; }
    .c-fuerte { font-weight: 800; color: var(--azul-hondo); }
    .i-nombre { font-weight: 700; }
    .i-marca { display: block; font-size: 10.5px; color: var(--tenue); text-transform: uppercase; letter-spacing: 0.6px; font-weight: 600; }

    /* ── CIERRE DE CUENTAS ── */
    .cierre { display: flex; gap: 12px; margin-top: 16px; align-items: stretch; }
    .caja {
      flex: 1; border: 2px solid var(--linea); border-radius: 14px;
      padding: 10px 15px; display: flex; align-items: center; justify-content: space-between; gap: 10px;
    }
    .caja .rot { font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: var(--tenue); }
    .caja .val { font-size: 16px; font-weight: 800; font-variant-numeric: tabular-nums; }
    .caja-verde { border-color: #bbf7d0; background: var(--verde-suave); }
    .caja-verde .rot, .caja-verde .val { color: var(--verde); }
    .caja-roja { border-color: #fecaca; background: var(--rojo-suave); }
    .caja-roja .rot, .caja-roja .val { color: var(--rojo); }
    .caja-total {
      flex: 1.3; border: none; border-radius: 14px; background: var(--azul);
      padding: 12px 18px; display: flex; align-items: center; justify-content: space-between; gap: 10px;
    }
    .caja-total .rot { font-size: 12px; font-weight: 800; color: #fff; text-transform: uppercase; letter-spacing: 1.8px; }
    .caja-total .val { font-size: 24px; font-weight: 800; color: #fff; letter-spacing: -0.5px; font-variant-numeric: tabular-nums; }

    /* ── FORMA DE PAGO ── */
    .pago { margin-top: 12px; display: flex; flex-wrap: wrap; gap: 8px; }
    .chip {
      font-size: 11.5px; font-weight: 700; color: var(--tenue);
      background: #f1f5f9; border: 1px solid var(--linea); border-radius: 999px; padding: 4px 12px;
    }
    .chip strong { color: var(--texto); font-weight: 800; }
    .chip-azul { background: var(--azul-suave); border-color: #bfdbfe; color: var(--azul-hondo); }

    /* ── FIRMAS ── */
    .firmas { display: flex; gap: 56px; margin-top: 38px; }
    .firma { flex: 1; text-align: center; }
    .firma .linea { border-top: 2px solid var(--texto); margin-bottom: 6px; }
    .firma .rot { font-size: 10.5px; font-weight: 800; color: var(--tenue); text-transform: uppercase; letter-spacing: 1.4px; }

    /* ── PIE ── */
    .pie {
      margin-top: 26px; border-top: 2px solid var(--azul-suave); padding-top: 14px;
      display: flex; justify-content: space-between; align-items: center; gap: 16px;
    }
    .contactos { display: flex; flex-wrap: wrap; gap: 8px; }
    .contacto {
      display: inline-flex; align-items: center; gap: 6px;
      font-size: 12px; font-weight: 700; color: var(--azul-hondo);
      background: var(--azul-suave); border: 1px solid #bfdbfe;
      border-radius: 999px; padding: 5px 13px;
    }
    .contacto .ico { color: var(--oro); font-weight: 800; }
    .gracias { font-size: 15px; font-weight: 800; color: var(--oro); font-style: italic; white-space: nowrap; }
    .sello { text-align: center; font-size: 10.5px; color: var(--tenue); margin-top: 12px; font-weight: 600; }

    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="hoja">

    <!-- CABECERA -->
    <div class="cabecera">
      <div class="marca">
        ${settings?.logoData
          ? `<img class="logo" src="${settings.logoData}" alt="Logo"/>`
          : `<div class="logo-vacio">${escapeHtml((business?.name || 'M').charAt(0).toUpperCase())}</div>`}
        <div>
          <div class="negocio">${escapeHtml(business?.name || 'Mi Negocio')}</div>
          ${settings?.slogan ? `<div class="slogan">"${escapeHtml(settings.slogan)}"</div>` : ''}
        </div>
      </div>

      <div>
        <div class="titulo-doc">${isPurchase ? 'Compra' : 'Recibo'}</div>
        <div class="titulo-sub">${day}/${month}/${year} · ${time}</div>
      </div>

      <div class="caja-numero">
        <div class="rot">N° de recibo</div>
        <div class="val">${receiptNum}</div>
      </div>
    </div>

    <div class="barra-marca"></div>

    <!-- DATOS -->
    <div class="bloque-datos">
      <div class="datos">
        <div class="linea-dato">
          <span class="rotulo">${isPurchase ? 'Pagado a:' : 'Recibí de:'}</span>
          <span class="relleno">${escapeHtml(isPurchase ? (supplier || 'Sin proveedor') : (clientName || 'S/N'))}</span>
        </div>
        <div class="linea-dato">
          <span class="rotulo">${isPurchase ? 'Registró:' : 'CI / NIT:'}</span>
          <span class="relleno">${escapeHtml(isPurchase ? (sellerName || '—') : (clientNit || '—'))}</span>
        </div>
      </div>

      <div class="fecha">
        <div><div class="f-tit">Día</div><div class="f-val">${day}</div></div>
        <div><div class="f-tit">Mes</div><div class="f-val">${month}</div></div>
        <div><div class="f-tit">Año</div><div class="f-val">${String(year).slice(-2)}</div></div>
      </div>
    </div>

    <div class="suma">
      <span class="rotulo">La suma de:</span>
      <span class="valor">${escapeHtml(amountToWords(totalNum))}</span>
    </div>

    <!-- DETALLE -->
    <table>
      <thead>
        <tr>
          <th>Detalle</th>
          <th style="width:95px;">Cantidad</th>
          <th style="width:115px;">P. Unitario</th>
          <th style="width:115px;">Importe</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
        ${extraRows}
        ${fillerRows}
      </tbody>
    </table>

    <!-- CIERRE -->
    <div class="cierre">
      <div class="caja ${aCuenta > 0 ? 'caja-verde' : ''}">
        <span class="rot">A Cuenta</span>
        <span class="val">${aCuenta.toFixed(2)}</span>
      </div>
      <div class="caja ${saldo > 0 ? 'caja-roja' : ''}">
        <span class="rot">Saldo</span>
        <span class="val">${saldo.toFixed(2)}</span>
      </div>
      <div class="caja-total">
        <span class="rot">Total</span>
        <span class="val">Bs ${totalNum.toFixed(2)}</span>
      </div>
    </div>

    <!-- FORMA DE PAGO -->
    <div class="pago">
      <span class="chip chip-azul">Pago: <strong>${escapeHtml(payLabel.replace(/[^\p{L}\s/]/gu, '').trim())}</strong></span>
      ${!isPurchase && montoRecibido !== undefined && montoRecibido !== null
        ? `<span class="chip">Recibido: <strong>Bs ${Number(montoRecibido).toFixed(2)}</strong></span>
           <span class="chip">Cambio: <strong>Bs ${Number(cambio).toFixed(2)}</strong></span>`
        : ''}
      <span class="chip">${isPurchase ? 'Registrado por' : 'Atendido por'}: <strong>${escapeHtml(sellerName || '—')}</strong></span>
    </div>

    <!-- FIRMAS -->
    <div class="firmas">
      <div class="firma">
        <div class="linea"></div>
        <div class="rot">Entregué conforme</div>
      </div>
      <div class="firma">
        <div class="linea"></div>
        <div class="rot">Recibí conforme</div>
      </div>
    </div>

    <!-- PIE -->
    <div class="pie">
      <div class="contactos">
        ${ubicacion ? `<span class="contacto"><span class="ico">📍</span>${ubicacion}</span>` : ''}
        ${telefono ? `<span class="contacto"><span class="ico">💬</span>${telefono}</span>` : ''}
      </div>
      <span class="gracias">${isPurchase ? '¡Compra registrada!' : '¡Gracias por su compra!'}</span>
    </div>
    <div class="sello">${escapeHtml(business?.name || 'Mi Negocio')} · Documento generado con Mi Ganancia</div>

  </div>
${AUTO_PRINT_SCRIPT}
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
export function printReceipt({
  business,
  settings,
  type = 'sale',
  format,
  saleId,
  items,
  total,
  date,
  clientName,
  clientNit,
  sellerName,
  paymentMethod,
  montoRecibido,
  cambio,
  supplier,
  extraCostRows,
}) {
  const isPurchase = type === 'purchase';
  const d = date instanceof Date ? date : new Date();

  const pad = (n) => String(n).padStart(2, '0');
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = d.getFullYear();
  const time = d.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });

  // Basado en el id real de la venta/compra (no en la hora de impresión) —
  // así reimprimir el mismo recibo siempre muestra el mismo número, y no
  // puede colisionar con otro registro como pasaba con Date.now().
  const receiptNum = saleId
    ? saleId.replace(/-/g, '').slice(-8).toUpperCase()
    : String(d.getTime()).slice(-6);

  const payLabels = { qr: '📲 QR / Transferencia', mixto: '🔀 Mixto', cash: '💵 Efectivo' };
  const payLabel = payLabels[paymentMethod] || '💵 Efectivo';

  const cleanExtraRows = Array.isArray(extraCostRows) ? extraCostRows.filter((r) => Number(r.amount) > 0) : [];
  const extraTotal = cleanExtraRows.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const productsSubtotal = Number(total) - extraTotal;

  const ctx = {
    business, settings, isPurchase, items, total, receiptNum,
    day, month, year, time, clientName, clientNit, sellerName, supplier,
    payLabel, isFiado: paymentMethod === 'fiado',
    montoRecibido, cambio, cleanExtraRows, productsSubtotal,
  };

  const chosen = format || getReceiptFormat();
  const isSheet = chosen === RECEIPT_FORMATS.SHEET;

  const html = isSheet ? buildSheetHtml(ctx) : buildThermalHtml(ctx);
  const winFeatures = isSheet ? 'width=860,height=900' : 'width=380,height=600';

  const win = window.open('', '_blank', winFeatures);
  if (win) {
    win.document.write(html);
    win.document.close();
  } else {
    alert('Activa las ventanas emergentes para imprimir el recibo.');
  }
}
