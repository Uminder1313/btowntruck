# BTown Mobile Truck Repair

Production website for **BTown Mobile Truck Repair** — 24/7 mobile heavy-duty
truck & trailer repair, Northern New Brunswick.

The public site is a faithful production build of the approved prototype
(same copy, fonts, colours, layout and inline SVG illustrations). On top of
it sits an authenticated, role-protected dispatch dashboard backed by a
Postgres database with row-level security.

---

## 1. Stack

| Layer      | Technology                                                        |
| ---------- | ----------------------------------------------------------------- |
| UI         | React 18 + TypeScript, Vite, Tailwind CSS, Radix primitives        |
| Routing    | react-router-dom                                                  |
| Toasts     | `sonner`, themed amber-on-dark                                    |
| Validation | `zod` — the same schemas run in the browser **and** on the server  |
| Data       | Managed Postgres with row-level security on every table            |
| Auth       | Server-side password auth (bcrypt), session persisted + refreshed  |
| Server     | Deno edge functions (`auth-api`, `public-api`)                     |

```
src/
  components/
    AppLayout.tsx          public one-page site (composition root)
    site/                  Header, Hero, Sections, Reviews/Notes/FAQ, Contact+Footer,
                           TruckIllustration (inline SVG), ServiceIcons, primitives
    auth/AuthShell.tsx     shared frame for /login, /register, /reset-password
    dashboard/             ui.tsx, Requests.tsx, Content.tsx, Admin.tsx
  data/site-content.ts     ALL public copy, in one place
  lib/
    db.ts                  database client
    auth.tsx               AuthProvider / useAuth / role helpers
    validation.ts          shared zod schemas + sanitisers
    public-data.ts         published-content loader, CSRF token, edge-fn caller
  pages/                   Index, Login, Register, ResetPassword, Dashboard,
                           Account, Forbidden (403), NotFound (404)

public/_headers            real HTTP security headers for the host
.env.example               every variable, with the secret ones marked
```

Server code is **not** in this tree — the two edge functions are deployed to
the project (`auth-api`, `public-api`). Their behaviour is documented in §5.

---

## 2. Local setup

```bash
npm install
cp .env.example .env     # fill in the two public values
npm run dev              # http://localhost:5173
npm run build            # production build into dist/
```

---

## 3. Accounts: register → sign in

**No password ships with this site.** Nothing is seeded, nothing is hard-coded,
and there is no default account. There is also no first-run setup page — the
old `/setup` screen has been removed.

### Registering

Anyone can create an account at **`/register`**: full name, email, and a
password of at least **12 characters** including upper case, lower case and a
number (confirmed twice, with a live strength hint). The form is protected by
an off-screen honeypot and a per-IP limit of 5 sign-ups per hour, and every
field is re-validated inside the edge function.

**Registration always creates a `customer` account.** The form has no role
field at all — the role is chosen by the server, so a tampered client cannot
grant itself access.

On success you get an amber toast (*"Account created — please sign in"*, or a
"check your email first" variant if email confirmation is switched on) and land
on `/login`.

### The staff area: `/admin`

Staff never sign in on the public pages. The whole staff area lives under
`/admin` and is **not linked from anywhere public** — not the landing page,
navbar, footer, `/login` or `/register`:

| Route             | Purpose                                                |
| ----------------- | ------------------------------------------------------ |
| `/admin`          | Bare entry: redirects to `/admin/login` when signed out, otherwise to `/dashboard` |
| `/admin/login`    | Administrator sign-in. No Customer/Administrator tabs   |
| `/admin/register` | Staff registration (multiple admins allowed)            |
| `/admin/pending`  | Holding screen for an unapproved staff account          |

### `ADMIN_EMAILS` and the approval flow

`ADMIN_EMAILS` is a comma-separated allow-list read **server-side only**,
inside the `auth-api` function — it is never exposed to the browser:

```
ADMIN_EMAILS="owner@example.com,office@example.com"
```

Registration through `/admin/register` decides the role on the server:

- Email **on** the allow-list → the account is created with role `admin`, and
  the amber toast reads *"Account created — please sign in"*.
- Email **not** on the list → the account is created with role
  **`pending_staff`**, and the toast reads *"Account created — an existing
  administrator must approve your access."*

`pending_staff` has no dashboard access. Row-level security denies it
everywhere a customer is denied, and it is denied `/account` too (they are
staff, not customers) — it can only reach `/admin/pending`, which explains the
wait and offers sign out. An existing administrator promotes the account and
picks its real role in *Dashboard → Users*, where `pending_staff` appears in
the role dropdown alongside the others.

Editing `ADMIN_EMAILS` never changes an account that already exists.

### Signing in

`/login` is **customer-only** — a plain sign-in card with no role tabs.
Customers land on `/account`. A staff account that signs in there is still
routed to `/dashboard` rather than blocked, but the admin area is never
advertised on the public pages.

`/admin/login` is staff-only. After authentication the real role is read from
the `profiles` table:

- `admin` / `dispatcher` / `viewer` → `/dashboard`
- `pending_staff` → `/admin/pending`
- `customer` → the session is **immediately signed out** with *"This account
  does not have administrator access."* Nothing else is revealed.

Sign-in intent never changes what you are allowed to do: the server-side role
is authoritative and row-level security re-checks it on every read and write.

Lockout (5 failures / 15 minutes), the per-IP rate limit and the generic
"those details did not match" error apply on both sign-in pages.


Forgot a password? Use *Forgot your password?* on `/login` — the reset link is
emailed (see §7).

---

## 4. Roles and authorization

| Role         | Can do                                                                                                    |
| ------------ | --------------------------------------------------------------------------------------------------------- |
| `admin`      | Everything: users and roles, all content, all requests, the audit log                                      |
| `dispatcher` | View/update service requests, assign, change status; manage road notes, reviews and FAQs incl. publishing  |
| `viewer`     | Read-only dashboard                                                                                       |
| `customer`   | `/account` only: their own profile and their own service requests. No dashboard, no other customer's data  |

Admins change roles with the dropdown in *Dashboard → Users*, which includes
`customer` — so a customer can be promoted to dispatcher or admin, and demoted
back again, without touching the database.

Authorization is enforced in **three** places, and the UI is the least
important of them:

1. **Row-level security** on every table. Policies call `is_admin()`,
   `is_staff()`, `is_active_user()` and `is_internal_user()` — `SECURITY
   DEFINER` functions that read the `profiles` table. A hand-crafted request
   from the browser is rejected by the database, not by React.
2. **Edge functions** re-derive the caller's identity from their JWT and
   re-check the role before any privileged action (`create_user` is admin-only,
   and `register` decides the role itself).
3. **The interface** hides what a role cannot use, and redirects each role to
   its own home screen (`/dashboard` for staff, `/account` for customers).

**What a `customer` can read.** The dispatch board, the audit log, unpublished
content and other people's requests are all closed to them:

- `service_requests` — only rows where `user_id = auth.uid()` **or** whose
  `email` equals their own profile email. The whole-board policy now requires
  `is_internal_user()` (admin / dispatcher / viewer).
- `profiles` — only their own row.
- `reviews` / `road_notes` / `faqs` — published rows only; drafts need an
  internal role.
- `audit_log`, `rate_limits`, `auth_throttle` — no customer policy at all.

Anonymous visitors can only: read `is_published` rows in `reviews`,
`road_notes` and `faqs`, and create a `service_request` through the throttled
`public-api` function. They have **no** insert policy on any table.


---

## 5. Database

Tables: `profiles`, `service_requests`, `reviews`, `road_notes`, `faqs`,
`audit_log`, plus two server-only throttle tables (`rate_limits`,
`auth_throttle` — RLS on, zero policies, so no client can touch them).

`reviews`, `road_notes` and `faqs` are seeded with the exact prototype content,
so the public site renders from the database and matches the design.

**Audit logging is done by database triggers**, not by application code — an
`AFTER INSERT/UPDATE/DELETE` trigger on every content table writes the actor,
action, entity, before/after snapshot and timestamp into `audit_log`. A
mutation therefore cannot be made without being logged. Admins read it in
*Dashboard → Audit log*.

Edge functions:

- **`public-api`** — `submit_request`: honeypot → per-IP rate limit
  (5/hour, hashed IP) → full server-side validation → insert → notification
  email. Returns field-level errors; never trusts the client's validation.
- **`auth-api`** — `register` (honeypot + 5/hour per IP; role decided server-side from `ADMIN_EMAILS`), `login`, `reset`, `create_user`.


---

## 6. Security measures

- **Validation on both sides.** One set of zod schemas (`src/lib/validation.ts`)
  for the browser; the edge functions re-validate and re-sanitise every field
  (control characters stripped, trimmed, hard length caps) before it reaches
  the database. React escapes all rendered text; `escapeHtml()` is used for
  hand-assembled HTML email bodies.
- **Login throttling.** 5 failed attempts on an account ⇒ locked for
  15 minutes. A coarser per-IP limit (30 / 15 min) blocks credential stuffing
  across many accounts. Password-reset is limited to 5 requests per IP per hour.
- **Generic auth errors.** Login and reset answer identically whether or not
  an email exists, so the site cannot be used to enumerate accounts.
- **Passwords** are hashed by the auth service (bcrypt); minimum 12 characters
  with mixed case and a digit. They are never stored, logged or echoed.
- **Deactivated accounts** cannot hold a session: login refuses them, and an
  open session is signed out on its next dashboard load.
- **CSRF.** Mutations go through the edge functions with a double-submit token
  (`X-CSRF-Token` header + the same value in the JSON body, held in
  `sessionStorage`). A cross-site form post cannot read the token, so it fails
  the comparison. Requests are `POST`-only with a JSON content type.
- **Bot defence.** An off-screen honeypot field on the public form; a filled
  honeypot is silently accepted and discarded.
- **Security headers** (`public/_headers`): `Content-Security-Policy`,
  `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`,
  and `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`.
  A CSP is also set via meta for hosts that serve static files without header
  support, and a small inline script forces `https://` (localhost exempt).
- **No secrets in client code.** The bundle contains only the database URL and
  the public anon key (which is rate limited and bound by RLS). The service-role
  key and the gateway key exist solely as server-side secrets read with
  `Deno.env.get()` inside edge functions.
- **Parameterised queries only.** All access goes through the query builder or
  `$n` placeholders; there is no string-concatenated SQL anywhere.
- **Clean 404 and 403 pages** in the site's own design language.

### Hosting notes

`public/_headers` is Netlify / Cloudflare Pages syntax. For other hosts, apply
the same set:

- **nginx** — `add_header` directives inside the `server` block, plus a
  `return 301 https://$host$request_uri;` redirect on port 80.
- **Vercel** — the `headers` array in `vercel.json`.

HSTS only takes effect over HTTPS, so make sure TLS is terminated at the edge.

---

## 7. Transactional email

A successful service request triggers a confirmation email from the
`public-api` function through the platform's email endpoint (one recipient,
with an idempotency key of `service-request-<id>` so a retry can never send
twice).

**One step remains for the owner:** verify a sending domain in the CRM tab of
the dashboard. Until then the endpoint answers
`{ success: false, code: 'no_sending_domain' }`. This is handled gracefully —
the request is still saved, the visitor still sees the success state and the
confirmation panel, and the refusal is only logged. Email starts flowing by
itself the moment the domain verifies (a single DNS step, automatic for domains
bought through the platform).

---

## 8. Environment variables

See `.env.example`. Public values are prefixed `VITE_` and are compiled into
the bundle. Everything else — `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`,
`SUPABASE_URL`, `GATEWAY_SECRET_KEY` — is a **server-side secret**, must never
carry a `VITE_` prefix, and must never be imported into a React component.

---

## 9. Site Content manager

*Dashboard → Site Content* edits the public landing page's text and images
without a rebuild. **Admin and dispatcher may save; viewer sees the same
values read-only.**

Every editable string lives in the `site_content` table (`key`, `type`,
`value`, `label`, `section`, `updated_at`, `updated_by`) and is seeded with the
copy that was already on the page, so the site looks identical until someone
changes something. Keys are grouped into **Hero, Services, How it works,
Fleets, Coverage, Contact, Footer** and **Images**.

- **Text keys** — inline inputs/textareas with a *Save* button per section.
- **Image keys** — current preview, *Upload/Replace* (jpg, png, webp or svg;
  5 MB maximum, validated both on type and size) and *Remove*, which reverts
  to the built-in default.

Saving fires the amber *"Published — live on the site"* toast and writes an
`audit_log` row. Changes are live on the public page immediately.

The public page fetches the table once on load through the anon role and
**always falls back to the hard-coded strings** in `src/data/site-content.ts`
when a key is missing, empty or the database is unreachable — so nothing can
break the landing page. The inline SVG truck stays the default hero art; it is
only replaced when the `hero_image` key has a value.

Uploads go to the public **`site-media`** storage bucket: world-readable so the
page can render them, writable only by `admin` and `dispatcher` through
row-level security. The Content-Security-Policy `img-src` allows that bucket's
origin.

Reviews, road notes and FAQs are unchanged — they are still managed in their
own dashboard sections.

---

## 10. Routes

| Route             | Access                                                        |
| ----------------- | ------------------------------------------------------------- |
| `/`               | Public site                                                   |
| `/login`          | Public, **customer-only** sign-in, with "forgot password"      |
| `/register`       | Public; always creates a `customer` (see §3)                   |
| `/reset-password` | Landing page for the emailed reset link                        |
| `/admin`          | Redirects to `/admin/login` or `/dashboard`                    |
| `/admin/login`    | Staff-only sign-in; not linked from anywhere public            |
| `/admin/register` | Staff registration; role decided by `ADMIN_EMAILS`             |
| `/admin/pending`  | `pending_staff` holding screen, with sign out                  |
| `/dashboard`      | **Protected** staff area (admin/dispatcher/viewer); customers → `/account`, `pending_staff` → `/admin/pending` |
| `/account`        | **Protected** customer area; staff → `/dashboard`, `pending_staff` → `/admin/pending` |
| `/403`            | Signed in, role too low                                       |
| `*`               | 404                                                           |
