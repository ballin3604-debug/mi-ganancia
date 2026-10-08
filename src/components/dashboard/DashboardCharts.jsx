import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { formatBs, formatBsShort } from '../../utils/currency';
import { AppIcon } from '../icons';

export function DonutChart({ data, totalLabel, isCurrency }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  let cumulativeAngle = 0;

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-52 text-[var(--mg-text-muted)] text-xs font-extrabold bg-[var(--mg-bg-elevated)] rounded-2xl border border-[var(--mg-border)] p-6">
        <AppIcon name="reportes" size={36} />
        <span className="mt-2">Sin registros de ventas aún</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-center gap-8 p-3">
      {/* CÍRCULO PROTAGONISTA, CUERPUDITO Y ELEGANTE */}
      <div className="relative w-48 h-48 sm:w-56 sm:h-56 shrink-0 group">
        {/* Glow de fondo tenue y elegante */}
        <div className="absolute inset-3 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all duration-500" />

        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90 relative z-10 drop-shadow-md">
          {data.map((item, idx) => {
            const percentage = item.value / total;
            const angle = percentage * 360;
            const r = 32; // Radio más amplio
            const circ = 2 * Math.PI * r;
            const strokeLength = percentage * circ;
            const rotation = cumulativeAngle;
            cumulativeAngle += angle;

            return (
              <motion.circle
                key={idx}
                initial={{ strokeDasharray: `0 ${circ}` }}
                animate={{ strokeDasharray: `${Math.max(0, strokeLength - (data.length > 1 ? 2 : 0))} ${circ}` }}
                transition={{ duration: 0.85, delay: idx * 0.08, ease: [0.16, 1, 0.3, 1] }}
                cx="50"
                cy="50"
                r={r}
                fill="transparent"
                stroke={item.color}
                strokeWidth="16" // ¡Grosor cuerpudito de 16px!
                strokeDashoffset={0}
                transform={`rotate(${rotation} 50 50)`}
                className="transition-all duration-300 hover:stroke-[19px] cursor-pointer"
              />
            );
          })}
          {/* Anillo de corte central estilizado */}
          <circle cx="50" cy="50" r="23" fill="var(--mg-bg-surface)" stroke="var(--mg-border)" strokeWidth="0.5" />
        </svg>

        {/* Texto e indicador central en el hueco del donut */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center z-20 px-3">
          <span className="text-[9px] font-black uppercase tracking-widest text-[var(--mg-text-muted)]">
            {totalLabel}
          </span>
          <span className="text-base sm:text-lg font-black text-[var(--mg-text-primary)] font-mono tracking-tight truncate max-w-[120px] my-0.5">
            {isCurrency ? `${formatBsShort(total)} Bs` : total}
          </span>
          <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100 shadow-2xs">
            100% Total
          </span>
        </div>
      </div>

      {/* Leyenda en tarjeta limpia con proporciones armoniosas */}
      <div className="flex-1 space-y-2.5 w-full min-w-0 bg-[var(--mg-bg-elevated)] p-4 rounded-2xl border border-[var(--mg-border)] shadow-2xs">
        {data.map((item, idx) => {
          const percentage = total > 0 ? ((item.value / total) * 100).toFixed(1) : 0;
          return (
            <motion.div
              key={idx}
              whileHover={{ x: 4 }}
              className="flex items-center justify-between text-xs text-[var(--mg-text-primary)] font-bold p-2 rounded-xl hover:bg-white hover:shadow-2xs transition-all cursor-default"
            >
              <div className="flex items-center gap-2.5 truncate pr-2">
                <span
                  className="w-3.5 h-3.5 rounded-lg shrink-0 shadow-xs border border-white/50"
                  style={{ backgroundColor: item.color }}
                />
                <span className="truncate font-black text-[12px]">{item.label}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0 font-mono">
                <span className="text-[10px] bg-white border border-[var(--mg-border)] px-2 py-0.5 rounded-md font-extrabold text-[var(--mg-text-muted)]">
                  {percentage}%
                </span>
                <span className="font-black text-slate-900 text-xs">
                  {isCurrency ? formatBs(item.value) : `${item.value} ud.`}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

export function LineChart({ data, labelEvery = 4 }) {
  const maxVal = Math.max(...data.map(d => d.total), 1);
  const height = 180;
  const width = 680;
  const padding = 28;

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1)) * (width - 2 * padding);
    const y = height - padding - (d.total / maxVal) * (height - 2 * padding);
    return { x, y, index: i, label: d.label, total: d.total };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaD = `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

  return (
    <div className="p-2 overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto min-w-[340px]">
        <defs>
          <linearGradient id="dashboardLineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--mg-accent)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="var(--mg-accent)" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {[0, 0.5, 1].map((ratio, i) => {
          const y = padding + ratio * (height - 2 * padding);
          return (
            <line
              key={i}
              x1={padding}
              y1={y}
              x2={width - padding}
              y2={y}
              stroke="var(--mg-border)"
              strokeWidth="0.5"
              strokeDasharray="4 4"
            />
          );
        })}

        {/* Area */}
        <motion.path
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          d={areaD}
          fill="url(#dashboardLineGrad)"
        />

        {/* Line */}
        <motion.path
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1, ease: 'easeOut' }}
          d={pathD}
          fill="none"
          stroke="var(--mg-accent)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data Points */}
        {points.filter(p => p.total > 0).map((p, i) => (
          <g key={i}>
            <motion.circle
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.5 + i * 0.03 }}
              cx={p.x}
              cy={p.y}
              r="4"
              fill="var(--mg-accent)"
              stroke="#ffffff"
              strokeWidth="1.5"
            />
            <text x={p.x} y={p.y - 8} fontSize="7.5" fontWeight="bold" fill="var(--mg-text-primary)" textAnchor="middle">
              Bs {p.total.toFixed(0)}
            </text>
          </g>
        ))}

        {/* X Axis Labels */}
        {points.filter(p => p.index % labelEvery === 0).map((p, i) => (
          <text key={i} x={p.x} y={height - 4} fontSize="8" fontWeight="semibold" fill="var(--mg-text-muted)" textAnchor="middle">
            {p.label}
          </text>
        ))}
      </svg>
    </div>
  );
}

function getPaymentMethodLabel(method) {
  if (method === 'qr') return '📲 QR';
  if (method === 'cash') return '💵 Efectivo';
  if (method === 'mixto') return '🔀 Mixto';
  return '💵 Efectivo';
}

export function DashboardCharts({
  visibleSalesCount,
  topProductsChartData,
  categorySalesChartData,
  hourlyTrendData,
  hourlyBands,
  visibleSales = [],
  filteredSales = [],
  salesItemsMap = {},
  filterPaymentMethod = 'Todos',
  setFilterPaymentMethod,
  filterCategory = 'Todas',
  setFilterCategory,
  categoriesList = [],
  onSelectSale,
  onReimprint,
  printingSaleId,
  isOwner = true
}) {
  const [activeTab, setActiveTab] = useState('recibos'); // 'recibos' | 'productos' | 'tendencia'
  const [expandedSaleId, setExpandedSaleId] = useState(null); // recibo desplegado para ver sus productos

  if (visibleSalesCount === 0) {
    return (
      <div className="bg-[var(--mg-bg-surface)] rounded-[20px] border border-[var(--mg-border)] p-8 text-center shadow-xs">
        <p className="mb-2 flex justify-center"><AppIcon name="recibo" size={40} /></p>
        <p className="font-extrabold text-[var(--mg-text-primary)] text-base">Sin ventas hoy</p>
        <p className="text-xs text-[var(--mg-text-muted)] mt-1">Registra las primeras ventas y aparecerán aquí con sus productos.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tab Switcher con animación de deslizamiento fluid */}
      <div className="flex items-center justify-between border-b border-[var(--mg-separator)] pb-3 flex-wrap gap-2">
        <div className="flex items-center gap-1.5 bg-[var(--mg-bg-elevated)] p-1 rounded-2xl border border-[var(--mg-border)] max-w-full overflow-x-auto scrollbar-none">
          {[
            { id: 'recibos', label: 'Recibos de Hoy', icon: 'recibo' },
            { id: 'productos', label: 'Productos y Categorías', icon: 'nuevoProducto' },
            { id: 'tendencia', label: 'Tendencia Temporal', icon: 'reportes' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              type="button"
              className={`relative px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                activeTab === tab.id
                  ? 'text-blue-600 font-extrabold shadow-xs'
                  : 'text-[var(--mg-text-muted)] hover:text-[var(--mg-text-primary)]'
              }`}
            >
              {activeTab === tab.id && (
                <motion.div
                  layoutId="activeChartTab"
                  className="absolute inset-0 bg-white rounded-xl shadow-xs border border-[var(--mg-border)]"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                <AppIcon name={tab.icon} size={14} /> {tab.label}
              </span>
            </button>
          ))}
        </div>

        <span className="text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
          {filteredSales.length} {filteredSales.length === 1 ? 'venta hoy' : 'ventas hoy'}
        </span>
      </div>

      {/* VISTA 1: RECIBOS DE HOY (clic en una fila = ver sus productos) */}
      <AnimatePresence mode="wait">
        {activeTab === 'recibos' && (
          <motion.div
            key="recibos"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            {/* Registro del día: filtros + recibos expandibles */}
            {/* Encabezado y Filtros */}
            <div className="bg-[var(--mg-bg-elevated)] p-4 rounded-2xl border border-[var(--mg-border)] space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h4 className="text-sm font-black text-[var(--mg-text-primary)]">
                    {isOwner ? 'Registro de Recibos y Ventas de Hoy' : 'Mis Recibos de Hoy'}
                  </h4>
                  <p className="text-xs text-[var(--mg-text-muted)] mt-0.5">
                    Toca un recibo para ver sus productos · filtra por pago o categoría
                  </p>
                </div>
                <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-100 px-3 py-1 rounded-full">
                  {filteredSales.length} de {visibleSalesCount} {visibleSalesCount === 1 ? 'venta' : 'ventas'}
                </span>
              </div>

              {/* Controles de Filtro */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[var(--mg-separator)]">
                <div>
                  <label className="text-[10px] font-extrabold uppercase tracking-widest text-[var(--mg-text-muted)] block mb-1">
                    Método de Pago
                  </label>
                  <select
                    value={filterPaymentMethod}
                    onChange={(e) => setFilterPaymentMethod && setFilterPaymentMethod(e.target.value)}
                    className="mg-input text-xs font-bold py-2"
                    aria-label="Filtrar por método de pago"
                  >
                    <option value="Todos">Todos los métodos</option>
                    <option value="cash">💵 Efectivo</option>
                    <option value="qr">📲 QR</option>
                    <option value="mixto">🔀 Mixto</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-extrabold uppercase tracking-widest text-[var(--mg-text-muted)] block mb-1">
                    Categoría de Producto
                  </label>
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory && setFilterCategory(e.target.value)}
                    className="mg-input text-xs font-bold py-2"
                    aria-label="Filtrar por categoría de producto"
                  >
                    {categoriesList.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat === 'Todas' ? 'Todas las categorías' : cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Lista / Tabla de Ventas Filtradas */}
            <div className="bg-[var(--mg-bg-surface)] rounded-2xl border border-[var(--mg-border)] overflow-hidden shadow-xs">
              {filteredSales.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[var(--mg-bg-elevated)] border-b border-[var(--mg-border)] text-[var(--mg-text-muted)] text-[10px] uppercase font-extrabold">
                        <th className="px-4 py-3">Hora</th>
                        <th className="px-4 py-3">Cliente</th>
                        <th className="px-4 py-3">Productos</th>
                        <th className="px-4 py-3">Pago</th>
                        <th className="px-4 py-3 text-right">Total</th>
                        <th className="px-2 py-3 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--mg-separator)] text-xs font-bold text-slate-700">
                      {filteredSales.map((sale) => {
                        const date = sale.createdAt?.toDate ? sale.createdAt.toDate() : new Date(sale.createdAt || Date.now());
                        const formattedTime = date.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
                        const itemsList = salesItemsMap[sale.id] || [];
                        const expanded = expandedSaleId === sale.id;

                        return (
                          <React.Fragment key={sale.id}>
                          <tr
                            onClick={() => setExpandedSaleId(expanded ? null : sale.id)}
                            className={`transition-colors cursor-pointer ${expanded ? 'bg-blue-50/60' : 'hover:bg-slate-50/80'}`}
                          >
                            <td className="px-4 py-3 font-mono font-bold text-[var(--mg-text-primary)]">
                              {formattedTime}
                            </td>
                            <td className="px-4 py-3">
                              <p className="font-extrabold text-[var(--mg-text-primary)]">{sale.clientName || 'Cliente Ocasional'}</p>
                              {sale.clientNit && sale.clientNit !== '0' && (
                                <p className="text-[10px] text-[var(--mg-text-muted)]">NIT: {sale.clientNit}</p>
                              )}
                            </td>
                            <td className="px-4 py-3 text-xs text-[var(--mg-text-secondary)] max-w-xs truncate">
                              {itemsList.length > 0 ? (
                                itemsList.map((item) => `${item.productName} (x${item.quantity})`).join(', ')
                              ) : (
                                <span className="text-[var(--mg-text-muted)] font-medium">Variados</span>
                              )}
                            </td>
                            <td className="px-4 py-3 font-bold">
                              <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${
                                sale.paymentMethod === 'qr'
                                  ? 'bg-purple-100 text-purple-800 border-purple-200'
                                  : sale.paymentMethod === 'fiado'
                                  ? 'bg-amber-100 text-amber-800 border-amber-200'
                                  : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                              }`}>
                                {getPaymentMethodLabel(sale.paymentMethod)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-black text-blue-700 font-mono text-sm">
                              {formatBs(sale.total)}
                            </td>
                            <td className="px-2 py-3 text-center">
                              <span className={`inline-flex w-6 h-6 items-center justify-center rounded-full border text-xs transition-transform ${expanded ? 'bg-blue-600 text-white border-blue-600 rotate-180' : 'bg-white text-slate-400 border-slate-200'}`}>
                                ⌄
                              </span>
                            </td>
                          </tr>
                          {expanded && (
                            <tr className="bg-blue-50/40">
                              <td colSpan={6} className="px-4 py-3">
                                <div className="flex items-start justify-between gap-3 flex-wrap">
                                  <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
                                    {itemsList.length > 0 ? (
                                      itemsList.map((item, idx) => (
                                        <span key={idx} className="bg-white border border-slate-200 px-2 py-1 rounded-md font-semibold text-[11px] text-slate-600 tabular-nums">
                                          {item.quantity}x {item.productName} ({formatBs(item.subtotal)})
                                        </span>
                                      ))
                                    ) : (
                                      <span className="text-slate-400 font-medium text-xs">Cargando productos…</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {onSelectSale && (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); onSelectSale(sale); }}
                                        type="button"
                                        className="px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 text-[11px] font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1"
                                      >
                                        <AppIcon name="detalle" size={13} /> Detalle
                                      </button>
                                    )}
                                    {onReimprint && (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); onReimprint(sale); }}
                                        disabled={printingSaleId === sale.id}
                                        type="button"
                                        className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded-lg transition-all shadow-2xs cursor-pointer flex items-center gap-1"
                                      >
                                        <AppIcon name="recibo" size={13} color="#fff" /> {printingSaleId === sale.id ? 'Imprimiendo…' : 'Recibo'}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-[var(--mg-text-muted)] font-bold">
                  No se encontraron ventas con los filtros seleccionados.
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* VISTA 2: PRODUCTOS Y CATEGORÍAS */}
        {activeTab === 'productos' && (
          <motion.div
            key="productos"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            <div className="bg-[var(--mg-bg-surface)] rounded-[22px] border border-[var(--mg-border)] p-5 shadow-xs">
              <h4 className="text-xs font-black uppercase tracking-wider text-[var(--mg-text-primary)] mb-1">
                Productos más vendidos
              </h4>
              <p className="text-[11px] text-[var(--mg-text-muted)] font-medium mb-3">
                Unidades y dinero que deja cada uno hoy.
              </p>
              <ul className="divide-y divide-[var(--mg-separator)]">
                {topProductsChartData
                  .filter((p) => p.label !== 'Otros')
                  .slice(0, 5)
                  .map((p, i, arr) => {
                    const max = Math.max(...arr.map((x) => x.value), 1);
                    return (
                    <li key={p.label} className="relative py-2.5 overflow-hidden">
                      <div
                        className="absolute left-0 top-1 bottom-1 rounded-lg"
                        style={{ width: `${Math.max((p.value / max) * 100, 6)}%`, background: `${p.color}1f` }}
                      />
                      <div className="relative flex items-center gap-3">
                        <span className="w-5 text-center text-xs font-black text-[var(--mg-text-faint)] shrink-0">
                          {i + 1}
                        </span>
                        {p.image ? (
                          <img
                            src={p.image}
                            alt={p.label}
                            className="w-9 h-9 rounded-xl object-cover border border-[var(--mg-border)] shrink-0 bg-white"
                            loading="lazy"
                          />
                        ) : (
                          <span className="w-9 h-9 rounded-xl bg-white border border-[var(--mg-border)] flex items-center justify-center text-base shrink-0">
                            📦
                          </span>
                        )}
                        <span className="flex-1 min-w-0 truncate text-sm font-bold text-[var(--mg-text-primary)]">
                          {p.label}
                        </span>
                        <span className="text-right shrink-0">
                          <span className="block text-sm font-black text-[var(--mg-text-primary)] tabular-nums">
                            {p.value} ud.
                          </span>
                          <span className="block text-[11px] font-bold text-[#1670C2] tabular-nums">
                            Bs {Number(p.revenue || 0).toFixed(2)}
                          </span>
                        </span>
                      </div>
                    </li>
                    );
                  })}
                {topProductsChartData.length === 0 && (
                  <li className="py-3 text-center text-xs text-[var(--mg-text-muted)] font-bold">
                    Sin ventas todavía.
                  </li>
                )}
              </ul>
            </div>

            <div className="bg-[var(--mg-bg-surface)] rounded-[22px] border border-[var(--mg-border)] p-5 shadow-xs">
              <h4 className="text-xs font-black uppercase tracking-wider text-[var(--mg-text-primary)] mb-3">
                Ventas por Categoría (Bs)
              </h4>
              <DonutChart data={categorySalesChartData} totalLabel="Total" isCurrency={true} />
            </div>
          </motion.div>
        )}

        {/* VISTA 3: TENDENCIA TEMPORAL (LÍNEA) */}
        {activeTab === 'tendencia' && (
          <motion.div
            key="tendencia"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="bg-[var(--mg-bg-surface)] rounded-[22px] border border-[var(--mg-border)] p-5 shadow-xs"
          >
            <h4 className="text-xs font-black uppercase tracking-wider text-[var(--mg-text-primary)] mb-3">
              Tendencia de Ingresos por Media Hora (Bs)
            </h4>
            <LineChart data={hourlyTrendData} labelEvery={4} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
