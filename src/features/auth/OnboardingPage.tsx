/**
 * OnboardingPage — pantalla de configuración inicial del hogar.
 *
 * Se muestra cuando el usuario está autenticado pero no tiene household_id.
 * Dos opciones:
 *   1. Crear un hogar nuevo → llama a la función RPC create_household()
 *   2. Unirse a un hogar existente con código de 6 dígitos → join_household()
 *
 * If the URL has ?code=XXXXXX (from invite link), skips the "choose" screen
 * and goes directly to join mode with the code pre-filled.
 *
 * Tras el onboarding, se refresca el JWT de Supabase para que el nuevo
 * household_id quede en los claims, y PowerSync conecta automáticamente.
 */

import { useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { supabase } from '@/infrastructure/powersync/SupabaseConnector';
import { useAuth } from './AuthContext';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/ui/card';
import { Logo } from '@/shared/ui/Logo';

type Mode = 'choose' | 'create' | 'join';

export function OnboardingPage() {
  const { session, refreshSession } = useAuth();
  const navigate = useNavigate();

  // Check for invite code in URL search params
  const search = useSearch({ strict: false }) as { code?: string };
  const inviteCode = search.code ?? '';

  const [mode, setMode] = useState<Mode>(inviteCode ? 'join' : 'choose');
  const [householdName, setHouseholdName] = useState('');
  const [joinCode, setJoinCode] = useState(inviteCode);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [joinCodeResult, setJoinCodeResult] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc('create_household', {
        household_name: householdName.trim(),
      });

      if (error) throw error;

      setJoinCodeResult(data.join_code);

      // Refrescar JWT y reconectar PowerSync con el nuevo household_id
      await refreshSession();

      // Dar tiempo al usuario para ver el código antes de redirigir
      setTimeout(() => navigate({ to: '/' }), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear el hogar');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const { error } = await supabase.rpc('join_household', {
        join_code: joinCode.trim(),
      });

      if (error) throw error;

      // Refrescar JWT y reconectar PowerSync con el nuevo household_id
      await refreshSession();

      await navigate({ to: '/' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Código inválido. Intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-violet-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Logo size={48} className="mx-auto mb-2" />
          <CardTitle className="text-xl">Configura tu hogar</CardTitle>
          <p className="text-sm text-gray-500">
            Hola{session?.email ? `, ${session.email.split('@')[0]}` : ''}. Antes de continuar,
            crea un hogar o únete a uno existente.
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          {mode === 'choose' && (
            <div className="space-y-3">
              <Button className="w-full" onClick={() => setMode('create')}>
                Crear un hogar nuevo
              </Button>
              <Button variant="outline" className="w-full" onClick={() => setMode('join')}>
                Unirme a un hogar existente
              </Button>
            </div>
          )}

          {mode === 'create' && (
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="household-name">Nombre del hogar</Label>
                <Input
                  id="household-name"
                  placeholder="Ej: Casa García"
                  value={householdName}
                  onChange={e => setHouseholdName(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>
              )}

              {joinCodeResult && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                  <p className="text-sm text-green-700 mb-1">¡Hogar creado! Código para invitar:</p>
                  <p className="text-3xl font-bold tracking-widest text-green-800">{joinCodeResult}</p>
                  <p className="text-xs text-green-600 mt-1">Compártelo con tu pareja. Redirigiendo...</p>
                </div>
              )}

              {!joinCodeResult && (
                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setMode('choose')}>
                    Atrás
                  </Button>
                  <Button type="submit" className="flex-1" disabled={isLoading || !householdName.trim()}>
                    {isLoading ? 'Creando...' : 'Crear hogar'}
                  </Button>
                </div>
              )}
            </form>
          )}

          {mode === 'join' && (
            <form onSubmit={handleJoin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="join-code">Código de invitación</Label>
                <Input
                  id="join-code"
                  placeholder="000000"
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  className="text-center text-2xl tracking-widest font-bold"
                  required
                  autoFocus
                />
                <p className="text-xs text-gray-400 text-center">
                  Pídele el código de 6 dígitos al administrador del hogar
                </p>
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>
              )}

              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => { setMode('choose'); setJoinCode(''); }}>
                  Atrás
                </Button>
                <Button type="submit" className="flex-1" disabled={isLoading || joinCode.length !== 6}>
                  {isLoading ? 'Uniéndome...' : 'Unirme'}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
