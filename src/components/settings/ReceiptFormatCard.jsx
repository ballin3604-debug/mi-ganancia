import { useState } from 'react';
import { motion } from 'motion/react';
import { getReceiptFormat, setReceiptFormat, RECEIPT_FORMATS } from '../../utils/receiptFormat';
import { AppIcon } from '../icons';

const OPCIONES = [
  {
    id: RECEIPT_FORMATS.THERMAL,
    icon: '🧾',
    title: 'Ticket térmico',
    detail: 'Rollo de 80mm',
    hint: 'Para impresoras de tickets. Angosto, en blanco y negro.',
  },
  {
    id: RECEIPT_FORMATS.SHEET,
    icon: '📄',
    title: 'Recibo en hoja',
    detail: 'Carta / A4',
    hint: 'Con monto en letras, firmas y tu logo. Ideal para PDF o WhatsApp.',
  },
];

export function ReceiptFormatCard() {
  const [format, setFormat] = useState(() => getReceiptFormat());

  function choose(id) {
    setReceiptFormat(id);
    setFormat(id);
  }

  return (
    <div className="bg-[var(--mg-bg-surface)] rounded-[22px] p-4 border border-[var(--mg-border)] shadow-xs space-y-3">
      <div className="flex items-center gap-2">
        <AppIcon name="recibo" size={20} />
        <div>
          <p className="font-extrabold text-[var(--mg-text-primary)] text-sm">Formato del recibo</p>
          <p className="text-[var(--mg-text-muted)] text-xs">
            Se guarda solo en este dispositivo, porque la impresora es de cada aparato
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {OPCIONES.map((op) => {
          const activa = format === op.id;
          return (
            <motion.button
              key={op.id}
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={() => choose(op.id)}
              aria-pressed={activa}
              className={`text-left p-3.5 rounded-2xl border-2 transition-all min-h-[44px] ${
                activa
                  ? 'border-[var(--mg-accent)] bg-[var(--mg-accent-bg)]'
                  : 'border-[var(--mg-border)] bg-[var(--mg-bg-surface)] hover:bg-[var(--mg-bg-elevated)]'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-lg shrink-0">{op.icon}</span>
                  <div className="min-w-0">
                    <p className={`text-xs font-black truncate ${activa ? 'text-[var(--mg-accent)]' : 'text-[var(--mg-text-primary)]'}`}>
                      {op.title}
                    </p>
                    <p className="text-[10px] font-bold text-[var(--mg-text-muted)] uppercase tracking-wider">
                      {op.detail}
                    </p>
                  </div>
                </div>

                {activa && (
                  <span className="w-5 h-5 rounded-full bg-[var(--mg-accent)] text-white text-[11px] font-black flex items-center justify-center shrink-0">
                    ✓
                  </span>
                )}
              </div>

              <p className="text-[10px] text-[var(--mg-text-muted)] mt-2 leading-relaxed font-medium">
                {op.hint}
              </p>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
