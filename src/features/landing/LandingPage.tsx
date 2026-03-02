/**
 * LandingPage — /
 *
 * Página pública de marketing. Visible solo para usuarios NO autenticados.
 * Autenticados son redirigidos a /dashboard desde la ruta.
 *
 * Secciones:
 *   1. Hero       — logo, tagline, CTAs
 *   2. Features   — 4 propuestas de valor
 *   3. Preview    — mockup visual de la app
 *   4. CTA final  — llamada a la acción
 *   5. Footer     — mínimo
 */

import { useNavigate } from '@tanstack/react-router';
import { cn } from '@/shared/ui/cn';
import {
  BarChart3, RefreshCw, Users, ArrowLeftRight,
  ChevronRight, Sparkles, ShieldCheck, Smartphone,
} from 'lucide-react';
import { Logo } from '@/shared/ui/Logo';

// ---------------------------------------------------------------------------
// Feature card data
// ---------------------------------------------------------------------------

const FEATURES = [
  {
    icon: <BarChart3 size={22} />,
    color: 'from-pink-400 to-rose-400',
    bg: 'bg-pink-50 dark:bg-pink-950/30',
    border: 'border-pink-100 dark:border-pink-900/40',
    title: 'Ve en qué gastas',
    desc: 'Dashboard con gráficas de categorías, tendencias mensuales y comparativas de presupuesto vs. gasto real.',
  },
  {
    icon: <RefreshCw size={22} />,
    color: 'from-violet-400 to-purple-400',
    bg: 'bg-violet-50 dark:bg-violet-950/30',
    border: 'border-violet-100 dark:border-violet-900/40',
    title: 'Siempre sincronizado',
    desc: 'Funciona offline. Tus datos se guardan localmente y se sincronizan en segundo plano cuando hay conexión.',
  },
  {
    icon: <Users size={22} />,
    color: 'from-emerald-400 to-teal-400',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    border: 'border-emerald-100 dark:border-emerald-900/40',
    title: 'Hecho para dos',
    desc: 'Comparte el hogar con tu pareja. Los dos ven y editan el mismo presupuesto en tiempo real.',
  },
  {
    icon: <ArrowLeftRight size={22} />,
    color: 'from-amber-400 to-orange-400',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-100 dark:border-amber-900/40',
    title: 'USD y COP sin drama',
    desc: 'Registra ingresos en dólares. La TRM se aplica automáticamente para convertir todo a pesos colombianos.',
  },
  {
    icon: <Sparkles size={22} />,
    color: 'from-fuchsia-400 to-pink-400',
    bg: 'bg-fuchsia-50 dark:bg-fuchsia-950/30',
    border: 'border-fuchsia-100 dark:border-fuchsia-900/40',
    title: 'Vista anual y mensual',
    desc: 'Planea el año entero en el spreadsheet anual, o enfócate en el mes con la vista de tarjetas detallada.',
  },
  {
    icon: <ShieldCheck size={22} />,
    color: 'from-blue-400 to-cyan-400',
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    border: 'border-blue-100 dark:border-blue-900/40',
    title: 'Tus datos, tu control',
    desc: 'Arquitectura local-first: tus finanzas viven en tu dispositivo. Sin acceso de terceros a tu información.',
  },
];

// ---------------------------------------------------------------------------
// Mock screen preview — decorative representation of the app UI
// ---------------------------------------------------------------------------

function AppPreview() {
  const bars = [65, 90, 45, 78, 55, 82];
  const categories = [
    { name: 'Vivienda', pct: 32, color: '#f9a8d4' },
    { name: 'Alimentación', pct: 24, color: '#86efac' },
    { name: 'Transporte', pct: 18, color: '#93c5fd' },
    { name: 'Servicios', pct: 14, color: '#fcd34d' },
    { name: 'Otros', pct: 12, color: '#c4b5fd' },
  ];

  return (
    <div className="relative mx-auto w-full max-w-sm">
      {/* Phone frame */}
      <div className="relative rounded-[2.5rem] border-[6px] border-[#1a1826] bg-[#0f0e17] shadow-2xl overflow-hidden"
        style={{ aspectRatio: '9/19' }}>

        {/* Status bar */}
        <div className="flex justify-between items-center px-6 pt-3 pb-1">
          <span className="text-[9px] text-white/60 font-medium">9:41</span>
          <div className="w-16 h-3.5 rounded-full bg-[#1a1826] border border-white/10" />
          <div className="flex gap-1">
            {[3, 5, 7].map(h => (
              <div key={h} className="w-0.5 rounded-full bg-white/40" style={{ height: h }} />
            ))}
            <div className="w-3 h-1.5 rounded-full border border-white/40 ml-0.5 mt-auto" />
          </div>
        </div>

        {/* App content */}
        <div className="px-4 pb-4 space-y-3 overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-[9px] text-white/50">Dashboard</p>
              <p className="text-xs font-bold text-white">Febrero 2026</p>
            </div>
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-pink-400 to-violet-400 flex items-center justify-center">
              <span className="text-[7px] font-bold text-white">J</span>
            </div>
          </div>

          {/* KPI strip */}
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { label: 'Balance', value: '$1.8M', color: 'text-green-400' },
              { label: 'Disponible', value: '$4.2M', color: 'text-white' },
              { label: 'Presupuestado', value: '$3.1M', color: 'text-white' },
              { label: 'Gastado', value: '$2.4M', color: 'text-pink-400' },
            ].map(kpi => (
              <div key={kpi.label} className="bg-white/5 rounded-xl p-2 border border-white/5">
                <p className="text-[8px] text-white/40 mb-0.5">{kpi.label}</p>
                <p className={cn('text-[11px] font-bold tabular-nums', kpi.color)}>{kpi.value}</p>
              </div>
            ))}
          </div>

          {/* Bar chart */}
          <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
            <p className="text-[8px] text-white/40 mb-2">Tendencia 6 meses</p>
            <div className="flex items-end gap-1 h-14">
              {bars.map((h, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                  <div className="w-full rounded-t flex flex-col justify-end gap-px" style={{ height: 48 }}>
                    <div className="w-full rounded-sm bg-violet-400/60" style={{ height: `${h * 0.55}%` }} />
                    <div className="w-full rounded-sm bg-pink-400" style={{ height: `${h * 0.4}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-1">
              {['S','O','N','D','E','F'].map(m => (
                <span key={m} className="text-[7px] text-white/30 flex-1 text-center">{m}</span>
              ))}
            </div>
          </div>

          {/* Category pie legend */}
          <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
            <p className="text-[8px] text-white/40 mb-2">Gasto por categoría</p>
            <div className="space-y-1.5">
              {categories.map(c => (
                <div key={c.name} className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: c.color }} />
                  <p className="text-[8px] text-white/60 flex-1">{c.name}</p>
                  <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${c.pct}%`, background: c.color }} />
                  </div>
                  <p className="text-[8px] text-white/40 w-5 text-right">{c.pct}%</p>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom nav */}
          <div className="flex justify-around pt-1 border-t border-white/5">
            {['⬡', '📅', '💰', '👤'].map((icon, i) => (
              <div key={i} className={cn(
                'flex flex-col items-center gap-0.5',
                i === 0 ? 'text-pink-400' : 'text-white/30',
              )}>
                <span className="text-[12px]">{icon}</span>
                <div className={cn('h-0.5 w-4 rounded-full', i === 0 ? 'bg-pink-400' : 'bg-transparent')} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Glow behind phone */}
      <div className="absolute inset-0 -z-10 blur-3xl opacity-30 rounded-full"
        style={{ background: 'radial-gradient(ellipse, #f472b6 0%, #a78bfa 50%, transparent 80%)' }} />

      {/* Floating badges */}
      <div className="absolute -right-4 top-16 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl shadow-lg px-3 py-2 text-[10px] font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        Sincronizado
      </div>
      <div className="absolute -left-4 bottom-24 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl shadow-lg px-3 py-2 text-[10px] font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
        <Smartphone size={11} className="text-violet-400" />
        Funciona offline
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LandingPage
// ---------------------------------------------------------------------------

export function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[var(--bg-app)] flex flex-col overflow-x-hidden">

      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-30 bg-[var(--bg-surface)]/80 backdrop-blur-md border-b border-[var(--border-subtle)]">
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
          <span className="text-base font-bold text-[var(--text-brand)] flex items-center gap-1.5">
            <Logo size={22} /> LittleFlower
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate({ to: '/login' })}
              className="px-3 py-1.5 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              Iniciar sesión
            </button>
            <button
              onClick={() => navigate({ to: '/login' })}
              className="px-4 py-1.5 text-sm font-semibold rounded-xl bg-[var(--color-primary)] text-white hover:opacity-90 transition-opacity shadow-sm"
            >
              Empezar gratis
            </button>
          </div>
        </div>
      </nav>

      <main className="flex-1">

        {/* ── Hero ── */}
        <section className="relative max-w-5xl mx-auto px-5 pt-16 pb-20 flex flex-col lg:flex-row items-center gap-12">

          {/* Left: copy */}
          <div className="flex-1 text-center lg:text-left">
            {/* Pill badge */}
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text-brand)] bg-[var(--group-available-bg)] border border-[var(--border-medium)] rounded-full px-3 py-1 mb-6">
              <Sparkles size={11} /> Para parejas colombianas
            </div>

            <h1 className="text-4xl sm:text-5xl font-extrabold text-[var(--text-primary)] leading-tight tracking-tight mb-4">
              Tu presupuesto
              <br />
              <span className="bg-gradient-to-r from-pink-500 to-violet-500 bg-clip-text text-transparent">
                siempre en orden.
              </span>
            </h1>

            <p className="text-base text-[var(--text-secondary)] leading-relaxed max-w-md mx-auto lg:mx-0 mb-8">
              LittleFlower es la app de presupuesto familiar para parejas.
              Planea, registra gastos y analiza tus finanzas —
              en pesos colombianos, con soporte para ingresos en dólares.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
              <button
                onClick={() => navigate({ to: '/login' })}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-pink-500 to-violet-500 text-white font-semibold text-sm shadow-lg hover:shadow-pink-200 dark:hover:shadow-pink-900/40 hover:opacity-95 transition-all"
              >
                Empezar gratis <ChevronRight size={16} />
              </button>
              <button
                onClick={() => navigate({ to: '/login' })}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-2xl border-2 border-[var(--border-strong)] text-[var(--text-primary)] font-semibold text-sm hover:bg-[var(--bg-hover)] transition-colors"
              >
                Iniciar sesión
              </button>
            </div>

            {/* Social proof */}
            <p className="mt-6 text-xs text-[var(--text-muted)] flex items-center gap-1.5 justify-center lg:justify-start">
              <ShieldCheck size={13} className="text-green-500" />
              Gratis · Sin tarjeta de crédito · Privacidad total
            </p>
          </div>

          {/* Right: app preview */}
          <div className="flex-1 flex justify-center lg:justify-end w-full max-w-xs lg:max-w-none">
            <AppPreview />
          </div>

          {/* Background decoration */}
          <div className="absolute top-0 right-0 -z-10 w-96 h-96 rounded-full opacity-20 blur-3xl"
            style={{ background: 'radial-gradient(circle, #f472b6, transparent)' }} />
          <div className="absolute bottom-0 left-0 -z-10 w-64 h-64 rounded-full opacity-15 blur-3xl"
            style={{ background: 'radial-gradient(circle, #a78bfa, transparent)' }} />
        </section>

        {/* ── Features ── */}
        <section className="bg-[var(--bg-surface)] border-y border-[var(--border-subtle)] py-16">
          <div className="max-w-5xl mx-auto px-5">
            <div className="text-center mb-10">
              <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
                Todo lo que necesitas para controlar tu plata
              </h2>
              <p className="text-sm text-[var(--text-muted)] max-w-md mx-auto">
                Sin complicaciones, sin suscripciones, sin datos en la nube de terceros.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {FEATURES.map((f, i) => (
                <div
                  key={i}
                  className={cn(
                    'rounded-2xl border p-5 transition-all hover:shadow-md hover:-translate-y-0.5',
                    f.bg, f.border,
                  )}
                >
                  <div className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center text-white bg-gradient-to-br mb-4 shadow-sm',
                    f.color,
                  )}>
                    {f.icon}
                  </div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)] mb-1.5">{f.title}</h3>
                  <p className="text-xs text-[var(--text-muted)] leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA final ── */}
        <section className="max-w-5xl mx-auto px-5 py-20 text-center">
          <div className="relative inline-block">
            <div className="absolute inset-0 -z-10 blur-2xl opacity-30 rounded-full"
              style={{ background: 'radial-gradient(ellipse, #f472b6, #a78bfa)' }} />
            <Logo size={64} className="mx-auto mb-6" />
          </div>
          <h2 className="text-3xl font-extrabold text-[var(--text-primary)] mb-3 tracking-tight">
            Empieza hoy, gratis.
          </h2>
          <p className="text-sm text-[var(--text-secondary)] mb-8 max-w-sm mx-auto">
            Invita a tu pareja, configura el hogar en minutos y toma el control de sus finanzas juntos.
          </p>
          <button
            onClick={() => navigate({ to: '/login' })}
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-pink-500 to-violet-500 text-white font-bold text-sm shadow-lg hover:opacity-95 transition-all hover:shadow-pink-200 dark:hover:shadow-pink-900/40"
          >
            Crear mi cuenta gratis <ChevronRight size={16} />
          </button>
        </section>

      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-[var(--border-subtle)] bg-[var(--bg-surface)]">
        <div className="max-w-5xl mx-auto px-5 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[var(--text-muted)]">
          <span className="font-semibold text-[var(--text-brand)] flex items-center gap-1">
            <Logo size={14} /> LittleFlower
          </span>
          <span>Hecho con amor para parejas colombianas 🇨🇴</span>
          <span>© {new Date().getFullYear()}</span>
        </div>
      </footer>

    </div>
  );
}
