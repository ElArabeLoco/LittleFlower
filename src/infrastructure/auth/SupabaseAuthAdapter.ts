/**
 * SupabaseAuthAdapter — email + password authentication via Supabase Auth.
 *
 * Supabase Auth issues JWTs with custom claims. The `household_id` claim is
 * added to the JWT via a Supabase database function + trigger (or via the
 * Supabase Auth hook "Custom JWT claims") after the user joins a household.
 *
 * After a successful login or register, PowerSync is connected using the
 * Supabase session token — the connector's fetchCredentials() reads it
 * automatically from the Supabase client's persisted session.
 *
 * This adapter is a thin wrapper over @supabase/supabase-js.
 * Tokens are persisted by Supabase in localStorage automatically.
 */

import { supabase } from '../powersync/SupabaseConnector';
import { db } from '../powersync/client';
import { SupabaseConnector } from '../powersync/SupabaseConnector';

export interface AuthSession {
  userId: string;
  email: string;
  token: string;
  householdId: string | null; // null until user joins or creates a household
}

export interface AuthError {
  code: 'INVALID_CREDENTIALS' | 'USER_EXISTS' | 'NETWORK_ERROR' | 'UNKNOWN';
  message: string;
}

export interface PendingConfirmation {
  pendingConfirmation: true;
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

export async function login(
  email: string,
  password: string,
): Promise<{ session: AuthSession } | { error: AuthError }> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.session) {
      return { error: { code: 'INVALID_CREDENTIALS', message: '' } };
    }

    // Connect PowerSync with the fresh session token
    await db.connect(new SupabaseConnector());

    return {
      session: {
        userId: data.user.id,
        email: data.user.email ?? email,
        token: data.session.access_token,
        householdId: (data.user.user_metadata?.['household_id'] as string | undefined) ?? null,
      },
    };
  } catch (err) {
    return { error: toAuthError(err) };
  }
}

// ---------------------------------------------------------------------------
// Register
// ---------------------------------------------------------------------------

export async function register(
  email: string,
  password: string,
  name: string,
): Promise<{ session: AuthSession } | { error: AuthError } | PendingConfirmation> {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name }, // stored in user_metadata
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      if (error.message.toLowerCase().includes('already registered')) {
        return { error: { code: 'USER_EXISTS', message: '' } };
      }
      return { error: toAuthError(error) };
    }

    if (!data.session) {
      // Supabase requires email confirmation — signal the UI to show a friendly message
      return { pendingConfirmation: true };
    }

    await db.connect(new SupabaseConnector());

    return {
      session: {
        userId: data.user!.id,
        email: data.user!.email ?? email,
        token: data.session.access_token,
        householdId: null, // new user has no household yet
      },
    };
  } catch (err) {
    return { error: toAuthError(err) };
  }
}

// ---------------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------------

export async function logout(): Promise<void> {
  await db.disconnect();
  await supabase.auth.signOut();
}

// ---------------------------------------------------------------------------
// Get current session — validated against Supabase (async)
// ---------------------------------------------------------------------------

/**
 * Returns the current session validated against Supabase.
 *
 * Uses supabase.auth.getSession() which:
 *   1. Returns the in-memory/localStorage session if the token is still valid.
 *   2. Automatically refreshes the token if it's about to expire.
 *   3. Returns null if there's no session or the refresh fails.
 *
 * This is async but is typically instant (no network call unless refresh needed).
 * Calling this in route beforeLoad guarantees the JWT is fresh and contains
 * the latest user_metadata (including household_id).
 *
 * Also connects PowerSync in the background when a valid session is found and
 * PowerSync is neither connected nor connecting.
 */
export async function getCurrentSession(): Promise<AuthSession | null> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) return null;

    const { user, access_token } = data.session;
    if (!user?.id) return null;

    // Connect PowerSync in background — does NOT block the UI.
    // Only when idle: db.connect() always tears down the current sync stream
    // before reconnecting, and this runs in every protected route's
    // beforeLoad, so an unconditional connect would abort in-flight uploads
    // and downloads on each navigation. Picking up new JWT claims (e.g.
    // household_id after onboarding) is AuthContext.refreshSession()'s job.
    if (!db.connected && !db.connecting) {
      db.connect(new SupabaseConnector()).catch((err) => {
        console.warn('[Auth] PowerSync connect failed (will retry):', err);
      });
    }

    return {
      userId: user.id,
      email: user.email ?? '',
      token: access_token,
      householdId: (user.user_metadata?.['household_id'] as string | undefined) ?? null,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Error normalizer
// ---------------------------------------------------------------------------

function toAuthError(err: unknown): AuthError {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes('invalid') || msg.includes('credentials') || msg.includes('password')) {
      return { code: 'INVALID_CREDENTIALS', message: '' };
    }
    if (msg.includes('exists') || msg.includes('duplicate') || msg.includes('already')) {
      return { code: 'USER_EXISTS', message: '' };
    }
    if (msg.includes('network') || msg.includes('fetch') || msg.includes('offline')) {
      return { code: 'NETWORK_ERROR', message: '' };
    }
  }
  return { code: 'UNKNOWN', message: '' };
}
