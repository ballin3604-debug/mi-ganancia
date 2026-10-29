import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Outlet, NavLink, Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBusiness } from '../context/BusinessContext';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { usePlan } from '../hooks/usePlan';
import { SyncErrorPanel } from './SyncErrorPanel';
import { LogoutModal } from './LogoutModal';
import Ayuda from './Ayuda';

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
function BagIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 7V6a6 6 0 1112 0v1m-15 0h18l-1.5 13.5a2 2 0 01-2 1.5H8.5a2 2 0 01-2-1.5L5 7z" />
    </svg>
  );
}
function StoreIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 10l1.2-5A2 2 0 017.17 3.5h9.66a2 2 0 011.97 1.5L20 10m-16 0h16m-16 0v9a2 2 0 002 2h12a2 2 0 002-2v-9m-16 0l1.5 2.5a2.5 2.5 0 004.4 0L12 10m0 0l1.1 2.5a2.5 2.5 0 004.4 0L19 10m-7 0v11" />
    </svg>
  );
}
function UsersIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2m18 0v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}

const NAV_ITEMS = [
  {
    label: 'Inicio', Icon: HomeIcon, ownerOnly: false, key: 'dashboard', basePath: '/', section: 'Operación',
    children: [
      { to: '/', label: 'Resumen', key: 'dashboard-home' },
    ],
  },
  {
    label: 'Ventas', Icon: CartIcon, ownerOnly: false, key: 'sales', basePath: '/ventas',
    children: [
      { to: '/ventas?tab=venta', label: 'Nueva Venta', key: 'sales-new' },
      { to: '/ventas?tab=pedidos', label: 'Pedidos', key: 'sales-orders', restaurantOnly: true },
      { to: '/ventas?tab=reporte', label: 'Reporte de Ventas', key: 'sales-report' },
      { to: '/ventas?tab=cajeros', label: 'Por Cajero', key: 'sales-cashier', ownerOnly: true },
      { to: '/ventas?tab=bitacora', label: 'Bitácora de pedidos', key: 'sales-order-log', restaurantOnly: true },
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
    label: 'Inventario', Icon: BoxIcon, ownerOnly: true, key: 'inventory', basePath: '/inventario', section: 'Gestión',
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
    label: 'Sucursales', Icon: StoreIcon, ownerOnly: true, key: 'branches', basePath: '/sucursales', section: 'Administración',
    children: [
      { to: '/sucursales', label: 'Sedes y almacenes', key: 'branches-list' },
    ],
  },
  {
    label: 'Equipo', Icon: UsersIcon, ownerOnly: true, key: 'team', basePath: '/equipo',
    children: [
      { to: '/equipo', label: 'Cajeros y accesos', key: 'team-list' },
    ],
  },
  {
    label: 'Reportes', Icon: ChartIcon, ownerOnly: true, key: 'reports', basePath: '/reportes',
    children: [
      { to: '/reportes?type=profit', label: 'Ganancias Diarias', key: 'reports-profit' },
      { to: '/reportes?type=costoVendido', label: 'Costo de lo Vendido', key: 'reports-costo' },
      { to: '/ventas?tab=reporte', label: 'Reporte de Ventas', key: 'reports-sales' },
      { to: '/ventas?tab=cajeros', label: 'Reporte por Cajero', key: 'reports-cashier' },
      { to: '/ventas?tab=bitacora', label: 'Bitácora de pedidos', key: 'reports-order-log', restaurantOnly: true },
      { to: '/compras?tab=historial', label: 'Reporte de Compras', key: 'reports-purchases' },
      { to: '/reportes?type=ranking', label: 'Ranking de Productos', key: 'reports-ranking' },
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
  const { business, settings, sectorConfig } = useBusiness();
  // Logo del negocio: si subió uno en Ajustes, se muestra en toda la app.
  const businessLogo = settings?.logoData || '/logo-icon.png?v=2';
  const businessLogoAlt = business?.name ? `Logo de ${business.name}` : 'Logo Mi Ganancia';
  // Restaurante: sin compras ni sucursales; sin reportes de inventario/compras.
  const isRestaurantMode = !!sectorConfig?.features?.dishes;
  const { online, pendingCount, errorCount } = useSyncStatus();
  const { can } = usePlan();
  const location = useLocation();
  const [showMenuDrawer, setShowMenuDrawer] = useState(false);
  const [showLogout, setShowLogout] = useState(false);
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
    if (!showMenuDrawer) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
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

  const OWNER_ONLY_PATHS = ['/configuracion', '/egresos', '/inventario', '/reportes', '/sucursales', '/equipo'];
  if (isCashier && OWNER_ONLY_PATHS.includes(location.pathname)) {
    return <Navigate to="/" replace />;
  }
  if (isRestaurantMode && (location.pathname.startsWith('/compras') || location.pathname.startsWith('/sucursales'))) {
    return <Navigate to="/" replace />;
  }

  const visibleItems = NAV_ITEMS.filter((item) => !item.ownerOnly || !isCashier)
    .filter((item) => !(isRestaurantMode && (item.key === 'purchases' || item.key === 'branches')))
    .filter((item) => item.key !== 'branches' || can('branches'))
    .map((item) => (
      item.children
        ? {
          ...item,
          children: item.children.filter((child) => {
            if (child.restaurantOnly && !isRestaurantMode) return false;
            if (isRestaurantMode && (
              child.key === 'inventory-report'
              || child.key === 'reports-purchases'
              || child.key === 'reports-inventory'
            )) return false;
            return true;
          }),
        }
        : item
    ));
  // En celular no se muestra la sección Reportes (solo PC).
  const mobileItems = visibleItems.filter((item) => item.key !== 'reports').map((item) =>
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
          aria-label={sidebarOpen ? 'Contraer menú' : 'Expandir menú'}
          aria-expanded={sidebarOpen}
          className="absolute -right-3.5 top-7 w-7 h-7 rounded-full bg-[var(--mg-bg-surface)] border border-[var(--mg-border)] text-[var(--mg-text-muted)] hover:text-[var(--mg-text-primary)] hover:border-[var(--mg-border-hover)] shadow-md flex items-center justify-center z-30 active:scale-90 transition-all"
        >
          <svg
            className={`w-4 h-4 transition-transform duration-300 ${sidebarOpen ? '' : 'rotate-180'}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="px-3 py-4 border-b border-[var(--mg-separator)] overflow-hidden">
          <div className={`flex items-center gap-2.5 ${sidebarOpen ? '' : 'justify-center'}`}>
            <img
              src={businessLogo}
              alt={businessLogoAlt}
              className="w-10 h-10 rounded-xl object-contain shrink-0 border border-[var(--mg-border)]"
            />
            {sidebarOpen && (
              <div className="min-w-0">
                <p className="text-[var(--mg-brand-text)] font-black text-[15px] leading-tight tracking-tight truncate">
                  Mi Ganancia
                </p>
                <p className="text-[var(--mg-text-muted)] text-[11px] leading-tight mt-0.5 flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${online ? 'bg-[var(--mg-success)] mg-pulse-dot' : 'bg-[var(--mg-warning)] animate-pulse'}`} />
                  <span className="truncate">{online ? (business?.name || 'Activo') : 'Sin conexión'}</span>
                </p>
                {pendingCount > 0 && (
                  <button
                    onClick={() => setIsErrorPanelOpen(true)}
                    className="mt-1.5 bg-[var(--mg-gold-bg)] hover:brightness-95 text-[var(--mg-gold-text)] text-[9px] font-bold px-2 py-0.5 rounded-full border border-[var(--mg-gold-border)] w-max flex items-center gap-1 shrink-0 cursor-pointer transition-all"
                  >
                    <span>⏳ {pendingCount} por sincronizar</span>
                  </button>
                )}
                {errorCount > 0 && (
                  <button
                    onClick={() => setIsErrorPanelOpen(true)}
                    className="mt-1.5 bg-[var(--mg-danger-bg)] hover:brightness-95 text-[var(--mg-danger)] text-[9px] font-bold px-2 py-0.5 rounded-full border border-[var(--mg-danger-border)] w-max flex items-center gap-1 shrink-0 cursor-pointer transition-all"
                  >
                    <span>⚠️ {errorCount} con error</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <nav aria-label="Navegación principal" className="flex-1 px-2.5 py-3 space-y-0.5 overflow-y-auto overflow-x-hidden">
          {visibleItems.map((item, index) => {
            const isOpen = !!expandedGroups[item.key];
            const isGroupActive = location.pathname === item.basePath;
            const GroupIcon = item.Icon;
            const prevItem = visibleItems[index - 1];
            const showSection = sidebarOpen && item.section && item.section !== prevItem?.section;

            if (!sidebarOpen) {
              return (
                <Link
                  key={item.key}
                  to={item.basePath}
                  title={item.label}
                  aria-label={item.label}
                  data-tutorial={item.key}
                  className="flex items-center justify-center py-1 rounded-xl"
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors shrink-0 ${
                    isGroupActive ? 'bg-[var(--mg-brand)] text-[var(--mg-brand-contrast)] shadow-sm' : 'text-[var(--mg-text-muted)] hover:bg-[var(--mg-bg-elevated)] hover:text-[var(--mg-text-secondary)]'
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
                {showSection && (
                  <p className={`px-3 pb-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-[var(--mg-text-secondary)] ${index === 0 ? 'pt-1' : 'pt-4'}`}>
                    {item.section}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => toggleGroup(item.key)}
                  data-tutorial={item.key}
                  aria-expanded={isOpen}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-[13px] font-semibold transition-colors ${
                    isGroupActive ? 'text-[var(--mg-brand-text)] bg-[var(--mg-brand-bg)]' : 'text-[var(--mg-text-secondary)] hover:bg-[var(--mg-bg-elevated)]'
                  }`}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors shrink-0 ${
                    isGroupActive ? 'bg-[var(--mg-brand)] text-[var(--mg-brand-contrast)]' : 'text-[var(--mg-text-muted)]'
                  }`}>
                    <span className="scale-[0.85] flex items-center justify-center">
                      <GroupIcon />
                    </span>
                  </div>
                  <span className="flex-1 text-left">{item.label}</span>
                  <svg
                    className={`w-3.5 h-3.5 shrink-0 text-[var(--mg-text-faint)] transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                {isOpen && (
                  <div className="ml-[22px] mt-0.5 mb-1 space-y-0.5 border-l border-[var(--mg-border)] pl-3">
                    {item.children.filter((child) => !child.ownerOnly || !isCashier).map((child) => {
                      const childActive = isChildActive(location, child.to);
                      return (
                        <Link
                          key={child.key}
                          to={child.to}
                          className={`block px-2.5 py-1.5 rounded-lg text-[12px] transition-colors ${
                            childActive ? 'text-[var(--mg-brand-text)] bg-[var(--mg-brand-bg)] font-bold' : 'text-[var(--mg-text-muted)] font-semibold hover:bg-[var(--mg-bg-elevated)] hover:text-[var(--mg-text-secondary)]'
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

        <div className={`px-3 py-3 border-t border-[var(--mg-separator)] overflow-hidden ${sidebarOpen ? '' : 'flex flex-col items-center px-0'}`}>
          <div className={`flex items-center gap-2.5 ${sidebarOpen ? '' : 'flex-col justify-center px-0'}`}>
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt="Avatar"
                title={sidebarOpen ? undefined : (user?.displayName || user?.email)}
                className="w-9 h-9 rounded-full shrink-0 object-cover ring-1 ring-[var(--mg-border)]"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            ) : (
              <span
                title={sidebarOpen ? undefined : (user?.displayName || user?.email)}
                className="w-9 h-9 rounded-full shrink-0 bg-[var(--mg-brand)] text-[var(--mg-brand-contrast)] flex items-center justify-center text-sm font-black"
              >
                {(user?.displayName || user?.email || 'U').charAt(0).toUpperCase()}
              </span>
            )}
            {sidebarOpen && (
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-[var(--mg-text-primary)] truncate">
                  {user?.displayName?.split(' ')[0]}
                </p>
                <p className="text-[11px] text-[var(--mg-text-muted)] truncate">
                  {role === 'cashier' ? 'Cajero de la tienda' : 'Dueño de la tienda'}
                </p>
              </div>
            )}

          <button
            type="button"
            onClick={() => setShowLogout(true)}
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
            className="w-9 h-9 shrink-0 rounded-xl flex items-center justify-center text-[var(--mg-text-muted)] hover:text-[var(--mg-danger)] hover:bg-[var(--mg-danger-bg)] active:scale-90 transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
          </div>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div className="flex-1 flex flex-col min-h-screen lg:min-h-0 lg:h-screen lg:overflow-hidden">

        {/* Mobile header — compacto, con marca y estado */}
        <header className="lg:hidden bg-[var(--mg-topbar)]/95 backdrop-blur-xl px-3 pt-3 pb-2.5 sticky top-0 z-30 border-b border-[var(--mg-separator)]">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={() => setShowMenuDrawer(true)}
                aria-label="Abrir menú"
                aria-expanded={showMenuDrawer}
                className="w-11 h-11 shrink-0 rounded-xl text-[var(--mg-text-primary)] hover:bg-[var(--mg-bg-elevated)] active:scale-90 transition-all flex items-center justify-center -ml-1"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h10" />
                </svg>
              </button>
              <img
                src={businessLogo}
                alt={businessLogoAlt}
                className="w-9 h-9 rounded-lg object-contain shrink-0 border border-[var(--mg-border)]"
              />
              <div className="min-w-0">
                <h1 className="text-[var(--mg-brand-text)] text-[15px] font-black leading-tight truncate flex items-center gap-1.5 tracking-tight">
                  Mi Ganancia
                  <span className={`w-1.5 h-1.5 rounded-full inline-block shrink-0 ${online ? 'bg-[var(--mg-success)]' : 'bg-[var(--mg-warning)] animate-pulse'}`} />
                </h1>
                <p className="text-[var(--mg-text-muted)] text-[11px] leading-tight truncate max-w-[160px]">
                  {online ? (business?.name || 'Activo') : 'Sin conexión'}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  {pendingCount > 0 && (
                    <button
                      onClick={() => setIsErrorPanelOpen(true)}
                      className="inline-block bg-[var(--mg-gold-bg)] text-[var(--mg-gold-text)] text-[9px] font-extrabold px-1.5 py-0.5 rounded-md border border-[var(--mg-gold-border)] cursor-pointer hover:brightness-95 transition-all"
                    >
                      ⏳ {pendingCount} pend.
                    </button>
                  )}
                  {errorCount > 0 && (
                    <button
                      onClick={() => setIsErrorPanelOpen(true)}
                      className="inline-block bg-[var(--mg-danger-bg)] text-[var(--mg-danger)] text-[9px] font-extrabold px-1.5 py-0.5 rounded-md border border-[var(--mg-danger-border)] transition-all cursor-pointer hover:brightness-95"
                    >
                      ⚠️ {errorCount} con error
                    </button>
                  )}
                </div>
              </div>
            </div>
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt="Avatar"
                className="w-10 h-10 rounded-full shrink-0 object-cover ring-1 ring-[var(--mg-border)]"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            ) : (
              <span className="w-10 h-10 rounded-full shrink-0 bg-[var(--mg-brand)] text-[var(--mg-brand-contrast)] flex items-center justify-center text-sm font-black">
                {(user?.displayName || user?.email || 'U').charAt(0).toUpperCase()}
              </span>
            )}
          </div>
        </header>

        <main className={`flex-1 overflow-y-auto pb-24 lg:pb-0 lg:w-full lg:mx-auto lg:px-6 ${location.pathname === '/ventas' || location.pathname === '/compras' || location.pathname === '/' ? 'lg:max-w-[1800px]' : 'lg:max-w-[1400px]'}`}>
          {/* key por ruta: reproduce el fade de entrada en cada navegación */}
          <div key={location.pathname} className="mg-fade-in h-full">
            <Outlet />
          </div>
        </main>

        {/* Bottom tab bar — solo accesos rápidos. El menú completo se abre con el icono superior izquierdo. */}
        <nav aria-label="Accesos rápidos" className="lg:hidden fixed bottom-0 left-0 right-0 bg-[var(--mg-bg-surface)]/95 backdrop-blur-xl border-t border-[var(--mg-separator)] flex justify-around z-30 pb-[env(safe-area-inset-bottom)] pt-1.5 shadow-[var(--mg-shadow-md)]">
          {/* Inicio Link */}
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 pt-1 pb-1 px-2 min-h-[48px] flex-1 transition-colors ${
                isActive ? 'text-[var(--mg-brand-text)]' : 'text-[var(--mg-text-muted)] hover:text-[var(--mg-text-secondary)]'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                  isActive ? 'bg-[var(--mg-brand)] text-[var(--mg-brand-contrast)]' : 'text-[var(--mg-text-muted)]'
                }`}>
                  <HomeIcon />
                </div>
                <span className={`text-[10px] ${isActive ? 'font-bold' : 'font-semibold'}`}>Inicio</span>
              </>
            )}
          </NavLink>

          {/* Ventas — acceso rápido */}
          <NavLink
            to="/ventas"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 pt-1 pb-1 px-2 min-h-[48px] flex-1 transition-colors ${
                isActive ? 'text-[var(--mg-brand-text)]' : 'text-[var(--mg-text-muted)] hover:text-[var(--mg-text-secondary)]'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                  isActive ? 'bg-[var(--mg-brand)] text-[var(--mg-brand-contrast)]' : 'text-[var(--mg-text-muted)]'
                }`}>
                  <CartIcon />
                </div>
                <span className={`text-[10px] ${isActive ? 'font-bold' : 'font-semibold'}`}>Ventas</span>
              </>
            )}
          </NavLink>
        </nav>
      </div>

      {/* Panel lateral móvil (drawer izquierdo estilo app) */}
      <AnimatePresence>
        {showMenuDrawer && (
          <div className="lg:hidden fixed inset-0 z-40">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
              onClick={() => setShowMenuDrawer(false)}
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              role="dialog"
              aria-modal="true"
              aria-label="Menú de navegación"
              className="absolute top-0 bottom-0 left-0 w-[84%] max-w-xs bg-[var(--mg-bg-surface)] border-r border-[var(--mg-border)] shadow-2xl flex flex-col"
              style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
            >
              {/* Marca */}
              <div className="flex items-center gap-2.5 px-4 pt-4 pb-3.5 border-b border-[var(--mg-separator)]">
                <img
                  src={businessLogo}
                  alt={businessLogoAlt}
                  className="w-9 h-9 rounded-lg object-contain shrink-0 border border-[var(--mg-border)]"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[var(--mg-brand-text)] font-black text-base leading-tight truncate tracking-tight">
                    Mi Ganancia
                  </p>
                  <p className="text-[var(--mg-text-muted)] text-[11px] leading-tight truncate">
                    {business?.name || ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowMenuDrawer(false)}
                  aria-label="Cerrar menú"
                  className="w-11 h-11 shrink-0 rounded-xl flex items-center justify-center text-[var(--mg-text-muted)] hover:bg-[var(--mg-bg-elevated)] hover:text-[var(--mg-text-primary)] active:scale-90 transition-all -mr-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Navegación */}
              <nav aria-label="Secciones" className="flex-1 overflow-y-auto py-2">
                {mobileItems.map(({ to, label, Icon, end, key }) => {
                  const isActive = to === '/'
                    ? location.pathname === '/'
                    : location.pathname === to || location.pathname.startsWith(to);
                  return (
                    <NavLink
                      key={to}
                      to={to}
                      end={end}
                      data-tutorial={key}
                      onClick={() => setShowMenuDrawer(false)}
                      className={`relative flex items-center gap-3 px-4 py-3 min-h-[48px] transition-colors active:bg-[var(--mg-bg-elevated)] ${
                        isActive
                          ? 'text-[var(--mg-brand-text)] font-bold bg-[var(--mg-brand-bg)]'
                          : 'text-[var(--mg-text-secondary)] font-semibold hover:bg-[var(--mg-bg-elevated)]'
                      }`}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-[var(--mg-brand)] rounded-r-full" />
                      )}
                      <span className={`w-6 h-6 flex items-center justify-center shrink-0 ${isActive ? 'text-[var(--mg-brand-text)]' : 'text-[var(--mg-text-muted)]'}`}>
                        <Icon />
                      </span>
                      <span className="text-[15px]">{label}</span>
                    </NavLink>
                  );
                })}
              </nav>

              {/* Usuario */}
              <div className="border-t border-[var(--mg-separator)] px-4 py-3 flex items-center gap-2.5">
                {user?.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt="Avatar"
                    className="w-10 h-10 rounded-full object-cover shrink-0"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                ) : (
                  <span className="w-10 h-10 rounded-full bg-[var(--mg-brand)] text-[var(--mg-brand-contrast)] flex items-center justify-center font-black text-lg shrink-0">
                    {(user?.displayName || user?.email || 'U').charAt(0).toUpperCase()}
                  </span>
                )}
                <p className="flex-1 min-w-0 text-[13px] text-[var(--mg-text-muted)] font-medium truncate">
                  {user?.email || user?.phone || ''}
                </p>
                <button
                  type="button"
                  onClick={() => { setShowMenuDrawer(false); setShowLogout(true); }}
                  title="Cerrar sesión"
                  aria-label="Cerrar sesión"
                  className="w-9 h-9 shrink-0 rounded-xl flex items-center justify-center text-[var(--mg-text-muted)] hover:text-[var(--mg-danger)] hover:bg-[var(--mg-danger-bg)] active:scale-90 transition-all"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Errores de Sincronización */}
      <SyncErrorPanel
        businessId={business?.id}
        isOpen={isErrorPanelOpen}
        onClose={() => setIsErrorPanelOpen(false)}
      />

      {/* Confirmación de cierre de sesión */}
      <LogoutModal
        isOpen={showLogout}
        onClose={() => setShowLogout(false)}
        user={user}
        business={business}
      />

      {/* Ayuda contextual "?" — una sola vez aquí, sirve para todas las pantallas */}
      <Ayuda />
    </div>
  );
}
