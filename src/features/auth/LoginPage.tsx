import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useAuth } from './AuthContext';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/ui/card';
import { Logo } from '@/shared/ui/Logo';
import { Mail } from 'lucide-react';

interface LoginPageProps {
  joinCode?: string;
}

export function LoginPage({ joinCode }: LoginPageProps) {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [pendingConfirmation, setPendingConfirmation] = useState(false);

  const redirectTo = joinCode ? `/join?code=${joinCode}` : '/';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (mode === 'login') {
        const { error } = await login(email, password);
        if (error) { setError(error.message); return; }
        await navigate({ to: redirectTo });
      } else {
        const { error, pendingConfirmation } = await register(email, password, name);
        if (error) { setError(error.message); return; }
        if (pendingConfirmation) {
          setPendingConfirmation(true);
          return;
        }
        await navigate({ to: redirectTo });
      }
    } finally {
      setIsLoading(false);
    }
  }

  if (pendingConfirmation) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-violet-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-6 text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <Mail className="w-8 h-8 text-green-600" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-gray-800">Revisa tu correo</h2>
              <p className="text-sm text-gray-500">
                Enviamos un enlace de confirmación a <strong className="text-gray-700">{email}</strong>.
                Haz clic en el enlace para activar tu cuenta.
              </p>
            </div>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => {
                setPendingConfirmation(false);
                setMode('login');
                setPassword('');
                setError(null);
              }}
            >
              Volver a iniciar sesión
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-violet-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Logo size={48} className="mx-auto mb-2" />
          <CardTitle className="text-2xl">LittleFlower</CardTitle>
          <p className="text-sm text-gray-500">Tu presupuesto familiar</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Nombre</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Tu nombre"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Correo</Label>
              <Input
                id="email"
                type="email"
                placeholder="correo@ejemplo.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Cargando...' : mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
            </Button>

            <p className="text-center text-sm text-gray-500">
              {mode === 'login' ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}{' '}
              <button
                type="button"
                className="text-pink-600 hover:underline font-medium"
                onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); }}
              >
                {mode === 'login' ? 'Regístrate' : 'Inicia sesión'}
              </button>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
