import type { Session, User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient, setSupabaseAccessToken } from "@/lib/supabase";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  authError: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ emailConfirmationRequired: boolean }>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const SupabaseAuthContext = createContext<AuthContextValue | null>(null);

function toMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

export function SupabaseAuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    getSupabaseBrowserClient()
      .then(async client => {
        const { data, error } = await client.auth.getSession();
        if (!active) return;
        if (error) setAuthError(error.message);
        setSession(data.session);
        setSupabaseAccessToken(data.session?.access_token ?? null);
        setLoading(false);
        const { data: listener } = client.auth.onAuthStateChange((_event, nextSession) => {
          setSession(nextSession);
          setSupabaseAccessToken(nextSession?.access_token ?? null);
          setAuthError(null);
        });
        unsubscribe = () => listener.subscription.unsubscribe();
      })
      .catch(error => {
        if (!active) return;
        setAuthError(toMessage(error));
        setLoading(false);
      });
    return () => { active = false; unsubscribe?.(); };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user: session?.user ?? null,
    session,
    loading,
    authError,
    signIn: async (email, password) => {
      const client = await getSupabaseBrowserClient();
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
    },
    signUp: async (email, password, fullName) => {
      const client = await getSupabaseBrowserClient();
      const { data, error } = await client.auth.signUp({ email, password, options: { data: { full_name: fullName }, emailRedirectTo: `${window.location.origin}/login` } });
      if (error) throw new Error(error.message);
      return { emailConfirmationRequired: !data.session };
    },
    requestPasswordReset: async email => {
      const client = await getSupabaseBrowserClient();
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/login?reset=1` });
      if (error) throw new Error(error.message);
    },
    updatePassword: async password => {
      const client = await getSupabaseBrowserClient();
      const { error } = await client.auth.updateUser({ password });
      if (error) throw new Error(error.message);
    },
    signOut: async () => {
      const client = await getSupabaseBrowserClient();
      const { error } = await client.auth.signOut();
      if (error) throw new Error(error.message);
      setSupabaseAccessToken(null);
    },
  }), [authError, loading, session]);

  return <SupabaseAuthContext.Provider value={value}>{children}</SupabaseAuthContext.Provider>;
}

export function useSupabaseAuth() {
  const context = useContext(SupabaseAuthContext);
  if (!context) throw new Error("useSupabaseAuth must be used inside SupabaseAuthProvider");
  return context;
}
