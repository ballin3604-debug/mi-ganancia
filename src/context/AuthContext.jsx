import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { getUserData } from '../services/auth';
import { isAdmin } from '../services/admin';
import { initializeSyncEngine, syncCacheFromServer } from '../services/syncEngine';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [businessId, setBusinessId] = useState(null);
  const [userStatus, setUserStatus] = useState(null); // 'pending' | 'active' | 'rejected' | 'suspended'
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [role, setRole] = useState(null); // 'owner' | 'cashier' | null
  const [sellerName, setSellerName] = useState(''); // nombre que aparece en ventas
  const [authError, setAuthError] = useState(null);

  const activeSessionIdRef = useRef(0);

  const handleUserSession = useCallback(async (supabaseUser) => {
    const thisSessionId = ++activeSessionIdRef.current;
    setLoading(true);

    if (supabaseUser) {
      const userObj = {
        ...supabaseUser,
        uid: supabaseUser.id,
        displayName: supabaseUser.user_metadata?.displayName || supabaseUser.email,
      };
      try {
        const userData = await getUserData(supabaseUser.id);

        // Guard check right after the await
        if (thisSessionId !== activeSessionIdRef.current) return;

        if (!userData) {
          // Brand new user — no profile doc yet
          setNeedsSetup(true);
          setUserStatus(null);
          setBusinessId(null);
          setSellerName(userObj.displayName || '');
        } else {
          setUserStatus(userData.status || 'active');
          setRole(userData.role === 'cashier' ? 'cashier' : 'owner');
          setSellerName(userData.name || userObj.displayName || '');
          if (userData.business_id) {
            setBusinessId(userData.business_id);
            setNeedsSetup(false);
          } else {
            setBusinessId(null);
            setNeedsSetup(false);
          }
        }
        setUser(userObj);
        setAuthError(null);
      } catch (err) {
        // Guard check inside catch as well
        if (thisSessionId !== activeSessionIdRef.current) return;
        console.error('Error loading user data:', err);
        // Do NOT set needsSetup to true on network/RLS errors
        setNeedsSetup(false);
        setAuthError(err.message || 'Error de conexión con el servidor.');
      }
    } else {
      if (thisSessionId !== activeSessionIdRef.current) return;
      setUser(null);
      setBusinessId(null);
      setUserStatus(null);
      setNeedsSetup(false);
      setRole(null);
      setSellerName('');
      setAuthError(null);
    }

    if (thisSessionId === activeSessionIdRef.current) {
      setLoading(false);
    }
  }, []);

  // Releer la sesión (perfil) bajo demanda — p.ej. botón "Ya me aprobaron"
  const refreshSession = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    await handleUserSession(session?.user || null);
  }, [handleUserSession]);

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleUserSession(session?.user || null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      handleUserSession(session?.user || null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [handleUserSession]);

  // Realtime: si el admin aprueba/suspende/reactiva, la app se entera sola
  // sin recargar ni cerrar sesión. Requiere que `profiles` esté en la
  // publicación supabase_realtime (migración realtime_profiles).
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`profile-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
        () => refreshSession()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, refreshSession]);

  // Respaldo por polling mientras está pendiente (por si el realtime no llega)
  useEffect(() => {
    if (!user?.id || userStatus !== 'pending') return;
    const t = setInterval(async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('status,business_id')
          .eq('id', user.id)
          .single();
        if (data && (data.status !== 'pending' || data.business_id)) {
          refreshSession();
        }
      } catch { /* sigue esperando */ }
    }, 8000);
    return () => clearInterval(t);
  }, [user?.id, userStatus, refreshSession]);

  function completeSetup(bid, userRole = 'owner', displayName = '') {
    setBusinessId(bid);
    setNeedsSetup(false);
    setUserStatus('active');
    setRole(userRole);
    if (displayName) setSellerName(displayName);
  }

  function setRequestSent() {
    setNeedsSetup(false);
    setUserStatus('pending');
  }

  useEffect(() => {
    if (!businessId) return;

    // initializeSyncEngine is async — it resolves to the cleanup function,
    // it does not return one synchronously. Awaiting it here means the
    // 'online'/'offline' listeners and the 15s poll interval it sets up were
    // never removed on businessId change, leaking one full set per switch.
    let cleanup = null;
    let cancelled = false;

    initializeSyncEngine(businessId).then((unsub) => {
      if (cancelled) {
        if (typeof unsub === 'function') unsub();
      } else {
        cleanup = unsub;
      }
    });

    // Sync initial cache from server
    syncCacheFromServer(businessId);

    return () => {
      cancelled = true;
      if (typeof cleanup === 'function') {
        cleanup();
      }
    };
  }, [businessId]);

  const admin = user ? isAdmin(user.id) : false;

  return (
    <AuthContext.Provider value={{
      user, businessId, loading, needsSetup,
      userStatus, admin, role, sellerName, authError,
      completeSetup, setRequestSent, refreshSession,
      // Para cuando el usuario cambia su PROPIO rol desde Ajustes (p.ej. un
      // dueño se autodegrada a cajero, o viceversa) — sin esto, el rol de la
      // sesión activa quedaba desactualizado hasta recargar, y toda la UI de
      // permisos (menú, rutas owner-only) seguía mostrando el rol viejo.
      updateOwnRole: setRole,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
