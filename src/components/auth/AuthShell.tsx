import React from 'react';
import { Link } from 'react-router-dom';
import { Orb } from '@/components/site/primitives';
import { BUSINESS_NAME, content } from '@/data/site-content';

/**
 * Shared frame for /login, /register and the password-reset screens.
 * Same dark base, amber accent, glass card and fonts as the public site.
 */

const AuthShell: React.FC<{
  eyebrow: string;
  title: string;
  sub?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}> = ({ eyebrow, title, sub, children, footer }) => (
  <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink px-5 py-16">
    <Orb className="h-[620px] w-[900px] left-1/2 -translate-x-1/2 top-[-320px] opacity-60" />
    <Orb className="h-[420px] w-[420px] right-[-150px] bottom-[-120px] opacity-35" tone="ice" />

    <div className="relative z-10 w-full max-w-[460px]">
      <Link to="/" className="group mb-8 flex items-center gap-3" aria-label={`${BUSINESS_NAME} — home`}>
        <svg viewBox="0 0 64 64" width="40" height="40" aria-hidden="true">
          <rect width="64" height="64" rx="14" fill="#11161C" />
          <path
            d="M41 12a13 13 0 0 0-14.6 17.4L13.6 42.2a5.2 5.2 0 0 0 7.3 7.3l12.8-12.8A13 13 0 0 0 51 22l-7.4 7.4-6.2-1.8-1.8-6.2z"
            fill="#F4F5F7"
          />
          <circle cx="46" cy="48" r="6.5" fill="#FFB020" />
        </svg>
        <span className="leading-tight">
          <span className="block font-display text-[15px] font-bold tracking-tight text-chalk transition-colors group-hover:text-amber">
            BTown
          </span>
          <span className="mono block text-[9.5px] text-graphite">{content.wordmarkSub}</span>
        </span>
      </Link>

      <div className="glass glass-solid px-6 py-8 sm:px-8 sm:py-10">
        <p className="mono text-amber">{eyebrow}</p>
        <h1 className="mt-4 font-display text-[28px] font-bold leading-tight tracking-tight text-chalk sm:text-[32px]">
          {title}
        </h1>
        {sub && <p className="mt-3 text-[15px] leading-relaxed text-graphite">{sub}</p>}
        <div className="mt-8">{children}</div>
      </div>

      {footer && <div className="mt-6 text-center">{footer}</div>}
    </div>
  </div>
);

export default AuthShell;
