/**
 * JoinPage — handles invite deep links (/join?code=XXXXXX).
 *
 * Cases:
 *   - Authenticated + no household → auto-join with the code
 *   - Authenticated + already has household → show "already in a household" message
 *   - Not authenticated → handled by route beforeLoad (redirect to /login)
 */

import { useState, useEffect } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { supabase } from '@/infrastructure/powersync/SupabaseConnector';
import { useAuth } from './AuthContext';
import { Card, CardContent } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { Logo } from '@/shared/ui/Logo';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export function JoinPage() {
  const { session, refreshSession } = useAuth();
  const navigate = useNavigate();
  const { code } = useSearch({ from: '/join' });
  const [status, setStatus] = useState<'joining' | 'success' | 'already' | 'error'>('joining');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!session) return;

    // Already has a household
    if (session.householdId) {
      setStatus('already');
      return;
    }

    // No code provided
    if (!code) {
      setErrorMsg('No se proporcionó un código de invitación.');
      setStatus('error');
      return;
    }

    // Auto-join
    let cancelled = false;
    (async () => {
      try {
        const { error } = await supabase.rpc('join_household', {
          join_code: code.trim(),
        });
        if (cancelled) return;
        if (error) throw error;

        await refreshSession();
        setStatus('success');
        setTimeout(() => navigate({ to: '/' }), 1500);
      } catch (err) {
        if (cancelled) return;
        setErrorMsg(err instanceof Error ? err.message : 'Código inválido o expirado.');
        setStatus('error');
      }
    })();

    return () => { cancelled = true; };
  }, [session, code, refreshSession, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-violet-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-8 pb-6 text-center space-y-4">
          <Logo size={48} className="mx-auto" />

          {status === 'joining' && (
            <>
              <Loader2 className="w-8 h-8 text-pink-500 animate-spin mx-auto" />
              <p className="text-sm text-gray-500">Uniéndote al hogar...</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-semibold text-gray-800">¡Te uniste al hogar!</h2>
                <p className="text-sm text-gray-500">Redirigiendo...</p>
              </div>
            </>
          )}

          {status === 'already' && (
            <>
              <div className="mx-auto w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-amber-600" />
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-semibold text-gray-800">Ya perteneces a un hogar</h2>
                <p className="text-sm text-gray-500">No puedes unirte a otro hogar.</p>
              </div>
              <Button onClick={() => navigate({ to: '/' })}>Ir al inicio</Button>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="mx-auto w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-semibold text-gray-800">No se pudo unir</h2>
                <p className="text-sm text-red-600">{errorMsg}</p>
              </div>
              <Button variant="outline" onClick={() => navigate({ to: '/onboarding' })}>
                Ir al onboarding
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
