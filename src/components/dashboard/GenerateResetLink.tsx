import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Check, Clock, Copy, KeyRound, Loader2, X } from 'lucide-react';
import { expiryLabel } from '@/components/auth/lib/password-reset';
import type { Profile } from '@/components/auth/lib/auth';
import { API_BASE } from '@/components/auth/lib/api';
import { getSessionToken } from '@/components/auth/lib/session-store';
/**
 * Dashboard → Users → "Generate reset link".
 *
 * Administrators only (the edge function re-checks the role from the caller's
 * JWT, and row-level security on `password_reset_tokens` allows nobody else).
 * It mints a single-use link that expires in 60 minutes and shows it once, so
 * the administrator can send it by text, WhatsApp or in person — the whole
 * flow works with no email configured. Every generation is audited.
 */
export const GenerateResetLink: React.FC<{ user: Pick<Profile, 'id' | 'email' | 'full_name'> }> = ({
  user,
}) => {
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [copied, setCopied] = useState(false);

  const open = !!link;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLink('');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const generate = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const sessionToken = getSessionToken();

const response = await fetch(
  `${API_BASE}/api/auth/reset-link`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(sessionToken
        ? { Authorization: `Bearer ${sessionToken}` }
        : {}),
    },
    body: JSON.stringify({
      user_id: user.id,
    }),
  }
);

const data = await response.json();
const status = response.status;

      if (status !== 200 || !data.url) {
        toast.error(data.error ?? 'Could not generate a reset link.');
        return;
      }
      setLink(data.url);
      setExpiresAt(data.expires_at ?? '');
      setCopied(false);
      try {
        window.supercool?.track?.('reset_link_generated', { scope: data.scope ?? 'customer' });
      } catch {
        /* analytics must never break the page */
      }
    } catch {
      toast.error('Network problem. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success('Reset link copied.');
    } catch {
      toast.error('Could not copy automatically — select the link and copy it.');
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={generate}
        disabled={busy}
        className="btn-ghost !py-2 text-[12.5px]"
        aria-label={`Generate a reset link for ${user.email}`}
      >
        {busy ? <Loader2 size={13} className="animate-spin" /> : <KeyRound size={13} />}
        Generate reset link
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/80 px-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Password reset link"
        >
          <div className="glass glass-solid w-full max-w-[540px] p-6 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="mono text-amber">// One-time link</p>
                <h2 className="mt-3 font-display text-[21px] font-semibold tracking-tight text-chalk">
                  Reset link for {user.full_name ?? user.email}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setLink('')}
                className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-white/12 text-chalk transition-colors hover:border-amber/50 hover:text-amber"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <p className="mt-4 text-[14.5px] leading-relaxed text-graphite">
              Send this link to the person yourself — by text, WhatsApp or in person. Email is not
              needed. It can be used once and then it stops working.
            </p>

            <div className="mt-5">
              <label className="field-label" htmlFor="grs-link">
                Reset link
              </label>
              <input
                id="grs-link"
                readOnly
                value={link}
                onFocus={(e) => e.currentTarget.select()}
                className="field-input mono mt-2 !text-[11px]"
              />
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button type="button" className="btn-amber !py-2.5 text-[13.5px]" onClick={copy}>
                {copied ? <Check size={15} /> : <Copy size={15} />}
                {copied ? 'Copied' : 'Copy link'}
              </button>
              <span className="mono inline-flex items-center gap-2 text-[9.5px] text-graphite">
                <Clock size={12} className="text-amber" />
                Expires {expiryLabel(expiresAt)} — 60 minutes from now
              </span>
            </div>

            <p className="mono mt-5 text-[9.5px] leading-relaxed text-graphite">
              The link is stored only as a hash, expires in 60 minutes and is invalidated the moment
              the password is set. This generation is recorded in the audit log.
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default GenerateResetLink;

