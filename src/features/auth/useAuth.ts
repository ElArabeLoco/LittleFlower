import { createContext, useContext } from 'react';
import type { AuthSession, AuthError } from '@/infrastructure/auth/SupabaseAuthAdapter';

export interface AuthContextValue {
  session: AuthSession | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ error?: AuthError }>;
  register: (email: string, password: string, name: string) => Promise<{ error?: AuthError; pendingConfirmation?: true }>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
