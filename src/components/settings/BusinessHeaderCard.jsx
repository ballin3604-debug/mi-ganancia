import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BUSINESS_CATEGORIES, getCategoryById } from '../../config/businessCategories';

export function BusinessHeaderCard({
  businessCategory,
  setBusinessCategory,
  slogan,
  setSlogan,
  phone,
  setPhone,
  logoData,
  setLogoData,
  qrData,
  setQrData,
  onImagePick,
  onQRPick
}) {
  const [showRubroModal, setShowRubroModal] = useState(false);
  const logoRef = useRef(null);
  const qrRef = useRef(null);

  const currentCat = getCategoryById(businessCategory);

  return (
    <div className="space-y-4">
      {/* Modal Selector de Rubro Comercial */}
      <AnimatePresence>
        {showRubroModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs mg-backdrop-in">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[var(--mg-bg-surface)] w-full max-w-md rounded-[24px] p-5 border border-[var(--mg-border)] shadow-xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-[var(--mg-text-primary)] text-base">Seleccionar Rubro</h3>
                  <p className="text-xs text-[var(--mg-text-muted)]">Elige la categoría de tu comercio</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRubroModal(false)}
                  className="w-8 h-8 rounded-full bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)] font-bold text-sm flex items-center justify-center hover:bg-[var(--mg-bg-section)]"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[60vh] overflow-y-auto pr-1">
                {BUSINESS_CATEGORIES.map((cat) => {
                  const isSelected = cat.id === businessCategory;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setBusinessCategory(cat.id);
                        setShowRubroModal(false);
                      }}
                      className={`p-3.5 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                        isSelected
                          ? 'border-[var(--mg-accent)] bg-[var(--mg-accent-bg)] font-bold text-[var(--mg-accent-text)]'
                          : 'border-[var(--mg-border)] bg-[var(--mg-bg-surface)] hover:bg-[var(--mg-bg-elevated)] text-[var(--mg-text-primary)]'
                      }`}
                    >
                      <span className="text-2xl">{cat.emoji}</span>
                      <span className="text-xs font-bold leading-snug">{cat.name}</span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Grid de Formulario: Rubro, Logo, Slogan, Teléfono y QR */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Rubro comercial */}
        <div className="bg-[var(--mg-bg-surface)] rounded-[22px] p-4 border border-[var(--mg-border)] shadow-xs md:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-xl shrink-0">{currentCat.emoji}</span>
              <div className="min-w-0">
                <p className="font-extrabold text-[var(--mg-text-primary)] text-sm">Rubro comercial</p>
                <p className="text-[var(--mg-text-muted)] text-xs font-bold truncate">{currentCat.name}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowRubroModal(true)}
              className="px-3.5 py-2 bg-[var(--mg-bg-elevated)] hover:bg-[var(--mg-bg-section)] text-[var(--mg-text-primary)] font-bold text-xs rounded-xl border border-[var(--mg-border)] transition-all active:scale-95 shrink-0 min-h-[40px] flex items-center gap-1.5"
            >
              <span>✏️ Cambiar</span>
            </button>
          </div>
        </div>
        {/* Logo */}
        <div className="bg-[var(--mg-bg-surface)] rounded-[22px] p-4 border border-[var(--mg-border)] space-y-3 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="text-xl">🏪</span>
            <div>
              <p className="font-extrabold text-[var(--mg-text-primary)] text-sm">Logo del negocio</p>
              <p className="text-[var(--mg-text-muted)] text-xs">Se imprime en el recibo digital/térmico</p>
            </div>
          </div>

          <div className="flex items-center gap-4 pt-1">
            {logoData ? (
              <img
                src={logoData}
                alt="Logo del negocio"
                className="w-20 h-20 rounded-2xl object-contain border border-[var(--mg-accent-border)] bg-[var(--mg-bg-elevated)] shrink-0 p-1"
              />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-[var(--mg-bg-elevated)] flex items-center justify-center text-3xl shrink-0 border-2 border-dashed border-[var(--mg-border)]">
                🏪
              </div>
            )}

            <div className="flex-1 space-y-2">
              <button
                type="button"
                onClick={() => logoRef.current?.click()}
                className="w-full bg-[var(--mg-accent)] hover:bg-[var(--mg-accent-hover)] text-white font-bold py-2.5 rounded-xl text-xs active:scale-95 transition-all min-h-[44px]"
              >
                📁 {logoData ? 'Cambiar logo' : 'Subir logo'}
              </button>
              {logoData && (
                <button
                  type="button"
                  onClick={() => setLogoData('')}
                  aria-label="Quitar logo"
                  className="w-full bg-[var(--mg-danger-bg)] text-[var(--mg-danger)] hover:bg-red-100 font-bold py-2 rounded-xl text-xs active:scale-95 transition-all min-h-[36px]"
                >
                  Quitar logo
                </button>
              )}
            </div>
          </div>
          <input
            ref={logoRef}
            type="file"
            accept="image/*"
            aria-label="Seleccionar archivo de logo"
            className="hidden"
            onChange={(e) => onImagePick(e, setLogoData, 250)}
          />
        </div>

        {/* QR de cobro */}
        <div className="bg-[var(--mg-bg-surface)] rounded-[22px] p-4 border border-[var(--mg-border)] space-y-3 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="text-xl">📱</span>
            <div>
              <p className="font-extrabold text-[var(--mg-text-primary)] text-sm">QR de Cobro</p>
              <p className="text-[var(--mg-text-muted)] text-xs">QR de Tigo Money, BCP, BNB, etc.</p>
            </div>
          </div>

          <div className="flex items-center gap-4 pt-1">
            {qrData ? (
              <img
                src={qrData}
                alt="QR de cobro"
                className="w-20 h-20 rounded-2xl object-contain border border-[var(--mg-accent-border)] bg-[var(--mg-bg-elevated)] shrink-0 p-1"
              />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-[var(--mg-bg-elevated)] flex flex-col items-center justify-center shrink-0 border-2 border-dashed border-[var(--mg-border)] gap-1">
                <span className="text-xl">📱</span>
                <span className="text-[var(--mg-text-faint)] text-[10px]">Sin QR</span>
              </div>
            )}

            <div className="flex-1 space-y-2">
              <button
                type="button"
                onClick={() => qrRef.current?.click()}
                className="w-full bg-[var(--mg-accent-bg)] hover:bg-[var(--mg-accent-border)] text-[var(--mg-accent)] font-bold py-2.5 rounded-xl text-xs active:scale-95 transition-all border border-[var(--mg-accent-border)] min-h-[44px]"
              >
                📁 {qrData ? 'Cambiar QR' : 'Subir QR'}
              </button>
              {qrData && (
                <button
                  type="button"
                  onClick={() => setQrData('')}
                  aria-label="Quitar QR"
                  className="w-full bg-[var(--mg-danger-bg)] text-[var(--mg-danger)] hover:bg-red-100 font-bold py-2 rounded-xl text-xs active:scale-95 transition-all min-h-[36px]"
                >
                  Quitar QR
                </button>
              )}
            </div>
          </div>
          <input
            ref={qrRef}
            type="file"
            accept="image/*"
            aria-label="Seleccionar archivo de QR"
            className="hidden"
            onChange={onQRPick}
          />
        </div>

        {/* Slogan */}
        <div className="bg-[var(--mg-bg-surface)] rounded-[22px] p-4 border border-[var(--mg-border)] space-y-2 shadow-xs">
          <label className="flex items-center gap-2">
            <span className="text-xl">✨</span>
            <div>
              <p className="font-extrabold text-[var(--mg-text-primary)] text-sm">Slogan del Negocio</p>
              <p className="text-[var(--mg-text-muted)] text-xs">Frase corta impresa en el recibo</p>
            </div>
          </label>
          <input
            type="text"
            value={slogan}
            onChange={(e) => setSlogan(e.target.value)}
            placeholder='Ej: "La mejor tienda del barrio"'
            className="mg-input text-sm font-medium py-3"
            maxLength={80}
          />
        </div>

        {/* Teléfono */}
        <div className="bg-[var(--mg-bg-surface)] rounded-[22px] p-4 border border-[var(--mg-border)] space-y-2 shadow-xs">
          <label className="flex items-center gap-2">
            <span className="text-xl">📞</span>
            <div>
              <p className="font-extrabold text-[var(--mg-text-primary)] text-sm">Teléfono / WhatsApp</p>
              <p className="text-[var(--mg-text-muted)] text-xs">Contacto para clientes en el recibo</p>
            </div>
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Ej: +591 70000000"
            className="mg-input text-sm font-medium py-3"
            maxLength={20}
          />
        </div>
      </div>
    </div>
  );
}
