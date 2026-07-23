import { supabase } from '../services/supabaseClient';

/**
 * Resize & optimize images.
 * - Regular images (logos, products): 300px max, JPEG 0.72
 * - QR codes: 600px max, PNG (lossless) — critical for scan accuracy
 */
function resizeImage(file, maxSize, format, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        // Scale down only if larger than maxSize
        if (width > height) {
          if (width > maxSize) { height = Math.round((height * maxSize) / width); width = maxSize; }
        } else {
          if (height > maxSize) { width = Math.round((width * maxSize) / height); height = maxSize; }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        // For QR: white background + nearest-neighbor (sharp pixels)
        if (format === 'png') {
          ctx.imageSmoothingEnabled = false;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
        } else {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
        }

        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL(format === 'png' ? 'image/png' : 'image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function useImageUpload() {
  async function pickImage(file, maxSize = 300) {
    if (!file) return null;
    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona una imagen.');
      return null;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('La imagen es muy grande. Máximo 10MB.');
      return null;
    }
    return resizeImage(file, maxSize, 'jpeg', 0.72);
  }

  /**
   * Special handler for QR codes:
   * - Uses PNG (lossless, no JPEG artifacts)
   * - Higher resolution (600px)
   * - Sharpening pass to improve contrast
   * - White background guaranteed
   */
  async function pickQR(file) {
    if (!file) return null;
    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona una imagen.');
      return null;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('La imagen es muy grande. Máximo 10MB.');
      return null;
    }

    // Step 1: resize to 600px PNG
    const base64 = await resizeImage(file, 600, 'png', 1.0);

    // Step 2: apply contrast boost to make QR modules pure black/white
    const sharpened = await applyQRSharpening(base64);
    return sharpened;
  }

  /**
   * Resize + upload to Supabase Storage (bucket "product-images") and return
   * the public URL. Used ONLY by admin catalog screens (master catalog,
   * per-store photo replacement) — those are always-online flows.
   * NOT offline-safe: unlike pickImage(), this requires connectivity.
   *
   * @param {File} file
   * @param {string} path e.g. `master/${masterProductId}.jpg` or `products/${businessId}/${productId}.jpg`
   */
  async function uploadProductImage(file, path) {
    if (!file) return null;
    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona una imagen.');
      return null;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('La imagen es muy grande. Máximo 10MB.');
      return null;
    }

    const dataUrl = await resizeImage(file, 300, 'jpeg', 0.72);
    const blob = await (await fetch(dataUrl)).blob();

    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(path, blob, { contentType: 'image/jpeg', upsert: true });
    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('product-images').getPublicUrl(path);
    // Cache-busting param: same path can point to different bytes after a
    // replacement upload (upsert), so the URL must change for the SW/browser
    // cache-first strategy to fetch the new file instead of serving stale.
    return `${data.publicUrl}?v=${Date.now()}`;
  }

  return { pickImage, pickQR, uploadProductImage };
}

function applyQRSharpening(base64) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      // Read pixel data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Boost contrast: push pixels toward pure black or pure white
      for (let i = 0; i < data.length; i += 4) {
        const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
        // Threshold at 128 — anything below → black, above → white
        const val = avg < 128 ? 0 : 255;
        data[i] = val;
        data[i + 1] = val;
        data[i + 2] = val;
        data[i + 3] = 255; // full opacity
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.src = base64;
  });
}
