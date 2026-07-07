import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Role } from '@scorecard/shared';
import { supabase } from '../../lib/supabase';

// ONE auth subscription for the whole app (S6). Components consume it via useAuth();
// route access lives in AuthGuard — pages never re-implement session/role checks.
interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  /** From the JWT's app_metadata (synced from profiles.role); undefined until signed in. */
  role: Role | undefined;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const role = session?.user?.app_metadata?.['role'] as Role | undefined;

  return (
    <AuthContext.Provider value={{ session, loading, role }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
