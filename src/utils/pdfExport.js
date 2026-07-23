function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function alignClass(align) {
  return align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : '';
}

// Genera un reporte limpio en una ventana nueva y dispara el diálogo de impresión
// (el usuario elige "Guardar como PDF"). Sin dependencias externas.
export function exportReportToPDF({
  businessName = 'Mi Negocio',
  title,
  subtitle,
  periodLabel,
  columns,
  rows,
  totals,
  summary,
  orientation,
}) {
  const finalOrientation = orientation || (columns.length > 6 ? 'landscape' : 'portrait');

  const theadHtml = columns.map((c) => `<th class="${alignClass(c.align)}">${escapeHtml(c.label)}</th>`).join('');

  const rowsHtml = rows.length > 0
    ? rows.map((row) => `<tr>${row.map((cell, i) => `<td class="${alignClass(columns[i]?.align)}">${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')
    : `<tr><td colspan="${columns.length}" class="empty-row">Sin datos en el periodo seleccionado.</td></tr>`;

  let totalsHtml = '';
  if (totals && totals.values && Object.keys(totals.values).length > 0) {
    const idxs = Object.keys(totals.values).map(Number).sort((a, b) => a - b);
    const firstIdx = idxs[0];
    const cells = [];
    if (firstIdx > 0) {
      cells.push(`<td colspan="${firstIdx}" class="totals-label">${escapeHtml(totals.label || 'Total del período')}</td>`);
    }
    for (let i = firstIdx; i < columns.length; i++) {
      if (totals.values[i] !== undefined) {
        cells.push(`<td class="font-bold ${alignClass(columns[i].align)}">${escapeHtml(totals.values[i])}</td>`);
      } else {
        cells.push('<td></td>');
      }
    }
    totalsHtml = `<tfoot><tr class="totals-tr">${cells.join('')}</tr></tfoot>`;
  }

  const summaryHtml = summary ? `
    <div class="totals-box">
      <div class="totals-title">Resumen del Periodo</div>
      ${summary.map((s) => `
        <div class="totals-row${s.emphasis ? ' grand-total' : ''}">
          <span>${escapeHtml(s.label)}</span>
          <span class="font-bold${s.negative ? ' text-red' : ''}">${escapeHtml(s.value)}</span>
        </div>`).join('')}
    </div>
  ` : '';

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: A4 ${finalOrientation}; margin: 12mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      color: #333;
      background: #fff;
      font-size: 11px;
      line-height: 1.5;
    }
    .header-container {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #1670C2;
      padding-bottom: 5mm;
      margin-bottom: 6mm;
    }
    .business-info h1 {
      font-size: 20px;
      font-weight: 800;
      color: #1670C2;
      text-transform: uppercase;
      margin-bottom: 1mm;
    }
    .business-info p { font-size: 10px; color: #666; font-weight: 500; }
    .brand-logo { text-align: right; }
    .brand-logo .logo-text { font-size: 15px; font-weight: 900; color: #1670C2; }
    .brand-logo .logo-sub {
      font-size: 8px; color: #999; text-transform: uppercase;
      letter-spacing: 1px; margin-top: 0.5mm;
    }
    .report-title { font-size: 15px; font-weight: 800; color: #333; margin-bottom: 1.5mm; }
    .report-subtitle { font-size: 10px; color: #888; font-weight: 500; margin-bottom: 2mm; }
    .report-dates { font-size: 10px; color: #666; font-weight: 600; margin-bottom: 6mm; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8mm; font-size: 10px; }
    th {
      background-color: #f0f7ff; color: #1670C2; font-weight: 700;
      padding: 2.5mm 2mm; border: 1px solid #d0e3f7; text-align: left; white-space: nowrap;
    }
    td { padding: 2mm; border: 1px solid #e2e8f0; color: #4a5568; }
    tr:nth-child(even) { background-color: #f8fafc; }
    .empty-row { text-align: center; color: #999; padding: 8mm; font-style: italic; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .font-bold { font-weight: bold; }
    .text-green { color: #16a34a; }
    .text-red { color: #dc2626; }
    .totals-tr td {
      background-color: #eaf3fd;
      border-top: 2px solid #1670C2;
      color: #1670C2;
      font-weight: 800;
    }
    .totals-label {
      text-align: right;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-size: 9px;
      color: #5a7fa0 !important;
    }
    .totals-box {
      background-color: #f8fafc;
      border: 1.5px solid #e2e8f0;
      border-radius: 4mm;
      padding: 5mm;
      width: 60%;
      margin-left: auto;
      page-break-inside: avoid;
    }
    .totals-title {
      font-size: 11px; font-weight: 800; color: #1670C2;
      border-bottom: 1.5px solid #cbd5e1; padding-bottom: 1.5mm;
      margin-bottom: 3mm; text-transform: uppercase;
    }
    .totals-row { display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 1.5mm; color: #4a5568; }
    .totals-row.grand-total {
      font-size: 12px; font-weight: 900; color: #1670C2;
      border-top: 1.5px dashed #cbd5e1; padding-top: 2mm; margin-top: 2mm;
    }
  </style>
</head>
<body>
  <div class="header-container">
    <div class="business-info">
      <h1>${escapeHtml(businessName)}</h1>
      <p>Reporte Oficial de Operaciones</p>
    </div>
    <div class="brand-logo">
      <span class="logo-text">📈 Mi Ganancia</span>
      <div class="logo-sub">Tu Aliado Comercial</div>
    </div>
  </div>

  <h2 class="report-title">${escapeHtml(title)}</h2>
  ${subtitle ? `<div class="report-subtitle">${escapeHtml(subtitle)}</div>` : ''}
  ${periodLabel ? `<div class="report-dates">${escapeHtml(periodLabel)}</div>` : ''}

  <table>
    <thead><tr>${theadHtml}</tr></thead>
    <tbody>${rowsHtml}</tbody>
    ${totalsHtml}
  </table>

  ${summaryHtml}

  <script>
    window.onload = function() {
      window.print();
      setTimeout(function() { window.close(); }, 500);
    };
  </script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=900,height=700');
  if (win) {
    win.document.write(html);
    win.document.close();
  } else {
    alert('Activa las ventanas emergentes para exportar el reporte.');
  }
}
