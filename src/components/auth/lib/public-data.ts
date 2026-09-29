import { useEffect, useState } from 'react';
import { db } from '@/components/auth/lib/db';
import { getSessionToken } from '@/components/auth/lib/session-store';
import { API_BASE } from '@/components/auth/lib/api';
import {
  FALLBACK_FAQS,
  FALLBACK_NOTES,
  FALLBACK_REVIEWS,
  type Faq,
  type Review,
  type RoadNote,
} from '@/data/site-content';

/* ---------------------------------------------------------------------------
   Public content loader.

   Reviews, road notes and FAQs render from the database so the owner can edit
   them in the dashboard. Row-level security means anonymous visitors can only
   ever read rows with is_published = true. If the fetch fails we fall back to
   the seeded copy so the page never renders empty.
--------------------------------------------------------------------------- */

export type PublicContent = {
  reviews: Review[];
  notes: RoadNote[];
  faqs: Faq[];
  loading: boolean;
};

export function usePublicContent(): PublicContent {
  const [reviews, setReviews] = useState<Review[]>(FALLBACK_REVIEWS);
  const [notes, setNotes] = useState<RoadNote[]>(FALLBACK_NOTES);
  const [faqs, setFaqs] = useState<Faq[]>(FALLBACK_FAQS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const response = await fetch(`${API_BASE}/api/public/content`);

if (!response.ok) {
  throw new Error('Failed to load public content');
}

const data = await response.json();

const r = { data: data.reviews };
const n = { data: data.notes };
const f = { data: data.faqs };

      if (cancelled) return;
      if (r.data && r.data.length) setReviews(r.data as Review[]);
      if (n.data && n.data.length) setNotes(n.data as RoadNote[]);
      if (f.data && f.data.length) setFaqs(f.data as Faq[]);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { reviews, notes, faqs, loading };
}

/** Base URL for this project's edge functions. */
export const FN_BASE = `${API_BASE}/api`;

/** Anon key is a public, rate-limited identifier — safe in the browser. */


/**
 * Calls one of the project's edge functions.
 *
 * `csrf` is a double-submit token: a random value is generated per page load,
 * sent both as a header and inside the JSON body, so a cross-site form post
 * (which cannot read our token) fails the comparison. When the caller is
 * signed in the user's access token is attached so the function can verify
 * the role server-side.
 */
export function csrfToken(): string {
  const KEY = 'btown_csrf';
  let token = sessionStorage.getItem(KEY);
  if (!token) {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    token = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    sessionStorage.setItem(KEY, token);
  }
  return token;
}

export async function callFn<T = Record<string, unknown>>(
  slug: string,
  payload: Record<string, unknown>,
): Promise<{ status: number; data: T }> {
  const token = csrfToken();
  /* The site's OWN session token. Every protected edge function authorises the
     caller from the X-Session-Token header for this window and from the
     httpOnly cookie for same-origin calls. The platform session, when one
     exists, is only the data layer's JWT for row-level security. */
  const sessionToken = getSessionToken();

const res = await fetch(`${FN_BASE}/${slug}`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': token,
    ...(sessionToken ? { 'X-Session-Token': sessionToken } : {}),
  },
  body: JSON.stringify({ ...payload, csrf_token: token }),
});
  let data: T;
  try {
    data = (await res.json()) as T;
  } catch {
    data = {} as T;
  }
  return { status: res.status, data };
}
