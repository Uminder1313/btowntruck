/**
 * The site's OWN session token store.
 *
 * `auth-api` mints this token, stores only its SHA-256 hash, and also sets it as
 * an HttpOnly + Secure + SameSite=Lax cookie. The cookie is the primary
 * mechanism, but a browser does not send a Lax cookie on a cross-site request
 * and the edge functions live on a different origin — so the SAME token is
 * mirrored here and sent as the `X-Session-Token` header on every protected
 * call.
 *
 * This value is not a credential: it is a revocable session identifier, it is
 * only ever sent to our own edge functions, and the server treats it as
 * untrusted input (it looks the token up by hash).
 */
const SESSION_TOKEN_KEY = 'btown_session_token';

export function getSessionToken(): string {
  try {
    return window.localStorage.getItem(SESSION_TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
}

export function setSessionToken(token: string): void {
  try {
    if (token) window.localStorage.setItem(SESSION_TOKEN_KEY, token);
    else window.localStorage.removeItem(SESSION_TOKEN_KEY);
  } catch {
    /* private mode / storage disabled — the cookie remains the fallback */
  }
}

export function clearSessionToken(): void {
  setSessionToken('');
}
