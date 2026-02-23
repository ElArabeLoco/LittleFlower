/**
 * SettingsPage — /settings
 *
 * Página de perfil del usuario:
 *   1. Tarjeta de perfil — avatar grande, email, nombre del usuario
 *   2. Tarjeta de hogar  — nombre del household + ID (solo lectura, con botón de copiar)
 *   3. Apariencia        — tema claro / oscuro / automático
 *   4. Números           — formato abreviado / completo
 *   5. Sesión            — Cerrar sesión
 */

import { useState } from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import { useNavigate } from '@tanstack/react-router';
import { AppNav } from '@/shared/ui/AppNav';
import { AppHeader } from '@/shared/ui/AppHeader';
import { Button } from '@/shared/ui/button';
import { useAppSettings, type Theme, type NumberFormat } from './AppSettingsContext';
import { LogOut, Sun, Moon, SunMoon, Copy, Check, Home } from 'lucide-react';
import { cn } from '@/shared/ui/cn';
import { useQuery } from '@powersync/react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HouseholdRow {
  id: string;
  name: string;
}

interface UserRow {
  id: string;
  name: string;
  color: string | null;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] px-1 mb-1.5">
      {children}
    </h2>
  );
}

function SettingsCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn(
      'bg-[var(--bg-surface)] rounded-xl border border-[var(--border-subtle)] shadow-sm divide-y divide-[var(--border-subtle)]',
      className,
    )}>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Profile card — avatar grande + nombre + email
// ---------------------------------------------------------------------------

function ProfileCard({ email, userName }: { email: string; userName: string | null }) {
  const initial = email ? email[0].toUpperCase() : '?';

  return (
    <div className="flex items-center gap-4 px-5 py-5">
      {/* Big avatar */}
      <div
        className="flex-shrink-0 w-16 h-16 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-secondary)] flex items-center justify-center text-white text-2xl font-bold shadow-md select-none"
      >
        {initial}
      </div>

      <div className="flex-1 min-w-0">
        {userName && (
          <p className="text-base font-semibold text-[var(--text-primary)] truncate">{userName}</p>
        )}
        <p className={cn(
          'truncate',
          userName
            ? 'text-sm text-[var(--text-muted)]'
            : 'text-base font-semibold text-[var(--text-primary)]',
        )}>
          {email}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Household card — nombre + ID read-only con copy
// ---------------------------------------------------------------------------

function HouseholdCard({ householdId, householdName }: { householdId: string; householdName: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(householdId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API not available — nothing critical
    }
  }

  return (
    <>
      {/* Household name */}
      <div className="flex items-center gap-3 px-5 py-4">
        <Home size={18} className="shrink-0 text-[var(--text-muted)]" />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-[var(--text-muted)] mb-0.5">Nombre del hogar</p>
          <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{householdName}</p>
        </div>
      </div>

      {/* Household ID — read-only with copy button */}
      <div className="px-5 py-3">
        <p className="text-xs text-[var(--text-muted)] mb-1.5">Código de unión</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs font-mono text-[var(--text-secondary)] bg-[var(--bg-surface-2)] px-2.5 py-1.5 rounded-lg border border-[var(--border-subtle)] truncate select-all">
            {householdId}
          </code>
          <button
            type="button"
            onClick={handleCopy}
            title={copied ? '¡Copiado!' : 'Copiar código'}
            className={cn(
              'shrink-0 flex items-center justify-center w-8 h-8 rounded-lg border transition-all',
              copied
                ? 'border-green-400 bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400'
                : 'border-[var(--border-medium)] bg-[var(--bg-surface-2)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]',
            )}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
          </button>
        </div>
        <p className="text-[10px] text-[var(--text-muted)] mt-1.5">
          Comparte este código para que otros se unan a tu hogar
        </p>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Theme selector
// ---------------------------------------------------------------------------

const THEME_OPTIONS: { value: Theme; label: string; icon: React.ReactNode; desc: string }[] = [
  { value: 'light', label: 'Claro',      icon: <Sun size={18} />,     desc: 'Siempre modo claro' },
  { value: 'dark',  label: 'Oscuro',     icon: <Moon size={18} />,    desc: 'Siempre modo oscuro' },
  { value: 'auto',  label: 'Automático', icon: <SunMoon size={18} />, desc: 'Sigue el sistema' },
];

function ThemeSelector() {
  const { theme, setTheme } = useAppSettings();

  return (
    <div className="px-4 py-4 space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {THEME_OPTIONS.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setTheme(opt.value)}
            className={cn(
              'flex flex-col items-center gap-1.5 rounded-xl border-2 px-2 py-3 text-xs font-medium transition-all',
              theme === opt.value
                ? 'border-[var(--color-primary)] bg-[var(--bg-hover)] text-[var(--text-brand)]'
                : 'border-[var(--border-medium)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)]',
            )}
          >
            <span className={theme === opt.value ? 'text-[var(--text-brand)]' : 'text-[var(--text-muted)]'}>
              {opt.icon}
            </span>
            <span>{opt.label}</span>
          </button>
        ))}
      </div>
      <p className="text-xs text-[var(--text-muted)] text-center">
        {THEME_OPTIONS.find(o => o.value === theme)?.desc}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Number format selector
// ---------------------------------------------------------------------------

const NUMBER_FORMATS: { value: NumberFormat; label: string; example: string; desc: string }[] = [
  {
    value: 'abbreviated',
    label: 'Abreviado',
    example: '$1.2M / $150K',
    desc: 'Compacto, ideal para el spreadsheet',
  },
  {
    value: 'full',
    label: 'Completo',
    example: '$1.200.000',
    desc: 'Cifra exacta en pesos',
  },
];

function NumberFormatSelector() {
  const { numberFormat, setNumberFormat } = useAppSettings();

  return (
    <div className="px-4 py-4 space-y-2">
      {NUMBER_FORMATS.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => setNumberFormat(opt.value)}
          className={cn(
            'w-full flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-all',
            numberFormat === opt.value
              ? 'border-[var(--color-primary)] bg-[var(--bg-hover)]'
              : 'border-[var(--border-medium)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)]',
          )}
        >
          {/* Radio dot */}
          <span className={cn(
            'flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center',
            numberFormat === opt.value
              ? 'border-[var(--color-primary)]'
              : 'border-[var(--border-strong)]',
          )}>
            {numberFormat === opt.value && (
              <span className="w-2 h-2 rounded-full bg-[var(--color-primary)]" />
            )}
          </span>
          <div className="flex-1 min-w-0">
            <p className={cn(
              'text-sm font-medium',
              numberFormat === opt.value ? 'text-[var(--text-brand)]' : 'text-[var(--text-primary)]',
            )}>
              {opt.label}
              <span className="ml-2 font-mono text-xs text-[var(--text-muted)]">{opt.example}</span>
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">{opt.desc}</p>
          </div>
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SettingsPage
// ---------------------------------------------------------------------------

export function SettingsPage() {
  const { session, logout } = useAuth();
  const navigate = useNavigate();

  const userId = session?.userId ?? '';
  const householdId = session?.householdId ?? '';

  // Query user name from PowerSync
  const { data: userRows = [] } = useQuery<UserRow>(
    userId
      ? `SELECT id, name, color FROM users WHERE id = ? LIMIT 1`
      : `SELECT id, name, color FROM users WHERE 1=0`,
    userId ? [userId] : [],
  );

  // Query household name from PowerSync
  const { data: householdRows = [] } = useQuery<HouseholdRow>(
    householdId
      ? `SELECT id, name FROM households WHERE id = ? LIMIT 1`
      : `SELECT id, name FROM households WHERE 1=0`,
    householdId ? [householdId] : [],
  );

  const userName = userRows[0]?.name ?? null;
  const householdName = householdRows[0]?.name ?? 'Mi hogar';

  async function handleLogout() {
    await logout();
    await navigate({ to: '/login' });
  }

  return (
    <div className="min-h-screen bg-[var(--bg-app)] flex flex-col">
      <AppHeader
        emoji="🌸"
        title="Perfil"
        subtitle={session?.email ?? ''}
      />

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-6 space-y-6">

        {/* ── Perfil ── */}
        <section>
          <SectionTitle>Perfil</SectionTitle>
          <SettingsCard>
            <ProfileCard email={session?.email ?? ''} userName={userName} />
          </SettingsCard>
        </section>

        {/* ── Hogar ── */}
        {householdId && (
          <section>
            <SectionTitle>Hogar</SectionTitle>
            <SettingsCard>
              <HouseholdCard householdId={householdId} householdName={householdName} />
            </SettingsCard>
          </section>
        )}

        {/* ── Apariencia ── */}
        <section>
          <SectionTitle>Apariencia</SectionTitle>
          <SettingsCard>
            <div className="px-4 pt-3 pb-1">
              <p className="text-sm font-medium text-[var(--text-primary)]">Tema</p>
              <p className="text-xs text-[var(--text-muted)]">Elige entre modo claro, oscuro o automático según el sistema</p>
            </div>
            <ThemeSelector />
          </SettingsCard>
        </section>

        {/* ── Números ── */}
        <section>
          <SectionTitle>Números</SectionTitle>
          <SettingsCard>
            <div className="px-4 pt-3 pb-1">
              <p className="text-sm font-medium text-[var(--text-primary)]">Formato de montos</p>
              <p className="text-xs text-[var(--text-muted)]">Afecta todos los valores mostrados (no los campos de entrada)</p>
            </div>
            <NumberFormatSelector />
          </SettingsCard>
        </section>

        {/* ── Sesión ── */}
        <section>
          <SectionTitle>Sesión</SectionTitle>
          <SettingsCard>
            <div className="px-1 py-1">
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 h-12 rounded-xl"
                onClick={handleLogout}
              >
                <LogOut size={16} />
                Cerrar sesión
              </Button>
            </div>
          </SettingsCard>
        </section>

      </main>

      <AppNav />
    </div>
  );
}
