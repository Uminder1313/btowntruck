import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/** Page gutter container — 1360px max width, matching the prototype. */
export const Shell: React.FC<{ className?: string; children: React.ReactNode }> = ({
  className,
  children,
}) => <div className={cn('shell', className)}>{children}</div>;

/** Vertical section rhythm used by every band on the page. */
export const Section: React.FC<
  { id?: string; className?: string; children: React.ReactNode }
> = ({ id, className, children }) => (
  <section id={id} className={cn('relative py-20 sm:py-24 lg:py-32', className)}>
    {children}
  </section>
);

/** Blurred background orb (amber by default, "ice" for the cool variant). */
export const Orb: React.FC<{ className?: string; tone?: 'amber' | 'ice' }> = ({
  className,
  tone = 'amber',
}) => (
  <div
    aria-hidden="true"
    className={cn('orb', tone === 'ice' ? 'orb-ice' : 'orb-amber', className)}
  />
);

/** Mono uppercase section eyebrow, e.g. "// 02 — Services". */
export const Eyebrow: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => <p className={cn('mono text-amber', className)}>{children}</p>;

/**
 * Scroll-reveal wrapper. Adds `is-visible` the first time the element
 * intersects the viewport; respects prefers-reduced-motion through CSS.
 */
export const Reveal: React.FC<{
  children: React.ReactNode;
  delay?: number;
  className?: string;
  as?: 'div' | 'li' | 'article' | 'span';
}> = ({ children, delay = 0, className, as = 'div' }) => {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            io.disconnect();
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const Tag = as as keyof JSX.IntrinsicElements;
  return React.createElement(
    Tag,
    {
      ref: ref as never,
      className: cn('reveal', visible && 'is-visible', className),
      style: { ['--reveal-delay' as string]: `${delay}ms` },
    },
    children,
  );
};

/** Small amber pulse dot used in the hero eyebrow and "open now" markers. */
export const LiveDot: React.FC<{ className?: string }> = ({ className }) => (
  <span
    aria-hidden="true"
    className={cn('inline-block h-2 w-2 rounded-full bg-amber blink-dot', className)}
  />
);

/** Thin gradient rule. */
export const Hairline: React.FC<{ className?: string }> = ({ className }) => (
  <div aria-hidden="true" className={cn('hairline', className)} />
);
