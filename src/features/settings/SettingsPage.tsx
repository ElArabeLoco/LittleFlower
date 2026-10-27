/**
 * SettingsPage — /settings
 *
 * Página de perfil del usuario. En pantallas anchas, dos columnas de alto parecido:
 *   Izquierda  — Perfil (avatar, nombre, email) y Hogar (nombre, código de unión,
 *                integrantes de la economía)
 *   Derecha    — Preferencias: tema, idioma y formato de montos en una sola tarjeta
 * Debajo, a todo el ancho: Datos (exportar / importar) y un pie con la versión y
 * Cerrar sesión.
 */

import { useState } from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import { Link, useNavigate } from '@tanstack/react-router';
import { AppNav } from '@/shared/ui/AppNav';
import { AppHeader } from '@/shared/ui/AppHeader';
import { Button } from '@/shared/ui/button';
import { useAppSettings, type Theme, type NumberFormat } from './useAppSettings';
import { LogOut, Sun, Moon, SunMoon, Check, Home, Share2, Languages, Tag, Users, ChevronRight } from 'lucide-react';
import { ExportImportSection } from './export/ExportImportSection';
import { cn } from '@/shared/ui/cn';
import { useHouseholdQuery, useUserQuery } from '@/infrastructure/powersync/queries/useHouseholdQueries';
import { useI18n, type Locale } from '@/shared/i18n/I18nContext';
import { useHouseholdMembers } from '@/application/useHouseholdMembers';
import { formatList } from '@/features/members/formatList';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-semibold text-[var(--text-secondary)] px-1 mb-2">
      {children}
    </h2>
  );
}

/** Label and one-line description at the top of a card block. */
function PreferenceHeading({ label, description }: { label: string; description: string }) {
  return (
    <div className="px-4 pt-3 pb-1">
      <p className="text-sm font-medium text-[var(--text-primary)]">{label}</p>
      <p className="text-xs text-[var(--text-muted)]">{description}</p>
    </div>
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
  const { t, locale } = useI18n();
  const { members } = useHouseholdMembers();
  const [copied, setCopied] = useState(false);

  const inviteLink = joinCode ? `${window.location.origin}/join?code=${joinCode}` : null;

  async function handleInvite() {
    if (!inviteLink || !joinCode) return;

    const shareData = {
      title: 'Florecita',
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
        {joinCode && (
          <p className="mt-2 text-center text-xs text-[var(--text-muted)]">{t.settings.inviteFamilyHint}</p>
        )}
      </div>

      {/* Members of the household economy (not accounts) */}
      <Link
        to="/members"
        className="flex min-h-14 items-center gap-3 px-5 py-4 transition-colors hover:bg-[var(--bg-hover)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]"
      >
        <Users size={18} aria-hidden="true" className="shrink-0 text-sky-700 dark:text-sky-300" />
        <div className="min-w-0 flex-1">
          <p className="mb-0.5 text-xs text-[var(--text-muted)]">{t.settings.membersLabel}</p>
          <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
            {members.length > 0 ? formatList(locale, members.map(member => member.name)) : t.settings.membersNone}
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-0.5 text-sm font-medium text-[var(--text-brand)]">
          {t.settings.membersManage}
          <ChevronRight size={16} aria-hidden="true" />
        </span>
      </Link>
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
        title={t.settings.profileTitle}
        subtitle={session?.email ?? ''}
        maxWidth="max-w-4xl"
      />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

          {/* ── Left column: who you are and your household ── */}
          <div className="space-y-6">
            <section>
              <SectionTitle>{t.settings.profileTitle}</SectionTitle>
              <SettingsCard>
                <ProfileCard email={session?.email ?? ''} userName={userName} />
              </SettingsCard>
            </section>

            {householdId && (
              <section>
                <SectionTitle>{t.settings.householdTitle}</SectionTitle>
                <SettingsCard>
                  <HouseholdCard householdName={householdName} joinCode={joinCode} />
                </SettingsCard>
              </section>
            )}
          </div>

          {/* ── Right column: how the app looks and reads, in one card ── */}
          <section>
            <SectionTitle>{t.settings.preferencesTitle}</SectionTitle>
            <SettingsCard>
              <div>
                <PreferenceHeading label={t.settings.themeLabel} description={t.settings.themeDescription} />
                <ThemeSelector />
              </div>
              <div>
                <PreferenceHeading label={t.settings.languageLabel} description={t.settings.languageDescription} />
                <LanguageSelector />
              </div>
              <div>
                <PreferenceHeading label={t.settings.numberFormatLabel} description={t.settings.numberFormatDescription} />
                <NumberFormatSelector />
              </div>
            </SettingsCard>
          </section>

        </div>

        {/* Datos: full width, its actions two by two on wide screens */}
        <section>
          <SectionTitle>{t.settings.dataTitle}</SectionTitle>
          <SettingsCard className="overflow-hidden">
            <p className="px-4 pt-3 pb-2 text-xs text-[var(--text-muted)]">{t.settings.dataDescription}</p>
            <ExportImportSection householdId={householdId} />
          </SettingsCard>
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-4">
          <p className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
            <Tag size={15} aria-hidden="true" className="shrink-0" />
            Florecita v{__APP_VERSION__}
          </p>
          <Button
            variant="ghost"
            className="h-11 gap-2 rounded-xl px-4 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
            onClick={handleLogout}
          >
            <LogOut size={16} aria-hidden="true" />
            {t.settings.signOut}
          </Button>
        </footer>
      </main>

      <AppNav />
    </div>
  );
}
