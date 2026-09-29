import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/components/auth/lib/utils';
import type { Role, Status, Urgency } from '@/components/auth/lib/validation';

/* ---------------------------------------------------------------------------
   Small presentational building blocks shared by every dashboard screen.
   Same dark base / amber accent / glass panels as the public site.
--------------------------------------------------------------------------- */

export const Panel: React.FC<{ className?: string; children: React.ReactNode }> = ({
  className,
  children,
}) => <div className={cn('glass glass-solid p-5 sm:p-6', className)}>{children}</div>;

export const PageTitle: React.FC<{ title: string; sub?: string; actions?: React.ReactNode }> = ({
  title,
  sub,
  actions,
}) => (
  <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <h1 className="font-display text-[26px] font-bold tracking-tight text-chalk sm:text-[32px]">
        {title}
      </h1>
      {sub && <p className="mt-2 max-w-[62ch] text-[15px] leading-relaxed text-graphite">{sub}</p>}
    </div>
    {actions && <div className="flex flex-wrap gap-2.5">{actions}</div>}
  </header>
);

const STATUS_STYLE: Record<Status, string> = {
  new: 'border-amber/45 bg-amber/12 text-amber',
  dispatched: 'border-ice/40 bg-ice/10 text-ice',
  in_progress: 'border-blue-400/35 bg-blue-400/10 text-blue-300',
  completed: 'border-emerald-400/35 bg-emerald-400/10 text-emerald-300',
  cancelled: 'border-white/15 bg-white/5 text-graphite',
};

export const STATUS_LABEL: Record<Status, string> = {
  new: 'New',
  dispatched: 'Dispatched',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const URGENCY_LABEL: Record<Urgency, string> = {
  emergency: 'Emergency',
  today: 'Today',
  scheduled: 'Scheduled',
};

export const StatusPill: React.FC<{ status: Status }> = ({ status }) => (
  <span
    className={cn(
      'mono inline-flex items-center rounded-full border px-2.5 py-1 text-[9.5px]',
      STATUS_STYLE[status] ?? STATUS_STYLE.new,
    )}
  >
    {STATUS_LABEL[status] ?? status}
  </span>
);

export const UrgencyPill: React.FC<{ urgency: Urgency }> = ({ urgency }) => (
  <span
    className={cn(
      'mono inline-flex items-center rounded-full border px-2.5 py-1 text-[9.5px]',
      urgency === 'emergency'
        ? 'border-red-400/40 bg-red-400/10 text-red-300'
        : urgency === 'today'
          ? 'border-amber/40 bg-amber/10 text-amber'
          : 'border-white/15 bg-white/5 text-graphite',
    )}
  >
    {URGENCY_LABEL[urgency] ?? urgency}
  </span>
);

export const RolePill: React.FC<{ role: Role }> = ({ role }) => (
  <span
    className={cn(
      'mono inline-flex items-center rounded-full border px-2.5 py-1 text-[9.5px]',
      role === 'admin'
        ? 'border-amber/45 bg-amber/12 text-amber'
        : role === 'dispatcher'
          ? 'border-ice/40 bg-ice/10 text-ice'
          : 'border-white/15 bg-white/5 text-graphite',
    )}
  >
    {role}
  </span>
);

export const Spinner: React.FC<{ label?: string }> = ({ label = 'Loading…' }) => (
  <div className="flex items-center gap-3 py-10 text-graphite">
    <Loader2 className="animate-spin text-amber" size={18} />
    <span className="text-[14.5px]">{label}</span>
  </div>
);

export const EmptyState: React.FC<{ title: string; sub?: string }> = ({ title, sub }) => (
  <div className="rounded-2xl border border-dashed border-white/12 px-6 py-12 text-center">
    <p className="font-display text-[17px] font-semibold text-chalk">{title}</p>
    {sub && <p className="mt-2 text-[14.5px] text-graphite">{sub}</p>}
  </div>
);

/** Read-only notice shown to the `viewer` role in place of controls. */
export const ReadOnlyNote: React.FC<{ what?: string }> = ({ what = 'this section' }) => (
  <p className="mono rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-[10px] leading-relaxed text-graphite">
    Read-only access — your role cannot change {what}.
  </p>
);

export const Field: React.FC<{
  label: string;
  htmlFor: string;
  error?: string;
  children: React.ReactNode;
  hint?: string;
}> = ({ label, htmlFor, error, children, hint }) => (
  <div>
    <label className="field-label" htmlFor={htmlFor}>
      {label}
    </label>
    <div className="mt-2">{children}</div>
    {hint && !error && <p className="mt-1.5 text-[12px] text-graphite">{hint}</p>}
    {error && <p className="mt-1.5 text-[12.5px] text-red-400">{error}</p>}
  </div>
);

export const Toggle: React.FC<{
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}> = ({ checked, onChange, label, disabled }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={cn(
      'relative inline-flex h-[26px] w-[46px] flex-none items-center rounded-full border transition-colors duration-300',
      checked ? 'border-amber/60 bg-amber/25' : 'border-white/15 bg-white/[0.06]',
      disabled && 'cursor-not-allowed opacity-50',
    )}
  >
    <span
      className={cn(
        'absolute h-[18px] w-[18px] rounded-full transition-transform duration-300',
        checked ? 'translate-x-[24px] bg-amber' : 'translate-x-[4px] bg-graphite',
      )}
    />
  </button>
);
