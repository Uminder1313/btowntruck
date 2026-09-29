import React, { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Image as ImageIcon, Loader2, Save, Trash2, Upload } from 'lucide-react';
import { getSessionToken } from '@/components/auth/lib/session-store';
import { useAuth, isStaff } from '@/components/auth/lib/auth';
import { Panel, PageTitle, Spinner, EmptyState, ReadOnlyNote } from '@/components/dashboard/ui';
import type { SiteContentRow } from '@/components/auth/lib/site-copy';

import { API_BASE } from '@/components/auth/lib/api';

const getAuthHeaders = () => {
  const token = getSessionToken();

  return {
    Authorization: `Bearer ${token}`,
  };
};

const resolveMediaUrl = (value: string) => {
  if (!value) return '';

  if (
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('data:')
  ) {
    return value;
  }

  if (value.startsWith('/')) {
    return `${API_BASE}${value}`;
  }

  return value;
};
/* ---------------------------------------------------------------------------
   Dashboard → Site Content.

   Edits the public landing page's text and images without a rebuild. Admin and
   dispatcher may save; viewer sees the same values read-only. The UI check is
   presentation: row-level security on `site_content` and on the `site-media`
   storage bucket only lets is_staff() write, and every save is written to the
   audit log by a database trigger.
--------------------------------------------------------------------------- */

const SECTION_ORDER = [
  'Hero',
  'Services',
  'How it works',
  'Fleets',
  'Coverage',
  'Contact',
  'Footer',
  'Images',
];

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];

/** Public URL for an object in the site-media bucket. */

const explain = (message?: string) =>
  message && message.toLowerCase().includes('policy')
    ? 'Permission denied — your role cannot change the site content.'
    : 'Could not save that change.';

/* ------------------------------------------------------------ Image editor */
const ImageRow: React.FC<{
  row: SiteContentRow;
  canEdit: boolean;
  onChange: (key: string, value: string) => void;
}> = ({ row, canEdit, onChange }) => {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (file: File) => {
  if (!ALLOWED.includes(file.type)) {
    toast.error('Use a JPG, PNG, WebP or SVG image.');
    return;
  }

  if (file.size > MAX_BYTES) {
    toast.error('That image is larger than 5 MB. Please upload a smaller file.');
    return;
  }

  setBusy(true);

  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(
      `${API_BASE}/api/admin/content/site-content/${encodeURIComponent(row.key)}/image`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData,
      },
    );

    const data = await response.json();

    if (!response.ok) {
      toast.error(
        data.error ?? 'Could not upload the image.',
      );
      return;
    }

    const url = data.url;

    onChange(row.key, url);

    toast.success('Published — live on the site');
  } catch (e) {
    toast.error(
      `Upload failed: ${e instanceof Error ? e.message : String(e)}`,
    );
  } finally {
    setBusy(false);

    if (fileRef.current) {
      fileRef.current.value = '';
    }
  }
};

  const remove = async () => {
  setBusy(true);

  try {
    const response = await fetch(
      `${API_BASE}/api/admin/content/site-content/${encodeURIComponent(row.key)}`,
      {
        method: 'PATCH',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          value: '',
        }),
      },
    );

    const data = await response.json();

    if (!response.ok) {
      toast.error(
        data.error ?? 'Could not remove the image.',
      );
      return;
    }

    onChange(row.key, '');

    toast.success('Published — live on the site');
  } catch (e) {
    toast.error(
      `Could not remove the image: ${
        e instanceof Error ? e.message : String(e)
      }`,
    );
  } finally {
    setBusy(false);
  }
};

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
      <p className="text-[14.5px] font-semibold text-chalk">{row.label}</p>
      <p className="mono mt-1 text-[9.5px] text-graphite">{row.key}</p>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex h-[132px] w-full flex-none items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-ink sm:w-[220px]">
          {row.value ? (
            <img
              src={resolveMediaUrl(row.value)}
              alt={`Current image for ${row.label}`}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="mono flex flex-col items-center gap-2 text-[9.5px] text-graphite">
              <ImageIcon size={20} />
              Using the built-in artwork
            </span>
          )}
        </div>

        <div className="flex-1">
          <p className="text-[14px] leading-relaxed text-graphite">
            JPG, PNG, WebP or SVG, up to 5 MB. Remove the image to go back to the illustration
            drawn into the page.
          </p>
          {canEdit ? (
            <div className="mt-4 flex flex-wrap gap-2.5">
              <input
                ref={fileRef}
                id={`img-${row.key}`}
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.svg,image/jpeg,image/png,image/webp,image/svg+xml"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) upload(f);
                }}
              />
              <label
                htmlFor={`img-${row.key}`}
                className={`btn-amber cursor-pointer !py-2.5 text-[13.5px] ${busy ? 'pointer-events-none opacity-60' : ''}`}
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {row.value ? 'Replace image' : 'Upload image'}
              </label>
              {row.value && (
                <button
                  type="button"
                  onClick={remove}
                  disabled={busy}
                  className="btn-ghost !py-2.5 text-[13.5px]"
                >
                  <Trash2 size={14} />
                  Remove
                </button>
              )}
            </div>
          ) : (
            <div className="mt-4">
              <ReadOnlyNote what="site images" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ---------------------------------------------------------------- Section */
const SectionPanel: React.FC<{
  section: string;
  rows: SiteContentRow[];
  canEdit: boolean;
  onChange: (key: string, value: string) => void;
}> = ({ section, rows, canEdit, onChange }) => {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  /* Keep drafts in step with the loaded rows (and with a sibling save). */
  useEffect(() => {
    setDrafts(Object.fromEntries(rows.map((r) => [r.key, r.value])));
  }, [rows]);

  const textRows = rows.filter((r) => r.type !== 'image');
  const imageRows = rows.filter((r) => r.type === 'image');

  const dirty = textRows.some((r) => (drafts[r.key] ?? r.value) !== r.value);

  const save = async () => {
  const changed = textRows.filter(
    (r) => (drafts[r.key] ?? r.value) !== r.value,
  );

  if (!changed.length) return;

  setBusy(true);

  try {
    for (const r of changed) {
      const next = (drafts[r.key] ?? '').slice(0, 20000);

      const response = await fetch(
        `${API_BASE}/api/admin/content/site-content/${encodeURIComponent(r.key)}`,
        {
          method: 'PATCH',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            value: next,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        toast.error(
          data.error ?? 'Could not save that change.',
        );
        return;
      }

      onChange(r.key, data.data?.value ?? next);
    }

    toast.success('Published — live on the site');

    try {
      window.supercool?.track?.('site_content_saved', {
        section,
        keys: changed.length,
      });
    } catch {
      /* analytics must never break the page */
    }
  } catch (e) {
    toast.error(
      `Could not save that change: ${
        e instanceof Error ? e.message : String(e)
      }`,
    );
  } finally {
    setBusy(false);
  }
};

  return (
    <Panel>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-[19px] font-semibold tracking-tight text-chalk">
          {section}
        </h2>
        {canEdit && textRows.length > 0 && (
          <button
            type="button"
            onClick={save}
            disabled={busy || !dirty}
            className="btn-amber !py-2.5 text-[13.5px] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {busy ? 'Publishing…' : 'Save section'}
          </button>
        )}
      </div>

      {!canEdit && textRows.length > 0 && (
        <div className="mt-4">
          <ReadOnlyNote what="the public site's wording" />
        </div>
      )}

      {textRows.length > 0 && (
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          {textRows.map((r) => {
            const id = `sc-${r.key}`;
            const long = r.type === 'richtext' || (drafts[r.key] ?? r.value).length > 90;
            return (
              <div key={r.key} className={long ? 'lg:col-span-2' : undefined}>
                <label className="field-label" htmlFor={id}>
                  {r.label}
                </label>
                {long ? (
                  <textarea
                    id={id}
                    className="field-input mt-2 min-h-[92px] resize-y"
                    value={drafts[r.key] ?? ''}
                    disabled={!canEdit}
                    onChange={(e) => setDrafts((d) => ({ ...d, [r.key]: e.target.value }))}
                  />
                ) : (
                  <input
                    id={id}
                    className="field-input mt-2"
                    value={drafts[r.key] ?? ''}
                    disabled={!canEdit}
                    onChange={(e) => setDrafts((d) => ({ ...d, [r.key]: e.target.value }))}
                  />
                )}
                <p className="mono mt-1.5 text-[9px] text-graphite">{r.key}</p>
              </div>
            );
          })}
        </div>
      )}

      {imageRows.length > 0 && (
        <div className="mt-6 space-y-4">
          {imageRows.map((r) => (
            <ImageRow key={r.key} row={r} canEdit={canEdit} onChange={onChange} />
          ))}
        </div>
      )}
    </Panel>
  );
};

/* ------------------------------------------------------------------ Page */
export const SiteContentAdmin: React.FC = () => {
  const { profile } = useAuth();
  const canEdit = isStaff(profile);
  const [rows, setRows] = useState<SiteContentRow[] | null>(null);

  useEffect(() => {
  let cancelled = false;

  (async () => {
    try {
      const response = await fetch(
        `${API_BASE}/api/admin/content/site-content`,
        {
          headers: getAuthHeaders(),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ?? 'Could not load the site content.',
        );
      }

      if (!cancelled) {
        setRows((result.data ?? []) as SiteContentRow[]);
      }
    } catch (e) {
      if (!cancelled) {
        toast.error(
          e instanceof Error
            ? e.message
            : 'Could not load the site content.',
        );

        setRows([]);
      }
    }
  })();

  return () => {
    cancelled = true;
  };
}, []);

  const applyChange = (key: string, value: string) =>
    setRows((prev) => (prev ?? []).map((r) => (r.key === key ? { ...r, value } : r)));

  const grouped = useMemo(() => {
    const map = new Map<string, SiteContentRow[]>();
    for (const r of rows ?? []) {
      const list = map.get(r.section) ?? [];
      list.push(r);
      map.set(r.section, list);
    }
    return [...map.entries()].sort((a, b) => {
      const ai = SECTION_ORDER.indexOf(a[0]);
      const bi = SECTION_ORDER.indexOf(b[0]);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  }, [rows]);

  return (
    <div>
      <PageTitle
        title="Site content"
        sub="The wording and images on the public landing page. Saving publishes immediately — no rebuild, no developer. Reviews, road notes and FAQs stay in their own sections."
      />

      {rows === null ? (
        <Spinner label="Loading the site content…" />
      ) : rows.length === 0 ? (
        <EmptyState
          title="Nothing to edit yet"
          sub="The content rows have not been seeded for this site."
        />
      ) : (
        <div className="space-y-4">
          {grouped.map(([section, list]) => (
            <SectionPanel
              key={section}
              section={section}
              rows={list}
              canEdit={canEdit}
              onChange={applyChange}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default SiteContentAdmin;
