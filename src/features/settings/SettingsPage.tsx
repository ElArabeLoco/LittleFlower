/**
 * SettingsPage — /settings
 *
 * Página de perfil del usuario:
 *   1. Tarjeta de perfil — avatar grande, email, nombre del usuario
 *   2. Tarjeta de hogar  — nombre del household + ID (solo lectura, con botón de copiar)
 *   3. Apariencia        — tema claro / oscuro / automático
 *   4. Idioma            — español / english
 *   5. Números           — formato abreviado / completo
 *   6. Sesión            — Cerrar sesión
 */

import { useState } from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import { useNavigate } from '@tanstack/react-router';
import { AppNav } from '@/shared/ui/AppNav';
import { AppHeader } from '@/shared/ui/AppHeader';
import { Button } from '@/shared/ui/button';
import { useAppSettings, type Theme, type NumberFormat } from './AppSettingsContext';
import { LogOut, Sun, Moon, SunMoon, Check, Home, Share2, Languages, Tag } from 'lucide-react';
import { cn } from '@/shared/ui/cn';
import { useHouseholdQuery, useUserQuery } from '@/infrastructure/powersync/queries/useHouseholdQueries';
import { useI18n, type Locale } from '@/shared/i18n/I18nContext';

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

function HouseholdCard({ householdName, joinCode }: { householdName: string; joinCode: string | null }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  const inviteLink = joinCode ? `${window.location.origin}/join?code=${joinCode}` : null;

  async function handleInvite() {
    if (!inviteLink || !joinCode) return;

    const shareData = {
      title: 'LittleFlower',
      text: t.settings.shareText(joinCode),
      url: inviteLink,
    };

    // Try Web Share API first (mobile), fall back to clipboard
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // User cancelled or share failed — fall through to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API not available
    }
  }

  return (
    <>
      {/* Household name */}
      <div className="flex items-center gap-3 px-5 py-4">
        <Home size={18} className="shrink-0 text-[var(--text-muted)]" />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-[var(--text-muted)] mb-0.5">{t.settings.householdNameLabel}</p>
          <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{householdName}</p>
        </div>
      </div>

      {/* Join code + invite button */}
      <div className="px-5 py-3">
        <p className="text-xs text-[var(--text-muted)] mb-1.5">{t.settings.joinCodeLabel}</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-center text-lg font-mono font-bold tracking-widest text-[var(--text-secondary)] bg-[var(--bg-surface-2)] px-2.5 py-1.5 rounded-lg border border-[var(--border-subtle)] select-all">
            {joinCode ?? '------'}
          </code>
        </div>
        {joinCode && (
          <button
            type="button"
            onClick={handleInvite}
            className={cn(
              'w-full mt-3 flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-2.5 text-sm font-medium transition-all',
              copied
                ? 'border-green-400 bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400'
                : 'border-[var(--color-primary)] text-[var(--text-brand)] hover:bg-[var(--bg-hover)]',
            )}
          >
            {copied ? <Check size={16} /> : <Share2 size={16} />}
            {copied ? t.settings.linkCopied : t.settings.inviteFamily}
          </button>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Theme selector
// ---------------------------------------------------------------------------

function ThemeSelector() {
  const { theme, setTheme } = useAppSettings();
  const { t } = useI18n();

  const THEME_OPTIONS: { value: Theme; label: string; icon: React.ReactNode; desc: string }[] = [
    { value: 'light', label: t.settings.themeLight, icon: <Sun size={18} />,     desc: t.settings.themeLightDesc },
    { value: 'dark',  label: t.settings.themeDark,  icon: <Moon size={18} />,    desc: t.settings.themeDarkDesc },
    { value: 'auto',  label: t.settings.themeAuto,  icon: <SunMoon size={18} />, desc: t.settings.themeAutoDesc },
  ];

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
// Language selector
// ---------------------------------------------------------------------------

const LANGUAGE_OPTIONS: { value: Locale; label: string }[] = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'English' },
];

function LanguageSelector() {
  const { locale, setLocale } = useI18n();

  return (
    <div className="px-4 py-4">
      <div className="grid grid-cols-2 gap-2">
        {LANGUAGE_OPTIONS.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setLocale(opt.value)}
            className={cn(
              'flex flex-col items-center gap-1.5 rounded-xl border-2 px-2 py-3 text-xs font-medium transition-all',
              locale === opt.value
                ? 'border-[var(--color-primary)] bg-[var(--bg-hover)] text-[var(--text-brand)]'
                : 'border-[var(--border-medium)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)]',
            )}
          >
            <Languages size={18} className={locale === opt.value ? 'text-[var(--text-brand)]' : 'text-[var(--text-muted)]'} />
            <span>{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Number format selector
// ---------------------------------------------------------------------------

function NumberFormatSelector() {
  const { numberFormat, setNumberFormat } = useAppSettings();
  const { t } = useI18n();

  const NUMBER_FORMATS: { value: NumberFormat; label: string; example: string; desc: string }[] = [
    {
      value: 'abbreviated',
      label: t.settings.abbreviated,
      example: '$1.2M / $150K',
      desc: t.settings.abbreviatedDesc,
    },
    {
      value: 'full',
      label: t.settings.full,
      example: '$1.200.000',
      desc: t.settings.fullDesc,
    },
  ];

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
  const { t } = useI18n();

  const userId = session?.userId ?? '';
  const householdId = session?.householdId ?? '';

  const { data: userRows = [] } = useUserQuery(userId);
  const { data: householdRows = [] } = useHouseholdQuery(householdId);

  const userName = userRows[0]?.name ?? null;
  const householdName = householdRows[0]?.name ?? t.settings.defaultHousehold;
  const joinCode = householdRows[0]?.join_code ?? null;

  async function handleLogout() {
    await logout();
    await navigate({ to: '/login' });
  }

  return (
    <div className="min-h-screen bg-[var(--bg-app)] flex flex-col">
      <AppHeader
        emoji="🌸"
        title={t.settings.profileTitle}
        subtitle={session?.email ?? ''}
      />

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-6 space-y-6">

        {/* ── Perfil ── */}
        <section>
          <SectionTitle>{t.settings.profileTitle}</SectionTitle>
          <SettingsCard>
            <ProfileCard email={session?.email ?? ''} userName={userName} />
          </SettingsCard>
        </section>

        {/* ── Hogar ── */}
        {householdId && (
          <section>
            <SectionTitle>{t.settings.householdTitle}</SectionTitle>
            <SettingsCard>
              <HouseholdCard householdName={householdName} joinCode={joinCode} />
            </SettingsCard>
          </section>
        )}

        {/* ── Apariencia ── */}
        <section>
          <SectionTitle>{t.settings.appearanceTitle}</SectionTitle>
          <SettingsCard>
            <div className="px-4 pt-3 pb-1">
              <p className="text-sm font-medium text-[var(--text-primary)]">{t.settings.themeLabel}</p>
              <p className="text-xs text-[var(--text-muted)]">{t.settings.themeDescription}</p>
            </div>
            <ThemeSelector />
          </SettingsCard>
        </section>

        {/* ── Idioma ── */}
        <section>
          <SectionTitle>{t.settings.languageTitle}</SectionTitle>
          <SettingsCard>
            <div className="px-4 pt-3 pb-1">
              <p className="text-sm font-medium text-[var(--text-primary)]">{t.settings.languageLabel}</p>
              <p className="text-xs text-[var(--text-muted)]">{t.settings.languageDescription}</p>
            </div>
            <LanguageSelector />
          </SettingsCard>
        </section>

        {/* ── Números ── */}
        <section>
          <SectionTitle>{t.settings.numbersTitle}</SectionTitle>
          <SettingsCard>
            <div className="px-4 pt-3 pb-1">
              <p className="text-sm font-medium text-[var(--text-primary)]">{t.settings.numberFormatLabel}</p>
              <p className="text-xs text-[var(--text-muted)]">{t.settings.numberFormatDescription}</p>
            </div>
            <NumberFormatSelector />
          </SettingsCard>
        </section>

        {/* ── Versión ── */}
        <section>
          <SectionTitle>{t.settings.versionTitle}</SectionTitle>
          <SettingsCard>
            <div className="flex items-center gap-3 px-5 py-4">
              <Tag size={16} className="shrink-0 text-[var(--text-muted)]" />
              <div className="flex-1">
                <p className="text-sm text-[var(--text-primary)]">Florecita</p>
                <p className="text-xs text-[var(--text-muted)]">v{__APP_VERSION__}</p>
              </div>
            </div>
          </SettingsCard>
        </section>

        {/* ── Sesión ── */}
        <section>
          <SectionTitle>{t.settings.sessionTitle}</SectionTitle>
          <SettingsCard>
            <div className="px-1 py-1">
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 h-12 rounded-xl"
                onClick={handleLogout}
              >
                <LogOut size={16} />
                {t.settings.signOut}
              </Button>
            </div>
          </SettingsCard>
        </section>

      </main>

      <AppNav />
    </div>
  );
}
