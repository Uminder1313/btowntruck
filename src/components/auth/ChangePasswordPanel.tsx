import React, { useState } from 'react';
import { toast } from 'sonner';
import { Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react';
import { Field, Panel } from '@/components/dashboard/ui';
import { PasswordStrengthMeter } from '@/components/auth/PasswordStrengthMeter';
import { changePasswordSchema } from '@/lib/password-reset';
import { fieldErrors } from '@/lib/validation';
import { API_BASE } from '@/lib/api';

/**
 * /account — "Change password" section.
 *
 * Available to every signed-in account (customers, dispatchers, administrators
 * and viewers): the current password is proved with a real sign-in attempt on
 * the server before anything changes, so a stolen session alone cannot take
 * the account over.
 */
export const ChangePasswordPanel: React.FC = () => {
  const [values, setValues] = useState({ current_password: '', new_password: '', confirm: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  const set =
    (key: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setValues((v) => ({ ...v, [key]: e.target.value }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;

    const parsed = changePasswordSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const sessionToken = localStorage.getItem('btown_session_token');

const response = await fetch(`${API_BASE}/api/auth/change-password`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    ...(sessionToken
      ? { Authorization: `Bearer ${sessionToken}` }
      : {}),
  },
  body: JSON.stringify(parsed.data),
});

const data = await response.json();
const status = response.status;
      if (status !== 200) {
        if (data.field) setErrors({ [data.field]: data.error ?? 'Please check this field.' });
        toast.error(data.error ?? 'Could not change your password.');
        return;
      }
      setValues({ current_password: '', new_password: '', confirm: '' });
      toast.success('Password updated.');
      try {
        window.supercool?.track?.('password_changed', { surface: 'account' });
      } catch {
        /* analytics must never break the page */
      }
    } catch {
      toast.error('Network problem. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const type = show ? 'text' : 'password';

  return (
    <Panel>
      <h2 className="font-display text-[17px] font-semibold text-chalk">Change password</h2>
      <p className="mt-2 text-[14px] leading-relaxed text-graphite">
        Choose a new password for this account. You stay signed in here.
      </p>

      <form className="mt-5 space-y-4" onSubmit={onSubmit} noValidate>
        <Field label="Current password" htmlFor="cp-current" error={errors.current_password}>
          <div className="relative">
            <input
              id="cp-current"
              type={type}
              className="field-input pr-12"
              value={values.current_password}
              onChange={set('current_password')}
              autoComplete="current-password"
              aria-invalid={!!errors.current_password}
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

        <Field label="New password" htmlFor="cp-new" error={errors.new_password}>
          <input
            id="cp-new"
            type={type}
            className="field-input"
            value={values.new_password}
            onChange={set('new_password')}
            autoComplete="new-password"
            aria-invalid={!!errors.new_password}
          />
        </Field>

        <PasswordStrengthMeter value={values.new_password} id="cp-strength" />

        <Field label="Confirm new password" htmlFor="cp-confirm" error={errors.confirm}>
          <input
            id="cp-confirm"
            type={type}
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
              <Loader2 size={15} className="animate-spin" />
              Updating…
            </>
          ) : (
            <>
              <KeyRound size={15} />
              Update password
            </>
          )}
        </button>
      </form>
    </Panel>
  );
};

export default ChangePasswordPanel;
