import React from 'react';
import { Check, X } from 'lucide-react';
import { passwordStrength } from '@/components/auth/lib/password-reset';
import { PASSWORD_MIN } from '@/components/auth/lib/validation';

/**
 * Strength meter + the rules the server actually enforces.
 * Purely advisory; nothing here is what keeps a weak password out.
 */
export const PasswordStrengthMeter: React.FC<{ value: string; id?: string }> = ({
  value,
  id,
}) => {
  const strength = passwordStrength(value);
  const entered = value.length > 0;

  const rules = [
    { ok: value.length >= PASSWORD_MIN, label: `At least ${PASSWORD_MIN} characters` },
    { ok: /[a-z]/.test(value), label: 'One lowercase letter' },
    { ok: /[A-Z]/.test(value), label: 'One uppercase letter' },
    { ok: /[0-9]/.test(value), label: 'One number' },
  ];

  return (
    <div id={id}>
      <div className="flex gap-1.5" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={`h-[3px] flex-1 rounded-full transition-colors duration-300 ${
              entered && i < strength.score ? strength.tone : 'bg-white/10'
            }`}
          />
        ))}
      </div>
      <p className="mono mt-2 text-[9.5px] text-graphite" aria-live="polite">
        Password strength: {strength.label}
      </p>

      <ul className="mt-3 space-y-1.5">
        {rules.map((r) => (
          <li key={r.label} className="flex items-center gap-2 text-[12.5px]">
            {r.ok ? (
              <Check size={13} className="flex-none text-amber" />
            ) : (
              <X size={13} className="flex-none text-graphite" />
            )}
            <span className={r.ok ? 'text-chalk/85' : 'text-graphite'}>{r.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default PasswordStrengthMeter;
