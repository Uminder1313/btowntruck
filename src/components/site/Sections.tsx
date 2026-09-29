import React from 'react';
import { Check, Phone } from 'lucide-react';
import { Section, Shell, Orb, Eyebrow, Reveal } from '@/components/site/primitives';
import ServiceIcon from '@/components/site/ServiceIcons';
import { content, PHONE_HREF } from '@/data/site-content';
import { useCopy } from '@/components/auth/lib/site-copy';

/* ---------------------------------------------------------------- 02 */
export const Services: React.FC = () => {
  const c = useCopy();
  return (
    <Section id="services" className="overflow-hidden">
      <Orb className="h-[560px] w-[560px] right-[-220px] top-[8%] opacity-45" />
      <Shell className="relative z-10">
        <Reveal>
          <Eyebrow>// 02 — Services</Eyebrow>
        </Reveal>
        <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <Reveal delay={80}>
            <h2 className="t-h2 max-w-[13ch]">{c.t('services_title', content.services.title)}</h2>
          </Reveal>
          <Reveal delay={160}>
            <p className="t-lead max-w-[36ch] md:text-right">
              {c.t('services_sub', content.services.sub)}
            </p>
          </Reveal>
        </div>

        <ul className="mt-14 grid grid-cols-2 gap-3.5 sm:gap-4 lg:grid-cols-4">
          {content.services.items.map((item, i) => (
            <Reveal as="li" key={item.key} delay={(i % 4) * 80 + Math.floor(i / 4) * 40}>
              <article className="glass glass-hover group h-full px-5 py-6 sm:px-6 sm:py-7">
                <div className="flex h-[52px] items-end">
                  <ServiceIcon name={item.key} size={46} className="icon3d" />
                </div>
                <h3 className="t-h3 mt-6 text-chalk">
                  {c.t(`service_${item.key}_title`, item.label)}
                </h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-graphite">
                  {c.t(`service_${item.key}_desc`, item.line)}
                </p>
                <span
                  aria-hidden="true"
                  className="mt-5 block h-px w-full origin-left scale-x-0 bg-gradient-to-r from-amber to-transparent transition-transform duration-500 group-hover:scale-x-100"
                />
              </article>
            </Reveal>
          ))}
        </ul>
      </Shell>
    </Section>
  );
};


/* ---------------------------------------------------------------- 03 */
export const HowItWorks: React.FC = () => {
  const c = useCopy();
  const stepKeys = ['how_step1', 'how_step2', 'how_step3'];
  return (
    <Section id="how" className="overflow-hidden">
      <Orb className="h-[520px] w-[520px] left-[-200px] top-[20%] opacity-35" tone="ice" />
      <Shell className="relative z-10">
        <Reveal>
          <Eyebrow>// 03 — How it works</Eyebrow>
        </Reveal>
        <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <Reveal delay={80}>
            <h2 className="t-h2 max-w-[13ch]">{c.t('how_title', content.how.title)}</h2>
          </Reveal>
          <Reveal delay={160}>
            <p className="t-lead max-w-[36ch] md:text-right">{c.t('how_sub', content.how.sub)}</p>
          </Reveal>
        </div>

        {/* Connector rail on desktop */}
        <div className="relative mt-16">
          <div
            aria-hidden="true"
            className="absolute left-0 right-0 top-[38px] hidden h-px lg:block"
            style={{
              background:
                'linear-gradient(90deg, transparent, rgba(255,176,32,0.45) 15%, rgba(255,176,32,0.45) 85%, transparent)',
            }}
          />
          <ol className="grid gap-4 lg:grid-cols-3">
            {content.how.steps.map((step, i) => (
              <Reveal as="li" key={step.n} delay={i * 120}>
                <div className="glass glass-hover relative h-full px-6 py-8">
                  <span className="mono-num relative z-10 flex h-[54px] w-[54px] items-center justify-center rounded-full border border-amber/45 bg-ink text-[20px] font-semibold text-amber">
                    {step.n}
                  </span>
                  <h3 className="t-h3 mt-6 text-chalk">
                    {c.t(`${stepKeys[i]}_label`, step.label)}
                  </h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-graphite">
                    {c.t(`${stepKeys[i]}_line`, step.line)}
                  </p>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </Shell>
    </Section>
  );
};

/* ---------------------------------------------------------------- 04 */
export const EmergencyBand: React.FC = () => {
  const c = useCopy();
  return (
    <section className="relative overflow-hidden py-16 sm:py-20">
      <Orb className="h-[420px] w-[900px] left-1/2 -translate-x-1/2 top-[-140px] opacity-60" />
      <Shell className="relative z-10">
        <Reveal>
          <div className="glass glass-solid overflow-hidden px-6 py-10 text-center sm:px-12 sm:py-14">
            <h2 className="t-h2">{c.t('emergency_title', content.emergency.title)}</h2>
            <a
              href={c.phoneHref}
              className="mono-num mt-6 inline-block font-display text-[clamp(34px,6vw,64px)] font-bold leading-none text-amber transition-transform duration-300 hover:scale-[1.02]"
              style={{ textWrap: 'balance' }}
              onClick={() => {
                try {
                  window.supercool?.track?.('cta_click', { cta: 'emergency-band' });
                } catch {
                  /* analytics must never break the page */
                }
              }}
            >
              {c.phone}
            </a>
            <p className="t-lead mt-6">{c.t('emergency_line', content.emergency.line)}</p>
          </div>
        </Reveal>
      </Shell>
    </section>
  );
};


/* ---------------------------------------------------------------- 05 */
export const Fleets: React.FC = () => {
  const c = useCopy();

  return (
  <Section id="fleets" className="overflow-hidden">
    <Shell className="relative z-10">
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <Reveal>
            <Eyebrow>// 05 — Fleets</Eyebrow>
          </Reveal>
          <Reveal delay={80}>
<h2 className="t-h2 mt-6 max-w-[16ch]">
  {c.t('fleets_title', content.fleets.title)}
</h2>          </Reveal>
          <Reveal delay={160}>
<p className="t-lead mt-6 max-w-[48ch]">
  {c.t('fleets_body', content.fleets.sub)}
</p>      

</Reveal>
          <ul className="mt-9 space-y-3.5">
            {content.fleets.rows.map((row, i) => (
              <Reveal as="li" key={row} delay={220 + i * 80}>
                <div className="flex items-start gap-3.5">
                  <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full border border-amber/40 bg-amber/10">
                    <Check size={13} className="text-amber" />
                  </span>
                  <span className="text-[15.5px] leading-relaxed text-chalk/85">{row}</span>
                </div>
              </Reveal>
            ))}
          </ul>
          <Reveal delay={480}>
            <a href="#contact" className="btn-amber mt-10">
              {c.t('fleets_cta', content.fleets.cta)}
            </a>
          </Reveal>
        </div>

        {/* Yard illustration: a row of trucks parked for scheduled service */}
        <Reveal delay={200}>
          <div className="glass overflow-hidden p-5 sm:p-7">
            <svg viewBox="0 0 520 320" className="h-auto w-full" role="img" aria-label="Three trucks parked in a yard for scheduled maintenance">
              <defs>
                <linearGradient id="fl-body" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#333C47" />
                  <stop offset="100%" stopColor="#171D24" />
                </linearGradient>
                <linearGradient id="fl-glass" x1="0" y1="0" x2="0.6" y2="1">
                  <stop offset="0%" stopColor="#9CC9E8" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="#1B222A" />
                </linearGradient>
                <linearGradient id="fl-ground" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1A2029" />
                  <stop offset="100%" stopColor="#0E1116" />
                </linearGradient>
              </defs>
              <rect x="0" y="232" width="520" height="88" fill="url(#fl-ground)" />
              <g stroke="#FFB020" strokeWidth="2.5" opacity="0.4" strokeDasharray="14 12" className="dash-flow">
                <path d="M0 268h520" />
              </g>
              {[30, 190, 350].map((x, i) => (
                <g key={x} transform={`translate(${x}, ${i === 1 ? 4 : 0})`}>
                  <rect x="46" y="96" width="94" height="112" rx="6" fill="url(#fl-body)" />
                  <g stroke="#0E1116" strokeWidth="2" opacity="0.5">
                    <path d="M70 100v104M96 100v104M120 100v104" />
                  </g>
                  <rect x="4" y="128" width="46" height="80" rx="8" fill="#2A323C" />
                  <rect x="10" y="136" width="34" height="26" rx="5" fill="url(#fl-glass)" />
                  <rect x="8" y="196" width="130" height="8" rx="4" fill="#FFB020" opacity="0.32" />
                  <circle cx="30" cy="216" r="13" fill="#0B0E12" />
                  <circle cx="30" cy="216" r="5" fill="#6E7885" />
                  <circle cx="108" cy="216" r="13" fill="#0B0E12" />
                  <circle cx="108" cy="216" r="5" fill="#6E7885" />
                  <rect x="18" y="120" width="12" height="5" rx="2.5" fill="#FFB020" />
                </g>
              ))}
            </svg>
            <p className="mono mt-5 text-center text-[10.5px] text-graphite">
              {c.t('fleets_caption', content.fleets.caption)}
            </p>
          </div>
        </Reveal>
      </div>
    </Shell>
  </Section>
);
};


/* ---------------------------------------------------------------- 06 */

export const Coverage: React.FC = () => {
  const c = useCopy();

  return (
    <Section id="coverage" className="overflow-hidden">
      <Orb className="h-[600px] w-[600px] right-[-240px] bottom-[-120px] opacity-40" />

      <Shell className="relative z-10">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
          <div>
            <Reveal>
              <Eyebrow>// 06 — Coverage</Eyebrow>
            </Reveal>

            <Reveal delay={80}>
              <h2 className="t-h2 mt-6 max-w-[14ch]">
                {c.t('coverage_title', content.coverage.title)}
              </h2>
            </Reveal>

            <Reveal delay={160}>
              <p className="t-lead mt-6 max-w-[44ch]">
                {c.t('coverage_body', content.coverage.sub)}
              </p>
            </Reveal>

            <Reveal delay={240}>
              <a href="#contact" className="btn-ghost mt-9">
                {c.t('coverage_cta', content.coverage.cta)}
              </a>
            </Reveal>

            <Reveal delay={320}>
              <ul className="mt-9 flex flex-wrap gap-2.5">
                {c
                  .t('coverage_towns', content.coverage.pins.join(', '))
                  .split(',')
                  .map((pin) => pin.trim())
                  .filter(Boolean)
                  .map((pin) => (
                    <li
                      key={pin}
                      className="glass !rounded-full px-3.5 py-2 text-[13.5px] font-medium text-chalk/85"
                    >
                      {pin}
                    </li>
                  ))}
              </ul>
            </Reveal>
          </div>

          {/* Schematic coverage map: Hwy 2 corridor + Saint John River */}
          <Reveal delay={200}>
            <div className="glass overflow-hidden p-5 sm:p-7">
              <svg
                viewBox="0 0 560 420"
                className="h-auto w-full"
                role="img"
                aria-label="Schematic map of the Highway 2 corridor and Saint John River valley across Northern New Brunswick"
              >
                <defs>
                  <radialGradient id="cv-glow" cx="0.5" cy="0.5" r="0.5">
                    <stop
                      offset="0%"
                      stopColor="#FFB020"
                      stopOpacity="0.16"
                    />
                    <stop
                      offset="100%"
                      stopColor="#FFB020"
                      stopOpacity="0"
                    />
                  </radialGradient>
                </defs>

                <rect
                  width="560"
                  height="420"
                  fill="#0B0E12"
                  rx="14"
                />

                <rect
                  width="560"
                  height="420"
                  fill="url(#cv-glow)"
                  rx="14"
                />

                <g
                  stroke="rgba(255,255,255,0.05)"
                  strokeWidth="1"
                >
                  {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                    <path
                      key={`h${i}`}
                      d={`M0 ${i * 60}h560`}
                    />
                  ))}

                  {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                    <path
                      key={`v${i}`}
                      d={`M${i * 62} 0v420`}
                    />
                  ))}
                </g>

                {/* Saint John River */}
                <path
                  d="M64 44C110 120 150 150 180 214c30 62 84 96 140 122 46 22 100 30 152 26"
                  fill="none"
                  stroke="#9CC9E8"
                  strokeWidth="5"
                  opacity="0.5"
                  strokeLinecap="round"
                />

                {/* Trans-Canada Highway 2 */}
                <path
                  d="M50 330C140 318 196 268 250 214c58-58 120-96 206-108"
                  fill="none"
                  stroke="#FFB020"
                  strokeWidth="4.5"
                  strokeLinecap="round"
                  opacity="0.9"
                />

                <path
                  d="M50 330C140 318 196 268 250 214c58-58 120-96 206-108"
                  fill="none"
                  stroke="#0E1116"
                  strokeWidth="2"
                  strokeDasharray="12 14"
                  className="dash-flow"
                />

                {[
                  {
                    x: 64,
                    y: 330,
                    label: 'Edmundston',
                    big: true,
                  },
                  {
                    x: 208,
                    y: 258,
                    label: 'Grand Falls',
                  },
                  {
                    x: 300,
                    y: 178,
                    label: 'Saint-Léonard',
                  },
                  {
                    x: 424,
                    y: 118,
                    label: 'Saint-Quentin',
                  },
                  {
                    x: 496,
                    y: 92,
                    label: 'Hwy 2',
                  },
                ].map((p) => (
                  <g key={p.label}>
                    {p.big && (
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r="17"
                        fill="none"
                        stroke="#FFB020"
                        strokeWidth="1.6"
                        opacity="0.6"
                        className="ring-pulse"
                        style={{
                          transformOrigin: `${p.x}px ${p.y}px`,
                        }}
                      />
                    )}

                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={p.big ? 8 : 6}
                      fill="#FFB020"
                    />

                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={p.big ? 3.2 : 2.4}
                      fill="#0E1116"
                    />

                    <text
                      x={p.x + 14}
                      y={p.y + 5}
                      fill="#F4F5F7"
                      fontSize="14"
                      fontFamily="DM Mono, monospace"
                      opacity="0.85"
                    >
                      {p.label}
                    </text>
                  </g>
                ))}
              </svg>

              <p className="mono mt-5 text-center text-[10.5px] leading-relaxed text-graphite">
                {content.coverage.legend}
              </p>
            </div>
          </Reveal>
        </div>
      </Shell>
    </Section>
  );
};


/** Sticky mobile call bar — the prototype's persistent 24/7 CTA. */
export const MobileCallBar: React.FC = () => {
  const c = useCopy();

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-ink/92 p-3 backdrop-blur-xl sm:hidden">
      <a
        href={c.phoneHref}
        className="btn-amber w-full !py-3.5 text-[15px]"
        onClick={() => {
          try {
            window.supercool?.track?.('cta_click', { cta: 'mobile-bar' });
          } catch {
            /* analytics must never break the page */
          }
        }}
      >
        <Phone size={16} />
        {c.t('mobile_bar', content.mobileBar)}
      </a>
    </div>
  );
};
