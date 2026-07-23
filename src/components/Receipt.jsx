function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

export function printReceipt({
  business,
  settings,
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
}) {
  const d = date instanceof Date ? date : new Date();

  const pad = (n) => String(n).padStart(2, '0');
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = d.getFullYear();
  const time = d.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });

  // Basado en el id real de la venta (no en la hora de impresión) — así
  // reimprimir el mismo recibo siempre muestra el mismo número, y no puede
  // colisionar con otra venta como pasaba con un número basado en Date.now().
  const receiptNum = saleId
    ? saleId.replace(/-/g, '').slice(-8).toUpperCase()
    : String(d.getTime()).slice(-6);
  const payLabels = { qr: '📲 QR / Transferencia', mixto: '🔀 Mixto', fiado: '⏳ Fiado (CxC)', cash: '💵 Efectivo' };
  const payLabel = payLabels[paymentMethod] || '💵 Efectivo';

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Recibo N° ${receiptNum}</title>
  <style>
    @page {
      size: 80mm auto;
      margin: 0;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', Courier, monospace, Arial, sans-serif;
      font-size: 11px;
      line-height: 1.3;
      color: #000;
      background: #fff;
      padding: 4mm 3mm;
      width: 74mm;
      max-width: 74mm;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .bold { font-weight: bold; }
    .header {
      margin-bottom: 4mm;
      text-align: center;
    }
    .biz-name {
      font-size: 14px;
      font-weight: bold;
      text-transform: uppercase;
      margin-bottom: 1.5mm;
    }
    .sub-info {
      font-size: 10px;
    }
    .separator {
      border-top: 1px dashed #000;
      margin: 3mm 0;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 0.8mm;
      font-size: 10.5px;
    }
    .info-val {
      font-weight: bold;
    }
    .table-header {
      display: flex;
      font-weight: bold;
      margin-bottom: 1.5mm;
      font-size: 10.5px;
      border-bottom: 1px dashed #000;
      padding-bottom: 1mm;
    }
    .table-row {
      display: flex;
      margin-bottom: 1.5mm;
      font-size: 10.5px;
    }
    .col-qty { width: 12%; text-align: left; }
    .col-desc { width: 50%; text-align: left; word-break: break-word; }
    .col-price { width: 18%; text-align: right; }
    .col-subtotal { width: 20%; text-align: right; font-weight: bold; }
    
    .totals {
      margin-top: 2mm;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 0.8mm;
      font-size: 10.5px;
    }
    .main-total {
      font-size: 13px;
      font-weight: bold;
      border-top: 1px dashed #000;
      padding-top: 2mm;
      margin-top: 1.5mm;
    }
    .footer {
      margin-top: 5mm;
      text-align: center;
      font-size: 10px;
    }
    .thanks {
      font-weight: bold;
      text-transform: uppercase;
      margin-bottom: 1mm;
    }
    
    @media print {
      body {
        width: 74mm;
        margin: 0;
        padding: 2mm 1mm;
      }
    }
  </style>
</head>
<body>
  <!-- HEADER -->
  <div class="header">
    <p class="biz-name">${escapeHtml(business?.name || 'MI NEGOCIO')}</p>
    ${settings?.slogan ? `<p class="sub-info italic">"${escapeHtml(settings.slogan)}"</p>` : ''}
    ${settings?.phone ? `<p class="sub-info">Tel/WhatsApp: ${escapeHtml(settings.phone)}</p>` : ''}
    ${settings?.address ? `<p class="sub-info">${escapeHtml(settings.address)}</p>` : ''}
  </div>

  <div class="separator"></div>

  <!-- META INFO -->
  <div class="info-row">
    <span>Nº Venta:</span>
    <span class="info-val">${receiptNum}</span>
  </div>
  <div class="info-row">
    <span>Fecha:</span>
    <span class="info-val">${day}/${month}/${year} ${time}</span>
  </div>
  <div class="info-row">
    <span>Cajero:</span>
    <span class="info-val">${escapeHtml(sellerName || '—')}</span>
  </div>

  <div class="separator"></div>

  <!-- CLIENT INFO -->
  <div class="info-row">
    <span>Cliente:</span>
    <span class="info-val">${escapeHtml(clientName || 'S/N')}</span>
  </div>
  <div class="info-row">
    <span>CI / NIT:</span>
    <span class="info-val">${escapeHtml(clientNit || '0')}</span>
  </div>

  <div class="separator"></div>

  <!-- ITEMS TABLE -->
  <div class="table-header">
    <span class="col-qty">Cant</span>
    <span class="col-desc">Producto</span>
    <span class="col-price">P.U.</span>
    <span class="col-subtotal">Subt</span>
  </div>

  ${items
    .map(
      (item) => `
    <div class="table-row">
      <span class="col-qty">${escapeHtml(item.quantity)}</span>
      <span class="col-desc">
        ${escapeHtml(item.productName)}
        ${item.productBrand ? `<br/><span style="font-size:9.5px;color:#333;">${escapeHtml(item.productBrand)}</span>` : ''}
      </span>
      <span class="col-price">${Number(item.price).toFixed(2)}</span>
      <span class="col-subtotal">${Number(item.subtotal).toFixed(2)}</span>
    </div>
  `
    )
    .join('')}

  <div class="separator"></div>

  <!-- TOTALS -->
  <div class="totals">
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
    ${montoRecibido !== undefined && montoRecibido !== null ? `
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

  <!-- FOOTER -->
  <div class="footer">
    <p class="thanks">¡Gracias por su compra!</p>
    <p>Desarrollado por Mi Ganancia</p>
  </div>

  <script>
    window.onload = function() {
      window.print();
      setTimeout(function() { window.close(); }, 500);
    };
  </script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=380,height=600');
  if (win) {
    win.document.write(html);
    win.document.close();
  } else {
    alert('Activa las ventanas emergentes para imprimir el recibo.');
  }
}
