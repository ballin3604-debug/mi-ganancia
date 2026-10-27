import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import BarcodeScanner from './BarcodeScanner';

vi.mock('html5-qrcode', () => ({
  Html5Qrcode: class {
    static getCameras = vi.fn().mockResolvedValue([]);
  },
  Html5QrcodeSupportedFormats: {
    EAN_13: 1,
    EAN_8: 2,
    UPC_A: 3,
    UPC_E: 4,
    CODE_128: 5,
    CODE_39: 6,
    ITF: 7,
    QR_CODE: 8,
  },
}));

afterEach(cleanup);

describe('BarcodeScanner', () => {
  it('ocupa el espacio disponible en pantalla completa y conserva mensajes y acciones del módulo', () => {
    render(
      <BarcodeScanner fullScreen message="Código no registrado">
        <button type="button">Crear producto</button>
      </BarcodeScanner>,
    );

    const region = document.getElementById('mg-barcode-region');

    expect(region.className).toContain('mg-barcode-fullscreen');
    expect(region.parentElement.className).toContain('flex-1');
    expect(screen.getByText('Código no registrado')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Crear producto' })).toBeTruthy();
  });
});
