import { z } from 'zod';

/* ---------------------------------------------------------------------------
   Shared zod schemas. The SAME shapes are used by the browser forms and by
   the edge functions (which re-parse every payload server-side), so a
   tampered client can never widen what the server accepts.
--------------------------------------------------------------------------- */

/** Strips control characters and angle brackets, then trims + caps length. */
export const safeText = (max: number) =>
  z
    .string()
    .transform((v) => v.replace(/[\u0000-\u001F\u007F]/g, '').trim())
    .pipe(z.string().max(max));

export const PASSWORD_MIN = 12;

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, `Password must be at least ${PASSWORD_MIN} characters.`)
  .max(200, 'Password is too long.')
  .refine((v) => /[a-z]/.test(v), 'Include at least one lowercase letter.')
  .refine((v) => /[A-Z]/.test(v), 'Include at least one uppercase letter.')
  .refine((v) => /[0-9]/.test(v), 'Include at least one number.');

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Enter a valid email address.')
  .max(254);

/** Public service-request form. `honeypot` must stay empty (bot trap). */
export const serviceRequestSchema = z.object({
  name: safeText(120).pipe(z.string().min(1, 'Please add a name.')),
  phone: safeText(40).pipe(z.string().min(6, 'Please add a phone number we can reach you on.')),
  email: emailSchema,
  truck_details: safeText(200).optional(),
  location: safeText(200).pipe(z.string().min(1, 'Please tell us where you are.')),
  issue_description: safeText(2000).optional(),
  urgency: z.enum(['emergency', 'today', 'scheduled']).default('emergency'),
  honeypot: z.string().max(0).optional(),
});
export type ServiceRequestInput = z.infer<typeof serviceRequestSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password.').max(200),
});

export const resetRequestSchema = z.object({ email: emailSchema });

/**
 * Public registration. The role is NEVER part of this payload â€” the server
 * always creates a `customer` unless the email is in ADMIN_EMAILS.
 * `honeypot` must stay empty (bot trap).
 */
export const registerSchema = z
  .object({
    full_name: safeText(120).pipe(z.string().min(1, 'Add your name.')),
    email: emailSchema,
    password: passwordSchema,
    confirm: z.string(),
    honeypot: z.string().max(0).optional(),
  })
  .refine((v) => v.password === v.confirm, {
    message: 'Passwords do not match.',
    path: ['confirm'],
  });

export const newUserSchema = z.object({
  full_name: safeText(120).pipe(z.string().min(1, 'Add a name.')),
  email: emailSchema,
  role: z.enum(['admin', 'dispatcher', 'viewer', 'customer', 'pending_staff']),
  password: passwordSchema,
});


export const reviewSchema = z.object({
  author: safeText(120).pipe(z.string().min(1, 'Add an author.')),
  rating: z.coerce.number().int().min(1).max(5),
  text: safeText(1000).pipe(z.string().min(1, 'Add the review text.')),
  is_published: z.boolean(),
});

export const roadNoteSchema = z.object({
  title: safeText(200).pipe(z.string().min(1, 'Add a title.')),
  category: safeText(60).optional(),
  read_minutes: z.coerce.number().int().min(0).max(240).optional(),
  body: safeText(20000).optional(),
  is_published: z.boolean(),
});

export const faqSchema = z.object({
  question: safeText(300).pipe(z.string().min(1, 'Add a question.')),
  answer: safeText(5000).pipe(z.string().min(1, 'Add an answer.')),
  sort_order: z.coerce.number().int().min(0).max(999),
  is_published: z.boolean(),
});

export const STATUSES = ['new', 'dispatched', 'in_progress', 'completed', 'cancelled'] as const;
export const URGENCIES = ['emergency', 'today', 'scheduled'] as const;
/**
 * `pending_staff` is created by /admin/register when the email is NOT on the
 * server-side ADMIN_EMAILS allow-list. It has no dashboard access and no
 * customer area â€” an existing administrator promotes it in Dashboard â†’ Users.
 */
export const ROLES = ['admin', 'dispatcher', 'viewer', 'customer', 'pending_staff'] as const;
/** Roles that work the dispatch board. */
export const INTERNAL_ROLES = ['admin', 'dispatcher', 'viewer'] as const;


export type Status = (typeof STATUSES)[number];
export type Urgency = (typeof URGENCIES)[number];
export type Role = (typeof ROLES)[number];


/** Turns a zod error into a { field: message } map for form rendering. */
export function fieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = String(issue.path[0] ?? '_');
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/**
 * Escapes user-provided text before it is placed into any HTML string
 * (emails, exports). React escapes JSX automatically, but server-rendered
 * email bodies are assembled by hand and need this.
 */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
