import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Eye, EyeOff, Loader2, ShieldCheck, UserPlus } from 'lucide-react';
import AuthShell from '@/components/auth/AuthShell';
import { Field } from '@/components/dashboard/ui';
import { useAuth, homeFor } from '@/lib/auth';
import { callFn } from '@/lib/public-data';
import { registerSchema, fieldErrors, PASSWORD_MIN } from '@/lib/validation';

/**
 * /admin/register — administrator registration. Not linked from anywhere public.
 *
 * The browser never decides what kind of account this creates. The form has
 * no role field at all: the `admin_register` action in the auth-api edge
 * function creates an `admin` when the email appears in the server-side
 * ADMIN_EMAILS allow-list (or is the bootstrap administrator address), and
 * also when the users table currently holds no administrator at all — so the
 * very first administrator can always register. Every other address becomes
 * `pending_staff`, which has no dashboard access until an existing
 * administrator approves it in Dashboard → Users. Multiple administrators
 * are allowed.
 *
 * Also server-side: the honeypot check, the per-IP rate limit (5 sign-ups per
 * hour) and a re-parse of every field.
 */

/** Cheap, honest strength hint — advisory only; the rules are enforced by zod. */
function strengthOf(pw: string): { score: number; label: string; tone: string } {
  let score = 0;
  if (pw.length >= PASSWORD_MIN) score += 1;
  if (pw.length >= 16) score += 1;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score += 1;
  if (/[0-9]/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw)) score += 1;

  if (!pw) return { score: 0, label: 'Enter a password', tone: 'bg-white/10' };
  if (score <= 2) return { score, label: 'Too weak', tone: 'bg-red-400' };
  if (score === 3) return { score, label: 'Getting there', tone: 'bg-amber' };
  if (score === 4) return { score, label: 'Good', tone: 'bg-ice' };
  return { score, label: 'Strong', tone: 'bg-emerald-400' };
}

const AdminRegister: React.FC = () => {
  const navigate = useNavigate();
  const { session, profile, loading } = useAuth();
  const [values, setValues] = useState({
    full_name: '',
    email: '',
    password: '',
    confirm: '',
    honeypot: '',
  });
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  /* Browser tab title for this administrator door; the site title is restored
     when you leave the page. */
  useEffect(() => {
    const previous = document.title;
    document.title = 'Administrator Registration';
    return () => {
      document.title = previous;
    };
  }, []);

  /* Already signed in? There is nothing to register. */
  useEffect(() => {
    if (loading || !session || !profile) return;
    navigate(homeFor(profile), { replace: true });
  }, [loading, session, profile, navigate]);

  const set = (key: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  const strength = strengthOf(values.password);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;

    const parsed = registerSchema.safeParse(values);
    if (!parsed.success) {
      const errs = fieldErrors(parsed.error);
      setErrors(errs);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const response = await fetch('http://localhost:3001/api/auth/admin-register', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    full_name: parsed.data.full_name,
    email: parsed.data.email,
    password: parsed.data.password,
    confirm: parsed.data.confirm,
    honeypot: values.honeypot,
  }),
});

const data = await response.json();
const status = response.status;

      if (status !== 200) {
        if (data.field) setErrors({ [data.field]: data.error ?? 'Please check this field.' });
        toast.error(data.error ?? 'Could not create that account. Please try again.');
        return;
      }

      try {
        window.supercool?.track?.('form_submit', { form: 'admin-register' });
      } catch {
        /* analytics must never break the page */
      }

      if (data.approval_required) {
        toast.success('Account created — an existing administrator must approve your access.');
      } else {
        toast.success('Account created — please sign in');
      }
      navigate('/admin/login', { replace: true });
    } catch {
      toast.error('Network problem. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      eyebrow="// ADMINISTRATOR AREA"
      title="Register an administrator account."
      sub="For the owner and management team. Approved email addresses are granted admin access immediately."
      footer={
        <Link
          to="/admin/login"
          className="mono inline-flex items-center gap-2 text-[10.5px] text-graphite transition-colors hover:text-amber"
        >
          <ArrowLeft size={13} />
          Back to administrator sign-in
        </Link>
      }
    >
      <p className="mono mb-7 flex items-start gap-2.5 rounded-2xl border border-amber/25 bg-amber/[0.07] px-4 py-3 text-[10px] leading-relaxed text-amber">
        <ShieldCheck size={15} className="mt-px flex-none" />
        If your email is on the approved administrator list you are granted access immediately;
        otherwise an existing administrator must approve you in Dashboard → Users.
      </p>

      <form className="space-y-5" onSubmit={onSubmit} noValidate>
        {/* Honeypot: invisible to people, irresistible to bots. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-[-9999px] h-0 w-0 overflow-hidden"
        >
          <label htmlFor="ar-company">Company</label>
          <input
            id="ar-company"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={values.honeypot}
            onChange={set('honeypot')}
          />
        </div>

        <Field label="Full name" htmlFor="ar-name" error={errors.full_name}>
          <input
            id="ar-name"
            className="field-input"
            value={values.full_name}
            onChange={set('full_name')}
            autoComplete="name"
            aria-invalid={!!errors.full_name}
          />
        </Field>

        <Field label="Email" htmlFor="ar-email" error={errors.email}>
          <input
            id="ar-email"
            type="email"
            className="field-input"
            value={values.email}
            onChange={set('email')}
            autoComplete="email"
            placeholder="you@example.com"
            aria-invalid={!!errors.email}
          />
        </Field>

        <Field
          label="Password"
          htmlFor="ar-password"
          error={errors.password}
          hint={`At least ${PASSWORD_MIN} characters, with upper case, lower case and a number.`}
        >
          <div className="relative">
            <input
              id="ar-password"
              type={showPw ? 'text' : 'password'}
              className="field-input pr-12"
              value={values.password}
              onChange={set('password')}
              autoComplete="new-password"
              aria-invalid={!!errors.password}
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-graphite transition-colors hover:text-amber"
              aria-label={showPw ? 'Hide password' : 'Show password'}
            >
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </Field>

        {/* Strength hint */}
        <div className="-mt-2">
          <div className="flex gap-1.5" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className={`h-[3px] flex-1 rounded-full transition-colors duration-300 ${
                  i < strength.score ? strength.tone : 'bg-white/10'
                }`}
              />
            ))}
          </div>
          <p className="mono mt-2 text-[9.5px] text-graphite" aria-live="polite">
            Password strength: {strength.label}
          </p>
        </div>

        <Field label="Confirm password" htmlFor="ar-confirm" error={errors.confirm}>
          <input
            id="ar-confirm"
            type={showPw ? 'text' : 'password'}
            className="field-input"
            value={values.confirm}
            onChange={set('confirm')}
            autoComplete="new-password"
            aria-invalid={!!errors.confirm}
          />
        </Field>

        <button type="submit" className="btn-amber w-full" disabled={busy}>
          {busy ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Creating your account…
            </>
          ) : (
            <>
              <UserPlus size={16} />
              Create administrator account
            </>
          )}
        </button>

        <p className="text-center text-[13.5px] text-graphite">
          Already have an administrator account?{' '}
          <Link
            to="/admin/login"
            className="font-semibold text-amber transition-opacity hover:opacity-80"
          >
            Sign in
          </Link>
        </p>
      </form>
    </AuthShell>
  );
};

export default AdminRegister;
