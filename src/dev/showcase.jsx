import { createRoot } from 'react-dom/client';
import '../index.css';
import DataTable from '../components/DataTable';
import ProductCatalogCard, { StockLabel } from '../components/ProductCatalogCard';
import ProductListRow, { RowAddButton } from '../components/ProductListRow';
import { AuditSalesList } from '../components/AuditSalesList';
import { AuditPurchasesList } from '../components/AuditPurchasesList';
import { LogoutModal } from '../components/LogoutModal';
import { AppIcon } from '../components/icons';

const sales = [
  { id: '1', seller: 'Carlos', total: 250, number: 'T-0001', dateLabel: '21 oct · 10:30' },
  { id: '2', seller: 'Carlos', total: 120, number: 'T-0002', dateLabel: '21 oct · 11:05' },
  { id: '3', seller: 'María', total: 380, number: 'T-0003', dateLabel: '21 oct · 11:40' },
];

const purchases = [
  { id: '1', number: 'C-010', productName: 'Coca-Cola 2L', supplier: 'Distribuidora Sur', totalCost: 96, createdAt: new Date() },
  { id: '2', number: 'C-011', productName: 'Arroz 1kg', supplier: 'Mayorista Andino', totalCost: 45, createdAt: new Date() },
];

const columns = [
  { key: 'fecha', label: 'Fecha', sortable: true },
  { key: 'cliente', label: 'Cliente', sortable: true },
  { key: 'metodo', label: 'Método' },
  { key: 'total', label: 'Total', align: 'right', sortable: true, render: (r) => <span className="tabular-nums font-black">{r.total}</span> },
];

const rows = [
  { id: 1, fecha: '21/10/2026', cliente: 'Consumidor final', metodo: 'Efectivo', total: 'Bs 120,00' },
  { id: 2, fecha: '21/10/2026', cliente: 'Ana Pérez', metodo: 'QR', total: 'Bs 340,00' },
  { id: 3, fecha: '21/10/2026', cliente: 'Consumidor final', metodo: 'Mixto', total: 'Bs 85,00' },
  { id: 4, fecha: '20/10/2026', cliente: 'Jorge Ruiz', metodo: 'Efectivo', total: 'Bs 210,00' },
  { id: 5, fecha: '20/10/2026', cliente: 'Consumidor final', metodo: 'Tarjeta', total: 'Bs 130,00' },
  { id: 6, fecha: '20/10/2026', cliente: 'Lucía Gómez', metodo: 'QR', total: 'Bs 155,00' },
];

function Section({ id, title, children }) {
  return (
    <section id={id} className="bg-[var(--mg-bg-surface)] border border-[var(--mg-border)] rounded-2xl p-5 space-y-4">
      <h2 className="text-xs font-black uppercase tracking-widest text-[var(--mg-text-muted)]">{title}</h2>
      {children}
    </section>
  );
}

function Gallery() {
  return (
    <div className="max-w-5xl mx-auto p-5 space-y-5">
      <h1 className="text-2xl font-black text-[var(--mg-brand)]">Showcase de componentes (dev)</h1>

      <Section id="iconos" title="Iconos">
        <div className="flex flex-wrap gap-4">
          {['scan', 'cash', 'pdf', 'eliminar', 'qr', 'check', 'reportes', 'reloj'].map((n) => (
            <span key={n} className="flex items-center gap-1.5 text-xs font-bold text-[var(--mg-text-secondary)]">
              <AppIcon name={n} size={20} /> {n}
            </span>
          ))}
        </div>
      </Section>

      <Section id="estados" title="Botones e inputs (hover / focus / disabled)">
        <div className="flex flex-wrap items-center gap-3">
          <button id="btn-primary" type="button" className="mg-btn-primary">Primario</button>
          <button type="button" className="mg-btn-secondary">Secundario</button>
          <button type="button" className="mg-btn-tertiary">Terciario</button>
          <button id="btn-disabled" type="button" disabled className="mg-btn-primary">Deshabilitado</button>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <input id="input-demo" className="mg-input" placeholder="Input normal" />
          <input className="mg-input" placeholder="Input deshabilitado" disabled />
        </div>
        <div className="flex flex-wrap gap-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-[var(--mg-success-text)] bg-[var(--mg-success-bg)] border border-[var(--mg-success-border)] rounded-lg">
            <AppIcon name="check" size={14} /> Éxito
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-[var(--mg-gold-text)] bg-[var(--mg-gold-bg)] border border-[var(--mg-gold-border)] rounded-lg">
            <AppIcon name="reloj" size={14} /> Advertencia
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-[var(--mg-danger)] bg-[var(--mg-danger-bg)] border border-[var(--mg-danger-border)] rounded-lg">
            <AppIcon name="eliminar" size={14} /> Error
          </span>
        </div>
      </Section>

      <Section id="tabla" title="DataTable">
        <DataTable columns={columns} rows={rows} getRowKey={(r) => r.id} footer={[{ key: 'total', value: 'Bs 1.040,00', label: 'Total del período' }]} />
      </Section>

      <Section id="productos" title="Productos">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <ProductCatalogCard
            product={{ name: 'Coca-Cola 2L', brand: 'Embol', imageData: null }}
            priceLabel="Bs 12,00"
            metaLabel={<StockLabel stock={0} minStock={5} />}
            actionArea={<RowAddButton onAdd={() => {}} />}
            onSelect={() => {}}
          />
          <ProductCatalogCard
            product={{ name: 'Arroz 1kg', brand: 'Granero', imageData: null }}
            priceLabel="Bs 8,50"
            metaLabel={<StockLabel stock={3} minStock={5} />}
            actionArea={<RowAddButton onAdd={() => {}} />}
            onSelect={() => {}}
          />
          <ProductCatalogCard
            product={{ name: 'Aceite 900ml', brand: 'Fino', imageData: null }}
            priceLabel="Bs 15,00"
            metaLabel={<StockLabel stock={42} minStock={5} />}
            actionArea={<RowAddButton onAdd={() => {}} disabled />}
            onSelect={() => {}}
          />
        </div>
        <ProductListRow
          product={{ name: 'Leche PIL 1L', imageData: null }}
          subtitle="Bolsa · PIL"
          priceLabel="Bs 9,00"
          actionArea={<RowAddButton onAdd={() => {}} />}
          onSelect={() => {}}
        />
      </Section>

      <Section id="listas" title="Listas de auditoría">
        <AuditSalesList sales={sales} businessName="Tienda Central" onSelectSale={() => {}} />
        <AuditPurchasesList rows={purchases} />
      </Section>
    </div>
  );
}

function Root() {
  const view = new URLSearchParams(window.location.search).get('view');
  if (view === 'logout') {
    return <LogoutModal isOpen user={{ displayName: 'Ana' }} business={{ name: 'Tienda Central' }} onClose={() => {}} />;
  }
  return <Gallery />;
}

createRoot(document.getElementById('showcase-root')).render(<Root />);
