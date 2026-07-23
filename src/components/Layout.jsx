import { useState, useEffect } from 'react';
import { Outlet, NavLink, Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBusiness } from '../context/BusinessContext';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { SyncErrorPanel } from './SyncErrorPanel';

// ── Icons (estilo iOS — outline, stroke 1.8) ─────────────────────────────
function HomeIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );
}
function CartIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}
function BoxIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  );
}
function WalletIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  );
}
function GearIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
function ChartIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}
function DocumentTextIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}
function BagIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 7V6a6 6 0 1112 0v1m-15 0h18l-1.5 13.5a2 2 0 01-2 1.5H8.5a2 2 0 01-2-1.5L5 7z" />
    </svg>
  );
}

const NAV_ITEMS = [
  {
    label: 'Inicio', Icon: HomeIcon, ownerOnly: false, key: 'dashboard', basePath: '/',
    children: [
      { to: '/', label: 'Resumen', key: 'dashboard-home' },
    ],
  },
  {
    label: 'Ventas', Icon: CartIcon, ownerOnly: false, key: 'sales', basePath: '/ventas',
    children: [
      { to: '/ventas?tab=venta', label: 'Nueva Venta', key: 'sales-new' },
      { to: '/ventas?tab=reporte', label: 'Reporte de Ventas', key: 'sales-report' },
    ],
  },
  {
    label: 'Compras', Icon: BagIcon, ownerOnly: false, key: 'purchases', basePath: '/compras',
    children: [
      { to: '/compras?tab=comprar', label: 'Comprar', key: 'purchases-new' },
      { to: '/compras?tab=historial', label: 'Reporte de Compras', key: 'purchases-report' },
    ],
  },
  {
    label: 'CxC', Icon: DocumentTextIcon, ownerOnly: false, key: 'cxc', basePath: '/cxc',
    children: [
      { to: '/cxc?tab=pending', label: 'Pendientes', key: 'cxc-pending' },
      { to: '/cxc?tab=paid', label: 'Cobros', key: 'cxc-paid' },
    ],
  },
  {
    label: 'Inventario', Icon: BoxIcon, ownerOnly: true, key: 'inventory', basePath: '/inventario',
    children: [
      { to: '/inventario', label: 'Productos', key: 'inventory-products' },
      { to: '/reportes?type=inventory', label: 'Reporte de Inventario', key: 'inventory-report' },
    ],
  },
  {
    label: 'Egresos', Icon: WalletIcon, ownerOnly: true, key: 'expenses', basePath: '/egresos',
    children: [
      { to: '/egresos', label: 'Egresos', key: 'expenses-list' },
      { to: '/reportes?type=expenses', label: 'Reporte de Egresos', key: 'expenses-report' },
    ],
  },
  {
    label: 'Reportes', Icon: ChartIcon, ownerOnly: true, key: 'reports', basePath: '/reportes',
    children: [
      { to: '/reportes?type=profit', label: 'Ganancias Diarias', key: 'reports-profit' },
      { to: '/reportes?type=ranking', label: 'Ranking de Productos', key: 'reports-ranking' },
      { to: '/reportes?type=ranges', label: 'Inversión por Cliente', key: 'reports-ranges' },
      { to: '/reportes?type=expenses', label: 'Reporte de Egresos', key: 'reports-expenses' },
      { to: '/reportes?type=inventory', label: 'Reporte de Inventario', key: 'reports-inventory' },
    ],
  },
  {
    label: 'Ajustes', Icon: GearIcon, ownerOnly: true, key: 'settings', basePath: '/configuracion',
    children: [
      { to: '/configuracion', label: 'General', key: 'settings-general' },
    ],
  },
];

function isChildActive(location, childTo) {
  const [childPath, childQuery] = childTo.split('?');
  if (location.pathname !== childPath) return false;
  if (!childQuery) return true;
  const currentParams = new URLSearchParams(location.search);
  const childParams = new URLSearchParams(childQuery);
  for (const [k, v] of childParams) {
    if (currentParams.get(k) !== v) return false;
  }
  return true;
}

export default function Layout() {
  const { user, role } = useAuth();
  const { business, settings } = useBusiness();
  const { online, pendingCount, errorCount } = useSyncStatus();
  const location = useLocation();
  const [showMenuDrawer, setShowMenuDrawer] = useState(false);
  const [isErrorPanelOpen, setIsErrorPanelOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try {
      const saved = localStorage.getItem('mg-sidebar-open');
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('mg-sidebar-open', String(sidebarOpen));
    } catch { /* localStorage no disponible, ignorar */ }
  }, [sidebarOpen]);
  const [expandedGroups, setExpandedGroups] = useState(() => {
    const initial = {};
    NAV_ITEMS.forEach((item) => {
      if (item.children) initial[item.key] = location.pathname === item.basePath;
    });
    return initial;
  });

  const isCashier = role === 'cashier';

  useEffect(() => {
    if (!showMenuDrawer) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setShowMenuDrawer(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showMenuDrawer]);

  useEffect(() => {
    const activeGroup = NAV_ITEMS.find((item) => item.children && location.pathname === item.basePath);
    if (activeGroup) {
      setExpandedGroups((prev) => (prev[activeGroup.key] ? prev : { ...prev, [activeGroup.key]: true }));
    }
  }, [location.pathname]);

  function toggleGroup(key) {
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const OWNER_ONLY_PATHS = ['/configuracion', '/egresos', '/inventario', '/reportes'];
  if (isCashier && OWNER_ONLY_PATHS.includes(location.pathname)) {
    return <Navigate to="/" replace />;
  }

  const visibleItems = NAV_ITEMS.filter((item) => !item.ownerOnly || !isCashier);
  const mobileItems = visibleItems.map((item) =>
    item.children ? { to: item.basePath, label: item.label, Icon: item.Icon, end: false, key: item.key } : item
  );

  return (
    <div className="min-h-screen bg-[var(--mg-bg-base)] flex flex-col lg:flex-row">

      {/* ── DESKTOP SIDEBAR ── */}
      <aside className={`hidden lg:flex flex-col relative bg-[var(--mg-bg-surface)] border-r border-[var(--mg-border)] shrink-0 sticky top-0 h-screen transition-[width] duration-300 ${sidebarOpen ? 'w-60' : 'w-[76px]'}`}>
        <button
          type="button"
          onClick={() => setSidebarOpen((v) => !v)}
          title={sidebarOpen ? 'Contraer menú' : 'Expandir menú'}
          className="absolute -right-3.5 top-6 w-7 h-7 rounded-full bg-[var(--mg-bg-surface)] border border-[var(--mg-border)] text-[var(--mg-text-secondary)] shadow-md flex items-center justify-center z-30 active:scale-90 transition-transform"
        >
          <svg
            className={`w-4 h-4 transition-transform duration-300 ${sidebarOpen ? '' : 'rotate-180'}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="px-4 py-4 border-b border-[var(--mg-separator)] overflow-hidden">
          <div className={`flex items-center gap-2.5 ${sidebarOpen ? '' : 'justify-center'}`}>
            <img
              src="/logo-icon.png"
              alt="Logo Mi Ganancia"
              className="w-10 h-10 rounded-xl object-contain bg-white p-0.5 shrink-0 shadow-sm border border-[var(--mg-border)]"
            />
            {sidebarOpen && (
              <div className="min-w-0">
                <p className="text-[var(--mg-text-primary)] font-black text-sm leading-tight truncate">
                  Mi Ganancia
                </p>
                <p className="text-[var(--mg-text-muted)] text-[11px] leading-tight mt-0.5 flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${online ? 'bg-[var(--mg-success)] mg-pulse-dot' : 'bg-orange-500 animate-pulse'}`} />
                  {online ? (business?.name || 'Activo') : 'Sin conexión'}
                </p>
                {pendingCount > 0 && (
                  <button
                    onClick={() => setIsErrorPanelOpen(true)}
                    className="mt-1.5 bg-orange-50 hover:bg-orange-100 text-orange-700 text-[9px] font-bold px-2 py-0.5 rounded-full border border-orange-100 w-max flex items-center gap-1 shrink-0 cursor-pointer transition-all hover:scale-105"
                  >
                    <span>⏳ {pendingCount} por sincronizar</span>
                  </button>
                )}
                {errorCount > 0 && (
                  <button
                    onClick={() => setIsErrorPanelOpen(true)}
                    className="mt-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-[9px] font-bold px-2 py-0.5 rounded-full border border-red-100 w-max flex items-center gap-1 shrink-0 cursor-pointer transition-all hover:scale-105"
                  >
                    <span>⚠️ {errorCount} con error</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <nav className="flex-1 px-2.5 py-3 space-y-1 overflow-y-auto overflow-x-hidden">
          {visibleItems.map((item) => {
            const isOpen = !!expandedGroups[item.key];
            const isGroupActive = location.pathname === item.basePath;
            const GroupIcon = item.Icon;

            if (!sidebarOpen) {
              return (
                <Link
                  key={item.key}
                  to={item.basePath}
                  title={item.label}
                  data-tutorial={item.key}
                  className="flex items-center justify-center py-1.5 rounded-[14px] transition-all"
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shrink-0 ${
                    isGroupActive ? 'bg-[#1670C2] text-white shadow-sm' : 'text-gray-400 hover:bg-[var(--mg-bg-elevated)]'
                  }`}>
                    <span className="scale-[0.85] flex items-center justify-center">
                      <GroupIcon />
                    </span>
                  </div>
                </Link>
              );
            }

            return (
              <div key={item.key}>
                <button
                  type="button"
                  onClick={() => toggleGroup(item.key)}
                  data-tutorial={item.key}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-[14px] text-[13px] font-bold transition-all ${
                    isGroupActive ? 'text-[#1670C2] bg-blue-50/60' : 'text-[var(--mg-text-secondary)] hover:bg-[var(--mg-bg-elevated)]'
                  }`}
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all shrink-0 ${
                    isGroupActive ? 'bg-[#1670C2] text-white shadow-sm' : 'text-gray-400'
                  }`}>
                    <span className="scale-[0.85] flex items-center justify-center">
                      <GroupIcon />
                    </span>
                  </div>
                  <span className="flex-1 text-left">{item.label}</span>
                  <svg
                    className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                {isOpen && (
                  <div className="ml-9 mt-0.5 mb-1 space-y-0.5 border-l-2 border-[var(--mg-border)] pl-3">
                    {item.children.map((child) => {
                      const childActive = isChildActive(location, child.to);
                      return (
                        <Link
                          key={child.key}
                          to={child.to}
                          className={`block px-2.5 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${
                            childActive ? 'text-[#1670C2] bg-blue-50/60' : 'text-[var(--mg-text-muted)] hover:bg-[var(--mg-bg-elevated)]'
                          }`}
                        >
                          {child.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className={`px-4 py-4 border-t border-[var(--mg-separator)] flex items-center gap-2.5 overflow-hidden ${sidebarOpen ? '' : 'justify-center px-0'}`}>
          <img
            src={user?.photoURL || ''}
            alt="Avatar"
            title={sidebarOpen ? undefined : (user?.displayName || user?.email)}
            className="w-9 h-9 rounded-full shrink-0 object-cover"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          {sidebarOpen && (
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-[var(--mg-text-primary)] truncate">
                {user?.displayName?.split(' ')[0]}
              </p>
              <p className="text-[11px] text-[var(--mg-text-muted)] truncate">{user?.email}</p>
            </div>
          )}
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div className="flex-1 flex flex-col min-h-screen lg:min-h-0 lg:h-screen lg:overflow-hidden">

        {/* Mobile header — estilo iOS large title */}
        <header className="lg:hidden bg-[var(--mg-bg-base)] px-5 pt-12 pb-3 sticky top-0 z-30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <img
                src="/logo-icon.png"
                alt="Logo Mi Ganancia"
                className="w-10 h-10 rounded-xl object-contain bg-white p-0.5 shrink-0 shadow-sm border border-[var(--mg-border)]"
              />
              <div className="min-w-0">
                <h1 className="text-[var(--mg-text-primary)] text-base font-black leading-tight truncate flex items-center gap-1.5">
                  Mi Ganancia
                  <span className={`w-2 h-2 rounded-full inline-block shrink-0 ${online ? 'bg-[var(--mg-success)]' : 'bg-orange-500 animate-pulse'}`} />
                </h1>
                <p className="text-[var(--mg-text-muted)] text-[11px] leading-tight truncate max-w-[150px]">
                  {online ? (business?.name || 'Activo') : 'Sin conexión'}
                </p>
                {pendingCount > 0 && (
                  <button
                    onClick={() => setIsErrorPanelOpen(true)}
                    className="inline-block bg-orange-50 hover:bg-orange-100 text-orange-700 text-[9px] font-extrabold px-1.5 py-0.5 rounded-md border border-orange-100 mt-0.5 cursor-pointer transition-all hover:scale-105"
                  >
                    ⏳ {pendingCount} pend.
                  </button>
                )}
                {errorCount > 0 && (
                  <button
                    onClick={() => setIsErrorPanelOpen(true)}
                    className="inline-block bg-red-50 hover:bg-red-100 text-red-700 text-[9px] font-extrabold px-1.5 py-0.5 rounded-md border border-red-100 mt-0.5 ml-1 transition-all cursor-pointer"
                  >
                    ⚠️ {errorCount} con error
                  </button>
                )}
              </div>
            </div>
            <img
              src={user?.photoURL || ''}
              alt="Avatar"
              className="w-9 h-9 rounded-full shrink-0 object-cover"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          </div>
        </header>

        <main className={`flex-1 overflow-y-auto pb-24 lg:pb-0 lg:w-full lg:mx-auto lg:px-6 ${location.pathname === '/ventas' || location.pathname === '/compras' ? 'lg:max-w-[1800px]' : 'lg:max-w-[1400px]'}`}>
          <Outlet />
        </main>

        {/* Bottom tab bar estilo iOS */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-[var(--mg-bg-surface)]/95 backdrop-blur-xl border-t border-[var(--mg-separator)] flex justify-around z-30 pb-[env(safe-area-inset-bottom)] pt-1 shadow-lg">
          {/* Inicio Link */}
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-1 px-2 transition-all flex-1 ${
                isActive ? 'text-[#1670C2] font-bold' : 'text-[var(--mg-text-muted)]'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                  isActive ? 'bg-[#1670C2] text-white shadow-sm' : 'text-gray-400'
                }`}>
                  <HomeIcon />
                </div>
                <span className="text-[9px] mt-0.5">Inicio</span>
              </>
            )}
          </NavLink>

          {/* Menú Toggle Button */}
          {(() => {
            const menuPaths = ['/ventas', '/compras', '/inventario', '/egresos', '/reportes', '/configuracion'];
            const isMenuPathActive = menuPaths.some(path => location.pathname === path || (path !== '/' && location.pathname.startsWith(path)));
            
            return (
              <button
                type="button"
                onClick={() => setShowMenuDrawer(true)}
                className={`flex flex-col items-center gap-0.5 py-1 px-2 transition-all flex-1 relative ${
                  isMenuPathActive ? 'text-[#1670C2] font-bold' : 'text-[var(--mg-text-muted)]'
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all relative ${
                  isMenuPathActive ? 'bg-[#1670C2]/10 text-[#1670C2]' : 'text-gray-400'
                }`}>
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                  {isMenuPathActive && (
                    <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-[#1670C2] rounded-full border border-white" />
                  )}
                </div>
                <span className="text-[9px] mt-0.5">Menú</span>
              </button>
            );
          })()}
        </nav>
      </div>

      {/* Drawer flotante móvil (bottom sheet) */}
      {showMenuDrawer && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-xs transition-opacity duration-300"
          onClick={() => setShowMenuDrawer(false)}
        >
          <div 
            className="fixed bottom-0 left-0 right-0 bg-[var(--mg-bg-surface)] rounded-t-[32px] p-6 z-50 shadow-2xl transition-transform duration-300 transform translate-y-0"
            onClick={(e) => e.stopPropagation()}
            style={{
              paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))'
            }}
          >
            {/* Tirador del drawer */}
            <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-6" onClick={() => setShowMenuDrawer(false)} />

            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-black text-[var(--mg-text-primary)]">Menú</h3>
              <button 
                type="button"
                onClick={() => setShowMenuDrawer(false)}
                className="w-7 h-7 rounded-full bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)] hover:text-[var(--mg-text-primary)] flex items-center justify-center font-bold text-base"
              >
                ×
              </button>
            </div>

            {/* Opciones del Menú (excluyendo Inicio) */}
            <div className="grid grid-cols-2 gap-3">
              {mobileItems.filter(item => item.to !== '/').map(({ to, label, Icon, end, key }) => {
                const isActive = location.pathname === to || (to !== '/' && location.pathname.startsWith(to));
                return (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    data-tutorial={key}
                    onClick={() => setShowMenuDrawer(false)}
                    className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all active:scale-95 ${
                      isActive 
                        ? 'bg-blue-50/70 border-blue-200 text-[#1670C2] font-bold shadow-xs' 
                        : 'bg-[var(--mg-bg-elevated)] border-transparent text-[var(--mg-text-secondary)] hover:bg-[var(--mg-bg-elevated)]/50'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 shadow-sm transition-all ${
                      isActive ? 'bg-[#1670C2] text-white' : 'bg-white text-gray-400 border border-[var(--mg-border)]'
                    }`}>
                      <Icon />
                    </div>
                    <span className="text-xs font-bold">{label}</span>
                  </NavLink>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Errores de Sincronización */}
      <SyncErrorPanel
        businessId={business?.id}
        isOpen={isErrorPanelOpen}
        onClose={() => setIsErrorPanelOpen(false)}
      />
    </div>
  );
}
