import { AppIcon } from '../icons';

/**
 * Campos antes inexistentes en Ajustes (segundo diseño).
 * Reusa 1:1 el estilo actual de tarjetas: rounded-[22px], mg-* vars, mg-input.
 * No toca los estilos existentes, solo agrega.
 */
export function BusinessExtraFields({
  legalName, setLegalName,
  nit, setNit,
  city, setCity,
  address, setAddress,
  footerMessage, setFooterMessage,
  showQrOnTicket, setShowQrOnTicket,
  hasQr,
}) {
  return (
    <div className="space-y-4">
      {/* ── Datos fiscales (Razón Social + NIT) ── */}
      <div className="bg-[var(--mg-bg-surface)] rounded-[22px] p-4 border border-[var(--mg-border)] shadow-xs space-y-3">
        <div className="flex items-center gap-2">
          <AppIcon name="carnet" size={20} />
          <div>
            <p className="font-extrabold text-[var(--mg-text-primary)] text-sm">Datos fiscales</p>
            <p className="text-[var(--mg-text-muted)] text-xs">Razón social y NIT impresos en el recibo</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          <div className="space-y-1.5">
            <label className="text-[11px] font-extrabold text-[var(--mg-text-secondary)]">
              Razón Social / Nombre Legal
            </label>
            <input
              type="text"
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              placeholder="Ej: Comercial Alan S.R.L."
              className="mg-input text-sm font-medium py-3"
              maxLength={120}
            />
            <p className="text-[10px] text-[var(--mg-text-muted)]">Nombre fiscal del titular</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-extrabold text-[var(--mg-text-secondary)]">
              NIT / Identificación Tributaria
            </label>
            <input
              type="text"
              value={nit}
              onChange={(e) => setNit(e.target.value)}
              placeholder="Ej: 1029384019"
              className="mg-input text-sm font-medium py-3"
              maxLength={30}
              inputMode="numeric"
            />
            <p className="text-[10px] text-[var(--mg-text-muted)]">Aparece en la cabecera fiscal del ticket</p>
          </div>
        </div>
      </div>

      {/* ── Ubicación y contacto (Ciudad + Dirección) ── */}
      <div className="bg-[var(--mg-bg-surface)] rounded-[22px] p-4 border border-[var(--mg-border)] shadow-xs space-y-3">
        <div className="flex items-center gap-2">
          <AppIcon name="sucursales" size={20} />
          <div>
            <p className="font-extrabold text-[var(--mg-text-primary)] text-sm">Ubicación para clientes</p>
            <p className="text-[var(--mg-text-muted)] text-xs">Dirección física en los comprobantes</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          <div className="space-y-1.5">
            <label className="text-[11px] font-extrabold text-[var(--mg-text-secondary)]">
              Ciudad / Departamento
            </label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Ej: Santa Cruz de la Sierra"
              className="mg-input text-sm font-medium py-3"
              maxLength={80}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-extrabold text-[var(--mg-text-secondary)]">
              Dirección física (Casa Matriz)
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Ej: Av. San Martín #1420, Esq. 3er Anillo"
              className="mg-input text-sm font-medium py-3"
              maxLength={200}
            />
          </div>
        </div>
      </div>

      {/* ── Pie del ticket + QR visible ── */}
      <div className="bg-[var(--mg-bg-surface)] rounded-[22px] p-4 border border-[var(--mg-border)] shadow-xs space-y-3">
        <div className="flex items-center gap-2">
          <AppIcon name="recibo" size={20} />
          <div>
            <p className="font-extrabold text-[var(--mg-text-primary)] text-sm">Pie del ticket</p>
            <p className="text-[var(--mg-text-muted)] text-xs">Mensaje de agradecimiento y QR al final</p>
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] font-extrabold text-[var(--mg-text-secondary)]">
            Mensaje de pie de página en el ticket
          </label>
          <input
            type="text"
            value={footerMessage}
            onChange={(e) => setFooterMessage(e.target.value)}
            placeholder="¡Gracias por su compra! Conserve su recibo."
            className="mg-input text-sm font-medium py-3"
            maxLength={160}
          />
        </div>
        <label className="flex items-center gap-2.5 bg-[var(--mg-bg-elevated)] border border-[var(--mg-border)] rounded-2xl px-3 py-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={!!showQrOnTicket}
            onChange={(e) => setShowQrOnTicket(e.target.checked)}
            className="w-4 h-4 accent-[#1670C2] shrink-0"
          />
          <span className="text-xs font-bold text-[var(--mg-text-primary)]">
            Imprimir QR al final del ticket
          </span>
          {!hasQr && (
            <span className="ml-auto text-[10px] font-bold text-[var(--mg-text-muted)]">
              Subí un QR para verlo
            </span>
          )}
        </label>
      </div>
    </div>
  );
}
