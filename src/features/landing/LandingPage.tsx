/**
 * LandingPage — /
 *
 * Public page, only for visitors without a session (the route sends signed-in
 * users into the app).
 *
 * Sections:
 *   1. Bar        — flower + name, sign in (and create, from `sm`)
 *   2. Hero       — headline, CTAs, the blooming flower with petal tags
 *   3. Steps      — create, invite, log (the flower grows with each step)
 *   4. Features   — samples of the real interface
 *   5. Privacy    — night band
 *   6. Footer
 */

import { Link } from '@tanstack/react-router';
import { useI18n } from '@/shared/i18n/useI18n';
import { buttonVariants } from '@/shared/ui/buttonVariants';
import { cn } from '@/shared/ui/cn';
import { FlowerMark } from '@/shared/ui/FlowerMark';
import { PetalMeter } from '@/shared/ui/PetalMeter';
import { FeatureShowcase } from './components/FeatureShowcase';
import { HeroBloom } from './components/HeroBloom';

const SAMPLE_JOIN_CODE = '482917';

const SECTION_TITLE_CLASS =
  'max-w-[15em] text-[32px] font-[790] leading-[1.08] tracking-[-0.03em] text-[var(--text-primary)] sm:text-[42px]';

export function LandingPage() {
  const { t } = useI18n();
  const l = t.landing;

  const steps = [
    { title: l.step1Title, desc: l.step1Desc, petals: 0.2 },
    { title: l.step2Title, desc: l.step2Desc, petals: 0.6 },
    { title: l.step3Title, desc: l.step3Desc, petals: 1 },
  ];

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-[var(--bg-app)] text-[var(--text-primary)]">

      {/* ── Bar ── */}
      <header className="sticky top-0 z-30 border-b border-[var(--border-subtle)] bg-[var(--bg-bar)] pt-[env(safe-area-inset-top)] backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link to="/" aria-label={l.homeLink} className="flex items-center gap-2.5 rounded-lg">
            <FlowerMark className="size-8 shrink-0" />
            <span className="text-xl font-[760] tracking-[-0.02em]">Florecita</span>
          </Link>
          <nav aria-label={l.accountNav} className="flex items-center gap-2">
            <Link to="/login" className={buttonVariants({ variant: 'outline' })}>
              {l.signIn}
            </Link>
            <Link to="/login" search={{ mode: 'register' }} className={cn(buttonVariants(), 'hidden sm:inline-flex')}>
              {l.createHousehold}
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">

        {/* ── Hero ── */}
        <section className="mx-auto grid max-w-6xl items-center gap-8 px-4 pb-20 pt-10 sm:px-6 sm:pt-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:gap-6 lg:pb-28">
          <div className="max-w-xl">
            <h1 className="text-[40px] font-[820] leading-[1.04] tracking-[-0.04em] sm:text-[56px] lg:text-[64px]">
              {l.heroTitle}
            </h1>
            <p className="mt-5 max-w-[30em] text-[17px] leading-relaxed text-[var(--text-secondary)] sm:text-[19px]">
              {l.heroDesc}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/login" search={{ mode: 'register' }} className={buttonVariants({ size: 'lg' })}>
                {l.createHousehold}
              </Link>
              <Link to="/login" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
                {l.haveAccount}
              </Link>
            </div>
            <p className="mt-5 text-sm text-[var(--text-muted)]">{l.heroNote}</p>
          </div>

          <div className="flex justify-center">
            <HeroBloom />
          </div>
        </section>

        {/* ── Steps ── */}
        <section className="border-y border-[var(--border-subtle)] bg-[var(--bg-surface)]">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <h2 className={SECTION_TITLE_CLASS}>{l.stepsTitle}</h2>
            <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
              {steps.map((step, index) => (
                <li key={step.title} className="flex flex-col gap-3.5">
                  <PetalMeter value={step.petals} className="size-16" />
                  <h3 className="text-[22px] font-[720] tracking-[-0.015em]">
                    {index + 1}. {step.title}
                  </h3>
                  <p className="max-w-[30em] text-base leading-relaxed text-[var(--text-secondary)]">{step.desc}</p>
                  {index === 1 && (
                    <p aria-label={l.step2CodeLabel(SAMPLE_JOIN_CODE)} className="mt-1 flex gap-1.5">
                      {SAMPLE_JOIN_CODE.split('').map((digit, i) => (
                        <span
                          key={i}
                          aria-hidden="true"
                          className="grid h-12 w-10 place-items-center rounded-[10px] border border-[var(--border-medium)] bg-[var(--bg-surface-2)] text-[22px] font-bold tabular-nums"
                        >
                          {digit}
                        </span>
                      ))}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── Features ── */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <h2 className={cn(SECTION_TITLE_CLASS, 'mb-10 sm:mb-12')}>{l.featuresTitle}</h2>
          <FeatureShowcase />
        </section>

        {/* ── Privacy ── */}
        <section className="bg-[#181015] text-[#F4EEF2] [--flower-edge:#181015] dark:bg-[var(--bg-surface)] dark:[--flower-edge:var(--bg-surface)]">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-10 px-4 py-16 sm:px-6 sm:py-24 md:flex-row md:items-center md:gap-16">
            <FlowerMark className="size-40 shrink-0 sm:size-56 lg:size-72" />
            <div className="max-w-xl">
              <h2 className="text-[34px] font-[800] leading-[1.06] tracking-[-0.035em] sm:text-[48px]">{l.privacyTitle}</h2>
              <p className="mt-5 text-[17px] leading-relaxed text-[#C3B6BE] sm:text-lg">{l.privacyDesc}</p>
              <Link
                to="/login"
                search={{ mode: 'register' }}
                className={cn(buttonVariants({ size: 'lg' }), 'mt-8 focus-visible:ring-offset-[#181015]')}
              >
                {l.createHousehold}
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 pb-[calc(2.5rem+env(safe-area-inset-bottom))] pt-10 text-sm text-[var(--text-secondary)] sm:px-6">
        <span className="flex items-center gap-2 font-bold text-[var(--text-primary)]">
          <FlowerMark className="size-[22px]" />
          Florecita
        </span>
        <nav aria-label={l.footerNav} className="flex flex-wrap gap-5">
          <Link to="/login" className="font-medium text-[var(--text-brand)] hover:underline">{l.signIn}</Link>
          <Link to="/login" search={{ mode: 'register' }} className="font-medium text-[var(--text-brand)] hover:underline">
            {l.footerCreate}
          </Link>
        </nav>
        <span>florecita.club</span>
      </footer>
    </div>
  );
}
