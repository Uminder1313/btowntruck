import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { Orb } from '@/components/site/primitives';

/** 403 — signed in, but the role does not cover the requested screen. */
const Forbidden: React.FC = () => (
  <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink px-5 py-16">
    <Orb className="h-[520px] w-[820px] left-1/2 -translate-x-1/2 top-[-260px] opacity-45" />
    <div className="relative z-10 w-full max-w-[520px] text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-amber/40 bg-amber/10">
        <ShieldAlert className="text-amber" size={24} />
      </span>
      <p className="mono mt-7 text-amber">// 403 — Forbidden</p>
      <h1 className="mt-4 font-display text-[34px] font-bold leading-tight tracking-tight text-chalk sm:text-[44px]">
        Your role does not cover this.
      </h1>
      <p className="t-lead mx-auto mt-5 max-w-[44ch]">
        You are signed in, but this screen needs a higher permission level. Ask an administrator if
        you need access.
      </p>
      <div className="mt-9 flex flex-wrap items-center justify-center gap-3.5">
        <Link to="/dashboard" className="btn-amber">
          Back to the dashboard
        </Link>
        <Link to="/" className="btn-ghost">
          Go to the site
        </Link>
      </div>
    </div>
  </div>
);

export default Forbidden;
