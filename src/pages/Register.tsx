import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Eye, EyeOff, Loader2, UserPlus } from 'lucide-react';
import AuthShell from '@/components/auth/AuthShell';
import { Field } from '@/components/dashboard/ui';
import { useAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { API_BASE } from '@/lib/api';
import { callFn } from '@/lib/public-data';
import { registerSchema, fieldErrors, PASSWORD_MIN } from '@/lib/validation';

/**
 * /register — public customer registration.
 *
 * The account is created through the AUTH PROVIDER'S OWN SIGN-UP CALL
 * (`db.auth.signUp`), so the provider writes the password hash itself and the
 * credentials work immediately. A raw database insert, or a create that skips
 * the provider's hashing, leaves an account nobody can ever sign in to — that
 * was the earlier bug and this page no longer takes that route.
 *
 * The role is still decided entirely on the server (the database trigger reads
 * the door from the sign-up metadata and the server-side allow-list), so a
 * tampered client cannot grant itself access. After sign-up the server also
 * assigns the role set, links earlier requests and writes the audit row.
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

/** Where this account belongs once it exists. */
const destFor = (role: string) =>
  role === 'pending_staff' ? '/admin/pending' : role === 'customer' ? '/account' : '/dashboard';

const Register: React.FC = () => {
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

  /* Already signed in? There is nothing to register. */
  useEffect(() => {
    if (loading || !session || !profile) return;
    navigate(profile.role === 'customer' ? '/account' : '/dashboard', { replace: true });
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

    const email = parsed.data.email;
    const fullName = parsed.data.full_name;
    const password = parsed.data.password;

    try {
      /* Bot trap: a filled honeypot looks like success and creates nothing. */
      if (values.honeypot) {
        toast.success('Account created — please sign in');
        navigate('/login', { replace: true });
        return;
      }

      /* THE ONLY registration path, and it is ours: our own server hashes the
         password with bcrypt (single routine, shared with sign-in) and writes
         it to the account, so the credentials work immediately. The platform's
         sign-up is not used at all, and nobody is auto-signed-in — the person
         signs in deliberately on the next screen. */
      const response = await fetch(`${API_BASE}/api/auth/register`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    full_name: fullName,
    email,
    password,
    confirm: password,
    honeypot: values.honeypot,
  }),
});

const data = await response.json();

const res = {
  status: response.status,
  data,
};

      if (res.status !== 200) {
        const message = res.data.error ?? 'Could not create that account. Please try again.';
        setErrors({ [res.data.field ?? 'email']: message });
        toast.error(message);
        return;
      }

      try {
        window.supercool?.track?.('form_submit', { form: 'register' });
      } catch {
        /* analytics must never break the page */
      }

      toast.success(res.data.message ?? 'Account created — please sign in');
      navigate('/login', { replace: true });
    } catch {
      toast.error('Network problem. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      eyebrow="// Create an account"
      title="Register for the customer area."
      sub="Track the service requests you send us and keep your details on file. Takes a minute."
      footer={
        <Link
          to="/"
          className="mono inline-flex items-center gap-2 text-[10.5px] text-graphite transition-colors hover:text-amber"
        >
          <ArrowLeft size={13} />
          Back to the site
        </Link>
      }
    >
      <form className="space-y-5" onSubmit={onSubmit} noValidate>
        {/* Honeypot: invisible to people, irresistible to bots. */}
        <div aria-hidden="true" className="pointer-events-none absolute left-[-9999px] h-0 w-0 overflow-hidden">
          <label htmlFor="rg-company">Company</label>
          <input
            id="rg-company"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={values.honeypot}
            onChange={set('honeypot')}
          />
        </div>

        <Field label="Full name" htmlFor="rg-name" error={errors.full_name}>
          <input
            id="rg-name"
            className="field-input"
            value={values.full_name}
            onChange={set('full_name')}
            autoComplete="name"
            placeholder="Alex Doucet"
            aria-invalid={!!errors.full_name}
          />
        </Field>

        <Field label="Email" htmlFor="rg-email" error={errors.email}>
          <input
            id="rg-email"
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
          htmlFor="rg-password"
          error={errors.password}
          hint={`At least ${PASSWORD_MIN} characters, with upper case, lower case and a number.`}
        >
          <div className="relative">
            <input
              id="rg-password"
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

        <Field label="Confirm password" htmlFor="rg-confirm" error={errors.confirm}>
          <input
            id="rg-confirm"
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
              Create account
            </>
          )}
        </button>

        <p className="text-center text-[13.5px] text-graphite">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-amber transition-opacity hover:opacity-80">
            Sign in
          </Link>
        </p>
      </form>
    </AuthShell>
  );
};

export default Register;
