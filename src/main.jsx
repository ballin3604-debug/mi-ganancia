import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { BusinessProvider } from './context/BusinessContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import './index.css';

function showUpdateBanner(worker) {
  if (document.getElementById('pwa-update-banner')) return;

  const banner = document.createElement('div');
  banner.id = 'pwa-update-banner';
  banner.style.cssText = `
    position: fixed;
    bottom: 16px;
    left: 16px;
    right: 16px;
    z-index: 9999;
    background: rgba(15, 23, 42, 0.95);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    color: white;
    padding: 16px;
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    font-family: system-ui, -apple-system, sans-serif;
    animation: pwa-fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  `;

  // Inject keyframes if not present
  if (!document.getElementById('pwa-keyframes')) {
    const style = document.createElement('style');
    style.id = 'pwa-keyframes';
    style.innerHTML = `
      @keyframes pwa-fadeInUp {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `;
    document.head.appendChild(style);
  }

  banner.innerHTML = `
    <div style="flex: 1; display: flex; align-items: center; gap: 8px;">
      <span style="font-size: 1.25rem;">✨</span>
      <div>
        <p style="margin: 0; font-size: 14px; font-weight: 700; color: #fff;">Actualización lista</p>
        <p style="margin: 2px 0 0 0; font-size: 12px; color: #94a3b8;">Nueva versión disponible para tu tienda.</p>
      </div>
    </div>
    <div style="display: flex; gap: 8px; shrink: 0;">
      <button id="pwa-update-btn" style="background: #007aff; color: white; border: none; font-weight: 700; font-size: 12px; padding: 8px 16px; border-radius: 10px; cursor: pointer; transition: all 0.2s; white-space: nowrap;">
        Actualizar
      </button>
      <button id="pwa-close-btn" style="background: transparent; color: #64748b; border: none; font-size: 18px; cursor: pointer; padding: 0 4px;">
        ×
      </button>
    </div>
  `;

  document.body.appendChild(banner);

  document.getElementById('pwa-update-btn').addEventListener('click', () => {
    worker.postMessage('SKIP_WAITING');
    banner.remove();
  });

  document.getElementById('pwa-close-btn').addEventListener('click', () => {
    banner.remove();
  });
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      // Check if there is already a waiting worker
      if (registration.waiting) {
        showUpdateBanner(registration.waiting);
      }

      // Check for updates
      registration.addEventListener('updatefound', () => {
        const installingWorker = registration.installing;
        if (installingWorker) {
          installingWorker.addEventListener('statechange', () => {
            if (installingWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                showUpdateBanner(installingWorker);
              }
            }
          });
        }
      });
    }).catch((err) => {
      console.warn('SW registration failed:', err);
    });

    // Reload the page once the new Service Worker activates
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <BusinessProvider>
          <ThemeProvider>
            <App />
          </ThemeProvider>
        </BusinessProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
