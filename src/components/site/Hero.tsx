import React, { useEffect, useRef, useState } from 'react';
import { Phone } from 'lucide-react';
import { Shell, Orb, LiveDot, Reveal } from '@/components/site/primitives';
import TruckIllustration from '@/components/site/TruckIllustration';
import ServiceIcon from '@/components/site/ServiceIcons';
import { content } from '@/data/site-content';
import { useCopy } from '@/lib/site-copy';



/** Amber check used by the hero's benefit chips. */
const Tick: React.FC = () => (
  <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
    <path
      d="M2.6 8.4l3.2 3.2 7.4-7.6"
      stroke="#FFB020"
      strokeWidth="2.6"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/** Counts up to `value` the first time the stat scrolls into view. */
const StatCard: React.FC<{
  value: number;
  suffix: string;
  label: string;
  highlight?: boolean;
}> = ({ value, suffix, label, highlight }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        io.disconnect();
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduce) {
          setShown(value);
          return;
        }
        const duration = 1100;
        const start = performance.now();
        const tick = (now: number) => {
          const p = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - p, 3);
          setShown(Math.round(value * eased));
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [value]);

  return (
    <div ref={ref} className="glass glass-hover h-full px-5 py-6 sm:px-6 sm:py-7">
      <p
        className={`mono-num font-display text-[clamp(30px,3.4vw,44px)] font-bold leading-none ${
          highlight ? 'text-amber' : 'text-chalk'
        }`}
        style={{ textWrap: 'balance' }}
      >
        {shown}
        <span className="text-[0.62em]">{suffix}</span>
      </p>
      <p className="mono mt-3 text-[10.5px] text-graphite">{label}</p>
    </div>
  );
};

const Hero: React.FC = () => {
  const t = content.hero;
  const c = useCopy();
  const heroImage = c.img('hero_image');

  return (
    <>
      <section
        id="top"
        className="relative flex min-h-[100svh] items-center overflow-hidden pb-20 pt-[116px] lg:pb-28 lg:pt-[72px]"
      >
        <Orb className="h-[760px] w-[1100px] left-1/2 -translate-x-1/2 bottom-[-420px] opacity-90" />
        <Orb className="h-[420px] w-[420px] left-[-140px] top-[6%] opacity-40" tone="ice" />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[42vh]"
          style={{
            background:
              'linear-gradient(to top, rgba(255,176,32,0.07), rgba(255,176,32,0.015) 40%, transparent)',
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(255,176,32,0.4), transparent)' }}
        />

        <Shell className="relative z-10">
          <div className="grid items-center gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.02fr)] lg:gap-10">
            <div className="max-w-[640px]">
              <p
                className="hero-in mono inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-2 text-amber backdrop-blur-md"
                style={{ ['--reveal-delay' as string]: '60ms' }}
              >
                <LiveDot />
                {c.t('hero_eyebrow', t.eyebrow)}
              </p>

              <h1 className="t-hero mt-7">
                <span
                  className="hero-in text-balance block text-chalk"
                  style={{ ['--reveal-delay' as string]: '160ms' }}
                >
                  {c.t('hero_line1', t.line1)}
                </span>
                <span
                  className="hero-in text-balance block text-amber"
                  style={{ ['--reveal-delay' as string]: '280ms' }}
                >
                  {c.t('hero_line2', t.line2)}
                </span>
              </h1>

              <p
                className="hero-in t-lead mt-7 max-w-[520px]"
                style={{ ['--reveal-delay' as string]: '400ms' }}
              >
                {c.t('hero_sub', t.sub)}
              </p>

              <div
                className="hero-in mt-9 flex flex-wrap items-center gap-3.5"
                style={{ ['--reveal-delay' as string]: '510ms' }}
              >
                <a
                  href={c.phoneHref}
                  className="btn-amber pulse-glow"
                  aria-label={`${c.t('hero_cta_primary', t.primary)}, 24/7`}
                  onClick={() => {
                    try {
                      window.supercool?.track?.('cta_click', { cta: 'hero-call' });
                    } catch {
                      /* analytics must never break the page */
                    }
                  }}
                >
                  <Phone size={17} />
                  {c.t('hero_cta_primary', t.primary)}
                </a>
                <a href="#how" className="btn-ghost">
                  {c.t('hero_cta_secondary', t.secondary)}
                </a>
              </div>

              <ul
                className="hero-in mt-9 flex flex-wrap gap-2.5"
                style={{ ['--reveal-delay' as string]: '620ms' }}
              >
                {[
  c.t('hero_chip1', t.chips[0]),
  c.t('hero_chip2', t.chips[1]),
  c.t('hero_chip3', t.chips[2]),
].map((chip) => (
  <li
    key={chip}
    className="glass flex items-center gap-2 !rounded-full px-3.5 py-2 text-[13.5px] font-medium text-chalk/85"
  >
    <Tick />
    {chip}
  </li>
))}
              </ul>
            </div>

            <div
              className="hero-in relative mx-auto w-full max-w-[600px]"
              style={{ ['--reveal-delay' as string]: '360ms' }}
            >
              {/* The inline SVG is the default; an uploaded hero image replaces it. */}
              {heroImage ? (
                <img
                  src={heroImage}
                  alt="BTown Mobile Truck Repair"
                  className="relative z-10 h-auto w-full rounded-2xl object-cover"
                  loading="eager"
                />
              ) : (
                <TruckIllustration className="relative z-10" />
              )}

              {/* Floating service chips (absolute on desktop, grid on mobile) */}
              {content.floaters.map((f) => {
  const labelKeys: Record<string, string> = {
    tire: 'hero_float_tire',
    battery: 'hero_float_battery',
    diesel: 'hero_float_diesel',
    reefer: 'hero_float_reefer',
  };

  const labelKey = labelKeys[f.icon];
  const label = labelKey ? c.t(labelKey, f.label) : f.label;

  return (
    <div
      key={f.label}
      className="glass bob absolute z-20 hidden items-center gap-2.5 !rounded-2xl px-3.5 py-2.5 sm:flex"
      style={{
        top: f.top,
        left: 'left' in f ? (f.left as string) : undefined,
        right: 'right' in f ? (f.right as string) : undefined,
        animationDelay: f.delay,
      }}
      aria-hidden="true"
    >
      <ServiceIcon name={f.icon} size={22} className="icon3d" />
      <span className="mono text-[10.5px] text-chalk/85">
        {label}
      </span>
    </div>
  );
})}

              <div className="mt-4 grid grid-cols-2 gap-3 sm:hidden">
  {content.floaters.map((f) => {
    const labelKeys: Record<string, string> = {
      tire: 'hero_float_tire',
      battery: 'hero_float_battery',
      diesel: 'hero_float_diesel',
      reefer: 'hero_float_reefer',
    };

    const labelKey = labelKeys[f.icon];
    const label = labelKey ? c.t(labelKey, f.label) : f.label;

    return (
      <div
        key={f.label}
        className="glass flex items-center gap-2.5 px-3.5 py-3"
      >
        <ServiceIcon name={f.icon} size={22} className="icon3d" />
        <span className="mono text-[10.5px] text-chalk/85">
          {label}
        </span>
      </div>
    );
  })}
</div>

              <p className="mono mt-6 text-center text-[10.5px] text-graphite">
                {c.t('hero_platform_label', t.platformLabel)}
              </p>
            </div>
          </div>
        </Shell>
      </section>


      {/* Stats band */}
      <section className="relative pb-6 pt-2 sm:pb-10">
        <Shell>
          <div className="grid grid-cols-2 gap-3.5 sm:gap-4 lg:grid-cols-4">
            {content.stats.items.map((item, i) => (
  <Reveal key={item.label} delay={i * 80}>
    <StatCard
      value={item.value}
      suffix={item.suffix}
      label={c.t(`hero_stat${i + 1}_label`, item.label)}
      highlight={i === 0}
    />
  </Reveal>
))}
          </div>
          <Reveal delay={340}>
  <p className="t-lead mt-8 text-center">
    {c.t('hero_stats_line', content.stats.line)}
  </p>
</Reveal>
        </Shell>
      </section>
    </>
  );
};

export default Hero;
