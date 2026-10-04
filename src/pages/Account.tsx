import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { LogOut, Wrench } from 'lucide-react';
import { db } from '@/components/auth/lib/db';
import { useAuth, canUseCustomerArea } from '@/components/auth/lib/auth';
import { API_BASE } from '@/components/auth/lib/api';
import { getSessionToken } from '@/components/auth/lib/session-store';
import {
  Panel,
  PageTitle,
  Spinner,
  EmptyState,
  RolePill,
  StatusPill,
  UrgencyPill,
} from '@/components/dashboard/ui';
import { ChangePasswordPanel } from '@/components/auth/ChangePasswordPanel';
import Header from '@/components/site/Header';
import { BUSINESS_NAME } from '@/data/site-content';
import type { Status, Urgency } from '@/components/auth/lib/validation';

type MyRequest = {
  id: number;
  location: string;
  truck_details: string | null;
  issue_description: string;
  urgency: Urgency;
  status: Status;
  created_at: string;
};

/**
 * /account â€” the customer area. Protected.
 *
 * Signed-out visitors go to /login. A customer, an administrator and a
 * dispatcher may all open this page; their own rows are the only ones it can
 * show. A `viewer` is sent to /dashboard, which is their workspace.
 *
 * The list below is filtered by the query AND by row-level security: the
 * SELECT policy on service_requests only matches rows whose user_id is the
 * caller's own auth id or whose email is their own address â€” so the database,
 * not this component, is what keeps other people's requests out, for every
 * role including staff.
 */
const Account: React.FC = () => {
  const navigate = useNavigate();
  const { session, profile, loading, signOut } = useAuth();
  const [rows, setRows] = useState<MyRequest[] | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestValues, setRequestValues] = useState({
  name: '',
  phone: '',
  truck_details: '',
  location: '',
  issue_description: '',
});

const [requestSending, setRequestSending] = useState(false);

useEffect(() => {
  if (profile?.full_name) {
    setRequestValues((values) => ({
      ...values,
      name: profile.full_name ?? '',
    }));
  }
}, [profile]);

  useEffect(() => {
    if (!loading && !session) navigate('/login', { replace: true });
  }, [loading, session, navigate]);

  /* An administrator or dispatcher is a staff member AND a customer: they may
     open this area as well as the dispatch board, and it shows only their own
     profile and their own requests. A viewer belongs on the dispatch board,
     and an account still awaiting approval gets the waiting screen. */
  useEffect(() => {
    if (loading || !session || !profile) return;
    if (profile.role === 'pending_staff') navigate('/admin/pending', { replace: true });
    else if (!canUseCustomerArea(profile)) navigate('/dashboard', { replace: true });
  }, [loading, session, profile, navigate]);


useEffect(() => {
  if (!profile || !canUseCustomerArea(profile)) return;

  let cancelled = false;

  (async () => {
    try {
      const sessionToken = getSessionToken();

      if (!sessionToken) {
        toast.error('Your session has expired. Please sign in again.');
        return;
      }

      const response = await fetch(`${API_BASE}/api/my-requests`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      const data = await response.json();

      if (cancelled) return;

      if (!response.ok) {
        toast.error(
          data.error ?? 'Could not load your service requests.',
        );
        setRows([]);
        return;
      }

      setRows((data.requests ?? []) as MyRequest[]);
    } catch (error) {
      if (cancelled) return;

      console.error('Load service requests error:', error);
      toast.error('Could not load your service requests.');
      setRows([]);
    }
  })();

  return () => {
    cancelled = true;
  };
}, [profile]);

  const onSignOut = async () => {
    await signOut();
    toast.success('Signed out.');
    navigate('/login', { replace: true });
  };

  if (loading || !session || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink px-6">
        <Spinner label="Checking your sessionâ€¦" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink">
      <Header />
      <main className="mx-auto max-w-[1100px] px-4 py-8 sm:px-7 sm:py-10">
        <PageTitle
          title={`Welcome back, ${(profile.full_name ?? profile.email).split(' ')[0]}.`}
          sub="Everything you have sent us, and where each job stands. Need us again? Send a new request and dispatch will call you back."
          actions={
  <button
    type="button"
    onClick={() => setRequestOpen(true)}
    className="btn-amber !py-2.5 text-[14px]"
  >
    <Wrench size={15} />
    Request service
  </button>
}
        />

        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.6fr)]">
          <Panel>
            <h2 className="font-display text-[17px] font-semibold text-chalk">Your details</h2>
            <dl className="mt-5 space-y-4">
              <div>
                <dt className="field-label">Name</dt>
                <dd className="mt-1 text-[15px] text-chalk">{profile.full_name ?? 'â€”'}</dd>
              </div>
              <div>
                <dt className="field-label">Email</dt>
                <dd className="mono mt-1 break-all text-[11px] text-graphite">{profile.email}</dd>
              </div>
              <div>
                <dt className="field-label">Account type</dt>
                <dd className="mt-2">
                  <RolePill role={profile.role} />
                </dd>
              </div>
            </dl>
            <p className="mono mt-6 text-[9.5px] leading-relaxed text-graphite">
              Need a detail changed? Mention it on your next request and dispatch will update your
              file.
            </p>
          </Panel>

          <Panel className="!p-0">
            <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] px-5 py-4 sm:px-6">
              <h2 className="font-display text-[17px] font-semibold text-chalk">
                Your service requests
              </h2>
              {rows !== null && (
                <span className="mono text-[9.5px] text-graphite">
                  {rows.length} {rows.length === 1 ? 'request' : 'requests'}
                </span>
              )}
            </div>

            {rows === null ? (
              <div className="px-6">
                <Spinner label="Loading your requestsâ€¦" />
              </div>
            ) : rows.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  title="No requests yet"
                  sub="When you send a request from the site it shows up here with its live status."
                />
              </div>
            ) : (
              <ul className="divide-y divide-white/[0.05]">
                {rows.map((r) => (
                  <li key={r.id} className="px-5 py-5 sm:px-6">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <StatusPill status={r.status} />
                      <UrgencyPill urgency={r.urgency} />
                      <span className="mono ml-auto text-[9.5px] text-graphite">
                        {new Date(r.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="mt-3 text-[15px] font-semibold leading-snug text-chalk">
                      {r.location}
                    </p>
                    {r.truck_details && (
                      <p className="mono mt-1 text-[9.5px] text-graphite">{r.truck_details}</p>
                    )}
                    <p className="mt-2 max-w-[70ch] text-[14.5px] leading-relaxed text-graphite">
                      {r.issue_description}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

                    <ChangePasswordPanel />
        </div>
      </main>

      {requestOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl rounded-2xl border border-white/[0.08] bg-ink p-6 shadow-2xl sm:p-8">
            <button
              type="button"
              onClick={() => setRequestOpen(false)}
              className="absolute right-4 top-4 text-graphite transition-colors hover:text-chalk"
              aria-label="Close request form"
            >
              Ã—
            </button>

            <h2 className="font-display text-[22px] font-semibold text-chalk">
              Raise a service request
            </h2>

            <p className="mt-2 text-[14px] leading-relaxed text-graphite">
              Tell us what you need and our dispatch team will get back to you.
            </p>

             <form
  className="mt-6 space-y-4"
  onSubmit={async (e) => {
    e.preventDefault();

    if (requestSending) return;

    if (
      !requestValues.name.trim() ||
      !requestValues.phone.trim() ||
      !requestValues.location.trim() ||
      !requestValues.issue_description.trim()
    ) {
      toast.error('Please complete all required fields.');
      return;
    }

    setRequestSending(true);

    try {
      const sessionToken = getSessionToken();

      const response = await fetch(
        `${API_BASE}/api/public/submit-request`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(sessionToken
              ? { Authorization: `Bearer ${sessionToken}` }
              : {}),
          },
          body: JSON.stringify({
            ...requestValues,
            urgency: 'scheduled',
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        toast.error(
          data.error ?? 'Could not submit your service request.',
        );
        return;
      }

      toast.success('Service request submitted successfully.');

      setRequestValues({
        name: profile?.full_name ?? '',
        phone: '',
        truck_details: '',
        location: '',
        issue_description: '',
      });

      setRequestOpen(false);

      // Reload the customer's requests so the new request
      // immediately appears in the account page.
      if (profile) {
        const { data: updatedRows, error } = await db
          .from('service_requests')
          .select(
            'id, location, truck_details, issue_description, urgency, status, created_at',
          )
          .eq('email', profile.email)
          .order('created_at', { ascending: false })
          .limit(50);

        if (!error) {
          setRows((updatedRows ?? []) as MyRequest[]);
        }
      }
    } catch {
      toast.error('Network problem. Please try again.');
    } finally {
      setRequestSending(false);
    }
  }}
>
  <div className="grid gap-4 sm:grid-cols-2">
    <div>
      <label
        htmlFor="account-request-name"
        className="field-label"
      >
        Name
      </label>

      <input
        id="account-request-name"
        className="field-input mt-2"
        value={requestValues.name}
        onChange={(e) =>
          setRequestValues((values) => ({
            ...values,
            name: e.target.value,
          }))
        }
      />
    </div>

    <div>
      <label
        htmlFor="account-request-phone"
        className="field-label"
      >
        Phone
      </label>

      <input
        id="account-request-phone"
        className="field-input mt-2"
        value={requestValues.phone}
        onChange={(e) =>
          setRequestValues((values) => ({
            ...values,
            phone: e.target.value,
          }))
        }
        inputMode="tel"
      />
    </div>
  </div>

  <div>
    <label
      htmlFor="account-request-truck"
      className="field-label"
    >
      Truck details
    </label>

    <input
      id="account-request-truck"
      className="field-input mt-2"
      value={requestValues.truck_details}
      onChange={(e) =>
        setRequestValues((values) => ({
          ...values,
          truck_details: e.target.value,
        }))
      }
      placeholder="Truck number, make/model, etc."
    />
  </div>

  <div>
    <label
      htmlFor="account-request-location"
      className="field-label"
    >
      Location
    </label>

    <input
      id="account-request-location"
      className="field-input mt-2"
      value={requestValues.location}
      onChange={(e) =>
        setRequestValues((values) => ({
          ...values,
          location: e.target.value,
        }))
      }
      placeholder="Where is the truck located?"
    />
  </div>

  <div>
    <label
      htmlFor="account-request-issue"
      className="field-label"
    >
      What do you need help with?
    </label>

    <textarea
      id="account-request-issue"
      className="field-input mt-2 min-h-[120px] resize-y"
      value={requestValues.issue_description}
      onChange={(e) =>
        setRequestValues((values) => ({
          ...values,
          issue_description: e.target.value,
        }))
      }
      placeholder="Describe the issue or service you need..."
    />
  </div>

  <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
    <button
      type="button"
      onClick={() => setRequestOpen(false)}
      className="btn-ghost !py-3 text-[14px]"
    >
      Cancel
    </button>

    <button
  type="submit"
  className="btn-amber !py-3 text-[14px]"
  disabled={requestSending}
>
  {requestSending ? 'Submitting...' : 'Submit request'}
</button>
  </div>
</form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Account;


