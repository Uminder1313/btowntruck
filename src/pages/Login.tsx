import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Eye, EyeOff, Loader2, LogIn } from 'lucide-react';
import AuthShell from '@/components/auth/AuthShell';
import { Field } from '@/components/dashboard/ui';
import { useAuth, homeFor, type Profile } from '@/lib/auth';
import { loginSchema, fieldErrors } from '@/lib/validation';

/**
 * /login — customer sign-in, with "forgot password" by secure email link.
 *
 * The browser never decides whether a login succeeds: `signIn` posts to the
 * auth-api edge function, which verifies the bcrypt hash it wrote at
 * registration, applies the per-IP rate limit and the 5-failures / 15-minute
 * account lockout, checks the profile is active, and returns generic errors
 * that never reveal whether an email address exists. The session token it
 * returns is this site's own — the platform's password verifier is never used.
 *
 * This is the PUBLIC door — no role tabs, no mention of the staff area.
 * Staff sign in at /admin/login instead, but a staff account that comes
 * through here is still taken to the dispatch board rather than blocked.
 * Roles come from the `user_roles` table after authentication, and every read
 * and write is additionally enforced by row-level security.
 */
const Login: React.FC = () => {
  const navigate = useNavigate();
  const { session, profile, loading, signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

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
    setBusy(true);
    try {
      const user = await signIn(parsed.data.email, parsed.data.password, 'customer');

      const signedIn: Profile = {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        roles: user.roles,
        is_active: user.is_active,
        created_at: '',
      };

      toast.success('Signed in.');
      try {
        window.supercool?.track?.('login', { role: user.role, door: 'customer' });
      } catch {
        /* analytics must never break the page */
      }
      navigate(homeFor(signedIn), { replace: true });
    } catch (err) {
      toast.error(
        err instanceof Error && err.message
          ? err.message
          : 'Network problem. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      eyebrow="// Account access"
      title="Sign in."
      sub="Track the service requests you have sent us and keep your details on file."
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
      <form className="space-y-5" onSubmit={onLogin} noValidate>
        <Field label="Email" htmlFor="li-email" error={errors.email}>
          <input
            id="li-email"
            type="email"
            className="field-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="you@example.com"
            aria-invalid={!!errors.email}
          />
        </Field>

        <Field label="Password" htmlFor="li-password" error={errors.password}>
          <div className="relative">
            <input
              id="li-password"
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
          to="/forgot-password"
          className="mono block w-full text-center text-[10.5px] text-graphite transition-colors hover:text-amber"
        >
          Forgot your password?
        </Link>

        <p className="text-center text-[13.5px] text-graphite">
          New here?{' '}
          <Link to="/register" className="font-semibold text-amber transition-opacity hover:opacity-80">
            Register now
          </Link>
        </p>
      </form>
    </AuthShell>
  );
};

export default Login;
