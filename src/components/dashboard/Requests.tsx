import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Filter, RefreshCw, X } from 'lucide-react';
import { getSessionToken } from '@/components/auth/lib/session-store';
import {
  useAuth,
  isStaff,
} from '@/components/auth/lib/auth';
import {
  STATUSES,
  URGENCIES,
  type Status,
  type Urgency,
} from '@/components/auth/lib/validation';
import {
  Panel,
  PageTitle,
  Spinner,
  EmptyState,
  StatusPill,
  UrgencyPill,
  STATUS_LABEL,
  URGENCY_LABEL,
  ReadOnlyNote,
} from '@/components/dashboard/ui';
import type { Profile } from '@/components/auth/lib/auth';

export type ServiceRequest = {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  location: string;
  truck_details: string | null;
  issue_description: string;
  urgency: Urgency;
  status: Status;
  assigned_to: string | null;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
};

import { API_BASE } from '@/components/auth/lib/api';

const getHeaders = () => {
  const token = getSessionToken();

  return {
    'Content-Type': 'application/json',
    ...(token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : {}),
  };
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

/* ---------------------------------------------------------------- Overview */

export const Overview: React.FC = () => {
  const [rows, setRows] = useState<ServiceRequest[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch(`${API_BASE}/api/admin/requests`, {
          headers: getHeaders(),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.error || 'Could not load requests.');
        }

        if (!cancelled) {
          setRows((data.rows ?? []) as ServiceRequest[]);
        }
      } catch (error) {
        console.error('Load overview requests error:', error);

        if (!cancelled) {
          toast.error('Could not load requests.');
          setRows([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const counts = useMemo(() => {
    const base: Record<Status, number> = {
      new: 0,
      dispatched: 0,
      in_progress: 0,
      completed: 0,
      cancelled: 0,
    };

    (rows ?? []).forEach((r) => {
      base[r.status] = (base[r.status] ?? 0) + 1;
    });

    return base;
  }, [rows]);

  return (
    <div>
      <PageTitle
        title="Overview"
        sub="Live picture of the board: how many jobs sit in each state, and the most recent calls to come in."
      />

      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-5">
        {STATUSES.map((s) => (
          <Panel key={s} className="glass-hover">
            <p className="mono text-[9.5px] text-graphite">
              {STATUS_LABEL[s]}
            </p>

            <p
              className={`mono-num mt-3 font-display text-[34px] font-bold leading-none ${
                s === 'new' ? 'text-amber' : 'text-chalk'
              }`}
            >
              {rows === null ? '—' : counts[s]}
            </p>
          </Panel>
        ))}
      </div>

      <h2 className="mt-10 font-display text-[19px] font-semibold tracking-tight text-chalk">
        Latest requests
      </h2>

      <Panel className="mt-4 !p-0">
        {rows === null ? (
          <div className="px-6">
            <Spinner />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No service requests yet"
              sub="Submissions from the public form land here the moment they arrive."
            />
          </div>
        ) : (
          <ul className="divide-y divide-white/[0.07]">
            {rows.slice(0, 8).map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center gap-3 px-5 py-4 sm:px-6"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-chalk">
                    {r.name}
                  </p>

                  <p className="mt-0.5 truncate text-[13.5px] text-graphite">
                    {r.location}
                  </p>
                </div>

                <UrgencyPill urgency={r.urgency} />
                <StatusPill status={r.status} />

                <span className="mono w-[86px] text-right text-[9.5px] text-graphite">
                  {fmt(r.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
};

/* ---------------------------------------------------------- Service requests */

export const Requests: React.FC = () => {
  const { profile } = useAuth();

  const canEdit = isStaff(profile);

  const [rows, setRows] = useState<ServiceRequest[] | null>(null);
  const [staff, setStaff] = useState<Profile[]>([]);
  const [statusFilter, setStatusFilter] = useState<Status | 'all'>('all');
  const [urgencyFilter, setUrgencyFilter] =
    useState<Urgency | 'all'>('all');
    const [search, setSearch] = useState('');
  const [openRow, setOpenRow] = useState<ServiceRequest | null>(null);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setRefreshing(true);

    try {
      const [reqsResponse, staffResponse] = await Promise.all([
        fetch(`${API_BASE}/api/admin/requests`, {
          headers: getHeaders(),
        }),

        fetch(`${API_BASE}/api/admin/request-staff`, {
          headers: getHeaders(),
        }),
      ]);

      const [reqs, people] = await Promise.all([
        reqsResponse.json(),
        staffResponse.json(),
      ]);

      if (!reqsResponse.ok) {
        throw new Error(
          reqs?.error || 'Could not load requests.'
        );
      }

      if (!staffResponse.ok) {
        throw new Error(
          people?.error || 'Could not load staff.'
        );
      }

      setRows((reqs.rows ?? []) as ServiceRequest[]);
      setStaff((people.rows ?? []) as Profile[]);
    } catch (error) {
      console.error('Load requests error:', error);

      toast.error(
        error instanceof Error
          ? error.message
          : 'Could not load requests.'
      );

      setRows([]);
      setStaff([]);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

 const filtered = useMemo(() => {
  const query = search.trim().toLowerCase();

  return (rows ?? []).filter((r) => {
    const matchesSearch =
      !query ||
      String(r.id).includes(query) ||
      r.name.toLowerCase().includes(query) ||
      r.phone.toLowerCase().includes(query) ||
      r.location.toLowerCase().includes(query) ||
      r.issue_description.toLowerCase().includes(query);

    const matchesStatus =
      statusFilter === 'all' || r.status === statusFilter;

    const matchesUrgency =
      urgencyFilter === 'all' || r.urgency === urgencyFilter;

    return matchesSearch && matchesStatus && matchesUrgency;
  });
}, [rows, search, statusFilter, urgencyFilter]);

  const patch = async (
    id: number,
    changes: Partial<ServiceRequest>
  ) => {
    setSaving(true);

    try {
      const response = await fetch(
        `${API_BASE}/api/admin/requests/${id}`,
        {
          method: 'PATCH',
          headers: getHeaders(),
          body: JSON.stringify(changes),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.row) {
        throw new Error(
          data?.error || 'Could not save that change.'
        );
      }

      const updated = data.row as ServiceRequest;

      setRows((prev) =>
        (prev ?? []).map((r) =>
          r.id === id ? updated : r
        )
      );

      setOpenRow((prev) =>
        prev && prev.id === id ? updated : prev
      );

      toast.success('Saved.');
    } catch (error) {
      console.error('Update request error:', error);

      toast.error(
        error instanceof Error
          ? error.message
          : 'Could not save that change.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageTitle
        title="Service requests"
        sub="Every call that came in through the public form. Filter the board, open a job for the full detail, change its status or hand it to a dispatcher."
        actions={
          <button
            type="button"
            className="btn-ghost !py-2.5 text-[13.5px]"
            onClick={load}
            disabled={refreshing}
          >
            <RefreshCw
              size={14}
              className={refreshing ? 'animate-spin' : ''}
            />
            Refresh
          </button>
        }
      />

      {!canEdit && (
        <div className="mb-5">
          <ReadOnlyNote what="service requests" />
        </div>
      )}

      <Panel className="mb-5">
        <div className="flex flex-col gap-4">
    <div className="relative w-full max-w-[420px]">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search requests..."
        className="field-input w-full pr-10"
      />

      {search && (
        <button
          type="button"
          onClick={() => setSearch('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-graphite transition-colors hover:text-chalk"
          aria-label="Clear search"
        >
          <X size={15} />
        </button>
      )}
    </div>
          <span className="mono inline-flex items-center gap-2 text-[10px] text-graphite">
            <Filter size={13} className="text-amber" />
            Filters
          </span>

          <div className="flex flex-wrap items-center gap-2">
            {(['all', ...STATUSES] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() =>
                  setStatusFilter(
                    s as Status | 'all'
                  )
                }
                className={`mono rounded-full border px-3 py-1.5 text-[9.5px] transition-colors duration-300 ${
                  statusFilter === s
                    ? 'border-amber/60 bg-amber/15 text-amber'
                    : 'border-white/12 bg-white/[0.03] text-graphite hover:border-amber/35 hover:text-chalk'
                }`}
              >
                {s === 'all'
                  ? 'All statuses'
                  : STATUS_LABEL[s as Status]}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(['all', ...URGENCIES] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() =>
                  setUrgencyFilter(
                    u as Urgency | 'all'
                  )
                }
                className={`mono rounded-full border px-3 py-1.5 text-[9.5px] transition-colors duration-300 ${
                  urgencyFilter === u
                    ? 'border-amber/60 bg-amber/15 text-amber'
                    : 'border-white/12 bg-white/[0.03] text-graphite hover:border-amber/35 hover:text-chalk'
                }`}
              >
                {u === 'all'
                  ? 'All urgencies'
                  : URGENCY_LABEL[u as Urgency]}
              </button>
            ))}
          </div>
        </div>
      </Panel>

      <Panel className="!p-0">
        {rows === null ? (
          <div className="px-6">
            <Spinner />
          </div>
        ) : filtered.length === 0 ? (
  <div className="p-6">
    <EmptyState
      title={
        rows.length === 0
          ? 'No service requests yet'
          : 'No matching requests'
      }
      sub={
        rows.length === 0
          ? 'Submissions from the public form will appear here.'
          : search.trim()
            ? `No requests match "${search.trim()}". Try a different search or clear the filters.`
            : 'Try changing or clearing the filters to see more jobs.'
      }
    />
  </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left">
              <thead>
                <tr className="border-b border-white/[0.08]">
                  {[
                    'Driver',
                    'Location',
                    'Urgency',
                    'Status',
                    'Received',
                    '',
                  ].map((h) => (
                    <th
                      key={h}
                      className="mono px-5 py-3.5 text-[9.5px] font-medium text-graphite"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-white/[0.05] transition-colors duration-200 hover:bg-white/[0.03]"
                  >
                    <td className="px-5 py-4">
                      <p className="text-[14.5px] font-semibold text-chalk">
                        {r.name}
                      </p>

                      <p className="mono mt-0.5 text-[9.5px] text-graphite">
                        {r.phone}
                      </p>
                    </td>

                    <td className="max-w-[240px] px-5 py-4 text-[14px] text-graphite">
                      {r.location}
                    </td>

                    <td className="px-5 py-4">
                      <UrgencyPill urgency={r.urgency} />
                    </td>

                    <td className="px-5 py-4">
                      <StatusPill status={r.status} />
                    </td>

                    <td className="mono px-5 py-4 text-[9.5px] text-graphite">
                      {fmt(r.created_at)}
                    </td>

                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => setOpenRow(r)}
                        className="mono text-[9.5px] text-amber transition-opacity hover:opacity-75"
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Detail drawer */}

      {openRow && (
        <div
          className="fixed inset-0 z-[70] flex justify-end"
          role="dialog"
          aria-modal="true"
          aria-label="Request detail"
        >
          <div
            className="absolute inset-0 bg-ink/80 backdrop-blur-sm"
            onClick={() => setOpenRow(null)}
          />

          <div className="relative z-10 h-full w-full max-w-[520px] overflow-y-auto border-l border-white/10 bg-[#11151b] px-6 py-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="mono text-[10px] text-amber">
                  Request #{openRow.id}
                </p>

                <h2 className="mt-2 font-display text-[24px] font-bold tracking-tight text-chalk">
                  {openRow.name}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setOpenRow(null)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/12 text-chalk transition-colors hover:border-amber/50 hover:text-amber"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <dl className="mt-7 space-y-4">
              {[
                ['Phone', openRow.phone],
                ['Email', openRow.email ?? '—'],
                ['Location', openRow.location],
                [
                  'Truck / trailer',
                  openRow.truck_details ?? '—',
                ],
                ['What is wrong', openRow.issue_description],
                ['Received', fmt(openRow.created_at)],
                ['Last updated', fmt(openRow.updated_at)],
              ].map(([label, value]) => (
                <div key={label as string}>
                  <dt className="mono text-[9.5px] text-graphite">
                    {label}
                  </dt>

                  <dd className="mt-1 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-chalk/90">
                    {value as string}
                  </dd>
                </div>
              ))}
            </dl>

            {canEdit ? (
              <div className="mt-8 space-y-6">
                <div>
                  <p className="field-label">
                    Status
                  </p>

                  <div className="mt-2 flex flex-wrap gap-2">
                    {STATUSES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        disabled={saving}
                        onClick={() =>
                          patch(openRow.id, {
                            status: s,
                          })
                        }
                        className={`mono rounded-full border px-3 py-2 text-[9.5px] transition-colors duration-300 disabled:opacity-50 ${
                          openRow.status === s
                            ? 'border-amber/60 bg-amber/15 text-amber'
                            : 'border-white/12 bg-white/[0.03] text-graphite hover:border-amber/40 hover:text-chalk'
                        }`}
                      >
                        {STATUS_LABEL[s]}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label
                    className="field-label"
                    htmlFor="assign"
                  >
                    Assigned to
                  </label>

                  <select
                    id="assign"
                    className="field-input mt-2"
                    value={openRow.assigned_to ?? ''}
                    disabled={saving}
                    onChange={(e) =>
                      patch(openRow.id, {
                        assigned_to:
                          e.target.value || null,
                      })
                    }
                  >
                    <option value="">
                      Unassigned
                    </option>

                    {staff.map((p) => (
                      <option
                        key={p.id}
                        value={p.id}
                      >
                        {p.full_name ?? p.email} (
                        {p.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    className="field-label"
                    htmlFor="notes"
                  >
                    Internal notes
                  </label>

                  <textarea
                    id="notes"
                    className="field-input mt-2 min-h-[100px] resize-y"
                    defaultValue={
                      openRow.internal_notes ?? ''
                    }
                    onBlur={(e) => {
                      const next =
                        e.target.value.slice(
                          0,
                          4000
                        );

                      if (
                        next !==
                        (openRow.internal_notes ??
                          '')
                      ) {
                        patch(openRow.id, {
                          internal_notes: next,
                        });
                      }
                    }}
                    placeholder="Parts needed, ETA given, follow-up…"
                  />

                  <p className="mono mt-1.5 text-[9.5px] text-graphite">
                    Saves when you click away.
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-8">
                <ReadOnlyNote
                  what="service requests"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

