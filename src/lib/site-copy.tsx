import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { db } from '@/lib/db';
import { PHONE, PHONE_HREF } from '@/data/site-content';

/* ---------------------------------------------------------------------------
   Editable public-site copy.

   Every string the owner can change from Dashboard → Site Content lives in the
   `site_content` table (anonymous visitors may read it; only admin and
   dispatcher may write it). This provider fetches the whole table once on load
   and hands back a lookup that ALWAYS falls back to the hard-coded string in
   src/data/site-content.ts, so a missing key, an empty value or an offline
   database renders exactly the same page as before.
--------------------------------------------------------------------------- */

export type SiteContentType = 'text' | 'richtext' | 'image';

export type SiteContentRow = {
  key: string;
  type: SiteContentType;
  value: string;
  label: string;
  section: string;
  sort_order: number;
};

type CopyMap = Record<string, string>;

const SiteCopyContext = createContext<{ map: CopyMap; loading: boolean }>({
  map: {},
  loading: false,
});

export const SiteContentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [map, setMap] = useState<CopyMap>({});
  const [loading, setLoading] = useState(true);

useEffect(() => {
  let cancelled = false;

  (async () => {
    try {
      const response = await fetch(
        'http://localhost:3001/api/content/site-content'
      );

      if (!response.ok) {
        setLoading(false);
        return;
      }

      const result = await response.json();
      console.log('SITE CONTENT API RESULT:', result);

      if (cancelled) return;

      if (result.data) {
        const next: CopyMap = {};

        for (const row of result.data as {
          key: string;
          value: string | null;
        }[]) {
          if (row.value && row.value.trim()) {
            next[row.key] = row.value;
          }
        }
console.log('SITE CONTENT MAP:', next);
        setMap(next);
      }
    } catch {
      // Keep the existing hard-coded fallback content.
    } finally {
      if (!cancelled) {
        setLoading(false);
      }
    }
  })();

  return () => {
    cancelled = true;
  };
}, []);

  const value = useMemo(() => ({ map, loading }), [map, loading]);
  return <SiteCopyContext.Provider value={value}>{children}</SiteCopyContext.Provider>;
};

/** Builds a `tel:` link from whatever the owner typed into the phone field. */
export function telHref(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.length === 10) return `tel:+1${digits}`;
  if (digits.length > 10) return `tel:+${digits}`;
  return PHONE_HREF;
}

export function useCopy() {
  const { map, loading } = useContext(SiteCopyContext);
  return useMemo(() => {
    const t = (key: string, fallback: string) => map[key] ?? fallback;
    const phone = map.contact_phone ?? PHONE;
    return {
      t,
      /** Image keys have no code-side default: empty string means "use the built-in art". */
      img: (key: string) => map[key] ?? '',
      phone,
      phoneHref: telHref(phone),
      loading,
    };
  }, [map, loading]);
}
