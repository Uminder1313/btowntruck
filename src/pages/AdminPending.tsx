import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Clock, LogOut, RefreshCw } from 'lucide-react';
import AuthShell from '@/components/auth/AuthShell';
import { Spinner } from '@/components/dashboard/ui';
import { useAuth, homeFor } from '@/lib/auth';

/**
 * /admin/pending — the waiting room for a staff account that registered at
 * /admin/register with an email that is not on the ADMIN_EMAILS allow-list.
 *
 * The role `pending_staff` is denied by row-level security everywhere a
 * customer is denied, and it is not a customer either, so /account is closed
 * to it as well. This screen is all it can reach until an administrator sets
 * a real role in Dashboard → Users.
 */
const AdminPending: React.FC = () => {
  const navigate = useNavigate();
  const { session, profile, loading, signOut, refreshProfile } = useAuth();

  useEffect(() => {
    if (!loading && !session) navigate('/admin/login', { replace: true });
  }, [loading, session, navigate]);

  /* Approved while the tab was open? Move them along. */
  useEffect(() => {
    if (!loading && session && profile && profile.role !== 'pending_staff') {
      navigate(homeFor(profile), { replace: true });
    }
  }, [loading, session, profile, navigate]);

  const onSignOut = async () => {
    await signOut();
    toast.success('Signed out.');
    navigate('/admin/login', { replace: true });
  };

  const onCheck = async () => {
    await refreshProfile();
    toast.success('Checked — no change yet if you are still on this screen.');
  };

  if (loading || !session || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink px-6">
        <Spinner label="Checking your session…" />
      </div>
    );
  }

  return (
    <AuthShell
      eyebrow="// Awaiting approval"
      title="Your administrator account is awaiting approval by an existing administrator."
      sub="The account exists and your password is correct — it simply has no dashboard access until an administrator approves it in Dashboard → Users."
    >
      <div className="space-y-6">
        <div className="flex items-start gap-3.5 rounded-2xl border border-amber/25 bg-amber/[0.07] px-4 py-4">
          <Clock size={18} className="mt-0.5 flex-none text-amber" />
          <div>
            <p className="text-[14.5px] font-semibold text-chalk">Waiting on an administrator</p>
            <p className="mt-1.5 text-[14px] leading-relaxed text-graphite">
              Once an administrator approves your account in Dashboard → Users, sign in again and
              the dispatch board opens automatically.
            </p>
          </div>
        </div>

        <dl className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <dt className="mono text-[9.5px] text-graphite">Account</dt>
            <dd className="mono truncate text-[10.5px] text-chalk">{profile.email}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="mono text-[9.5px] text-graphite">Status</dt>
            <dd className="mono rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[9.5px] text-graphite">
              pending_staff
            </dd>
          </div>
        </dl>

        <div className="space-y-3">
          <button type="button" onClick={onCheck} className="btn-ghost w-full">
            <RefreshCw size={15} />
            Check again
          </button>
          <button type="button" onClick={onSignOut} className="btn-amber w-full">
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      </div>
    </AuthShell>
  );
};

export default AdminPending;
