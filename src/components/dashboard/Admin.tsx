import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, ShieldAlert, UserPlus } from 'lucide-react';
import { useAuth, isAdmin, type Profile } from '@/lib/auth';
import { getSessionToken } from '@/lib/session-store';
import { newUserSchema, fieldErrors, ROLES, PASSWORD_MIN, type Role } from '@/lib/validation';
import {
  Panel,
  PageTitle,
  Spinner,
  EmptyState,
  RolePill,
  Toggle,
  Field,
} from '@/components/dashboard/ui';
import { GenerateResetLink } from '@/components/dashboard/GenerateResetLink';

/* ------------------------------------------------------------------ Users */
/** Roles an administrator can assign. `pending_staff` is not a role: it means
    "no roles yet", and granting any role is what approves the account. */
const ASSIGNABLE: Role[] = ['admin', 'dispatcher', 'viewer', 'customer'];

const summaryOf = (roles: Role[]): Role =>
  roles.includes('admin')
    ? 'admin'
    : roles.includes('dispatcher')
      ? 'dispatcher'
      : roles.includes('viewer')
        ? 'viewer'
        : 'customer';

export const UsersAdmin: React.FC = () => {
  const { profile } = useAuth();
  const admin = isAdmin(profile);
  const [rows, setRows] = useState<Profile[] | null>(null);
  const [roleSets, setRoleSets] = useState<Record<string, Role[]>>({});
  const [draft, setDraft] = useState({ full_name: '', email: '', role: 'dispatcher' as Role, password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [savingId, setSavingId] = useState('');

 const load = async () => {
  const token = getSessionToken();

  try {
    const response = await fetch(
      'http://localhost:3001/api/admin/users',
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      toast.error(data?.error || 'Could not load users.');
      return;
    }

    const users = data.users ?? [];

    setRows(users as Profile[]);

    const map: Record<string, Role[]> = {};

    users.forEach((user: Profile & { roles?: Role[] }) => {
      map[user.id] = user.roles ?? [];
    });

    setRoleSets(map);
  } catch (error) {
    console.error('Users load error:', error);
    toast.error('Could not connect to the local backend.');
  }
};

  useEffect(() => {
    load();
  }, []);

  /* Role changes are checked server-side: the edge function re-reads the
     caller's role set and only an administrator may write it. */
  const setRoles = async (row: Profile, next: Role[]) => {
    if (next.length === 0) {
      toast.error('Keep at least one role on the account.');
      return;
    }
    setSavingId(row.id);
    const token = getSessionToken();

const response = await fetch(
  `http://localhost:3001/api/admin/users/${row.id}/roles`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      roles: next,
    }),
  },
);

let data: { error?: string; roles?: Role[] } = {};

try {
  data = await response.json();
} catch {
  data = {};
}

const status = response.status;
    setSavingId('');
    if (status !== 200) {
      toast.error(data.error ?? 'Permission denied — only an administrator can change roles.');
      return;
    }
    const saved = data.roles ?? next;
    setRoleSets((m) => ({ ...m, [row.id]: saved }));
    setRows((prev) =>
      (prev ?? []).map((r) => (r.id === row.id ? { ...r, role: summaryOf(saved) } : r)),
    );
    toast.success(`Roles updated — ${saved.join(', ')}.`);
  };

  const toggleRole = (row: Profile, role: Role) => {
    const current = roleSets[row.id] ?? (row.role === 'pending_staff' ? [] : [row.role]);
    const next = current.includes(role) ? current.filter((r) => r !== role) : [...current, role];
    setRoles(row, next);
  };

 const toggleActive = async (row: Profile) => {
  if (row.id === profile?.id) {
    toast.error('You cannot deactivate your own account.');
    return;
  }

  const next = !row.is_active;
  const token = getSessionToken();

  try {
    const response = await fetch(
      `http://localhost:3001/api/admin/users/${row.id}/status`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          is_active: next,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      toast.error(
        data?.error ||
        'Permission denied — only an administrator can change user status.'
      );
      return;
    }

    setRows((prev) =>
      (prev ?? []).map((r) =>
        r.id === row.id ? { ...r, is_active: next } : r
      )
    );

    toast.success(next ? 'Account reactivated.' : 'Account deactivated.');
  } catch (error) {
    console.error('Status update error:', error);
    toast.error('Unable to update account status.');
  }
};
const create = async (e: React.FormEvent) => {
  e.preventDefault();

  const parsed = newUserSchema.safeParse(draft);

  if (!parsed.success) {
    const errs = fieldErrors(parsed.error);
    setErrors(errs);
    toast.error(Object.values(errs)[0] ?? 'Please check the form.');
    return;
  }

  setErrors({});
  setBusy(true);

  try {
    const token = getSessionToken();

    const response = await fetch(
      'http://localhost:3001/api/admin/users',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          full_name: parsed.data.full_name,
          email: parsed.data.email,
          role: parsed.data.role,
          password: parsed.data.password,
        }),
      }
    );

    const data = await response.json();

    if (response.status === 403) {
      toast.error('Permission denied.');
      return;
    }

    if (!response.ok) {
      toast.error(data?.error ?? 'Could not create that user.');
      return;
    }

    toast.success(
      'User created. Ask them to sign in and change the password.'
    );

    setDraft({
      full_name: '',
      email: '',
      role: 'dispatcher',
      password: '',
    });

    load();

  } catch (error) {
    console.error('User creation error:', error);
    toast.error('Network problem. Please try again.');

  } finally {
    setBusy(false);
  }
};

  if (!admin) {
    return (
      <div>
        <PageTitle title="Users" />
        <Panel>
          <div className="flex items-start gap-4">
            <ShieldAlert className="mt-0.5 flex-none text-amber" size={20} />
            <p className="text-[15px] leading-relaxed text-graphite">
              Only administrators can manage user accounts. Your role does not include this section.
            </p>
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <div>
      <PageTitle
        title="Users"
        sub="Create staff accounts, assign roles and deactivate someone who has left. One person can hold several roles at once — an account can be admin AND customer, so it reaches the dispatch board and its own customer area. Tick a role to grant it, untick it to take it away; every change is written to the audit log."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.85fr)]">
        <Panel className="!p-0">
          {rows === null ? (
            <div className="px-6">
              <Spinner />
            </div>
          ) : rows.length === 0 ? (
            <div className="p-6">
              <EmptyState title="No users yet" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-white/[0.08]">
                    {['Person', 'Role set', 'Roles', 'Active', 'Reset link'].map((h) => (
                      <th key={h} className="mono px-5 py-3.5 text-[9.5px] font-medium text-graphite">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const set = roleSets[r.id] ?? (r.role === 'pending_staff' ? [] : [r.role]);
                    const pending = r.role === 'pending_staff' && set.length === 0;
                    return (
                      <tr key={r.id} className="border-b border-white/[0.05]">
                        <td className="px-5 py-4">
                          <p className="text-[14.5px] font-semibold text-chalk">{r.full_name ?? '—'}</p>
                          <p className="mono mt-0.5 text-[9.5px] text-graphite">{r.email}</p>
                          {pending && (
                            <p className="mono mt-1.5 text-[9.5px] text-amber">
                              awaiting approval — tick a role to approve
                            </p>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {set.length === 0 ? (
                              <span className="mono text-[9.5px] text-graphite">none</span>
                            ) : (
                              set.map((role) => <RolePill key={role} role={role} />)
                            )}
                            {savingId === r.id && (
                              <Loader2 size={13} className="animate-spin text-amber" />
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-x-4 gap-y-2">
                            {ASSIGNABLE.map((role) => (
                              <label
                                key={role}
                                className="mono inline-flex cursor-pointer items-center gap-2 text-[10px] text-chalk/85"
                              >
                                <input
                                  type="checkbox"
                                  className="h-3.5 w-3.5 accent-[#FFB020]"
                                  checked={set.includes(role)}
                                  disabled={savingId === r.id}
                                  onChange={() => toggleRole(r, role)}
                                  aria-label={`${role} role for ${r.email}`}
                                />
                                {role}
                              </label>
                            ))}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <Toggle
                            checked={r.is_active}
                            onChange={() => toggleActive(r)}
                            label={`Toggle active for ${r.email}`}
                            disabled={r.id === profile?.id}
                          />
                        </td>
                        <td className="px-5 py-4">
                          <GenerateResetLink user={r} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel>
          <h2 className="font-display text-[17px] font-semibold text-chalk">Create a user</h2>
          <form className="mt-5 space-y-4" onSubmit={create} noValidate>
            <Field label="Name" htmlFor="nu-name" error={errors.full_name}>
              <input
                id="nu-name"
                className="field-input"
                value={draft.full_name}
                onChange={(e) => setDraft((d) => ({ ...d, full_name: e.target.value }))}
              />
            </Field>
            <Field label="Email" htmlFor="nu-email" error={errors.email}>
              <input
                id="nu-email"
                type="email"
                className="field-input"
                value={draft.email}
                onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
              />
            </Field>
            <Field label="Starting role" htmlFor="nu-role" error={errors.role}>
              <select
                id="nu-role"
                className="field-input"
                value={draft.role}
                onChange={(e) => setDraft((d) => ({ ...d, role: e.target.value as Role }))}
              >
                {ASSIGNABLE.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Temporary password"
              htmlFor="nu-pw"
              error={errors.password}
              hint={`At least ${PASSWORD_MIN} characters, with upper case, lower case and a number. Share it securely and ask them to change it.`}
            >
              <input
                id="nu-pw"
                type="password"
                className="field-input"
                value={draft.password}
                onChange={(e) => setDraft((d) => ({ ...d, password: e.target.value }))}
                autoComplete="new-password"
              />
            </Field>
            <button type="submit" className="btn-amber w-full" disabled={busy}>
              {busy ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />}
              Create user
            </button>
          </form>
        </Panel>
      </div>
    </div>
  );
}


/* -------------------------------------------------------------- Audit log */
type AuditRow = {
  id: number;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export const AuditLog: React.FC = () => {
  const { profile } = useAuth();
  const admin = isAdmin(profile);
  const [rows, setRows] = useState<AuditRow[] | null>(null);

  useEffect(() => {
    if (!admin) {
      setRows([]);
      return;
    }
    (async () => {
      const response = await fetch('http://localhost:3001/api/admin/audit-log');

if (!response.ok) {
  toast.error('Could not load the audit log.');
  setRows([]);
  return;
}

const data = await response.json();

setRows((data.rows ?? []) as AuditRow[]);
    })();
  }, [admin]);

  if (!admin) {
    return (
      <div>
        <PageTitle title="Audit log" />
        <Panel>
          <div className="flex items-start gap-4">
            <ShieldAlert className="mt-0.5 flex-none text-amber" size={20} />
            <p className="text-[15px] leading-relaxed text-graphite">
              The audit log is restricted to administrators.
            </p>
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <div>
      <PageTitle
        title="Audit log"
        sub="Every change to requests, reviews, road notes, FAQs and accounts — written by the database itself, with the actor and timestamp, so it cannot be skipped by the app."
      />
      <Panel className="!p-0">
        {rows === null ? (
          <div className="px-6">
            <Spinner />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-6">
            <EmptyState title="Nothing logged yet" sub="Actions appear here as soon as staff start working." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead>
                <tr className="border-b border-white/[0.08]">
                  {['When', 'Actor', 'Action', 'Entity'].map((h) => (
                    <th key={h} className="mono px-5 py-3.5 text-[9.5px] font-medium text-graphite">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-white/[0.05]">
                    <td className="mono px-5 py-3.5 text-[9.5px] text-graphite">
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5 text-[13.5px] text-chalk/85">
                      {r.actor_email ?? 'public / system'}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="mono rounded-full border border-amber/30 bg-amber/10 px-2.5 py-1 text-[9.5px] text-amber">
                        {r.action}
                      </span>
                    </td>
                    <td className="mono px-5 py-3.5 text-[9.5px] text-graphite">
                      {r.entity}
                      {r.entity_id ? ` #${r.entity_id}` : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
};
