import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { AppIcon } from './icons';

const SCAN_REGION_ID = 'mg-barcode-region';

// Vista de cámara para escanear códigos de barras del producto
// (EAN-13, UPC, Code128, QR...). El padre recibe cada código vía onScan
// y decide qué hacer (sumar al carrito, buscar en inventario, etc.).
// Incluye entrada manual por si la cámara falla o no hay luz.
export default function BarcodeScanner({ onScan, autoResumeMs = 1800, fullScreen = false, message = null, children = null }) {
  const scannerRef = useRef(null);
  const lastCodeRef = useRef({ code: '', at: 0 });
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const [starting, setStarting] = useState(true);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const [manual, setManual] = useState('');
  const startedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      setStarting(true);
      setError('');
      try {
        const devices = await Html5Qrcode.getCameras().catch(() => []);
        if (cancelled) return;

        const scanner = new Html5Qrcode(SCAN_REGION_ID, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.ITF,
            Html5QrcodeSupportedFormats.QR_CODE,
          ],
          verbose: false,
        });
        scannerRef.current = scanner;

        // Preferir cámara trasera en celular
        let cameraConfig = { facingMode: 'environment' };
        const rear = (devices || []).find((d) =>
          /back|rear|trasera|environment/i.test(d.label || '')
        );
        if (rear) cameraConfig = rear.id;

        await scanner.start(
          cameraConfig,
          {
            fps: 10,
            qrbox: fullScreen
              ? (width, height) => ({
                  width: Math.min(Math.round(width * 0.82), 420),
                  height: Math.min(Math.round(height * 0.28), 220),
                })
              : { width: 250, height: 140 },
            ...(!fullScreen ? { aspectRatio: 1.4 } : {}),
          },
          (decodedText) => {
            const code = String(decodedText || '').trim();
            if (!code) return;
            const now = Date.now();
            // Evitar doble lectura del mismo código pegado al lector
            if (lastCodeRef.current.code === code && now - lastCodeRef.current.at < autoResumeMs) return;
            lastCodeRef.current = { code, at: now };
            setFlash(code);
            onScanRef.current?.(code);
            setTimeout(() => setFlash(''), 1500);
          },
          () => { /* frame sin código: silencioso */ }
        );
        if (cancelled) {
          await scanner.stop().catch(() => {});
          await scanner.clear().catch(() => {});
          return;
        }
        startedRef.current = true;
      } catch (err) {
        console.error('BarcodeScanner:', err);
        if (cancelled) return;
        const msg = String(err?.message || err || '');
        if (/permission|denied|not allowed/i.test(msg)) {
          setError('Sin permiso de cámara. Permite el acceso en tu navegador o escribe el código abajo.');
        } else if (/not found|no camera|devices/i.test(msg)) {
          setError('No se encontró cámara en este dispositivo. Escribe el código abajo.');
        } else if (/secure|https/i.test(msg)) {
          setError('La cámara requiere conexión segura (HTTPS). Escribe el código abajo.');
        } else {
          setError('No se pudo abrir la cámara. Escribe el código abajo.');
        }
      } finally {
        if (!cancelled) setStarting(false);
      }
    }

    // Pequeño delay para que el div del DOM exista antes de montar el video
    const t = setTimeout(start, 150);

    return () => {
      cancelled = true;
      clearTimeout(t);
      const s = scannerRef.current;
      scannerRef.current = null;
      if (s) {
        (async () => {
          try {
            if (startedRef.current) await s.stop();
          } catch { /* ya detenido */ }
          try { await s.clear(); } catch { /* ignore */ }
          startedRef.current = false;
        })();
      }
    };
  }, [autoResumeMs, fullScreen]);

  function handleManual(e) {
    e?.preventDefault();
    const code = manual.trim();
    if (!code) return;
    lastCodeRef.current = { code, at: Date.now() };
    setFlash(code);
    onScanRef.current?.(code);
    setManual('');
    setTimeout(() => setFlash(''), 1500);
  }

  const messageText = typeof message === 'string' ? message : message?.text;
  const messageIsSuccess = typeof message === 'object' && message?.ok;

  return (
    <div className={fullScreen ? 'flex flex-1 min-h-0 flex-col gap-3' : 'space-y-3'}>
      <div className={`relative overflow-hidden bg-black ${fullScreen ? 'flex-1 min-h-[220px]' : 'rounded-2xl border border-[var(--mg-border)]'}`}>
        <div
          id={SCAN_REGION_ID}
          className={fullScreen ? 'mg-barcode-fullscreen' : 'w-full min-h-[220px] [&_video]:!rounded-2xl'}
        />
        {starting && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 text-white">
            <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-white/30 border-t-white" />
            <p className="text-xs font-semibold">Abriendo cámara…</p>
            <p className="text-[11px] text-white/60">Apunta al código de barras</p>
          </div>
        )}
        {!starting && flash && (
          <div className="mg-fade-in absolute left-1/2 top-2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-[var(--mg-success)] px-3 py-1.5 text-xs font-black text-white shadow-lg">
            <AppIcon name="check" size={13} color="#fff" />
            {flash.slice(0, 20)}
          </div>
        )}
        {/* Marco guía */}
        {!starting && !error && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className={fullScreen ? 'relative w-[82%] max-w-[420px] h-[28%] max-h-[220px] rounded-xl border-2 border-white/70' : 'w-[70%] h-[45%] border-2 border-dashed border-white/50 rounded-xl'}>
              {fullScreen && <span className="absolute left-0 right-0 top-1/2 h-0.5 -translate-y-1/2 bg-rose-500/90 shadow-[0_0_8px_rgba(244,63,94,0.8)]" />}
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="flex items-start gap-2 rounded-xl border border-[var(--mg-gold-border)] bg-[var(--mg-gold-bg)] px-3 py-2 text-xs font-semibold text-[var(--mg-gold-text)]">
          <AppIcon name="ayuda" size={14} />
          <span>{error}</span>
        </p>
      )}

      {messageText && (
        <div className={`flex shrink-0 items-start gap-2 rounded-xl border px-3 py-2 text-xs font-bold ${messageIsSuccess ? 'border-[var(--mg-success-border)] bg-[var(--mg-success-bg)] text-[var(--mg-success-text)]' : 'border-[var(--mg-gold-border)] bg-[var(--mg-gold-bg)] text-[var(--mg-gold-text)]'}`}>
          <AppIcon name={messageIsSuccess ? 'check' : 'ayuda'} size={14} />
          <span>{messageText}</span>
        </div>
      )}

      {children}

      <form onSubmit={handleManual} className="flex shrink-0 gap-2">
        <input
          type="text"
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder="Escribe el código (ej: 7771234567890)"
          inputMode="numeric"
          className="mg-input min-w-0 flex-1 py-2.5 font-mono text-sm"
        />
        <button
          type="submit"
          disabled={!manual.trim()}
          className="shrink-0 rounded-xl bg-[var(--mg-brand)] px-4 text-sm font-bold text-white transition-colors hover:bg-[var(--mg-brand-hover)] active:scale-95 disabled:opacity-40"
        >
          Buscar
        </button>
      </form>
    </div>
  );
}
