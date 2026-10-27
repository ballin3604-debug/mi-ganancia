import 'fake-indexeddb/auto';
import { vi } from 'vitest';

// Polyfill crypto.randomUUID for fake-indexeddb / test environment
if (typeof crypto !== 'undefined' && !crypto.randomUUID) {
  crypto.randomUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };
}

// Minimal navigator.onLine stub (fake-indexeddb does not provide it)
if (typeof navigator === 'undefined') {
  global.navigator = { onLine: true };
}

// Stub window.matchMedia if needed by React components
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
