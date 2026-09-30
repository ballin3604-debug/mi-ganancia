import { useEffect, useRef, useState } from 'react';

// Cámara dentro de la app para fotos de productos.
// A diferencia del <input type="file" capture>, NO sale del formulario:
// en celulares de gama baja, abrir la cámara del sistema mata la página y
// la foto nunca llega. Aquí todo pasa en memoria y la foto se guarda al instante.
export default function PhotoCamera({ onCapture, maxSize = 800, quality = 0.8 }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [starting, setStarting] = useState(true);
  const [error, setError] = useState('');
  const [taking, setTaking] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      setStarting(true);
      setError('');
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('no-camera');
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch (err) {
        console.error('PhotoCamera:', err);
        if (!cancelled) {
          const msg = String(err?.message || '');
          if (/denied|not allowed|permission/i.test(msg)) {
            setError('Sin permiso de cámara. Permítelo en el navegador o usa Galería.');
          } else {
            setError('No se pudo abrir la cámara en este dispositivo. Usa Galería.');
          }
        }
      } finally {
        if (!cancelled) setStarting(false);
      }
    }

    const t = setTimeout(start, 100);
    return () => {
      cancelled = true;
      clearTimeout(t);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((tr) => tr.stop());
        streamRef.current = null;
      }
    };
  }, []);

  function handleCapture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth || taking) return;
    setTaking(true);
    try {
      const scale = Math.min(1, maxSize / Math.max(video.videoWidth, video.videoHeight));
      const w = Math.max(1, Math.round(video.videoWidth * scale));
      const h = Math.max(1, Math.round(video.videoHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(video, 0, 0, w, h);
      onCapture(canvas.toDataURL('image/jpeg', quality));
    } catch (err) {
      console.error('PhotoCamera capture:', err);
      setError('No se pudo tomar la foto. Intenta de nuevo.');
      setTaking(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="relative rounded-2xl overflow-hidden bg-black border border-[var(--mg-border)]">
        <video
          ref={videoRef}
          playsInline
          muted
          className="w-full max-h-[50vh] object-cover bg-black"
        />
        {starting && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 text-white">
            <span className="w-8 h-8 border-[3px] border-white/30 border-t-white rounded-full animate-spin" />
            <p className="text-xs font-semibold">Abriendo cámara…</p>
          </div>
        )}
        {!starting && !error && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="w-[80%] aspect-square max-h-[80%] border-2 border-dashed border-white/50 rounded-2xl" />
          </div>
        )}
      </div>

      {error && (
        <p className="text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          ⚠️ {error}
        </p>
      )}

      {!error && (
        <button
          type="button"
          onClick={handleCapture}
          disabled={starting || taking}
          className="w-full bg-[var(--mg-accent)] text-white font-black py-3.5 rounded-2xl text-sm active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {taking ? (
            <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          ) : (
            <>📸 Tomar foto</>
          )}
        </button>
      )}
    </div>
  );
}
