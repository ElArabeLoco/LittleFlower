import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useAuth } from './useAuth';
import { useI18n } from '@/shared/i18n/useI18n';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/ui/card';
import { FlowerMark } from '@/shared/ui/FlowerMark';
import { Mail } from 'lucide-react';

interface LoginPageProps {
  joinCode?: string;
  initialMode?: 'login' | 'register';
}

export function LoginPage({ joinCode, initialMode = 'login' }: LoginPageProps) {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
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
        if (error) { setError(t.auth.errors[error.code] ?? t.common.unexpectedError); return; }
        await navigate({ to: redirectTo });
      } else {
        const { error, pendingConfirmation } = await register(email, password, name);
        if (error) { setError(t.auth.errors[error.code] ?? t.common.unexpectedError); return; }
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
      <div className="min-h-screen bg-[var(--bg-app)] flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-6 text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <Mail className="w-8 h-8 text-green-600" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-[var(--text-primary)]">{t.auth.checkEmail}</h2>
              <p className="text-sm text-[var(--text-secondary)]">
                {t.auth.confirmationSent} <strong className="text-[var(--text-primary)]">{email}</strong>{t.auth.clickToActivate}
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
              {t.auth.backToLogin}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-app)] flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <FlowerMark className="mx-auto mb-2 size-12" />
          <CardTitle className="text-2xl">Florecita</CardTitle>
          <p className="text-sm text-[var(--text-secondary)]">{t.auth.subtitle}</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div className="space-y-1.5">
                <Label htmlFor="name">{t.auth.name}</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder={t.auth.namePlaceholder}
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">{t.auth.email}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t.auth.emailPlaceholder}
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">{t.auth.password}</Label>
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
              {isLoading ? t.common.loading : mode === 'login' ? t.auth.signIn : t.auth.createAccount}
            </Button>

            <p className="text-center text-sm text-[var(--text-secondary)]">
              {mode === 'login' ? t.auth.noAccount : t.auth.hasAccount}{' '}
              <button
                type="button"
                className="text-pink-600 hover:underline font-medium"
                onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); }}
              >
                {mode === 'login' ? t.auth.signUp : t.auth.logIn}
              </button>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
