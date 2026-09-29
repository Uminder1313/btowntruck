import React, { useState } from 'react';
import { toast } from 'sonner';
import { Eye, EyeOff, KeyRound, Loader2, X } from 'lucide-react';
import { PasswordStrengthMeter } from '@/components/auth/PasswordStrengthMeter';
import { changePasswordSchema } from '@/components/auth/lib/password-reset';
import { fieldErrors } from '@/components/auth/lib/validation';
import { API_BASE } from '@/components/auth/lib/api';

export const ChangePasswordPanel: React.FC = () => {
  const [open, setOpen] = useState(false);

  const [values, setValues] = useState({
    current_password: '',
    new_password: '',
    confirm: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  const set =
    (key: keyof typeof values) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setValues((v) => ({
        ...v,
        [key]: e.target.value,
      }));
    };

  const closeModal = () => {
    if (busy) return;

    setOpen(false);
    setErrors({});
    setShow(false);

    setValues({
      current_password: '',
      new_password: '',
      confirm: '',
    });
  };

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

      if (!sessionToken) {
        toast.error('Your session has expired. Please sign in again.');
        window.location.replace('/login');
        return;
      }

      const response = await fetch(
        `${API_BASE}/api/auth/change-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify(parsed.data),
        },
      );

      const data = await response.json();

      if (response.status !== 200) {
        if (data.field) {
          setErrors({
            [data.field]:
              data.error ?? 'Please check this field.',
          });
        }

        toast.error(
          data.error ?? 'Could not change your password.',
        );

        return;
      }

      /*
       * Password has now been changed successfully.
       *
       * Remove the current JWT and force a fresh login so the
       * user must authenticate again with the new password.
       */
      localStorage.removeItem('btown_session_token');

      toast.success(
        'Password updated. Please sign in again with your new password.',
      );

      try {
        window.supercool?.track?.('password_changed', {
          surface: 'account',
        });
      } catch {
        // Analytics must never break the password flow.
      }

      /*
       * Small delay allows the success toast to be visible before
       * redirecting to the login page.
       */
      setTimeout(() => {
        window.location.replace('/login');
      }, 900);
    } catch {
      toast.error('Network problem. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const type = show ? 'text' : 'password';

  return (
    <>
      {/* Small account action instead of the large password form */}
      <div className="mt-4">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="btn-ghost !py-2.5 text-[13px]"
        >
          <KeyRound size={14} />
          Change password
        </button>
      </div>

      {/* Password modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              closeModal();
            }
          }}
        >
          <div
            className="relative w-full max-w-[430px] rounded-2xl border border-white/[0.08] bg-[#181e26] p-6 shadow-2xl sm:p-8"
            role="dialog"
            aria-modal="true"
            aria-labelledby="change-password-title"
          >
            {/* Close */}
            <button
              type="button"
              onClick={closeModal}
              disabled={busy}
              className="absolute right-4 top-4 text-graphite transition-colors hover:text-chalk disabled:opacity-50"
              aria-label="Close change password"
            >
              <X size={18} />
            </button>

            {/* Header */}
            <div className="pr-8">
              <h2
                id="change-password-title"
                className="font-display text-[21px] font-semibold text-chalk"
              >
                Change password
              </h2>

              <p className="mt-2 text-[14px] leading-relaxed text-graphite">
                Choose a new password for this account.
                You will need to sign in again after changing it.
              </p>
            </div>

            <form
              className="mt-7 space-y-5"
              onSubmit={onSubmit}
              noValidate
            >
              {/* Current password */}
              <div>
                <label
                  htmlFor="cp-current"
                  className="field-label"
                >
                  Current password
                </label>

                <div className="relative mt-2">
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
                    aria-label={
                      show
                        ? 'Hide passwords'
                        : 'Show passwords'
                    }
                  >
                    {show ? (
                      <EyeOff size={17} />
                    ) : (
                      <Eye size={17} />
                    )}
                  </button>
                </div>

                {errors.current_password && (
                  <p className="mt-1.5 text-[12px] text-red-400">
                    {errors.current_password}
                  </p>
                )}
              </div>

              {/* New password */}
              <div>
                <label
                  htmlFor="cp-new"
                  className="field-label"
                >
                  New password
                </label>

                <input
                  id="cp-new"
                  type={type}
                  className="field-input mt-2"
                  value={values.new_password}
                  onChange={set('new_password')}
                  autoComplete="new-password"
                  aria-invalid={!!errors.new_password}
                />

                {errors.new_password && (
                  <p className="mt-1.5 text-[12px] text-red-400">
                    {errors.new_password}
                  </p>
                )}
              </div>

              {/* Strength */}
              <PasswordStrengthMeter
                value={values.new_password}
                id="cp-strength"
              />

              {/* Confirm */}
              <div>
                <label
                  htmlFor="cp-confirm"
                  className="field-label"
                >
                  Confirm new password
                </label>

                <input
                  id="cp-confirm"
                  type={type}
                  className="field-input mt-2"
                  value={values.confirm}
                  onChange={set('confirm')}
                  autoComplete="new-password"
                  aria-invalid={!!errors.confirm}
                />

                {errors.confirm && (
                  <p className="mt-1.5 text-[12px] text-red-400">
                    {errors.confirm}
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={busy}
                  className="btn-ghost w-full !py-3 text-[14px]"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={busy}
                  className="btn-amber w-full !py-3 text-[14px]"
                >
                  {busy ? (
                    <>
                      <Loader2
                        size={15}
                        className="animate-spin"
                      />
                      Updating...
                    </>
                  ) : (
                    <>
                      <KeyRound size={15} />
                      Update password
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default ChangePasswordPanel;
