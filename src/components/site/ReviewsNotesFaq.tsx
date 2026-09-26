import React, { useState } from 'react';
import { ArrowRight, ChevronDown, Star } from 'lucide-react';
import { Section, Shell, Orb, Eyebrow, Reveal } from '@/components/site/primitives';
import { content, PHONE_HREF } from '@/data/site-content';
import type { Faq, Review, RoadNote } from '@/data/site-content';

/* ---------------------------------------------------------------- 07 */
export const Reviews: React.FC<{ items: Review[] }> = ({ items }) => (
  <Section id="reviews" className="overflow-hidden">
    <Orb className="h-[520px] w-[520px] left-[-200px] bottom-[5%] opacity-35" tone="ice" />
    <Shell className="relative z-10">
      <Reveal>
        <Eyebrow>// 07 — Reviews</Eyebrow>
      </Reveal>
      <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <Reveal delay={80}>
          <h2 className="t-h2 max-w-[13ch]">{content.reviews.title}</h2>
        </Reveal>
        <Reveal delay={160}>
          <span className="glass mono inline-flex w-fit items-center gap-2 !rounded-full px-4 py-2.5 text-[11px] text-amber">
            <Star size={13} className="fill-amber text-amber" />
            {content.reviews.badge}
          </span>
        </Reveal>
      </div>

      <ul className="mt-14 grid gap-4 md:grid-cols-3">
        {items.map((review, i) => (
          <Reveal as="li" key={review.id} delay={i * 110}>
            <figure className="glass glass-hover flex h-full flex-col px-6 py-7">
              <div className="flex gap-1" aria-label={`${review.rating} out of 5 stars`}>
                {Array.from({ length: review.rating }).map((_, s) => (
                  <Star key={s} size={14} className="fill-amber text-amber" />
                ))}
              </div>
              <blockquote className="mt-5 flex-1 font-display text-[18px] leading-[1.45] tracking-tight text-chalk">
                {`\u201C${review.text}\u201D`}
              </blockquote>
              <figcaption className="mono mt-6 text-[10.5px] text-graphite">
                {`— ${review.author}`}
              </figcaption>
            </figure>
          </Reveal>
        ))}
      </ul>

      <Reveal delay={360}>
        <p className="mono mt-8 text-center text-[10.5px] text-graphite/80">
          {content.reviews.note}
        </p>
      </Reveal>
    </Shell>
  </Section>
);

/* ---------------------------------------------------------------- 08 */
export const RoadNotes: React.FC<{ items: RoadNote[] }> = ({ items }) => (
  <Section id="notes" className="overflow-hidden">
    <Shell className="relative z-10">
      <Reveal>
        <Eyebrow>// 08 — Road notes</Eyebrow>
      </Reveal>
      <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <Reveal delay={80}>
            <h2 className="t-h2 max-w-[13ch]">{content.notes.title}</h2>
          </Reveal>
          <Reveal delay={160}>
            <p className="t-lead mt-4 max-w-[42ch]">{content.notes.sub}</p>
          </Reveal>
        </div>
        <Reveal delay={200}>
          <a
            href="#notes"
            className="mono inline-flex items-center gap-2 text-[11px] text-amber transition-transform duration-300 hover:translate-x-1"
          >
            {content.notes.all}
          </a>
        </Reveal>
      </div>

      <ul className="mt-14 grid gap-4 md:grid-cols-3">
        {items.map((note, i) => (
          <Reveal as="li" key={note.id} delay={i * 110}>
            <a href="#notes" className="glass glass-hover group flex h-full flex-col px-6 py-7">
              <span className="mono w-fit rounded-full border border-amber/30 bg-amber/10 px-3 py-1.5 text-[10px] text-amber">
                {note.category ?? 'Road notes'}
              </span>
              <h3 className="t-h3 mt-6 flex-1 text-chalk transition-colors duration-300 group-hover:text-amber">
                {note.title}
              </h3>
              <span className="mono mt-6 flex items-center gap-2 text-[10.5px] text-graphite">
                {note.read_minutes ?? 5} {content.notes.readSuffix}
                <ArrowRight
                  size={13}
                  className="text-amber transition-transform duration-300 group-hover:translate-x-1"
                />
              </span>
            </a>
          </Reveal>
        ))}
      </ul>
    </Shell>
  </Section>
);

/* ---------------------------------------------------------------- 09 */
export const FaqSection: React.FC<{ items: Faq[] }> = ({ items }) => {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <Section id="faq" className="overflow-hidden">
      <Orb className="h-[560px] w-[560px] right-[-240px] top-[10%] opacity-35" />
      <Shell className="relative z-10">
        <Reveal>
          <Eyebrow>// 09 — FAQ</Eyebrow>
        </Reveal>
        <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <Reveal delay={80}>
            <h2 className="t-h2 max-w-[13ch]">{content.faq.title}</h2>
          </Reveal>
          <Reveal delay={160}>
            <p className="t-lead max-w-[36ch] md:text-right">{content.faq.sub}</p>
          </Reveal>
        </div>

        <div className="mt-14 grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,0.85fr)] lg:gap-10">
          <ul className="space-y-3">
            {items.map((faq, i) => {
              const isOpen = open === faq.id;
              const num = String(i + 1).padStart(2, '0');
              return (
                <Reveal as="li" key={faq.id} delay={Math.min(i, 5) * 60}>
                  <div
                    className={`glass overflow-hidden transition-colors duration-500 ${
                      isOpen ? 'border-amber/35' : ''
                    }`}
                  >
                    <h3>
                      <button
                        type="button"
                        onClick={() => setOpen(isOpen ? null : faq.id)}
                        aria-expanded={isOpen}
                        aria-controls={`faq-panel-${faq.id}`}
                        className="flex w-full items-center gap-4 px-5 py-5 text-left transition-colors duration-300 hover:text-amber sm:px-6"
                      >
                        <span className="mono-num flex-none text-[13px] text-amber">{num}</span>
                        <span className="flex-1 font-display text-[17px] font-semibold leading-snug tracking-tight text-chalk">
                          {faq.question}
                        </span>
                        <ChevronDown
                          size={18}
                          className={`flex-none text-amber transition-transform duration-400 ${
                            isOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                    </h3>
                    <div
                      id={`faq-panel-${faq.id}`}
                      hidden={!isOpen}
                      className="px-5 pb-6 sm:px-6"
                    >
                      <p className="max-w-[62ch] pl-0 text-[15.5px] leading-[1.7] text-graphite sm:pl-9">
                        {faq.answer}
                      </p>
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </ul>

          <Reveal delay={200}>
            <aside className="glass glass-solid h-fit px-6 py-8 lg:sticky lg:top-28">
              <a
                href={PHONE_HREF}
                className="font-display text-[19px] font-semibold leading-snug tracking-tight text-chalk transition-colors duration-300 hover:text-amber"
              >
                {content.faq.cta}
              </a>
              <p className="mono mt-8 text-[10px] leading-relaxed text-graphite/80">
                {content.faq.note}
              </p>
            </aside>
          </Reveal>
        </div>
      </Shell>
    </Section>
  );
};
