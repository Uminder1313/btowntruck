import React, {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { db } from '@/lib/db';
import { callFn } from '@/lib/public-data';
import { clearSessionToken, getSessionToken, setSessionToken } from '@/lib/session-store';
import type { Role } from '@/lib/validation';

/* ---------------------------------------------------------------------------
   Auth context — the site's OWN session.

   This site does not use the platform's password verifier or its session
   store. The single credential path is the `auth-api` edge function:

     register / first-time setup -> bcrypt $2a$10$ hash written to
                                    profiles.password_hash
     login                       -> the SAME routine verifies it and mints a
                                    session token (stored only as a SHA-256
                                    hash in auth_sessions)

   Everything below therefore talks to `auth-api`:

     * signIn  -> POST { action: "login" } and keep the token it returns.
     * on mount / on focus / on an interval -> POST { action: "current_user" },
       which resolves the caller from OUR session and returns their roles.
       There is no db.auth.getSession() and no db.auth.onAuthStateChange()
       anywhere in this file — the platform session is not the authority.

   Roles always come from the `user_roles` table: ONE ACCOUNT CAN HOLD SEVERAL
   ROLES AT ONCE (admin + customer, for example), so everything below reasons
   about the role SET. `profiles.role` is a human-readable summary only and is
   never used for authorization.
--------------------------------------------------------------------------- */

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  /** Display summary only — authorization reads `roles`. */
  role: Role;
  /** The authoritative role set. */
  roles: Role[];
  is_active: boolean;
  created_at: string;
};

/** What `auth-api` tells us about the caller of our own session. */
export type AuthUser = {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  roles: Role[];
  is_active: boolean;
};

export type SignInDoor = 'customer' | 'admin';

type AuthState = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  /** Signs in through auth-api and resolves with the signed-in account. */
  signIn: (email: string, password: string, door?: SignInDoor) => Promise<AuthUser>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  session: null,
  profile: null,
  loading: true,
  signIn: async () => {
    throw new Error('Auth provider is not ready.');
  },
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

const REAL_ROLES: Role[] = ['admin', 'dispatcher', 'viewer', 'customer'];

/** Does this account hold this role? The single question for authorization. */
export const hasRole = (p: Profile | null, role: Role) => !!p && p.roles.includes(role);

/** Convenience helpers mirroring the server-side role checks. */
export const isAdmin = (p: Profile | null) => !!p && p.is_active && hasRole(p, 'admin');
export const isStaff = (p: Profile | null) =>
  !!p && p.is_active && (hasRole(p, 'admin') || hasRole(p, 'dispatcher'));
/** Roles that may open the dispatch board. */
export const isInternal = (p: Profile | null) =>
  !!p &&
  p.is_active &&
  (hasRole(p, 'admin') || hasRole(p, 'dispatcher') || hasRole(p, 'viewer'));
/** Registered through /admin/register but not yet approved by an administrator. */
export const isPendingStaff = (p: Profile | null) => !!p && p.role === 'pending_staff';

/**
 * Roles that may also use the CUSTOMER side: their own /account page and their
 * own service requests. Admin and dispatcher accounts have always had this
 * capability, so they keep it.
 */
export const canUseCustomerArea = (p: Profile | null) =>
  !!p &&
  p.is_active &&
  (hasRole(p, 'customer') || hasRole(p, 'admin') || hasRole(p, 'dispatcher'));

/**
 * Where a signed-in account belongs. A multi-role account (admin AND customer)
 * lands on the dispatch board and keeps its customer area at /account.
 */
export const homeFor = (p: Profile | null): string => {
  if (!p) return '/login';
  if (p.role === 'pending_staff') return '/admin/pending';
  if (isInternal(p)) return '/dashboard';
  return '/account';
};

const asProfile = (u: AuthUser): Profile => ({
  id: u.id,
  email: u.email,
  full_name: u.full_name,
  role: u.role,
  roles: (u.roles ?? []).filter((r) => REAL_ROLES.includes(r)),
  is_active: u.is_active,
  created_at: '',
});

/** A truthy, typed stand-in for the context's `session` field. The authority is
    our own token; this only exists so every screen's `session` check keeps
    working exactly as before. */
const sessionFor = (u: AuthUser): Session =>
  ({
    user: { id: u.id, email: u.email },
    access_token: '',
    refresh_token: '',
    token_type: 'bearer',
    expires_at: 0,
  }) as unknown as Session;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  /** The user id from OUR session — never from a platform session. */
  const currentUserId = useRef<string | null>(null);

  /**
   * Reads the authoritative role SET from `user_roles` for the id returned by
   * our own session, falling back to the roles auth-api just told us about.
   */
const loadProfile = useCallback(async (user: AuthUser | null) => {
  if (!user) {
    currentUserId.current = null;
    setProfile(null);
    return;
  }

  const fromSession = (user.roles ?? []).filter((r) =>
    REAL_ROLES.includes(r),
  );

  const summary = fromSession.includes(user.role)
    ? user.role
    : (fromSession[0] ?? user.role);

  const roles = fromSession.length
    ? fromSession
    : REAL_ROLES.includes(user.role)
      ? [user.role]
      : [];

  currentUserId.current = user.id;
  setSession(sessionFor(user));
  setProfile({
    ...asProfile(user),
    role: summary,
    roles,
  });
}, []);

  /** One round trip to OUR session: who is this, and what may they do? */
 const readSession = useCallback(
  async (): Promise<{ reachable: boolean; user: AuthUser | null }> => {
    const token = getSessionToken();

    if (!token) {
      return { reachable: true, user: null };
    }

    try {
      const response = await fetch('http://localhost:3001/api/auth/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();

        if (data.user) {
          return { reachable: true, user: data.user };
        }
      }

      if (response.status === 401 || response.status === 403) {
        clearSessionToken();
        return { reachable: true, user: null };
      }

      return { reachable: false, user: null };
    } catch {
      return { reachable: false, user: null };
    }
  },
  [],
);

  /* On mount: resolve the session server-side. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { user } = await readSession();
      if (cancelled) return;
      await loadProfile(user);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadProfile, readSession]);

  /* Revalidate on window focus and on a light interval — this replaces the
     platform's onAuthStateChange, which no longer has anything to report. */
  useEffect(() => {
    let stopped = false;

    const revalidate = async () => {
      const { reachable, user } = await readSession();
      if (stopped || !reachable) return;
      await loadProfile(user);
    };

    const onFocus = () => {
      void revalidate();
    };
    window.addEventListener('focus', onFocus);
    const timer = window.setInterval(() => void revalidate(), 5 * 60 * 1000);

    return () => {
      stopped = true;
      window.removeEventListener('focus', onFocus);
      window.clearInterval(timer);
    };
  }, [loadProfile, readSession]);

  /**
   * The ONE sign-in path. auth-api verifies the bcrypt hash, enforces the
   * per-IP limit and the account lockout, and mints the session; this function
   * only stores what the server handed back.
   */
  const signIn = useCallback(
  async (
    email: string,
    password: string,
    door: SignInDoor = 'customer',
  ): Promise<AuthUser> => {
    const response = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
        door,
      }),
    });

    let data: {
      error?: string;
      token?: string;
      user?: AuthUser;
      roles?: string[];
    };

    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (!response.ok || !data.token || !data.user) {
      throw new Error(
        data.error ?? 'Those details did not match. Check your email and password.',
      );
    }

    setSessionToken(data.token);

    await loadProfile(data.user);

    return data.user;
  },
  [loadProfile],
);

  const signOut = useCallback(async () => {
  clearSessionToken();
  currentUserId.current = null;
  setProfile(null);
  setSession(null);
}, []);

  const refreshProfile = useCallback(async () => {
    const { reachable, user } = await readSession();
    if (!reachable) return;
    await loadProfile(user);
  }, [loadProfile, readSession]);

  const value = useMemo(
    () => ({ session, profile, loading, signIn, signOut, refreshProfile }),
    [session, profile, loading, signIn, signOut, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
