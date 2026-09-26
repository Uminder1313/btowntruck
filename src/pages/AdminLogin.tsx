import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Eye, EyeOff, Loader2, LogIn, ShieldCheck } from 'lucide-react';
import AuthShell from '@/components/auth/AuthShell';
import { Field } from '@/components/dashboard/ui';
import { useAuth, homeFor, type Profile } from '@/lib/auth';
import { loginSchema, fieldErrors } from '@/lib/validation';
import type { Role } from '@/lib/validation';

/** The roles that may use the administrator area. */
const STAFF_ROLES: Role[] = ['admin', 'dispatcher', 'viewer', 'pending_staff'];

/**
 * /admin/login — administrator sign-in. Not linked from anywhere public.
 *
 * The browser never decides whether a login succeeds: `signIn` posts to the
 * auth-api edge function, which verifies the bcrypt hash it wrote at
 * registration, applies the per-IP rate limit and the 5-failures / 15-minute
 * account lockout, checks the profile is active, and returns generic errors
 * that never reveal whether an email address exists. An allow-listed address
 * whose profile was created BEFORE the allow-list existed is promoted to
 * `admin` at sign-in, so no re-registration is needed.
 *
 * The session token it returns is this site's OWN session; the platform's
 * password verifier is never used. After authentication the REAL roles come
 * from the `user_roles` table. A customer account that reaches this door is
 * signed straight back out and pointed at the customer sign-in page; an
 * unapproved administrator account goes to the waiting screen.
 */
const AdminLogin: React.FC = () => {
  const navigate = useNavigate();
  const { session, profile, loading, signIn, signOut } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  /* A persistent inline message for the cases a toast cannot explain: a
     customer account at the administrator door needs a way out (a link). */
  const [notice, setNotice] = useState<{ text: string; to?: string; label?: string } | null>(null);

  /* Browser tab title for this administrator door; the site title is restored
     when you leave the page. */
  useEffect(() => {
    const previous = document.title;
    document.title = 'Administrator Sign In';
    return () => {
      document.title = previous;
    };
  }, []);

  /* Already signed in? Go straight to the right home screen. */
  useEffect(() => {
    if (loading || !session || !profile || busy) return;
    navigate(homeFor(profile), { replace: true });
  }, [loading, session, profile, busy, navigate]);

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setNotice(null);
    setBusy(true);
    try {
      const user = await signIn(parsed.data.email, parsed.data.password, 'admin');

      /* The administrative door: an account with no staff role at all is not a
         staff account, whatever else it holds. */
      if (!user.roles.some((role) => STAFF_ROLES.includes(role))) {
        await signOut();
        setNotice({
          text: 'This account is a customer account. Sign in on the customer page.',
          to: '/login',
          label: 'Go to customer sign-in',
        });
        return;
      }

      const signedIn: Profile = {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        roles: user.roles,
        is_active: user.is_active,
        created_at: '',
      };

      try {
        window.supercool?.track?.('login', { role: user.role, door: 'admin' });
      } catch {
        /* analytics must never break the page */
      }

      if (user.role === 'pending_staff') {
        toast.success('Signed in — your access is awaiting approval.');
        navigate('/admin/pending', { replace: true });
        return;
      }

      toast.success('Signed in.');
      navigate(homeFor(signedIn), { replace: true });
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'Network problem. Please try again.';
      toast.error(message);
      if (/customer account/i.test(message)) {
        setNotice({
          text: 'This account is a customer account. Sign in on the customer page.',
          to: '/login',
          label: 'Go to customer sign-in',
        });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      eyebrow="// ADMINISTRATOR AREA"
      title="Administrator sign in."
      sub="Restricted area for owners, dispatch and management."
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
      <p className="mono mb-7 flex items-center gap-2.5 rounded-2xl border border-amber/25 bg-amber/[0.07] px-4 py-3 text-[10px] leading-relaxed text-amber">
        <ShieldCheck size={15} className="flex-none" />
        Restricted area — attempts are rate limited and logged.
      </p>

      {notice && (
        <div
          role="alert"
          className="mono mb-6 rounded-2xl border border-amber/30 bg-amber/[0.07] px-4 py-3 text-[10.5px] leading-relaxed text-amber"
        >
          {notice.text}
          {notice.to && (
            <>
              {' '}
              <Link
                to={notice.to}
                className="font-semibold underline transition-opacity hover:opacity-80"
              >
                {notice.label}
              </Link>
            </>
          )}
        </div>
      )}

      <form className="space-y-5" onSubmit={onLogin} noValidate>
        <Field label="Email" htmlFor="al-email" error={errors.email}>
          <input
            id="al-email"
            type="email"
            className="field-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="you@example.com"
            aria-invalid={!!errors.email}
          />
        </Field>

        <Field label="Password" htmlFor="al-password" error={errors.password}>
          <div className="relative">
            <input
              id="al-password"
              type={showPw ? 'text' : 'password'}
              className="field-input pr-12"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
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

        <button type="submit" className="btn-amber w-full" disabled={busy}>
          {busy ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Signing in…
            </>
          ) : (
            <>
              <LogIn size={16} />
              Sign in
            </>
          )}
        </button>

        <Link
          to="/admin/forgot-password"
          className="mono block w-full text-center text-[10.5px] text-graphite transition-colors hover:text-amber"
        >
          Forgot your password?
        </Link>

        <p className="text-center text-[13.5px] text-graphite">
          Need an administrator account?{' '}
          <Link
            to="/admin/register"
            className="font-semibold text-amber transition-opacity hover:opacity-80"
          >
            Register
          </Link>
        </p>

        <p className="mono text-center text-[9.5px] leading-relaxed text-graphite">
          After 5 failed attempts the account is locked for 15 minutes, during which even the
          correct password is refused.
        </p>
      </form>
    </AuthShell>
  );
};

export default AdminLogin;
