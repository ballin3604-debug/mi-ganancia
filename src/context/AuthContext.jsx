import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { supabase, isSupabaseConfigured, supabaseConfigError } from '../services/supabaseClient';
import { getUserData } from '../services/auth';
import { isAdmin } from '../services/admin';
import { findInviteForEmail, joinBusinessWithCode } from '../services/cashier';
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
  const [memberPermissions, setMemberPermissions] = useState(null); // null = defecto por rol
  const [memberBranches, setMemberBranches] = useState(null); // null = todas las sedes
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
          // Sin perfil: ¿lo invitaron por correo? Entra directo, sin PIN.
          try {
            const invite = await findInviteForEmail(supabaseUser.email);
            if (invite) {
              if (thisSessionId !== activeSessionIdRef.current) return;
              const displayName = supabaseUser.user_metadata?.displayName || supabaseUser.email;
              await joinBusinessWithCode(supabaseUser, invite.code, displayName, {});
              const fresh = await getUserData(supabaseUser.id);
              if (fresh) {
                if (thisSessionId !== activeSessionIdRef.current) return;
                setUserStatus(fresh.status || 'active');
                setRole(fresh.role === 'cashier' ? 'cashier' : 'owner');
                setSellerName(fresh.name || userObj.displayName || '');
                setMemberPermissions(Array.isArray(fresh.custom_permissions) ? fresh.custom_permissions : null);
                if (fresh.business_id) {
                  setBusinessId(fresh.business_id);
                  setNeedsSetup(false);
                } else {
                  setBusinessId(null);
                  setNeedsSetup(false);
                }
                setUser(userObj);
                setAuthError(null);
                setLoading(false);
                return;
              }
            }
          } catch { /* sin invitación: flujo normal */ }
          // Brand new user — no profile doc yet
          setNeedsSetup(true);
          setUserStatus(null);
          setBusinessId(null);
          setSellerName(userObj.displayName || '');
          setMemberPermissions(null);
          setMemberBranches(null);
        } else {
          setUserStatus(userData.status || 'active');
          setRole(userData.role === 'cashier' ? 'cashier' : 'owner');
          setSellerName(userData.name || userObj.displayName || '');
          setMemberPermissions(Array.isArray(userData.custom_permissions) ? userData.custom_permissions : null);
          setMemberBranches(Array.isArray(userData.branch_ids) ? userData.branch_ids : null);
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
      setMemberPermissions(null);
      setMemberBranches(null);
      setAuthError(null);
    }

    if (thisSessionId === activeSessionIdRef.current) {
      setLoading(false);
    }
  }, []);

  // Releer la sesión (perfil) bajo demanda — p.ej. botón "Ya me aprobaron"
  const refreshSession = useCallback(async () => {
    if (!supabase) {
      setAuthError(supabaseConfigError || 'Falta VITE_SUPABASE_URL. Configura tu .env.');
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    await handleUserSession(session?.user || null);
  }, [handleUserSession]);

  useEffect(() => {
    if (!supabase || !isSupabaseConfigured) {
      setLoading(false);
      setAuthError(supabaseConfigError || 'Falta VITE_SUPABASE_URL. Configura tu .env.');
      return;
    }
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleUserSession(session?.user || null);
    }).catch((err) => {
      console.error('Error loading session:', err);
      setLoading(false);
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
    if (!supabase || !user?.id) return;
    const channel = supabase
      .channel(`profile-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
        () => refreshSession()
      )
      .subscribe();
    return () => {
      if (supabase) supabase.removeChannel(channel);
    };
  }, [user?.id, refreshSession]);

  // Respaldo por polling mientras está pendiente (por si el realtime no llega)
  useEffect(() => {
    if (!supabase || !user?.id || userStatus !== 'pending') return;
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
    setMemberPermissions(null);
    setMemberBranches(null);
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
    // 'online'/'offline'/visibility listeners and the poll interval it sets
    // up were never removed on businessId change, leaking one set per switch.
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

  // ¿Puede este miembro hacer X? Dueño = todo. Cajero = sus permisos
  // personalizados o los de defecto (cobrar, scanner, exportar).
  function hasPermission(permId) {
    if (role !== 'cashier') return true;
    const list = Array.isArray(memberPermissions)
      ? memberPermissions
      : ['cobrar', 'scanner', 'exportar'];
    return list.includes(permId);
  }

  return (
    <AuthContext.Provider value={{
      user, businessId, loading, needsSetup,
      userStatus, admin, role, sellerName, authError,
      memberPermissions, hasPermission, memberBranches,
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
