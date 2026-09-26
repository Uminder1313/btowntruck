import React, { useEffect, useState } from 'react';
import { API_BASE } from '@/lib/api';
import { toast } from 'sonner';

import { Loader2, Plus, Star, Trash2 } from 'lucide-react';

import { useAuth, isStaff, isAdmin } from '@/lib/auth';

import {

  Panel,

  PageTitle,

  Spinner,

  EmptyState,

  Toggle,

  Field,

  ReadOnlyNote,

} from '@/components/dashboard/ui';

import { reviewSchema, roadNoteSchema, faqSchema, fieldErrors } from '@/lib/validation';



type ReviewRow = {

  id: number;

  author: string;

  rating: number;

  text: string;

  is_published: boolean;

  sort_order: number;

};

type NoteRow = {

  id: number;

  title: string;

  body: string;

  category: string | null;

  read_minutes: number | null;

  is_published: boolean;

  sort_order: number;

};

type FaqRow = {

  id: number;

  question: string;

  answer: string;

  sort_order: number;

  is_published: boolean;

};



/** Maps a database error to a human message, flagging policy denials. */

const explain = (message?: string) =>

  message && message.toLowerCase().includes('policy')

    ? 'Permission denied — your role cannot make that change.'

    : 'Could not save that change.';



/* ---------------------------------------------------------------- Reviews */

/* ---------------------------------------------------------------- Reviews */

export const ReviewsAdmin: React.FC = () => {
  const { profile } = useAuth();
  const canEdit = isStaff(profile);

  const [rows, setRows] = useState<ReviewRow[] | null>(null);
  const [draft, setDraft] = useState({
    author: '',
    rating: 5,
    text: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [editText, setEditText] = useState('');

  /* -------------------------------------------------------------
     Load reviews
  ------------------------------------------------------------- */

  const load = async () => {
    try {
      const sessionToken = localStorage.getItem('btown_session_token');

      const response = await fetch(
        `${API_BASE}/api/admin/content/reviews`,
        {
          method: 'GET',
          headers: {
            ...(sessionToken
              ? { Authorization: `Bearer ${sessionToken}` }
              : {}),
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error ?? 'Could not load reviews.');
        setRows([]);
        return;
      }

      setRows((data.rows ?? []) as ReviewRow[]);
    } catch (error) {
      console.error('Load reviews error:', error);
      toast.error('Could not connect to the server.');
      setRows([]);
    }
  };

  useEffect(() => {
    load();
  }, []);

  /* -------------------------------------------------------------
     Publish / unpublish review
  ------------------------------------------------------------- */

  const togglePublished = async (row: ReviewRow) => {
    try {
      const sessionToken = localStorage.getItem('btown_session_token');

      const response = await fetch(
        `${API_BASE}/api/admin/content/reviews/${row.id}/publish`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(sessionToken
              ? { Authorization: `Bearer ${sessionToken}` }
              : {}),
          },
          body: JSON.stringify({
            is_published: !row.is_published,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error ?? 'Could not update publication status.');
        return;
      }

      setRows((prev) =>
        (prev ?? []).map((r) =>
          r.id === row.id
            ? {
                ...r,
                is_published: data.row?.is_published ?? !r.is_published,
              }
            : r
        )
      );

      toast.success(
        row.is_published ? 'Review unpublished.' : 'Review published.'
      );
    } catch (error) {
      console.error('Toggle review publication error:', error);
      toast.error('Could not update the review.');
    }
  };

  /* -------------------------------------------------------------
     Edit review text
  ------------------------------------------------------------- */

  const saveText = async (row: ReviewRow) => {
    const parsed = reviewSchema.safeParse({
      ...row,
      text: editText,
    });

    if (!parsed.success) {
      toast.error(
        Object.values(fieldErrors(parsed.error))[0] ??
          'Check the review.'
      );
      return;
    }

    try {
      const sessionToken = localStorage.getItem('btown_session_token');

      const response = await fetch(
        `${API_BASE}/api/admin/content/reviews/${row.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(sessionToken
              ? { Authorization: `Bearer ${sessionToken}` }
              : {}),
          },
          body: JSON.stringify({
            text: parsed.data.text,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error ?? 'Could not update the review.');
        return;
      }

      setRows((prev) =>
        (prev ?? []).map((r) =>
          r.id === row.id
            ? {
                ...r,
                text: data.row?.text ?? parsed.data.text,
              }
            : r
        )
      );

      setEditing(null);
      setEditText('');

      toast.success('Review saved.');
    } catch (error) {
      console.error('Save review error:', error);
      toast.error('Could not save the review.');
    }
  };

  /* -------------------------------------------------------------
     Add review
  ------------------------------------------------------------- */

  const add = async (e: React.FormEvent) => {
    e.preventDefault();

    const parsed = reviewSchema.safeParse({
      ...draft,
      is_published: false,
    });

    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }

    setErrors({});
    setBusy(true);

    try {
      const sessionToken = localStorage.getItem('btown_session_token');

      const response = await fetch(
        `${API_BASE}/api/admin/content/reviews`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(sessionToken
              ? { Authorization: `Bearer ${sessionToken}` }
              : {}),
          },
          body: JSON.stringify({
            author: parsed.data.author,
            rating: parsed.data.rating,
            text: parsed.data.text,
            sort_order: (rows?.length ?? 0) + 1,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error ?? 'Could not add the review.');
        return;
      }

      setDraft({
        author: '',
        rating: 5,
        text: '',
      });

      toast.success('Review added as a draft.');

      await load();
    } catch (error) {
      console.error('Add review error:', error);
      toast.error('Could not add the review.');
    } finally {
      setBusy(false);
    }
  };

  /* -------------------------------------------------------------
     UI
  ------------------------------------------------------------- */

  return (
    <div>
      <PageTitle
        title="Reviews"
        sub="Only published reviews appear on the public site. Edit the wording or hold a review back without deleting it."
      />

      {!canEdit && (
        <div className="mb-5">
          <ReadOnlyNote what="reviews" />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)]">
        {/* -------------------------------------------------------
            Reviews list
        ------------------------------------------------------- */}

        <Panel className="!p-0 overflow-hidden">
          {rows === null ? (
            <div className="px-6">
              <Spinner />
            </div>
          ) : rows.length === 0 ? (
            <div className="p-6">
              <EmptyState title="No reviews yet" />
            </div>
          ) : (
            <ul className="divide-y divide-white/[0.07]">
              {rows.map((r) => (
                <li
                  key={r.id}
                  className="px-5 py-5 sm:px-6"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    {/* Review content */}
                    <div className="min-w-0 flex-1">
                      {/* Stars */}
                      <div className="flex items-center gap-1">
                        {Array.from({
                          length: Math.max(
                            0,
                            Math.min(5, r.rating)
                          ),
                        }).map((_, i) => (
                          <Star
                            key={i}
                            size={13}
                            className="fill-amber text-amber"
                          />
                        ))}
                      </div>

                      {/* Review text */}
                      {editing === r.id ? (
                        <div className="mt-3 max-w-2xl space-y-3">
                          <textarea
                            className="field-input min-h-[110px] w-full resize-y"
                            value={editText}
                            onChange={(e) =>
                              setEditText(e.target.value)
                            }
                            autoFocus
                          />

                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="btn-amber !py-2 text-[13px]"
                              onClick={() => saveText(r)}
                            >
                              Save
                            </button>

                            <button
                              type="button"
                              className="btn-ghost !py-2 text-[13px]"
                              onClick={() => {
                                setEditing(null);
                                setEditText('');
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-chalk/90">
                          {r.text}
                        </p>
                      )}

                      {/* Author */}
                      <p className="mono mt-3 text-[9.5px] uppercase tracking-wide text-graphite">
                        {r.author}
                      </p>

                      {/* Status */}
                      <p
                        className={`mono mt-2 text-[9px] uppercase tracking-wide ${
                          r.is_published
                            ? 'text-emerald-400'
                            : 'text-graphite'
                        }`}
                      >
                        {r.is_published ? 'Published' : 'Draft'}
                      </p>
                    </div>

                    {/* Actions */}
                    {canEdit && (
                      <div className="flex flex-none items-center gap-3 sm:pt-1">
                        {editing !== r.id && (
                          <button
                            type="button"
                            className="mono text-[9.5px] text-amber transition-opacity hover:opacity-75"
                            onClick={() => {
                              setEditing(r.id);
                              setEditText(r.text);
                            }}
                          >
                            Edit
                          </button>
                        )}

                        <Toggle
                          checked={r.is_published}
                          onChange={() => togglePublished(r)}
                          label={`Publish review by ${r.author}`}
                        />
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* -------------------------------------------------------
            Add review
        ------------------------------------------------------- */}

        {canEdit && (
          <Panel>
            <h2 className="font-display text-[17px] font-semibold text-chalk">
              Add a review
            </h2>

            <p className="mt-1 text-[13px] leading-relaxed text-graphite">
              New reviews are created as drafts. You can publish them
              from the review list when ready.
            </p>

            <form
              className="mt-5 space-y-4"
              onSubmit={add}
              noValidate
            >
              <Field
                label="Author"
                htmlFor="rv-author"
                error={errors.author}
              >
                <input
                  id="rv-author"
                  className="field-input"
                  value={draft.author}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      author: e.target.value,
                    }))
                  }
                  placeholder="Owner-operator · Edmundston"
                />
              </Field>

              <Field
                label="Rating"
                htmlFor="rv-rating"
                error={errors.rating}
              >
                <select
                  id="rv-rating"
                  className="field-input"
                  value={draft.rating}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      rating: Number(e.target.value),
                    }))
                  }
                >
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>
                      {n} star{n > 1 ? 's' : ''}
                    </option>
                  ))}
                </select>
              </Field>

              <Field
                label="Review"
                htmlFor="rv-text"
                error={errors.text}
              >
                <textarea
                  id="rv-text"
                  className="field-input min-h-[120px] resize-y"
                  value={draft.text}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      text: e.target.value,
                    }))
                  }
                  placeholder="Enter the customer's review..."
                />
              </Field>

              <button
                type="submit"
                className="btn-amber flex w-full items-center justify-center gap-2"
                disabled={busy}
              >
                {busy ? (
                  <Loader2
                    size={15}
                    className="animate-spin"
                  />
                ) : (
                  <Plus size={15} />
                )}

                {busy ? 'Adding...' : 'Add as draft'}
              </button>
            </form>
          </Panel>
        )}
      </div>
    </div>
  );
};


/* -------------------------------------------------------------- Road notes */

/* -------------------------------------------------------------- Road notes */

export const NotesAdmin: React.FC = () => {
  const { profile } = useAuth();
  const canEdit = isStaff(profile);

  const [rows, setRows] = useState<NoteRow[] | null>(null);

  const [draft, setDraft] = useState({
    title: '',
    category: '',
    read_minutes: 5,
    body: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);

  const [edit, setEdit] = useState({
    title: '',
    category: '',
    read_minutes: 5,
    body: '',
  });

  /* -------------------------------------------------------------
     Load road notes
  ------------------------------------------------------------- */

  const load = async () => {
    try {
      const sessionToken = localStorage.getItem('btown_session_token');

      const response = await fetch(
        `${API_BASE}/api/admin/content/road-notes`,
        {
          method: 'GET',
          headers: {
            ...(sessionToken
              ? { Authorization: `Bearer ${sessionToken}` }
              : {}),
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error ?? 'Could not load road notes.');
        setRows([]);
        return;
      }

      setRows((data.rows ?? []) as NoteRow[]);
    } catch (error) {
      console.error('Load road notes error:', error);
      toast.error('Could not connect to the server.');
      setRows([]);
    }
  };

  useEffect(() => {
    load();
  }, []);

  /* -------------------------------------------------------------
     Publish / unpublish
  ------------------------------------------------------------- */

  const togglePublished = async (row: NoteRow) => {
    const next = !row.is_published;

    try {
      const sessionToken = localStorage.getItem('btown_session_token');

      const response = await fetch(
        `${API_BASE}/api/admin/content/road-notes/${row.id}/publish`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(sessionToken
              ? { Authorization: `Bearer ${sessionToken}` }
              : {}),
          },
          body: JSON.stringify({
            is_published: next,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        toast.error(
          data.error ?? 'Could not update publication status.'
        );
        return;
      }

      setRows((prev) =>
        (prev ?? []).map((r) =>
          r.id === row.id
            ? {
                ...r,
                is_published:
                  data.row?.is_published ?? next,
              }
            : r
        )
      );

      toast.success(next ? 'Published.' : 'Unpublished.');
    } catch (error) {
      console.error(
        'Toggle road note publication error:',
        error
      );

      toast.error('Could not update the road note.');
    }
  };

  /* -------------------------------------------------------------
     Edit road note
  ------------------------------------------------------------- */

  const saveEdit = async (row: NoteRow) => {
    const parsed = roadNoteSchema.safeParse({
      ...edit,
      is_published: row.is_published,
    });

    if (!parsed.success) {
      toast.error(
        Object.values(fieldErrors(parsed.error))[0] ??
          'Check the note.'
      );
      return;
    }

    try {
      const sessionToken = localStorage.getItem('btown_session_token');

      const response = await fetch(
        `${API_BASE}/api/admin/content/road-notes/${row.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(sessionToken
              ? { Authorization: `Bearer ${sessionToken}` }
              : {}),
          },
          body: JSON.stringify({
            title: parsed.data.title,
            category: parsed.data.category || null,
            read_minutes:
              parsed.data.read_minutes ?? null,
            body: parsed.data.body ?? '',
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        toast.error(
          data.error ?? 'Could not update the road note.'
        );
        return;
      }

      setRows((prev) =>
        (prev ?? []).map((r) =>
          r.id === row.id
            ? {
                ...r,
                ...(data.row ?? {
                  title: parsed.data.title,
                  category:
                    parsed.data.category || null,
                  read_minutes:
                    parsed.data.read_minutes ?? null,
                  body: parsed.data.body ?? '',
                }),
              }
            : r
        )
      );

      setOpenId(null);

      toast.success('Saved.');
    } catch (error) {
      console.error('Save road note error:', error);
      toast.error('Could not save the road note.');
    }
  };

  /* -------------------------------------------------------------
     Add road note
  ------------------------------------------------------------- */

  const add = async (e: React.FormEvent) => {
    e.preventDefault();

    const parsed = roadNoteSchema.safeParse({
      ...draft,
      is_published: false,
    });

    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }

    setErrors({});
    setBusy(true);

    try {
      const sessionToken = localStorage.getItem(
        'btown_session_token'
      );

      const response = await fetch(
        `${API_BASE}/api/admin/content/road-notes`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(sessionToken
              ? { Authorization: `Bearer ${sessionToken}` }
              : {}),
          },
          body: JSON.stringify({
            title: parsed.data.title,
            category: parsed.data.category || null,
            read_minutes:
              parsed.data.read_minutes ?? null,
            body: parsed.data.body ?? '',
            sort_order: (rows?.length ?? 0) + 1,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        toast.error(
          data.error ?? 'Could not create the road note.'
        );
        return;
      }

      setDraft({
        title: '',
        category: '',
        read_minutes: 5,
        body: '',
      });

      toast.success('Road note created as a draft.');

      await load();
    } catch (error) {
      console.error('Add road note error:', error);
      toast.error('Could not create the road note.');
    } finally {
      setBusy(false);
    }
  };

  /* -------------------------------------------------------------
     UI
  ------------------------------------------------------------- */

  return (
    <div>
      <PageTitle
        title="Road notes"
        sub="Short advice pieces shown on the public site. Drafts stay hidden until you publish them."
      />

      {!canEdit && (
        <div className="mb-5">
          <ReadOnlyNote what="road notes" />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)]">
        <Panel className="!p-0">
          {rows === null ? (
            <div className="px-6">
              <Spinner />
            </div>
          ) : rows.length === 0 ? (
            <div className="p-6">
              <EmptyState title="No road notes yet" />
            </div>
          ) : (
            <ul className="divide-y divide-white/[0.07]">
              {rows.map((r) => (
                <li
                  key={r.id}
                  className="px-5 py-5 sm:px-6"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <span className="mono rounded-full border border-amber/30 bg-amber/10 px-2.5 py-1 text-[9.5px] text-amber">
                        {r.category ?? 'Road notes'}
                      </span>

                      <p className="mt-3 font-display text-[16px] font-semibold leading-snug text-chalk">
                        {r.title}
                      </p>

                      <p className="mono mt-2 text-[9.5px] text-graphite">
                        {r.read_minutes ?? 5} min read ·{' '}
                        {r.is_published ? 'live' : 'draft'}
                      </p>
                    </div>

                    {canEdit && (
                      <div className="flex flex-none items-center gap-3">
                        <button
                          type="button"
                          className="mono text-[9.5px] text-amber transition-opacity hover:opacity-75"
                          onClick={() => {
                            setOpenId(
                              openId === r.id ? null : r.id
                            );

                            setEdit({
                              title: r.title,
                              category: r.category ?? '',
                              read_minutes:
                                r.read_minutes ?? 5,
                              body: r.body ?? '',
                            });
                          }}
                        >
                          {openId === r.id ? 'Close' : 'Edit'}
                        </button>

                        <Toggle
                          checked={r.is_published}
                          onChange={() =>
                            togglePublished(r)
                          }
                          label={`Publish ${r.title}`}
                        />
                      </div>
                    )}
                  </div>

                  {canEdit && openId === r.id && (
                    <div className="mt-5 space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                      <Field
                        label="Title"
                        htmlFor={`nt-title-${r.id}`}
                      >
                        <input
                          id={`nt-title-${r.id}`}
                          className="field-input"
                          value={edit.title}
                          onChange={(e) =>
                            setEdit((d) => ({
                              ...d,
                              title: e.target.value,
                            }))
                          }
                        />
                      </Field>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field
                          label="Category"
                          htmlFor={`nt-cat-${r.id}`}
                        >
                          <input
                            id={`nt-cat-${r.id}`}
                            className="field-input"
                            value={edit.category}
                            onChange={(e) =>
                              setEdit((d) => ({
                                ...d,
                                category: e.target.value,
                              }))
                            }
                          />
                        </Field>

                        <Field
                          label="Read minutes"
                          htmlFor={`nt-min-${r.id}`}
                        >
                          <input
                            id={`nt-min-${r.id}`}
                            type="number"
                            min={0}
                            className="field-input"
                            value={edit.read_minutes}
                            onChange={(e) =>
                              setEdit((d) => ({
                                ...d,
                                read_minutes: Number(
                                  e.target.value
                                ),
                              }))
                            }
                          />
                        </Field>
                      </div>

                      <Field
                        label="Body"
                        htmlFor={`nt-body-${r.id}`}
                      >
                        <textarea
                          id={`nt-body-${r.id}`}
                          className="field-input min-h-[120px] resize-y"
                          value={edit.body}
                          onChange={(e) =>
                            setEdit((d) => ({
                              ...d,
                              body: e.target.value,
                            }))
                          }
                        />
                      </Field>

                      <button
                        type="button"
                        className="btn-amber !py-2.5 text-[13.5px]"
                        onClick={() => saveEdit(r)}
                      >
                        Save changes
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {canEdit && (
          <Panel>
            <h2 className="font-display text-[17px] font-semibold text-chalk">
              New road note
            </h2>

            <form
              className="mt-5 space-y-4"
              onSubmit={add}
              noValidate
            >
              <Field
                label="Title"
                htmlFor="nn-title"
                error={errors.title}
              >
                <input
                  id="nn-title"
                  className="field-input"
                  value={draft.title}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      title: e.target.value,
                    }))
                  }
                />
              </Field>

              <Field
                label="Category"
                htmlFor="nn-cat"
                error={errors.category}
              >
                <input
                  id="nn-cat"
                  className="field-input"
                  value={draft.category}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      category: e.target.value,
                    }))
                  }
                  placeholder="Winter"
                />
              </Field>

              <Field
                label="Read minutes"
                htmlFor="nn-min"
                error={errors.read_minutes}
              >
                <input
                  id="nn-min"
                  type="number"
                  min={0}
                  className="field-input"
                  value={draft.read_minutes}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      read_minutes: Number(
                        e.target.value
                      ),
                    }))
                  }
                />
              </Field>

              <Field
                label="Body"
                htmlFor="nn-body"
                error={errors.body}
              >
                <textarea
                  id="nn-body"
                  className="field-input min-h-[110px] resize-y"
                  value={draft.body}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      body: e.target.value,
                    }))
                  }
                />
              </Field>

              <button
                type="submit"
                className="btn-amber w-full"
                disabled={busy}
              >
                {busy ? (
                  <Loader2
                    size={15}
                    className="animate-spin"
                  />
                ) : (
                  <Plus size={15} />
                )}

                Create draft
              </button>
            </form>
          </Panel>
        )}
      </div>
    </div>
  );
};



/* ------------------------------------------------------------------- FAQs */

export const FaqsAdmin: React.FC = () => {
  const { profile } = useAuth();

  const canEdit = isStaff(profile);
  const canDelete = isAdmin(profile);

  const [rows, setRows] = useState<FaqRow[] | null>(null);

  const [draft, setDraft] = useState({
    question: '',
    answer: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);

  const [edit, setEdit] = useState({
    question: '',
    answer: '',
  });

  const getHeaders = () => {
    const sessionToken = localStorage.getItem(
      'btown_session_token'
    );

    return {
      ...(sessionToken
        ? { Authorization: `Bearer ${sessionToken}` }
        : {}),
    };
  };

  const load = async () => {
    try {
      const response = await fetch(
        `${API_BASE}/api/admin/content/faqs`,
        {
          method: 'GET',
          headers: getHeaders(),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error ?? 'Could not load FAQs.');
        setRows([]);
        return;
      }

      setRows((data.rows ?? []) as FaqRow[]);
    } catch (error) {
      console.error('Load FAQs error:', error);
      toast.error('Could not connect to the server.');
      setRows([]);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const togglePublished = async (row: FaqRow) => {
    const next = !row.is_published;

    try {
      const response = await fetch(
        `${API_BASE}/api/admin/content/faqs/${row.id}/publish`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...getHeaders(),
          },
          body: JSON.stringify({
            is_published: next,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        toast.error(
          data.error ?? 'Could not update publication status.'
        );
        return;
      }

      setRows((prev) =>
        (prev ?? []).map((r) =>
          r.id === row.id
            ? {
                ...r,
                is_published:
                  data.row?.is_published ?? next,
              }
            : r
        )
      );

      toast.success(next ? 'Published.' : 'Unpublished.');
    } catch (error) {
      console.error('Toggle FAQ publication error:', error);
      toast.error('Could not update the FAQ.');
    }
  };

  const move = async (
    row: FaqRow,
    dir: -1 | 1
  ) => {
    const list = rows ?? [];

    const idx = list.findIndex(
      (r) => r.id === row.id
    );

    const swapWith = list[idx + dir];

    if (!swapWith) return;

    try {
      const response = await fetch(
        `${API_BASE}/api/admin/content/faqs/${row.id}/reorder`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...getHeaders(),
          },
          body: JSON.stringify({
            swap_id: swapWith.id,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        toast.error(
          data.error ?? 'Could not reorder FAQs.'
        );
        return;
      }

      toast.success('Reordered.');
      await load();
    } catch (error) {
      console.error('Reorder FAQ error:', error);
      toast.error('Could not reorder FAQs.');
    }
  };

  const saveEdit = async (row: FaqRow) => {
    const parsed = faqSchema.safeParse({
      ...edit,
      sort_order: row.sort_order,
      is_published: row.is_published,
    });

    if (!parsed.success) {
      toast.error(
        Object.values(fieldErrors(parsed.error))[0] ??
          'Check the FAQ.'
      );
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE}/api/admin/content/faqs/${row.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...getHeaders(),
          },
          body: JSON.stringify({
            question: parsed.data.question,
            answer: parsed.data.answer,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        toast.error(
          data.error ?? 'Could not update the FAQ.'
        );
        return;
      }

      setRows((prev) =>
        (prev ?? []).map((r) =>
          r.id === row.id
            ? {
                ...r,
                ...(data.row ?? {
                  question: parsed.data.question,
                  answer: parsed.data.answer,
                }),
              }
            : r
        )
      );

      setOpenId(null);

      toast.success('Saved.');
    } catch (error) {
      console.error('Save FAQ error:', error);
      toast.error('Could not save the FAQ.');
    }
  };

  const remove = async (row: FaqRow) => {
    try {
      const response = await fetch(
        `${API_BASE}/api/admin/content/faqs/${row.id}`,
        {
          method: 'DELETE',
          headers: getHeaders(),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        toast.error(
          data.error ?? 'Could not delete the FAQ.'
        );
        return;
      }

      toast.success('Deleted.');
      await load();
    } catch (error) {
      console.error('Delete FAQ error:', error);
      toast.error('Could not delete the FAQ.');
    }
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();

    const parsed = faqSchema.safeParse({
      ...draft,
      sort_order: (rows?.length ?? 0) + 1,
      is_published: false,
    });

    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }

    setErrors({});
    setBusy(true);

    try {
      const response = await fetch(
        `${API_BASE}/api/admin/content/faqs`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getHeaders(),
          },
          body: JSON.stringify({
            question: parsed.data.question,
            answer: parsed.data.answer,
            sort_order: parsed.data.sort_order,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        toast.error(
          data.error ?? 'Could not create the FAQ.'
        );
        return;
      }

      setDraft({
        question: '',
        answer: '',
      });

      toast.success('FAQ created as a draft.');

      await load();
    } catch (error) {
      console.error('Add FAQ error:', error);
      toast.error('Could not create the FAQ.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageTitle
        title="FAQs"
        sub="The questions on the public site, in the order shown here. Unpublished entries stay hidden."
      />

      {!canEdit && (
        <div className="mb-5">
          <ReadOnlyNote what="FAQs" />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,0.8fr)]">
        <Panel className="!p-0">
          {rows === null ? (
            <div className="px-6">
              <Spinner />
            </div>
          ) : rows.length === 0 ? (
            <div className="p-6">
              <EmptyState title="No FAQs yet" />
            </div>
          ) : (
            <ul className="divide-y divide-white/[0.07]">
              {rows.map((r, i) => (
                <li
                  key={r.id}
                  className="px-5 py-5 sm:px-6"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="mono text-[9.5px] text-amber">
                        {String(i + 1).padStart(2, '0')} ·{' '}
                        {r.is_published ? 'live' : 'draft'}
                      </p>

                      <p className="mt-2 font-display text-[16px] font-semibold leading-snug text-chalk">
                        {r.question}
                      </p>

                      <p className="mt-2 line-clamp-2 text-[14px] leading-relaxed text-graphite">
                        {r.answer}
                      </p>
                    </div>

                    {canEdit && (
                      <div className="flex flex-none flex-col items-end gap-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => move(r, -1)}
                            disabled={i === 0}
                            className="mono rounded-full border border-white/12 px-2 py-1 text-[9.5px] text-graphite transition-colors hover:border-amber/40 hover:text-amber disabled:opacity-35"
                            aria-label="Move up"
                          >
                            Up
                          </button>

                          <button
                            type="button"
                            onClick={() => move(r, 1)}
                            disabled={
                              i === rows.length - 1
                            }
                            className="mono rounded-full border border-white/12 px-2 py-1 text-[9.5px] text-graphite transition-colors hover:border-amber/40 hover:text-amber disabled:opacity-35"
                            aria-label="Move down"
                          >
                            Down
                          </button>
                        </div>

                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            className="mono text-[9.5px] text-amber transition-opacity hover:opacity-75"
                            onClick={() => {
                              setOpenId(
                                openId === r.id
                                  ? null
                                  : r.id
                              );

                              setEdit({
                                question: r.question,
                                answer: r.answer,
                              });
                            }}
                          >
                            {openId === r.id
                              ? 'Close'
                              : 'Edit'}
                          </button>

                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => remove(r)}
                              className="text-graphite transition-colors hover:text-red-400"
                              aria-label={`Delete ${r.question}`}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}

                          <Toggle
                            checked={r.is_published}
                            onChange={() =>
                              togglePublished(r)
                            }
                            label={`Publish ${r.question}`}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {canEdit && openId === r.id && (
                    <div className="mt-5 space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                      <Field
                        label="Question"
                        htmlFor={`fq-q-${r.id}`}
                      >
                        <input
                          id={`fq-q-${r.id}`}
                          className="field-input"
                          value={edit.question}
                          onChange={(e) =>
                            setEdit((d) => ({
                              ...d,
                              question: e.target.value,
                            }))
                          }
                        />
                      </Field>

                      <Field
                        label="Answer"
                        htmlFor={`fq-a-${r.id}`}
                      >
                        <textarea
                          id={`fq-a-${r.id}`}
                          className="field-input min-h-[130px] resize-y"
                          value={edit.answer}
                          onChange={(e) =>
                            setEdit((d) => ({
                              ...d,
                              answer: e.target.value,
                            }))
                          }
                        />
                      </Field>

                      <button
                        type="button"
                        className="btn-amber !py-2.5 text-[13.5px]"
                        onClick={() => saveEdit(r)}
                      >
                        Save changes
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {canEdit && (
          <Panel>
            <h2 className="font-display text-[17px] font-semibold text-chalk">
              New FAQ
            </h2>

            <form
              className="mt-5 space-y-4"
              onSubmit={add}
              noValidate
            >
              <Field
                label="Question"
                htmlFor="nf-q"
                error={errors.question}
              >
                <input
                  id="nf-q"
                  className="field-input"
                  value={draft.question}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      question: e.target.value,
                    }))
                  }
                />
              </Field>

              <Field
                label="Answer"
                htmlFor="nf-a"
                error={errors.answer}
              >
                <textarea
                  id="nf-a"
                  className="field-input min-h-[130px] resize-y"
                  value={draft.answer}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      answer: e.target.value,
                    }))
                  }
                />
              </Field>

              <button
                type="submit"
                className="btn-amber w-full"
                disabled={busy}
              >
                {busy ? (
                  <Loader2
                    size={15}
                    className="animate-spin"
                  />
                ) : (
                  <Plus size={15} />
                )}

                Create draft
              </button>
            </form>
          </Panel>
        )}
      </div>
    </div>
  );
};