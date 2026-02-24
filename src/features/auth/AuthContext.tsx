/**
 * AuthContext — provides the current auth session to the entire app.
 *
 * On mount: checks for an existing Supabase session (persisted in localStorage)
 * and connects PowerSync if found.
 *
 * Exposes: session, isLoading, login, register, logout, refreshSession
 */

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '@/infrastructure/powersync/SupabaseConnector';
import { db } from '@/infrastructure/powersync/client';
import { SupabaseConnector } from '@/infrastructure/powersync/SupabaseConnector';
import {
  login as supabaseLogin,
  register as supabaseRegister,
  logout as supabaseLogout,
  type AuthSession,
  type AuthError,
} from '@/infrastructure/auth/SupabaseAuthAdapter';

interface AuthContextValue {
  session: AuthSession | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ error?: AuthError }>;
  register: (email: string, password: string, name: string) => Promise<{ error?: AuthError }>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Auto-reconnect: poll every 5s, reconnect if disconnected and session exists.
  // Lives here (not in a UI component) to avoid useStatus() render loops.
  const sessionRef = useRef<AuthSession | null>(null);

  // Keep sessionRef in sync so the reconnect interval can read it without deps
  useEffect(() => { sessionRef.current = session; }, [session]);

  // Auto-reconnect: every 5s check if PowerSync dropped the connection.
  // Uses an interval (not useStatus) to avoid render-loop risks.
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!sessionRef.current) return;
      const { connected, connecting } = db.currentStatus;
      if (connected || connecting) return;
      try {
        await db.connect(new SupabaseConnector());
      } catch {
        // will retry next interval
      }
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // On mount: use onAuthStateChange as the single source of truth.
  //
  // Supabase fires INITIAL_SESSION synchronously on subscribe (using the
  // persisted localStorage token), then TOKEN_REFRESHED if it needs to
  // refresh, and SIGNED_OUT on logout. This covers all cases without a
  // separate getSession() call that could race with the listener.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, supabaseSession) => {
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (supabaseSession) {
          const householdId = supabaseSession.user.user_metadata?.['household_id'] ?? null;
          setSession({
            userId: supabaseSession.user.id,
            email: supabaseSession.user.email ?? '',
            token: supabaseSession.access_token,
            householdId,
          });
          // Connect PowerSync only when not already connected — avoids
          // unnecessary connecting→connected transitions on every token refresh
          // which would cause the SyncPill to flash "Sin conexión" momentarily.
          if (!db.connected) {
            await db.connect(new SupabaseConnector());
          }
        } else {
          // INITIAL_SESSION fired with no session → user is not logged in
          setSession(null);
        }
        // Auth state is now resolved — stop showing the loading screen
        setIsLoading(false);
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function login(email: string, password: string): Promise<{ error?: AuthError }> {
    const result = await supabaseLogin(email, password);
    if ('session' in result) {
      setSession(result.session);
      return {};
    }
    return { error: result.error };
  }

  async function register(email: string, password: string, name: string): Promise<{ error?: AuthError }> {
    const result = await supabaseRegister(email, password, name);
    if ('session' in result) {
      setSession(result.session);
      return {};
    }
    return { error: result.error };
  }

  async function logout(): Promise<void> {
    await supabaseLogout();
    setSession(null);
  }

  /**
   * Forces a JWT refresh and updates the session in context.
   * Call this after operations that change user_metadata (e.g. onboarding).
   */
  async function refreshSession(): Promise<void> {
    const { data, error } = await supabase.auth.refreshSession();
    if (error || !data.session) return;
    const householdId = data.session.user.user_metadata?.['household_id'] ?? null;
    setSession({
      userId: data.session.user.id,
      email: data.session.user.email ?? '',
      token: data.session.access_token,
      householdId,
    });
    // Reconnect PowerSync with the refreshed token containing household_id
    if (!db.connected) {
      await db.connect(new SupabaseConnector());
    }
  }

  return (
    <AuthContext.Provider value={{ session, isLoading, login, register, logout, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
