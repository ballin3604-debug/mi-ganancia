import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { formatBs, formatBsShort } from '../../utils/currency';

export function DonutChart({ data, totalLabel, isCurrency }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  let cumulativeAngle = 0;

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-52 text-[var(--mg-text-muted)] text-xs font-extrabold bg-[var(--mg-bg-elevated)] rounded-2xl border border-[var(--mg-border)] p-6">
        <span className="text-3xl mb-2">📊</span>
        <span>Sin registros de ventas aún</span>
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
  if (method === 'fiado') return '⏳ Fiado';
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
  const [selectedShift, setSelectedShift] = useState('todos'); // 'todos' | 'manana' | 'tarde' | 'noche'
  const [selectedBandSlot, setSelectedBandSlot] = useState(null);
  const [activeTab, setActiveTab] = useState('franjas'); // 'franjas' | 'recibos' | 'productos' | 'tendencia'
  const [breakdownView, setBreakdownView] = useState('productos'); // 'productos' | 'transacciones'

  // Filtrar franjas horarias por turno
  const filteredHourlyBands = useMemo(() => {
    if (selectedShift === 'todos') return hourlyBands;

    return hourlyBands.filter((band) => {
      // band.slot va de 0 a 47 (cada un slot representa 30 min)
      // slot 12 (06:00) a 23 (11:30) = mañana
      // slot 24 (12:00) a 35 (17:30) = tarde
      // slot 36 (18:00) a 47 (23:30) = noche
      if (selectedShift === 'manana') return band.slot >= 12 && band.slot < 24;
      if (selectedShift === 'tarde') return band.slot >= 24 && band.slot < 36;
      if (selectedShift === 'noche') return band.slot >= 36 || band.slot < 12;
      return true;
    });
  }, [hourlyBands, selectedShift]);

  // Max total de franja para escala de gráfico
  const maxBandTotal = useMemo(() => {
    if (hourlyBands.length === 0) return 1;
    return Math.max(...hourlyBands.map(b => b.total), 1);
  }, [hourlyBands]);

  // Franja activa elegida o null
  const selectedBandObj = useMemo(() => {
    if (selectedBandSlot !== null) {
      return hourlyBands.find(b => b.slot === selectedBandSlot) || null;
    }
    return null;
  }, [selectedBandSlot, hourlyBands]);

  // Ventas pertenecientes a la franja horaria seleccionada
  const slotSales = useMemo(() => {
    if (selectedBandSlot === null || !visibleSales) return [];
    return visibleSales.filter((s) => {
      if (!s.createdAt) return false;
      const d = s.createdAt.toDate ? s.createdAt.toDate() : new Date(s.createdAt);
      const slot = d.getHours() * 2 + (d.getMinutes() >= 30 ? 1 : 0);
      return slot === selectedBandSlot;
    });
  }, [visibleSales, selectedBandSlot]);

  // Resumen de productos vendidos durante la franja horaria seleccionada
  const slotProductsSummary = useMemo(() => {
    if (slotSales.length === 0) return [];
    const summary = {};
    slotSales.forEach((s) => {
      const items = salesItemsMap[s.id] || [];
      items.forEach((item) => {
        const name = item.productName || 'Producto varios';
        if (!summary[name]) {
          summary[name] = {
            productName: name,
            category: item.category || 'Otros',
            quantity: 0,
            subtotal: 0,
          };
        }
        summary[name].quantity += item.quantity || 0;
        summary[name].subtotal += item.subtotal || 0;
      });
    });
    return Object.values(summary).sort((a, b) => b.subtotal - a.subtotal);
  }, [slotSales, salesItemsMap]);

  const totalSalesSum = useMemo(() => {
    return hourlyBands.reduce((sum, b) => sum + b.total, 0);
  }, [hourlyBands]);

  // Franjas mostradas en la tabla (si hay franja seleccionada, filtra solo esa)
  const displayedBands = useMemo(() => {
    if (selectedBandSlot !== null) {
      return filteredHourlyBands.filter(b => b.slot === selectedBandSlot);
    }
    return filteredHourlyBands;
  }, [filteredHourlyBands, selectedBandSlot]);

  if (visibleSalesCount === 0) {
    return (
      <div className="bg-[var(--mg-bg-surface)] rounded-[20px] border border-[var(--mg-border)] p-8 text-center shadow-xs">
        <p className="text-4xl mb-2">⏰</p>
        <p className="font-extrabold text-[var(--mg-text-primary)] text-base">Sin datos de ventas para franjas horarias</p>
        <p className="text-xs text-[var(--mg-text-muted)] mt-1">Registra las primeras ventas para activar los gráficos e informes de horario.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tab Switcher con animación de deslizamiento fluid */}
      <div className="flex items-center justify-between border-b border-[var(--mg-separator)] pb-3 flex-wrap gap-2">
        <div className="flex items-center gap-1.5 bg-[var(--mg-bg-elevated)] p-1 rounded-2xl border border-[var(--mg-border)] max-w-full overflow-x-auto scrollbar-none">
          {[
            { id: 'franjas', label: '⏰ Ventas por Franja Horaria', icon: '⏱️' },
            { id: 'recibos', label: `🧾 Recibos de Hoy (${filteredSales.length})`, icon: '🧾' },
            { id: 'productos', label: '🍩 Productos y Categorías', icon: '📦' },
            { id: 'tendencia', label: '📈 Tendencia Temporal', icon: '📊' },
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
              <span className="relative z-10">{tab.label}</span>
            </button>
          ))}
        </div>

        <span className="text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
          {hourlyBands.length} {hourlyBands.length === 1 ? 'franja activa' : 'franjas activas con ventas'}
        </span>
      </div>

      {/* VISTA 1: VENTAS POR FRANJA HORARIA (PROTAGONISTA INTERACTIVO) */}
      <AnimatePresence mode="wait">
        {activeTab === 'franjas' && (
          <motion.div
            key="franjas"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            {/* Filtros por Turno y Botón de Restablecer */}
            <div className="flex items-center justify-between gap-3 flex-wrap bg-[var(--mg-bg-surface)] p-4 rounded-2xl border border-[var(--mg-border)]">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-extrabold uppercase text-[var(--mg-text-muted)]">Filtrar por Turno:</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    { id: 'todos', label: 'Todos los Turnos' },
                    { id: 'manana', label: '🌅 Mañana (06:00 - 12:00)' },
                    { id: 'tarde', label: '☀️ Tarde (12:00 - 18:00)' },
                    { id: 'noche', label: '🌙 Noche (18:00 - 24:00)' },
                  ].map((shift) => (
                    <button
                      key={shift.id}
                      onClick={() => setSelectedShift(shift.id)}
                      type="button"
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                        selectedShift === shift.id
                          ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                          : 'bg-[var(--mg-bg-elevated)] text-[var(--mg-text-secondary)] border-[var(--mg-border)] hover:bg-slate-100'
                      }`}
                    >
                      {shift.label}
                    </button>
                  ))}
                </div>
              </div>

              {selectedBandSlot !== null && (
                <button
                  onClick={() => setSelectedBandSlot(null)}
                  type="button"
                  className="bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <span>✖ Ver todas las franjas horarias</span>
                </button>
              )}
            </div>

            {/* Visualizador de Barras de Franjas Horarias */}
            <div className="bg-[var(--mg-bg-surface)] rounded-[22px] border border-[var(--mg-border)] p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h4 className="text-sm font-black text-[var(--mg-text-primary)]">
                    📊 Distribución de Ventas por Franja Horaria
                  </h4>
                  <p className="text-xs text-[var(--mg-text-muted)] mt-0.5">
                    Haz clic en cualquier franja para filtrar la tabla y ver qué productos se vendieron en ese horario
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100">
                  Máx Horario: {formatBs(maxBandTotal)}
                </span>
              </div>

              {/* Chart Bars */}
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5 pt-2">
                {filteredHourlyBands.map((band) => {
                  const isMax = band.total === maxBandTotal;
                  const isSelected = selectedBandSlot === band.slot;
                  const heightPercent = Math.max((band.total / maxBandTotal) * 100, 15);
                  const sharePercent = totalSalesSum > 0 ? ((band.total / totalSalesSum) * 100).toFixed(1) : 0;

                  return (
                    <motion.button
                      key={band.slot}
                      type="button"
                      whileHover={{ scale: 1.04, y: -2 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => {
                        if (selectedBandSlot === band.slot) {
                          setSelectedBandSlot(null);
                        } else {
                          setSelectedBandSlot(band.slot);
                        }
                      }}
                      className={`text-left rounded-2xl p-3 border flex flex-col justify-between h-36 transition-all relative overflow-hidden cursor-pointer ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-700 shadow-lg ring-2 ring-blue-400'
                          : isMax
                          ? 'bg-amber-50 border-amber-300 text-amber-950 hover:bg-amber-100/80'
                          : 'bg-[var(--mg-bg-elevated)] border-[var(--mg-border)] hover:border-blue-300 hover:bg-slate-50 text-[var(--mg-text-primary)]'
                      }`}
                    >
                      {/* Badge Hora Pico o Seleccionado */}
                      {isSelected ? (
                        <span className="absolute top-1.5 right-1.5 text-[9px] font-black bg-white text-blue-700 px-1.5 py-0.5 rounded-full shadow-xs">
                          ✓ ACTIVA
                        </span>
                      ) : isMax ? (
                        <span className="absolute top-1.5 right-1.5 text-[8px] font-black bg-amber-500 text-white px-1.5 py-0.5 rounded-full shadow-xs">
                          🔥 PICO
                        </span>
                      ) : null}

                      {/* Header label */}
                      <div>
                        <p className={`font-mono text-[10px] font-extrabold ${isSelected ? 'text-blue-100' : 'text-[var(--mg-text-muted)]'}`}>
                          {band.label}
                        </p>
                        <p className={`text-xs font-black mt-1 ${isSelected ? 'text-white' : 'text-[var(--mg-text-primary)]'}`}>
                          {formatBs(band.total)}
                        </p>
                      </div>

                      {/* Bar fill */}
                      <div className="w-full bg-black/10 rounded-full h-2.5 overflow-hidden my-1">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${heightPercent}%` }}
                          transition={{ duration: 0.5, ease: 'easeOut' }}
                          className={`h-full rounded-full ${
                            isSelected
                              ? 'bg-white'
                              : isMax
                              ? 'bg-amber-500'
                              : 'bg-blue-600'
                          }`}
                        />
                      </div>

                      {/* Footer count */}
                      <div className="flex items-center justify-between text-[10px] font-bold">
                        <span className={isSelected ? 'text-blue-100' : 'text-[var(--mg-text-secondary)]'}>
                          {band.count} {band.count === 1 ? 'venta' : 'ventas'}
                        </span>
                        <span className={isSelected ? 'text-blue-200' : 'text-[var(--mg-text-muted)]'}>
                          {sharePercent}%
                        </span>
                      </div>
                    </motion.button>
                  );
                })}

                {filteredHourlyBands.length === 0 && (
                  <div className="col-span-full py-8 text-center text-xs text-[var(--mg-text-muted)] font-bold">
                    No hay franjas de ventas registradas para este turno.
                  </div>
                )}
              </div>
            </div>

            {/* SI HAY UNA FRANJA SELECCIONADA: PANEL DE DETALLE DE VENTAS EN ESE HORARIO */}
            <AnimatePresence>
              {selectedBandObj && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="bg-blue-50/70 rounded-[24px] border-2 border-blue-200 p-5 shadow-sm space-y-4 overflow-hidden"
                >
                  <div className="flex items-center justify-between flex-wrap gap-2 border-b border-blue-200/80 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-xs shadow-xs">
                        ⏱️
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-blue-950">
                          Detalle de Lo Vendido en el Horario: <span className="font-mono text-blue-700 bg-white px-2 py-0.5 rounded-md border border-blue-200">{selectedBandObj.label}</span>
                        </h4>
                        <p className="text-xs text-blue-800/80 font-medium mt-0.5">
                          {slotSales.length} {slotSales.length === 1 ? 'transacción realizada' : 'transacciones realizadas'} en este intervalo de 30 minutos
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-blue-200">
                        <button
                          onClick={() => setBreakdownView('productos')}
                          type="button"
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            breakdownView === 'productos'
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'text-blue-700 hover:bg-blue-50'
                          }`}
                        >
                          📦 Productos ({slotProductsSummary.length})
                        </button>
                        <button
                          onClick={() => setBreakdownView('transacciones')}
                          type="button"
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            breakdownView === 'transacciones'
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'text-blue-700 hover:bg-blue-50'
                          }`}
                        >
                          🧾 Recibos ({slotSales.length})
                        </button>
                      </div>

                      <button
                        onClick={() => setSelectedBandSlot(null)}
                        type="button"
                        className="text-slate-400 hover:text-slate-700 text-lg font-bold w-7 h-7 rounded-full bg-white border border-blue-200 flex items-center justify-center cursor-pointer"
                        title="Cerrar detalle"
                      >
                        ×
                      </button>
                    </div>
                  </div>

                  {/* Resumen rápido de la franja */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="bg-white p-3 rounded-xl border border-blue-200 shadow-2xs">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Total Recaudado</p>
                      <p className="text-base font-black text-blue-950 mt-0.5">{formatBs(selectedBandObj.total)}</p>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-blue-200 shadow-2xs">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Total Unidades</p>
                      <p className="text-base font-black text-blue-950 mt-0.5">
                        {slotProductsSummary.reduce((sum, p) => sum + p.quantity, 0)} ud.
                      </p>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-blue-200 shadow-2xs col-span-2 sm:col-span-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Ticket Promedio</p>
                      <p className="text-base font-black text-blue-950 mt-0.5">
                        {formatBs(selectedBandObj.count > 0 ? selectedBandObj.total / selectedBandObj.count : 0)}
                      </p>
                    </div>
                  </div>

                  {/* TAB 1: PRODUCTOS VENDIDOS EN ESA FRANJA */}
                  {breakdownView === 'productos' && (
                    <div className="bg-white rounded-2xl border border-blue-200 p-4 space-y-3">
                      <h5 className="text-xs font-black uppercase text-blue-950 tracking-wider">
                        📦 Lista de Productos y Cantidades Vendidas ({selectedBandObj.label})
                      </h5>

                      {slotProductsSummary.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs text-left border-collapse">
                            <thead>
                              <tr className="border-b border-slate-200 text-slate-500 font-extrabold uppercase text-[10px] bg-slate-50">
                                <th className="py-2 px-3 rounded-l-lg">Producto</th>
                                <th className="py-2 px-3">Categoría</th>
                                <th className="py-2 px-3 text-center">Cant. Vendida</th>
                                <th className="py-2 px-3 text-right rounded-r-lg">Subtotal</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                              {slotProductsSummary.map((item, idx) => (
                                <tr key={idx} className="hover:bg-blue-50/40">
                                  <td className="py-2.5 px-3 font-extrabold text-slate-900">{item.productName}</td>
                                  <td className="py-2.5 px-3">
                                    <span className="bg-slate-100 text-slate-600 text-[10px] px-2 py-0.5 rounded-md border border-slate-200 font-semibold">
                                      {item.category}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3 text-center font-mono font-bold text-blue-700">
                                    {item.quantity} ud.
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-black text-slate-900">
                                    {formatBs(item.subtotal)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 font-medium py-4 text-center">
                          Cargando ítems de las ventas registradas en esta franja...
                        </p>
                      )}
                    </div>
                  )}

                  {/* TAB 2: RECIBOS / TRANSACCIONES DE ESA FRANJA */}
                  {breakdownView === 'transacciones' && (
                    <div className="bg-white rounded-2xl border border-blue-200 p-4 space-y-3">
                      <h5 className="text-xs font-black uppercase text-blue-950 tracking-wider">
                        🧾 Transacciones de Venta Registradas ({selectedBandObj.label})
                      </h5>

                      <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                        {slotSales.map((sale) => {
                          const saleDate = sale.createdAt?.toDate ? sale.createdAt.toDate() : new Date(sale.createdAt);
                          const formattedTime = saleDate.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                          const items = salesItemsMap[sale.id] || [];

                          return (
                            <div key={sale.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                              <div className="flex items-center justify-between text-xs flex-wrap gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-extrabold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-md">
                                    ⏱️ {formattedTime}
                                  </span>
                                  <span className="font-bold text-slate-800">
                                    Cliente: {sale.clientName || 'Cliente Ocasional'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase border ${
                                    sale.paymentMethod === 'qr'
                                      ? 'bg-purple-100 text-purple-800 border-purple-200'
                                      : sale.paymentMethod === 'fiado'
                                      ? 'bg-amber-100 text-amber-800 border-amber-200'
                                      : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                  }`}>
                                    {sale.paymentMethod || 'Efectivo'}
                                  </span>
                                  <span className="font-black text-slate-900 text-sm">
                                    {formatBs(sale.total)}
                                  </span>
                                </div>
                              </div>

                              {/* Ítems e instructivos del recibo */}
                              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/80 flex-wrap">
                                <div className="flex flex-wrap gap-1.5 text-[11px] text-slate-600 flex-1 min-w-0">
                                  {items.length > 0 ? (
                                    items.map((it, idx) => (
                                      <span key={idx} className="bg-white border border-slate-200 px-2 py-0.5 rounded-md font-semibold">
                                        {it.quantity}x {it.productName} ({formatBs(it.subtotal)})
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-slate-400 font-medium">Cargando detalles de ítems...</span>
                                  )}
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  {onSelectSale && (
                                    <button
                                      onClick={() => onSelectSale(sale)}
                                      type="button"
                                      className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 text-[11px] font-bold rounded-lg transition-all cursor-pointer"
                                    >
                                      🔍 Detalle
                                    </button>
                                  )}
                                  {onReimprint && (
                                    <button
                                      onClick={() => onReimprint(sale)}
                                      disabled={printingSaleId === sale.id}
                                      type="button"
                                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded-lg transition-all shadow-2xs cursor-pointer"
                                    >
                                      {printingSaleId === sale.id ? '⌛ Imprimiendo...' : '🖨️ Recibo'}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Tabla Detallada de Franjas Horarias (Filtrada si hay selección) */}
            <div className="bg-[var(--mg-bg-surface)] rounded-[22px] border border-[var(--mg-border)] p-5 shadow-xs">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-[var(--mg-text-primary)] flex items-center gap-2">
                  <span>📋 Tabla de Registro por Franja Horaria (30 minutos)</span>
                  {selectedBandSlot !== null && (
                    <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-200">
                      Filtrado activo
                    </span>
                  )}
                </h4>
                {selectedBandSlot !== null ? (
                  <button
                    onClick={() => setSelectedBandSlot(null)}
                    type="button"
                    className="text-[11px] text-blue-600 hover:underline font-bold cursor-pointer"
                  >
                    ← Mostrar todas las {filteredHourlyBands.length} franjas
                  </button>
                ) : (
                  <span className="text-[11px] text-[var(--mg-text-muted)] font-semibold">
                    Ordenado cronológicamente
                  </span>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--mg-border)] text-[var(--mg-text-muted)] font-extrabold uppercase text-[10px] bg-[var(--mg-bg-elevated)]">
                      <th className="py-2.5 px-3 rounded-l-xl">Franja Horaria</th>
                      <th className="py-2.5 px-3 text-center">Transacciones</th>
                      <th className="py-2.5 px-3 text-center">Ticket Promedio</th>
                      <th className="py-2.5 px-3 text-center">% del Total Día</th>
                      <th className="py-2.5 px-3 text-right rounded-r-xl">Monto Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--mg-separator)] font-bold text-[var(--mg-text-secondary)]">
                    {displayedBands.map((band) => {
                      const avg = band.count > 0 ? band.total / band.count : 0;
                      const share = totalSalesSum > 0 ? ((band.total / totalSalesSum) * 100).toFixed(1) : 0;
                      const isMax = band.total === maxBandTotal;
                      const isSelected = selectedBandSlot === band.slot;

                      return (
                        <tr
                          key={band.slot}
                          onClick={() => setSelectedBandSlot(isSelected ? null : band.slot)}
                          className={`cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-blue-50/90 border-l-4 border-l-blue-600 font-extrabold'
                              : isMax
                              ? 'bg-amber-50/50 hover:bg-amber-100/50'
                              : 'hover:bg-[var(--mg-bg-elevated)]'
                          }`}
                        >
                          <td className="py-3 px-3 font-mono font-bold text-[var(--mg-text-primary)] flex items-center gap-2">
                            <span>{band.label}</span>
                            {isSelected && (
                              <span className="text-[9px] bg-blue-600 text-white font-extrabold px-1.5 py-0.5 rounded-md">
                                SELECCIONADA
                              </span>
                            )}
                            {isMax && !isSelected && (
                              <span className="text-[9px] bg-amber-100 text-amber-800 font-extrabold px-1.5 py-0.5 rounded-md border border-amber-200">
                                🔥 PICO
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center">{band.count} {band.count === 1 ? 'venta' : 'ventas'}</td>
                          <td className="py-3 px-3 text-center font-mono text-[var(--mg-text-muted)]">{formatBs(avg)}</td>
                          <td className="py-3 px-3 text-center">
                            <span className="bg-slate-100 text-slate-700 font-mono text-[10px] px-2 py-0.5 rounded-full border border-slate-200">
                              {share}%
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-black text-blue-600">{formatBs(band.total)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {/* VISTA DE RECIBOS DE HOY FUSIONADA */}
        {activeTab === 'recibos' && (
          <motion.div
            key="recibos"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            {/* Encabezado y Filtros */}
            <div className="bg-[var(--mg-bg-elevated)] p-4 rounded-2xl border border-[var(--mg-border)] space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h4 className="text-sm font-black text-[var(--mg-text-primary)]">
                    {isOwner ? '🧾 Registro de Recibos y Ventas de Hoy' : '🧾 Mis Recibos de Hoy'}
                  </h4>
                  <p className="text-xs text-[var(--mg-text-muted)] mt-0.5">
                    Filtra por método de pago o categoría, consulta transacciones y reimprime comprobantes
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
                    <option value="fiado">⏳ Fiado (CxC)</option>
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
                        <th className="px-4 py-3 text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--mg-separator)] text-xs font-bold text-slate-700">
                      {filteredSales.map((sale) => {
                        const date = sale.createdAt?.toDate ? sale.createdAt.toDate() : new Date(sale.createdAt || Date.now());
                        const formattedTime = date.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
                        const itemsList = salesItemsMap[sale.id] || [];

                        return (
                          <tr key={sale.id} className="hover:bg-slate-50/80 transition-colors">
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
                            <td className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                {onSelectSale && (
                                  <button
                                    onClick={() => onSelectSale(sale)}
                                    type="button"
                                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-lg text-xs transition-all border border-slate-200 cursor-pointer"
                                  >
                                    🔍 Detalle
                                  </button>
                                )}
                                {onReimprint && (
                                  <button
                                    onClick={() => onReimprint(sale)}
                                    disabled={printingSaleId === sale.id}
                                    type="button"
                                    className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition-all shadow-2xs cursor-pointer"
                                  >
                                    {printingSaleId === sale.id ? '⌛' : '🖨️ Recibo'}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
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
              <h4 className="text-xs font-black uppercase tracking-wider text-[var(--mg-text-primary)] mb-3">
                🍩 Productos más vendidos (Unidades)
              </h4>
              <DonutChart data={topProductsChartData} totalLabel="Unidades" isCurrency={false} />
            </div>

            <div className="bg-[var(--mg-bg-surface)] rounded-[22px] border border-[var(--mg-border)] p-5 shadow-xs">
              <h4 className="text-xs font-black uppercase tracking-wider text-[var(--mg-text-primary)] mb-3">
                🍩 Ventas por Categoría (Bs)
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
              📈 Tendencia de Ingresos por Media Hora (Bs)
            </h4>
            <LineChart data={hourlyTrendData} labelEvery={4} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
