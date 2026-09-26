import React from 'react';
import { Link } from 'react-router-dom';
import { Compass, Phone } from 'lucide-react';
import { Orb } from '@/components/site/primitives';
import { PHONE, PHONE_HREF } from '@/data/site-content';

/** 404 — styled to match the site: dark base, amber accent, glass card. */
const NotFound: React.FC = () => (
  <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink px-5 py-16">
    <Orb className="h-[560px] w-[900px] left-1/2 -translate-x-1/2 top-[-280px] opacity-50" />
    <Orb className="h-[380px] w-[380px] right-[-120px] bottom-[-100px] opacity-30" tone="ice" />

    <div className="relative z-10 w-full max-w-[560px] text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-amber/40 bg-amber/10">
        <Compass className="text-amber" size={24} />
      </span>
      <p className="mono mt-7 text-amber">// 404 — Wrong exit</p>
      <h1 className="mt-4 font-display text-[36px] font-bold leading-[1.05] tracking-tight text-chalk sm:text-[52px]">
        That page took a wrong turn.
      </h1>
      <p className="t-lead mx-auto mt-5 max-w-[44ch]">
        The road you asked for is not on our map. Head back to the main site — or if a truck is down
        right now, skip the browsing and call dispatch.
      </p>
      <div className="mt-9 flex flex-wrap items-center justify-center gap-3.5">
        <a href={PHONE_HREF} className="btn-amber">
          <Phone size={16} />
          {PHONE}
        </a>
        <Link to="/" className="btn-ghost">
          Back to the site
        </Link>
      </div>
    </div>
  </div>
);

export default NotFound;
