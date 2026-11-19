import React from 'react';
import { motion } from 'motion/react';
import { formatBs } from '../../utils/currency';
import { AppIcon } from '../icons';

function formatDateShort(dateVal) {
  if (!dateVal) return '';
  const d = dateVal.toDate ? dateVal.toDate() : new Date(dateVal);
  return d.toLocaleDateString('es-BO', { day: 'numeric', month: 'short', year: 'numeric' });
}

function parseDueDate(dateStr) {
  if (!dateStr) return null;
  return new Date(`${dateStr}T00:00:00`);
}

export function DebtCard({ debt, businessName, onPay, onDelete }) {
  const isPending = debt.status === 'pending';
  const dueDateObj = parseDueDate(debt.dueDate);
  const todayObj = new Date(new Date().setHours(0, 0, 0, 0));
  const isOverdue = isPending && dueDateObj && dueDateObj < todayObj;

  const cleanPhone = (debt.clientPhone || '').replace(/\D/g, '');

  // El teléfono puede estar guardado con o sin código de país (+591 70000000 vs
  // 70000000). Anteponer 591 a ciegas rompía el enlace cuando ya lo tenía.
  const waPhone = cleanPhone.startsWith('591') ? cleanPhone : `591${cleanPhone}`;

  // Mensaje pre-armado de WhatsApp
  const waMsg = `Hola ${debt.clientName}, te saludamos de ${businessName || 'nuestro negocio'}. Tienes un saldo pendiente de ${formatBs(debt.amount)}. ¿Cuándo podrías pasar a cancelar? ¡Muchas gracias!`;
  const waUrl = cleanPhone ? `https://wa.me/${waPhone}?text=${encodeURIComponent(waMsg)}` : null;
  const telUrl = cleanPhone ? `tel:${cleanPhone}` : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2, transition: { duration: 0.18 } }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className={`bg-[var(--mg-bg-surface)] rounded-[22px] p-3.5 border transition-all shadow-xs hover:shadow-md ${
        isOverdue
          ? 'border-red-300 bg-red-50/20'
          : 'border-[var(--mg-border)] hover:border-[var(--mg-border-hover)]'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Avatar y Datos del cliente */}
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div
            className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 text-sm font-black border ${
              isOverdue
                ? 'bg-[var(--mg-danger-bg)] text-[var(--mg-danger)] border-red-200'
                : 'bg-[var(--mg-accent-bg)] text-[var(--mg-accent)] border-[var(--mg-accent-border)]'
            }`}
          >
            {(debt.clientName || '?').charAt(0).toUpperCase()}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-extrabold text-[var(--mg-text-primary)] text-sm sm:text-base truncate">
                {debt.clientName}
              </p>
              {isOverdue && (
                <span className="bg-[var(--mg-danger-bg)] text-[var(--mg-danger)] border border-red-200 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                  ⚠️ Vencido
                </span>
              )}
            </div>

            {/* NIT y Teléfono con Botones Directos de Contacto */}
            <div className="flex flex-wrap items-center gap-1.5 mt-1 text-xs text-[var(--mg-text-muted)] font-medium">
              {debt.clientNit && debt.clientNit !== '0' && (
                <span className="bg-[var(--mg-bg-elevated)] px-2 py-0.5 rounded-md border border-[var(--mg-border)] font-mono text-[10px]">
                  CI/NIT: <strong className="text-[var(--mg-text-secondary)]">{debt.clientNit}</strong>
                </span>
              )}

              {debt.clientPhone && (
                <div className="flex items-center gap-1">
                  {/* WhatsApp Button */}
                  {waUrl && (
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[10px] font-black px-2 py-0.5 rounded-lg transition-all active:scale-95"
                      title="Enviar mensaje por WhatsApp"
                    >
                      <AppIcon name="whatsapp" size={11} />
                      <span>WhatsApp</span>
                    </a>
                  )}

                  {/* Call Button */}
                  {telUrl && (
                    <a
                      href={telUrl}
                      className="inline-flex items-center gap-1 bg-[var(--mg-accent-bg)] hover:bg-blue-100 text-[var(--mg-accent)] border border-[var(--mg-accent-border)] text-[10px] font-black px-2 py-0.5 rounded-lg transition-all active:scale-95"
                      title="Llamar directamente"
                    >
                      <AppIcon name="llamar" size={11} />
                      <span>{debt.clientPhone}</span>
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Fechas de Venta y Límite */}
            <div className="flex flex-wrap items-center gap-2.5 mt-1 text-[10px] text-[var(--mg-text-muted)] font-medium">
              <span>Registrado: {formatDateShort(debt.createdAt)}</span>
              {debt.dueDate && (
                <span className={`font-bold ${isOverdue ? 'text-[var(--mg-danger)]' : 'text-[var(--mg-text-secondary)]'}`}>
                  Límite: {formatDateShort(debt.dueDate)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Monto y Acción de Cobro */}
        <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-[var(--mg-separator)]">
          <div className="text-left sm:text-right">
            <p className={`font-black text-lg sm:text-xl tracking-tight ${isPending ? 'text-[var(--mg-danger)]' : 'text-[var(--mg-success-text)]'}`}>
              {formatBs(debt.amount)}
            </p>

            {!isPending && debt.paidAt && (
              <p className="text-[10px] text-[var(--mg-success-text)] font-extrabold mt-0.5">
                Pagado: {formatDateShort(debt.paidAt)}
                {debt.paymentMethodReceived && ` (${debt.paymentMethodReceived === 'qr' ? '📱 QR' : '💵 Efec'})`}
              </p>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {isPending ? (
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.95 }}
                type="button"
                onClick={() => onPay(debt)}
                className="bg-[var(--mg-success)] hover:opacity-90 text-white text-xs font-black px-3.5 py-1.5 rounded-xl transition-all shadow-xs min-h-[34px] flex items-center gap-1"
              >
                <span>Cobrar</span>
                <AppIcon name="check" size={13} color="#fff" />
              </motion.button>
            ) : (
              <span className="text-[11px] text-[var(--mg-success-text)] bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full font-extrabold flex items-center gap-1">
                <AppIcon name="check" size={11} /> Pagado
              </span>
            )}

            <button
              type="button"
              onClick={() => onDelete(debt)}
              className="text-[11px] font-extrabold text-[var(--mg-text-muted)] hover:text-[var(--mg-danger)] p-1 rounded-lg transition-colors"
              title="Eliminar registro"
            >
              <AppIcon name="eliminar" size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Detalle de Productos */}
      {debt.description && (
        <div className="mt-2.5 bg-[var(--mg-bg-elevated)] p-2.5 rounded-xl border border-[var(--mg-border)] text-xs text-[var(--mg-text-secondary)] font-medium">
          <span className="text-[var(--mg-text-muted)] font-bold block mb-0.5 uppercase tracking-wider text-[10px]">
            📦 Productos llevados:
          </span>
          <p className="leading-relaxed">{debt.description}</p>
        </div>
      )}
    </motion.div>
  );
}
