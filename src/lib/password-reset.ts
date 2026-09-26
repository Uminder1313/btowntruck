import { z } from 'zod';
import { emailSchema, passwordSchema, PASSWORD_MIN } from '@/lib/validation';

/* ---------------------------------------------------------------------------
   Password reset — shared zod schemas and the strength meter.

   The same shapes are re-parsed inside the `password-reset` edge function, so
   a tampered client can never widen what the server accepts. `honeypot` must
   stay empty (bot trap); the per-IP rate limit is applied server-side.
--------------------------------------------------------------------------- */

export const forgotPasswordSchema = z.object({
  email: emailSchema,
  honeypot: z.string().max(0).optional(),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

/** A new password chosen from a reset link. */
export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: 'Passwords do not match.',
    path: ['confirm'],
  });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

/** Changing your own password from /account — the current one is re-verified. */
export const changePasswordSchema = z
  .object({
    current_password: z.string().min(1, 'Enter your current password.').max(200),
    new_password: passwordSchema,
    confirm: z.string(),
  })
  .refine((v) => v.new_password === v.confirm, {
    message: 'Passwords do not match.',
    path: ['confirm'],
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export type PasswordStrength = {
  score: number;
  pct: number;
  label: 'Enter a password' | 'Weak' | 'Fair' | 'Strong' | 'Very strong';
  tone: string;
};

/**
 * Advisory strength meter. The binding rules are `passwordSchema` (at least
 * PASSWORD_MIN characters with upper case, lower case and a number) — this
 * only tells the person how much better they could do.
 */
export function passwordStrength(pw: string): PasswordStrength {
  if (!pw) return { score: 0, pct: 0, label: 'Enter a password', tone: 'bg-white/10' };

  let score = 0;
  if (pw.length >= PASSWORD_MIN) score += 1;
  if (pw.length >= 16) score += 1;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score += 1;
  if (/[0-9]/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw)) score += 1;

  const pct = Math.min(100, Math.round((score / 5) * 100));
  if (score <= 1) return { score, pct, label: 'Weak', tone: 'bg-red-400' };
  if (score === 2) return { score, pct, label: 'Fair', tone: 'bg-amber' };
  if (score === 3) return { score, pct, label: 'Strong', tone: 'bg-ice' };
  return { score, pct, label: 'Very strong', tone: 'bg-emerald-400' };
}

/** Human-readable expiry for a generated reset link, e.g. "2:41 PM". */
export function expiryLabel(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return 'in 60 minutes';
  return at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
