import React, { useState } from 'react';
import { API_BASE } from '@/components/auth/lib/api';
import { toast } from 'sonner';
import { CheckCircle2, Loader2, Phone } from 'lucide-react';
import { useAuth } from '@/components/auth/lib/auth';
import {
  Section,
  Shell,
  Orb,
  Eyebrow,
  Reveal,
  LiveDot,
  Hairline,
} from '@/components/site/primitives';
import {
  content,
  PHONE,
  PHONE_HREF,
  NAV,
  BUSINESS_NAME,
} from '@/data/site-content';
import { serviceRequestSchema, fieldErrors } from '@/components/auth/lib/validation';
import { useCopy } from '@/components/auth/lib/site-copy';

/* ---------------------------------------------------------------- 10 */
export const Contact: React.FC = () => {
  const copy = useCopy();
  const c = content.contact;
  const { session } = useAuth();
  const [values, setValues] = useState({
    name: '',
    phone: '',
    email: '',
    truck_details: '',
    location: '',
    issue_description: '',
    honeypot: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [showAccountPrompt, setShowAccountPrompt] = useState(false);
  const [allowGuestSubmit, setAllowGuestSubmit] = useState(false);
  const set =
    (key: keyof typeof values) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setValues((v) => ({ ...v, [key]: e.target.value }));

      if (errors[key]) {
        setErrors((prev) => ({ ...prev, [key]: '' }));
      }
    };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (sending) return;
    if (!session && !allowGuestSubmit) {
  setShowAccountPrompt(true);
  return;
}
    // Client-side validation with the same zod schema the server re-runs.
    const parsed = serviceRequestSchema.safeParse({
      ...values,
      urgency: 'emergency',
    });

    if (!parsed.success) {
      const errs = fieldErrors(parsed.error);

      setErrors(errs);

      toast.error(
        Object.values(errs)[0] ?? 'Please check the form.',
      );

      return;
    }

    setSending(true);

    try {
      const response = await fetch(
        `${API_BASE}/api/public/submit-request`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(parsed.data),
        },
      );

      const data = await response.json();
      const status = response.status;

      if (status === 429) {
        toast.error(
          data.error ??
            'Too many requests. Please call us directly.',
        );
        return;
      }

      if (status >= 400) {
        if (data.errors) {
          setErrors(data.errors);
        }

        toast.error(
          data.error ??
            'Something went wrong. Please call us instead.',
        );

        return;
      }

      setSent(true);
setAllowGuestSubmit(false);
      setValues({
        name: '',
        phone: '',
        email: '',
        truck_details: '',
        location: '',
        issue_description: '',
        honeypot: '',
      });

      toast.success(c.toast);

      try {
        window.supercool?.track?.('form_submit', {
          form: 'service-request',
        });
      } catch {
        /* analytics must never break the page */
      }
    } catch {
      toast.error(
        'Network problem â€” please call 506-223-1121.',
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <Section id="contact" className="overflow-hidden">
      <Orb className="h-[620px] w-[900px] left-1/2 -translate-x-1/2 bottom-[-300px] opacity-55" />

      <Shell className="relative z-10">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <Reveal>
              <Eyebrow>// 10 â€” Contact</Eyebrow>
            </Reveal>

            <Reveal delay={80}>
              <h2 className="t-h2 mt-6">
                {copy.t('contact_title', c.title)}
              </h2>
            </Reveal>

            <Reveal delay={160}>
              <a
                href={PHONE_HREF}
                className="mono-num mt-7 inline-block font-display text-[clamp(32px,5.4vw,56px)] font-bold leading-none text-amber transition-transform duration-300 hover:scale-[1.02]"
                style={{ textWrap: 'balance' }}
                onClick={() => {
                  try {
                    window.supercool?.track?.('cta_click', {
                      cta: 'contact-phone',
                    });
                  } catch {
                    /* analytics must never break the page */
                  }
                }}
              >
                {PHONE}
              </a>
            </Reveal>

            <Reveal delay={220}>
              <p className="t-lead mt-5">
                {copy.t('contact_body', c.sameNumber)}
              </p>
            </Reveal>

            <Reveal delay={280}>
              <Hairline className="my-8" />
            </Reveal>

            <Reveal delay={320}>
              <p className="mono text-[10.5px] leading-relaxed text-graphite">
                {copy.t(
                  'contact_service_area',
                  c.areas,
                )}
              </p>
            </Reveal>

            <Reveal delay={380}>
              <p className="mono mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] text-graphite">
                <LiveDot />
                {c.bilingual}
              </p>
            </Reveal>
          </div>

          <Reveal delay={160}>
            <div className="glass glass-solid px-6 py-8 sm:px-8 sm:py-10">
              <h3 className="t-h3 text-chalk">
                {c.formTitle}
              </h3>

              {showAccountPrompt ? (
  <div className="mt-8 overflow-hidden rounded-2xl border border-amber/30 bg-gradient-to-br from-amber/10 via-background to-violet-500/10 p-6 shadow-[0_0_35px_rgba(245,158,11,0.12)]">
    <div className="flex h-12 w-12 items-center justify-center rounded-full border border-amber/40 bg-amber/10 text-xl">
      ðŸšš
    </div>

    <h4 className="mt-4 font-display text-[20px] font-semibold text-chalk">
      Almost there!
    </h4>

    <p className="mt-2 max-w-md text-[13px] leading-relaxed text-graphite">
      Sign in or create an account to submit your request and track its
      status from your Btowntruck dashboard.
    </p>

    <div className="mt-5 flex flex-col gap-3 sm:flex-row">
      <a
        href="/login"
        className="btn-amber inline-flex justify-center"
      >
        Sign in
      </a>

      <a
        href="/register"
        className="inline-flex items-center justify-center rounded-md border border-white/15 px-5 py-3 text-sm text-chalk transition-colors hover:border-amber/40 hover:text-amber"
      >
        Create account
      </a>

      <button
        type="button"
        onClick={() => {
  setShowAccountPrompt(false);
  setAllowGuestSubmit(true);
}}
        className="mono px-3 py-2 text-[10.5px] text-graphite transition-colors hover:text-chalk"
      >
        Continue as guest
      </button>
    </div>
  </div>
) : sent ? (
  <div className="mt-8 flex flex-col items-start gap-4">
    <span className="flex h-12 w-12 items-center justify-center rounded-full border border-amber/40 bg-amber/10">
      <CheckCircle2
        className="text-amber"
        size={22}
      />
    </span>

    <p className="font-display text-[19px] font-semibold leading-snug tracking-tight text-chalk">
      {c.toast}
    </p>

    <p className="text-[15px] leading-relaxed text-graphite">
      Keep your phone close ï¿½ dispatch calls back
      on the number you gave us.
    </p>

    <div className="flex flex-wrap gap-3 pt-2">
      <a
        href={PHONE_HREF}
        className="btn-amber !py-3 text-[14px]"
      >
        <Phone size={15} />
        {PHONE}
      </a>

      <button
        type="button"
        className="btn-ghost !py-3 text-[14px]"
        onClick={() => setSent(false)}
      >
        Send another request
      </button>
    </div>
  </div>              ) : (
                <form
                  className="mt-7 space-y-4"
                  onSubmit={onSubmit}
                  noValidate
                >
                  {/* Honeypot: hidden from users, filled only by bots. */}
                  <div
                    className="absolute h-0 w-0 overflow-hidden opacity-0"
                    aria-hidden="true"
                  >
                    <label htmlFor="sr-company">
                      Company
                    </label>

                    <input
                      id="sr-company"
                      name="company"
                      type="text"
                      tabIndex={-1}
                      autoComplete="off"
                      value={values.honeypot}
                      onChange={set('honeypot')}
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label
                        className="field-label"
                        htmlFor="sr-name"
                      >
                        {c.fields.name}
                      </label>

                      <input
                        id="sr-name"
                        className="field-input mt-2"
                        placeholder={c.placeholders.name}
                        value={values.name}
                        onChange={set('name')}
                        autoComplete="name"
                        aria-invalid={!!errors.name}
                        aria-describedby={
                          errors.name
                            ? 'sr-name-err'
                            : undefined
                        }
                      />

                      {errors.name && (
                        <p
                          id="sr-name-err"
                          className="mt-1.5 text-[12.5px] text-red-400"
                        >
                          {errors.name}
                        </p>
                      )}
                    </div>

                    <div>
                      <label
                        className="field-label"
                        htmlFor="sr-phone"
                      >
                        {c.fields.phone}
                      </label>

                      <input
                        id="sr-phone"
                        className="field-input mt-2"
                        placeholder={c.placeholders.phone}
                        value={values.phone}
                        onChange={set('phone')}
                        inputMode="tel"
                        autoComplete="tel"
                        aria-invalid={!!errors.phone}
                        aria-describedby={
                          errors.phone
                            ? 'sr-phone-err'
                            : undefined
                        }
                      />

                      {errors.phone && (
                        <p
                          id="sr-phone-err"
                          className="mt-1.5 text-[12.5px] text-red-400"
                        >
                          {errors.phone}
                        </p>
                      )}


<div>
  <label
    className="field-label"
    htmlFor="sr-email"
  >
    {c.fields.email}
  </label>

  <input
    id="sr-email"
    type="email"
    className="field-input mt-2"
    placeholder={c.placeholders.email}
    value={values.email}
    onChange={set('email')}
    autoComplete="email"
    aria-invalid={!!errors.email}
    aria-describedby={
      errors.email
        ? 'sr-email-err'
        : undefined
    }
  />

  {errors.email && (
    <p
      id="sr-email-err"
      className="mt-1.5 text-[12.5px] text-red-400"
    >
      {errors.email}
    </p>
  )}
</div>
                    </div>
                  </div>

                  <div>
                    <label
                      className="field-label"
                      htmlFor="sr-truck"
                    >
                      {c.fields.truck}
                    </label>

                    <input
                      id="sr-truck"
                      className="field-input mt-2"
                      placeholder={c.placeholders.truck}
                      value={values.truck_details}
                      onChange={set('truck_details')}
                    />
                  </div>

                  <div>
                    <label
                      className="field-label"
                      htmlFor="sr-location"
                    >
                      {c.fields.location}
                    </label>

                    <input
                      id="sr-location"
                      className="field-input mt-2"
                      placeholder={c.placeholders.location}
                      value={values.location}
                      onChange={set('location')}
                      aria-invalid={!!errors.location}
                      aria-describedby={
                        errors.location
                          ? 'sr-location-err'
                          : undefined
                      }
                    />

                    {errors.location && (
                      <p
                        id="sr-location-err"
                        className="mt-1.5 text-[12.5px] text-red-400"
                      >
                        {errors.location}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      className="field-label"
                      htmlFor="sr-issue"
                    >
                      {c.fields.issue}
                    </label>

                    <textarea
                      id="sr-issue"
                      className="field-input mt-2 min-h-[110px] resize-y"
                      placeholder={c.placeholders.issue}
                      value={values.issue_description}
                      onChange={set('issue_description')}
                    />
                  </div>

                  <button
                    type="submit"
                    className="btn-amber mt-2 w-full"
                    disabled={sending}
                  >
                    {sending ? (
                      <>
                        <Loader2
                          size={16}
                          className="animate-spin"
                        />
                        {c.sending}
                      </>
                    ) : (
                      c.submit
                    )}
                  </button>

                  <a
                    href={PHONE_HREF}
                    className="mono mt-3 block text-center text-[10.5px] leading-relaxed text-graphite transition-colors duration-300 hover:text-amber"
                  >
                    {c.emergencyLine}
                  </a>
                </form>
              )}
            </div>
          </Reveal>
        </div>
      </Shell>
    </Section>
  );
};

/* ---------------------------------------------------------------- Footer */
export const Footer: React.FC = () => {
  const copy = useCopy();

  return (
    <footer className="relative border-t border-white/[0.07] pb-28 pt-16 sm:pb-16">
      <Shell>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.3fr)_repeat(3,minmax(0,0.7fr))]">
          <div>
            <div className="flex items-center gap-3">
              <svg
                viewBox="0 0 64 64"
                width="36"
                height="36"
                aria-hidden="true"
              >
                <rect
                  width="64"
                  height="64"
                  rx="14"
                  fill="#11161C"
                />

                <path
                  d="M41 12a13 13 0 0 0-14.6 17.4L13.6 42.2a5.2 5.2 0 0 0 7.3 7.3l12.8-12.8A13 13 0 0 0 51 22l-7.4 7.4-6.2-1.8-1.8-6.2z"
                  fill="#F4F5F7"
                />

                <circle
                  cx="46"
                  cy="48"
                  r="6.5"
                  fill="#FFB020"
                />
              </svg>

              <span className="font-display text-[16px] font-bold tracking-tight text-chalk">
                {BUSINESS_NAME}
              </span>
            </div>

            <p className="t-lead mt-5 max-w-[34ch] text-[15.5px]">
              {copy.t(
                'footer_tagline',
                content.footer.tagline,
              )}
            </p>

            <p className="mono mt-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] text-graphite">
              <LiveDot />
              {content.footer.openNow}
            </p>

            <a
              href={PHONE_HREF}
              className="btn-amber mt-7 !py-3 text-[14px]"
            >
              <Phone size={15} />

              <span className="mono text-[12.5px]">
                {PHONE}
              </span>
            </a>
          </div>

          {content.footer.cols.map((col) => (
            <nav
              key={col.title}
              aria-label={col.title}
            >
              <p className="mono text-[10.5px] text-amber">
                {col.title}
              </p>

              <ul className="mt-5 space-y-3">
                {col.links.map((link, i) => {
                  /* Footer links point at the matching page section so every
                     link does something real. */
                  const target =
                    col.title === 'Services'
                      ? '#services'
                      : col.title === 'Areas'
                        ? '#coverage'
                        : ['#top', '#fleets', '#reviews', '#contact'][
                            i
                          ] ?? '#top';

                  return (
                    <li key={link}>
                      <a
                        href={target}
                        className="text-[14.5px] text-chalk/70 transition-colors duration-300 hover:text-amber"
                      >
                        {link}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </nav>
          ))}
        </div>

        <Hairline className="my-10" />

        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <p className="mono text-[10px] text-graphite/80">
            {content.footer.legal}
          </p>

          <nav
            aria-label="Legal"
            className="flex items-center gap-6"
          >
            <a
              href="#faq"
              className="mono text-[10px] text-graphite/80 transition-colors hover:text-amber"
            >
              {content.footer.privacy}
            </a>

            <a
              href="#faq"
              className="mono text-[10px] text-graphite/80 transition-colors hover:text-amber"
            >
              {content.footer.terms}
            </a>

            {/* Staff entrance to the protected dashboard */}
            <a
              href="/login"
              className="mono text-[10px] text-graphite/80 transition-colors hover:text-amber"
            >
              Staff login
            </a>
          </nav>
        </div>

        <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2">
          {NAV.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className="text-[13px] text-graphite/70 transition-colors duration-300 hover:text-amber"
            >
              {item.label}
            </a>
          ))}
        </div>
      </Shell>
    </footer>
  );
};
