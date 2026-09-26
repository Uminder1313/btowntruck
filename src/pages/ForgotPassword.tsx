import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Info, Loader2, Mail } from 'lucide-react';
import AuthShell from '@/components/auth/AuthShell';
import { Field } from '@/components/dashboard/ui';
import { callFn } from '@/lib/public-data';
import { forgotPasswordSchema } from '@/lib/password-reset';
import { fieldErrors } from '@/lib/validation';
import { API_BASE } from '@/lib/api';


/**
 * /forgot-password (customer) and /admin/forgot-password (administrator).
 *
 * One component, two doors. The browser only asks the server to start the
 * flow: the `password-reset` edge function applies the honeypot, the per-IP
 * rate limit and the re-parse, and ALWAYS answers the same way — so the page
 * can never be used to find out which addresses have accounts.
 *
 * Email cannot be delivered until this site has a verified sending domain, so
 * the success screen also says what to do in the meantime: an administrator
 * can generate a one-time link from Dashboard → Users without any email at
 * all.
 */
const ForgotPassword: React.FC<{ variant?: 'customer' | 'admin' }> = ({ variant = 'customer' }) => {
  const isAdmin = variant === 'admin';
  const loginPath = isAdmin ? '/admin/login' : '/login';

  const [email, setEmail] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  /* null until the server has told us; a false value shows the callout. */
  const [emailDelivery, setEmailDelivery] = useState<boolean | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;

    const parsed = forgotPasswordSchema.safeParse({ email, honeypot });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setBusy(true);
    try {
  const response = await fetch(
    `${API_BASE}/api/auth/reset-link/request`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: parsed.data.email,
        honeypot,
        scope: isAdmin ? 'admin' : 'customer',
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error || 'Password reset request failed');
  }

  setEmailDelivery(data.email_delivery === true);
  setSent(true);

  /* One neutral answer, whatever actually happened. */
  toast.success(
    'If an account exists for that address, reset instructions have been sent.'
  );
} catch {
  toast.error('Network problem. Please try again.');
} finally {
  setBusy(false);
}
  };

  const backLink = (
    <Link
      to={loginPath}
      className="mono inline-flex items-center gap-2 text-[10.5px] text-graphite transition-colors hover:text-amber"
    >
      <ArrowLeft size={13} />
      {isAdmin ? 'Back to administrator sign in' : 'Back to sign in'}
    </Link>
  );

  if (sent) {
    return (
      <AuthShell
        eyebrow="// Password reset"
        title="Check your instructions."
        sub="If an account exists for that address, reset instructions have been sent."
        footer={backLink}
      >
        <div className="space-y-4">
          <p className="text-[15px] leading-relaxed text-chalk">
            If an account exists for that address, reset instructions have been sent.
          </p>

          {emailDelivery !== true && (
            <div
              role="status"
              className="flex items-start gap-3 rounded-2xl border border-amber/30 bg-amber/[0.07] px-4 py-3.5"
            >
              <Info size={16} className="mt-0.5 flex-none text-amber" />
              <p className="mono text-[10.5px] leading-relaxed text-amber">
                Email delivery isn&rsquo;t configured on this site yet. Ask an administrator to
                generate a reset link for you from Dashboard &rarr; Users.
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setSent(false);
              setEmailDelivery(null);
              setErrors({});
            }}
            className="mono block w-full text-center text-[10.5px] text-graphite transition-colors hover:text-amber"
          >
            Use a different address
          </button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="// Password reset"
      title={isAdmin ? 'Reset your administrator password.' : 'Reset your password.'}
      sub={
        isAdmin
          ? 'Enter the email on your administrator account and we will send a secure, single-use reset link.'
          : 'Enter the email on your account and we will send a secure, single-use reset link.'
      }
      footer={backLink}
    >
      <form className="space-y-5" onSubmit={onSubmit} noValidate>
        {/* Honeypot: invisible to people, irresistible to bots. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-[-9999px] h-0 w-0 overflow-hidden"
        >
          <label htmlFor="fp-company">Company</label>
          <input
            id="fp-company"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
          />
        </div>

        <Field label="Email" htmlFor="fp-email" error={errors.email}>
          <input
            id="fp-email"
            type="email"
            className="field-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="you@example.com"
            aria-invalid={!!errors.email}
          />
        </Field>

        <button type="submit" className="btn-amber w-full" disabled={busy}>
          {busy ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Sending…
            </>
          ) : (
            <>
              <Mail size={16} />
              Send reset link
            </>
          )}
        </button>

        <p className="mono text-center text-[9.5px] leading-relaxed text-graphite">
          Reset requests are rate limited. We answer the same way for every address, so nothing
          here reveals whether an account exists.
        </p>
      </form>
    </AuthShell>
  );
};

export default ForgotPassword;
