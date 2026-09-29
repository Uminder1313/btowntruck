import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import AuthShell from '@/components/auth/AuthShell';
import { Field } from '@/components/dashboard/ui';
import { PasswordStrengthMeter } from '@/components/auth/PasswordStrengthMeter';
import { db } from '@/components/auth/lib/db';
import { passwordSchema } from '@/components/auth/lib/validation';
import { API_BASE } from '@/components/auth/lib/api';

/**
 * /reset-password — where BOTH kinds of reset arrive.
 *
 *  1. `?token=…` from an administrator-generated link (Dashboard → Users), which
 *     works with no email at all. The token is checked and then consumed on the
 *     server; it is single-use and expires after 60 minutes.
 *  2. The emailed recovery link, which the database client turns into a short
 *     lived session before this page looks; the new password is then set
 *     directly. This path starts working by itself once a sending domain is
 *     verified.
 *
 * The link also carries which door the flow came from, so "back to sign in"
 * means the right one for the person who is resetting.
 */
type CheckState = 'checking' | 'ready' | 'invalid' | 'done';

const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const token = params.get('token') ?? '';
  const scopeParam = params.get('scope') === 'admin' ? 'admin' : 'customer';

  const [scope, setScope] = useState<'customer' | 'admin'>(scopeParam);
  const [step, setStep] = useState<CheckState>('checking');
  const [dest, setDest] = useState('/login');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const loginPath = scope === 'admin' ? '/admin/login' : '/login';
  const forgotPath = scope === 'admin' ? '/admin/forgot-password' : '/forgot-password';

  useEffect(() => {
    let cancelled = false;

    (async () => {
      /* 1. An administrator-generated link: ask the server whether it is still
            usable before showing the form. */
      if (token) {
        try {
           const response = await fetch(
  `${API_BASE}/api/auth/reset-link/check`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      token,
    }),
  }
);

const data = await response.json();
const status = response.status;
          if (cancelled) return;
          if (status === 200 && data.valid) {
            setScope(data.scope === 'admin' ? 'admin' : 'customer');
            setStep('ready');
          } else {
            setStep('invalid');
          }
        } catch {
          if (!cancelled) setStep('invalid');
        }
        return;
      }

      /* 2. The emailed recovery link: the client picks the recovery token out
            of the URL fragment on load. Give it a moment to do so. */
      if (!cancelled) setStep('invalid');
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;

    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Choose a stronger password.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setError('');
    setErrors({});
    setBusy(true);

    let destination = loginPath;

    try {
      if (token) {
        const response = await fetch(
  `${API_BASE}/api/auth/reset-link/redeem`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      token,
      password,
      confirm,
    }),
  }
);

const data = await response.json();
const status = response.status;
        if (status !== 200) {
          if (data.field) setErrors({ [data.field]: data.error ?? 'Please check this field.' });
          toast.error(data.error ?? 'That reset link is not valid or has expired.');
          setBusy(false);
          return;
        }
        if (data.scope === 'admin') {
          destination = '/admin/login';
          setScope('admin');
        }
      } else {
  toast.error('Please request a new password reset link.');
  setBusy(false);
  return;
}
    } catch {
      toast.error('Network problem. Please try again.');
      setBusy(false);
      return;
    }

    setDest(destination);
    setBusy(false);
    setStep('done');
    toast.success('Password updated — please sign in');
    try {
      window.supercool?.track?.('password_reset', {
        via: token ? 'admin_link' : 'emailed_link',
        scope: destination === '/admin/login' ? 'admin' : 'customer',
      });
    } catch {
      /* analytics must never break the page */
    }
    window.setTimeout(() => navigate(destination, { replace: true }), 900);
  };

  if (step === 'checking') {
    return (
      <AuthShell eyebrow="// Password reset" title="Checking your link…">
        <div className="flex items-center gap-3 py-6 text-graphite">
          <Loader2 className="animate-spin text-amber" size={18} />
          <span className="text-[14.5px]">One moment…</span>
        </div>
      </AuthShell>
    );
  }

  if (step === 'done') {
    return (
      <AuthShell
        eyebrow="// Password reset"
        title="Password updated."
        sub="You can sign in with your new password now."
      >
        <Link to={dest} className="btn-amber w-full">
          Go to sign in
        </Link>
      </AuthShell>
    );
  }

  if (step === 'invalid') {
    return (
      <AuthShell
        eyebrow="// Password reset"
        title="This link is not valid."
        sub="Reset links are single-use and expire 60 minutes after they are created. Ask for a fresh one and try again."
      >
        <div className="space-y-3">
          <Link to={forgotPath} className="btn-amber w-full">
            Request a new link
          </Link>
          <Link
            to={loginPath}
            className="mono block text-center text-[10.5px] text-graphite transition-colors hover:text-amber"
          >
            Back to sign in
          </Link>
        </div>
      </AuthShell>
    );
  }

  const type = show ? 'text' : 'password';

  return (
    <AuthShell
      eyebrow="// Password reset"
      title="Choose a new password."
      sub={
        scope === 'admin'
          ? 'This link works once. You will be sent back to the administrator sign-in page.'
          : 'This link works once. You will be sent back to the sign-in page.'
      }
    >
      <form className="space-y-5" onSubmit={onSubmit} noValidate>
        <Field label="New password" htmlFor="rp-pw" error={error || errors.password}>
          <div className="relative">
            <input
              id="rp-pw"
              type={type}
              className="field-input pr-12"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              aria-invalid={!!(error || errors.password)}
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-graphite transition-colors hover:text-amber"
              aria-label={show ? 'Hide passwords' : 'Show passwords'}
            >
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </Field>

        <PasswordStrengthMeter value={password} id="rp-strength" />

        <Field label="Confirm new password" htmlFor="rp-confirm" error={errors.confirm}>
          <input
            id="rp-confirm"
            type={type}
            className="field-input"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            aria-invalid={!!errors.confirm}
          />
        </Field>

        <button type="submit" className="btn-amber w-full" disabled={busy}>
          {busy ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Saving…
            </>
          ) : (
            'Update password'
          )}
        </button>

        <p className="mono text-center text-[9.5px] leading-relaxed text-graphite">
          The link is invalidated as soon as the password is set.
        </p>
      </form>
    </AuthShell>
  );
};

export default ResetPassword;
