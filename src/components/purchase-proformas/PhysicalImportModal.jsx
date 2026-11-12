import { useMemo, useRef, useState } from 'react';
import { AppIcon } from '../icons';
import { createProformaItemFromProduct } from './proformaUi';

function normalize(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function detectDelimiter(line) {
  const candidates = ['\t', ';', '|', ','];
  let best = ';';
  let bestCount = 1;
  candidates.forEach((candidate) => {
    const count = line.split(candidate).length;
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  });
  return best;
}

function splitLine(line, delimiter) {
  return line.split(delimiter).map((cell) => String(cell || '').trim().replace(/^"(.*)"$/, '$1'));
}

function isHeaderRow(cells) {
  const keys = cells.map(normalize);
  return keys.some((cell) => (
    cell.includes('codigo')
    || cell.includes('code')
    || cell === 'producto'
    || cell.includes('descripcion')
    || cell.includes('cantidad')
    || cell.includes('precio')
    || cell.includes('vencimiento')
  ));
}

function headerIndexes(cells) {
  const indexes = {};
  cells.map(normalize).forEach((cell, index) => {
    if (indexes.code === undefined && (cell.includes('codigo') || cell.includes('code') || cell.includes('barra'))) indexes.code = index;
    if (indexes.name === undefined && (cell.includes('producto') || cell.includes('descrip') || cell.includes('nombre'))) indexes.name = index;
    if (indexes.qty === undefined && (cell.includes('cantidad') || cell.includes('paquete') || cell.includes('caja') || cell === 'cant')) indexes.qty = index;
    if (indexes.price === undefined && (cell.includes('precio') || cell.includes('costo') || cell.includes('compra'))) indexes.price = index;
    if (indexes.expiry === undefined && (cell.includes('vencimiento') || cell.includes('vence') || cell.includes('fecha'))) indexes.expiry = index;
    if (indexes.factor === undefined && (cell.includes('unidad') || cell.includes('factor') || cell === 'und')) indexes.factor = index;
  });
  return indexes;
}

function rowFromCells(cells, indexes) {
  if (indexes) {
    return {
      code: indexes.code !== undefined ? cells[indexes.code] : '',
      name: indexes.name !== undefined ? cells[indexes.name] : '',
      qty: indexes.qty !== undefined ? cells[indexes.qty] : '',
      price: indexes.price !== undefined ? cells[indexes.price] : '',
      expiry: indexes.expiry !== undefined ? cells[indexes.expiry] : '',
      factor: indexes.factor !== undefined ? cells[indexes.factor] : '',
    };
  }
  if (cells.length <= 3) {
    return { code: cells[0], name: '', qty: cells[1], price: cells[2], expiry: '', factor: '' };
  }
  return {
    code: cells[0],
    name: cells[1],
    qty: cells[2],
    price: cells[3],
    expiry: cells[4] || '',
    factor: cells[5] || '',
  };
}

function parseDate(value) {
  const raw = String(value || '').trim();
  if (!raw || /^(s\/?v|sin\s*venc|n\/?a|-|—)$/i.test(raw)) {
    return { noExpiry: true, expiryDate: '' };
  }
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(raw);
  if (match) {
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    if (!Number.isNaN(date.getTime())) {
      return {
        noExpiry: false,
        expiryDate: `${match[1]}-${String(match[2]).padStart(2, '0')}-${String(match[3]).padStart(2, '0')}`,
      };
    }
  }
  match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(raw);
  if (match) {
    const year = Number(match[3].length === 2 ? `20${match[3]}` : match[3]);
    const date = new Date(year, Number(match[2]) - 1, Number(match[1]));
    if (!Number.isNaN(date.getTime())) {
      return {
        noExpiry: false,
        expiryDate: `${year}-${String(match[2]).padStart(2, '0')}-${String(match[1]).padStart(2, '0')}`,
      };
    }
  }
  return { error: `fecha de vencimiento inválida (${raw})` };
}

function parseNumber(value) {
  const text = String(value || '').trim().replace(',', '.');
  if (!text) return null;
  const number = Number(text);
  if (!Number.isFinite(number)) return null;
  return number;
}

export default function PhysicalImportModal({ products = [], onClose, onImport }) {
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');
  const [errors, setErrors] = useState([]);
  const [preview, setPreview] = useState(null);
  const fileRef = useRef(null);

  const productByCode = useMemo(() => {
    const map = new Map();
    products.forEach((product) => {
      const code = normalize(product.barcode);
      if (code) map.set(code, product);
    });
    return map;
  }, [products]);

  const productByName = useMemo(() => {
    const map = new Map();
    products.forEach((product) => {
      map.set(normalize(product.name), product);
    });
    return map;
  }, [products]);

  function buildImport() {
    const lines = String(text || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      setPreview(null);
      setErrors(['Pegá las líneas de la proforma física o subí un archivo CSV/TXT.']);
      return;
    }

    const delimiter = detectDelimiter(lines[0]);
    const firstCells = splitLine(lines[0], delimiter);
    const withHeader = isHeaderRow(firstCells);
    const indexes = withHeader ? headerIndexes(firstCells) : null;
    const dataLines = withHeader ? lines.slice(1) : lines;
    const imported = [];
    const nextErrors = [];

    dataLines.forEach((line, index) => {
      const lineNumber = index + (withHeader ? 2 : 1);
      const cells = splitLine(line, delimiter);
      const row = rowFromCells(cells, indexes);
      const code = String(row.code || '').trim();
      const name = String(row.name || '').trim();
      const product = (code ? productByCode.get(normalize(code)) : null) || (name ? productByName.get(normalize(name)) : null);
      if (!product) {
        nextErrors.push(`Línea ${lineNumber}: no encontramos ${name || code || 'el producto'}.`);
        return;
      }

      const qty = parseNumber(row.qty);
      if (!(qty > 0)) {
        nextErrors.push(`Línea ${lineNumber}: la cantidad de paquetes/cajas debe ser mayor a 0.`);
        return;
      }
      const price = parseNumber(row.price);
      if (!(price > 0)) {
        nextErrors.push(`Línea ${lineNumber}: el precio de compra por caja debe ser mayor a 0.`);
        return;
      }

      const date = parseDate(row.expiry);
      if (date.error) {
        nextErrors.push(`Línea ${lineNumber}: ${date.error}.`);
        return;
      }

      const parsedFactor = parseNumber(row.factor);
      const item = createProformaItemFromProduct(product);
      const factor = parsedFactor && parsedFactor >= 1 ? Math.round(parsedFactor) : item.factor;
      const presentation = Array.isArray(product.presentations)
        ? product.presentations.find((presentationRow) => Number(presentationRow.factor) === factor)
        : null;
      imported.push({
        ...item,
        factor,
        packageFactor: factor,
        presentationName: presentation?.name || (factor > 1 ? 'Caja' : 'Unidad'),
        packageQty: String(qty),
        packagePrice: String(price),
        expiryDate: date.expiryDate,
        noExpiry: date.noExpiry,
      });
    });

    setErrors(nextErrors);
    setPreview({
      count: imported.length,
      lines: dataLines.length,
      items: imported,
    });
  }

  function handleImport() {
    if (!preview || preview.count === 0 || errors.length > 0) return;
    onImport(preview.items);
  }

  async function handleFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const content = await file.text();
      setText(content);
      setFileName(file.name);
      setPreview(null);
      setErrors([]);
    } catch (err) {
      console.error(err);
      setErrors(['No pudimos leer el archivo. Probá pegando el contenido manualmente.']);
    } finally {
      event.target.value = '';
    }
  }

  return (
    <div
      className="fixed inset-0 z-[95] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Importar proforma física"
        className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-[var(--mg-bg-surface)] shadow-2xl mg-slide-up sm:rounded-3xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center gap-3 border-b border-[var(--mg-separator)] px-4 py-3.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--mg-brand)] text-[var(--mg-brand-contrast)]">
            <AppIcon name="carpeta" size={19} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-black tracking-tight text-[var(--mg-brand-text)]">Importar física</h2>
            <p className="text-[11px] font-semibold text-[var(--mg-text-muted)]">
              Pegá el detalle o subí un CSV/TXT. Buscamos cada producto por código o nombre.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)]"
          >
            <AppIcon name="cerrar" size={15} />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          <div className="rounded-xl border border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] p-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-[var(--mg-text-muted)]">Formato sugerido</p>
            <pre className="mt-1 overflow-x-auto whitespace-pre-wrap font-mono text-[10px] font-semibold leading-relaxed text-[var(--mg-text-secondary)]">
{`Código;Producto;Cantidad;Precio caja;Vencimiento;Und. por caja
123456;Ron 750 ml;2;240;2027-01-31;12
789012;;1.5;90;S/V;6`}
            </pre>
            <p className="mt-1 text-[10px] font-semibold text-[var(--mg-text-muted)]">
              El producto es opcional si el código existe. Vencimiento vacío o S/V = sin vencimiento.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              onChange={handleFile}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="mg-btn-secondary inline-flex min-h-[36px] items-center gap-1.5 px-3 text-[11px]"
            >
              <AppIcon name="respaldo" size={14} />
              Subir archivo
            </button>
            {fileName && <span className="truncate text-[10px] font-bold text-[var(--mg-text-muted)]">{fileName}</span>}
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">
              Pegar detalle
            </label>
            <textarea
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                setPreview(null);
                setErrors([]);
              }}
              rows={7}
              placeholder="Código;Cantidad;Precio caja;Vencimiento"
              className="mg-input resize-y font-mono text-[11px] font-semibold"
            />
          </div>

          {errors.length > 0 && (
            <div className="rounded-xl border border-[var(--mg-danger-border)] bg-[var(--mg-danger-bg)] p-3">
              <p className="text-[11px] font-black text-[var(--mg-danger)]">Revisá estas líneas:</p>
              <ul className="mt-1 list-inside list-disc space-y-0.5 text-[10px] font-semibold text-[var(--mg-danger)]">
                {errors.slice(0, 8).map((message, index) => <li key={`${message}-${index}`}>{message}</li>)}
              </ul>
              {errors.length > 8 && <p className="mt-1 text-[10px] font-bold text-[var(--mg-danger)]">Y {errors.length - 8} más.</p>}
            </div>
          )}

          {preview && (
            <div className={`rounded-xl border p-3 ${
              errors.length === 0
                ? 'border-[var(--mg-success-border)] bg-[var(--mg-success-bg)]'
                : 'border-[var(--mg-border)] bg-[var(--mg-bg-elevated)]'
            }`}>
              <p className={`text-xs font-black ${errors.length === 0 ? 'text-[var(--mg-success-text)]' : 'text-[var(--mg-text-primary)]'}`}>
                {preview.count} de {preview.lines} líneas listas para importar.
              </p>
              {preview.count > 0 && (
                <div className="mt-1.5 space-y-0.5">
                  {preview.items.slice(0, 5).map((item) => (
                    <p key={item.key} className="truncate text-[10px] font-semibold text-[var(--mg-text-secondary)]">
                      {item.productName} · {item.packageQty} × {Number(item.packagePrice || 0).toFixed(2)} Bs
                    </p>
                  ))}
                  {preview.count > 5 && <p className="text-[10px] font-bold text-[var(--mg-text-muted)]">Y {preview.count - 5} más.</p>}
                </div>
              )}
            </div>
          )}
        </div>

        <footer className="flex gap-2 border-t border-[var(--mg-separator)] bg-[var(--mg-bg-surface)] p-3.5">
          <button type="button" onClick={onClose} className="mg-btn-tertiary flex-1 !py-2.5 text-sm">
            Cancelar
          </button>
          <button
            type="button"
            onClick={buildImport}
            className="mg-btn-secondary flex-1 !py-2.5 text-sm"
          >
            Revisar
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={!preview || preview.count === 0 || errors.length > 0}
            className="mg-btn-primary flex-[1.3] !py-2.5 text-sm disabled:opacity-50"
          >
            Importar
          </button>
        </footer>
      </div>
    </div>
  );
}
