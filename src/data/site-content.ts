/* ---------------------------------------------------------------------------
   Single source of truth for the public site's copy.
   Every string here is taken verbatim from the approved prototype.
   Dynamic content (reviews, road notes, FAQs) is loaded from the database;
   the arrays at the bottom are the seeded fallbacks so the page still
   renders identically if the network is unavailable.
--------------------------------------------------------------------------- */

export const PHONE = '506-223-1121';
export const PHONE_HREF = 'tel:+15062231121';
export const BUSINESS_NAME = 'BTown Mobile Truck Repair';

export type NavItem = { id: string; label: string };

export const NAV: NavItem[] = [
  { id: 'services', label: 'Services' },
  { id: 'how', label: 'How it works' },
  { id: 'fleets', label: 'Fleets' },
  { id: 'coverage', label: 'Coverage' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'notes', label: 'Road notes' },
  { id: 'faq', label: 'FAQ' },
  { id: 'contact', label: 'Contact' },
];

export const content = {
  badge: 'Concept prototype · v1',
  langToggleLabel: 'Switch to French',
  menuOpen: 'Open menu',
  menuClose: 'Close menu',
  callCta: `Call ${PHONE}`,
  wordmarkSub: 'Mobile truck repair',

  hero: {
    eyebrow: '// 24/7 · Northern New Brunswick',
    line1: "Truck trouble doesn't wait.",
    line2: 'Neither do we.',
    sub: '24/7 mobile heavy-duty truck & trailer repair. Certified mechanics dispatched to your location — no tow, no shop wait.',
    primary: 'Call BTown now',
    secondary: 'How it works',
    chips: ['No tow', 'No shop wait', 'No lost load'],
    platformLabel: 'Dispatched from Edmundston',
  },

  /* Floating glass chips that orbit the hero illustration */
  floaters: [
    { icon: 'tire', label: 'Tires', top: '12%', left: '-4%', delay: '0s' },
    { icon: 'battery', label: 'Battery', top: '26%', right: '-2%', delay: '1.3s' },
    { icon: 'diesel', label: 'Diesel', top: '62%', left: '-7%', delay: '2.6s' },
    { icon: 'reefer', label: 'Reefer', top: '76%', right: '2%', delay: '3.9s' },
  ] as const,

  stats: {
    items: [
      { value: 24, suffix: '/7', label: 'Dispatch' },
      { value: 45, suffix: ' min', label: 'Average arrival' },
      { value: 16, suffix: '+', label: 'Years heavy-duty' },
      { value: 100, suffix: '%', label: 'Commercially insured' },
    ],
    line: 'Four certified mechanics. One phone number. No tow truck required.',
  },

  services: {
    title: 'What we fix.',
    sub: 'Almost everything that stops a truck.',
    items: [
      { key: 'engine', label: 'Engine', line: 'Mobile truck & trailer repair' },
      { key: 'diesel', label: 'Diesel', line: 'Diagnostics & fuel systems' },
      { key: 'tire', label: 'Tires', line: 'Roadside tire service' },
      { key: 'battery', label: 'Battery', line: 'Jump start & cold-start' },
      { key: 'brakes', label: 'Brakes', line: 'Brakes & air systems' },
      { key: 'reefer', label: 'Reefer', line: 'Refrigeration units' },
      { key: 'trailer', label: 'Trailer', line: 'Trailer repair' },
      { key: 'fleet', label: 'Fleet', line: 'Scheduled maintenance' },
    ],
  },

  how: {
    title: 'Three steps.',
    sub: 'From the shoulder of the highway to back on the road.',
    steps: [
      { n: '1', label: 'Call', line: 'Tell us where you are and what\u2019s wrong' },
      { n: '2', label: 'We roll', line: 'A certified mechanic is dispatched; you get an ETA by text' },
      { n: '3', label: 'Fixed', line: 'Repaired roadside or in your yard — you\u2019re moving again' },
    ],
  },

  emergency: {
    title: 'Stuck right now? Call.',
    line: '24/7 · average dispatch under 30 minutes · live ETA by text',
  },

  fleets: {
    title: 'Parked trucks earn nothing.',
    sub: 'Scheduled on-site maintenance and priority dispatch for fleets of 3 to 300 — one number, one invoice, full digital service records.',
    rows: [
      'Preventive maintenance in your yard',
      'Priority 24/7 emergency response',
      'Cold-weather readiness checks every fall',
    ],
    cta: 'Book a fleet visit',
    caption: 'Yard service · Edmundston to Saint-Quentin',
  },

  coverage: {
    title: 'Northern NB, covered.',
    sub: 'Dispatched across the Saint John River valley and the Trans-Canada Highway 2 corridor.',
    cta: 'Check my location',
    pins: ['Edmundston', 'Grand Falls', 'Saint-Léonard', 'Saint-Quentin', 'Hwy 2'],
    legend: 'Amber line — Trans-Canada Highway 2 · Blue line — Saint John River',
  },

  reviews: {
    title: 'Drivers trust us.',
    badge: '4.9 ★ on Google',
    note: 'Sample reviews for prototype — real Google reviews will be pulled live.',
  },

  notes: {
    title: 'Road notes.',
    sub: 'Advice from the mechanics, not the marketing team.',
    all: 'All articles →',
    readSuffix: 'min read',
  },

  faq: {
    title: 'Straight answers.',
    sub: 'The questions drivers and fleet managers ask before they call.',
    note: 'Prototype answers — confirm these before launch.',
    cta: `Question not here? Call ${PHONE} — dispatch answers 24/7.`,
  },

  contact: {
    title: 'Need us now?',
    sameNumber: 'Same number, day or night.',
    areas: 'Edmundston · Grand Falls · Saint-Léonard · Saint-Quentin · Hwy 2',
    bilingual: 'EN / FR',
    formTitle: 'Request mobile service',
    fields: {
      name: 'Name',
      phone: 'Phone',
      truck: 'Truck / trailer',
      location: 'Location',
      issue: "What's wrong",
    },
    placeholders: {
      name: 'Jean D.',
      phone: '506 000 0000',
      truck: 'Volvo VNL 860 + 53ft reefer',
      location: 'Hwy 2 westbound, km 48',
      issue: 'Lost air pressure, warning light on the dash…',
    },
    submit: 'Send request',
    sending: 'Sending…',
    toast: 'Request received — a mechanic will call you back.',
    emergencyLine: `Emergency? Skip the form — call ${PHONE}.`,
    errors: {
      name: 'Please add a name.',
      phone: 'Please add a phone number we can reach you on.',
      location: 'Please tell us where you are.',
    },
  },

  footer: {
    tagline: '24/7 mobile heavy-duty truck & trailer repair across Northern New Brunswick.',
    openNow: 'Open now · 24/7',
    cols: [
      { title: 'Services', links: ['Mobile repair', 'Diesel', 'Tires', 'Reefer'] },
      { title: 'Company', links: ['About', 'Fleets', 'Reviews', 'Careers'] },
      { title: 'Areas', links: ['Edmundston', 'Grand Falls', 'Saint-Léonard', 'Saint-Quentin'] },
    ],
    legal: `© 2026 ${BUSINESS_NAME}`,
    privacy: 'Privacy',
    terms: 'Terms',
  },

  mobileBar: `Call ${PHONE} · 24/7`,
};

/* ------------------------------------------------------------------ */
/* Database-backed content types + seeded fallbacks                   */
/* ------------------------------------------------------------------ */

export type Review = { id: number; author: string; rating: number; text: string };
export type RoadNote = {
  id: number;
  title: string;
  category: string | null;
  read_minutes: number | null;
  body?: string;
};
export type Faq = { id: number; question: string; answer: string };

export const FALLBACK_REVIEWS: Review[] = [
  { id: 1, author: 'Owner-operator · Edmundston', rating: 5, text: 'Blew a tire outside Grand Falls at 2am. They were there in forty minutes.' },
  { id: 2, author: 'Fleet manager · Grand Falls', rating: 5, text: 'Our whole fleet gets serviced in our yard now. Zero downtime.' },
  { id: 3, author: 'Long-haul driver · Hwy 2', rating: 5, text: 'Reefer died in −28. Fixed on the shoulder, load saved.' },
];

export const FALLBACK_NOTES: RoadNote[] = [
  { id: 1, title: 'Why diesel gels at −25° and how to stop it.', category: 'Winter', read_minutes: 6 },
  { id: 2, title: 'Cold-start checklist for the first −20° night.', category: 'Battery', read_minutes: 4 },
  { id: 3, title: 'Three sounds your reefer makes before it fails.', category: 'Reefer', read_minutes: 5 },
];

export const FALLBACK_FAQS: Faq[] = [
  { id: 1, question: 'How fast do you actually arrive?', answer: 'Dispatch answers 24/7 and a mechanic is usually rolling within 30 minutes of your call. Average arrival along the Highway 2 corridor is about 45 minutes, and you get a live ETA by text as soon as the truck leaves. If we are further out than that, you hear the real number on the phone instead of a guess.' },
  { id: 2, question: 'What areas do you cover?', answer: 'The Saint John River valley and the Trans-Canada Highway 2 corridor: Edmundston, Grand Falls, Saint-Léonard, Saint-Quentin and everything in between — roadside or in your yard. Sitting just outside that stretch? Call anyway and we will tell you straight away whether we can reach you.' },
  { id: 3, question: 'Do you come out in winter conditions?', answer: 'Yes — winter is our busiest season. Our service trucks carry lighting, heat and cold-weather gear, so −30, freezing rain and snowbanks are normal working conditions, not a reason to wait until morning. We also run cold-weather readiness checks every fall so fewer trucks need that 3am call.' },
  { id: 4, question: 'What payment methods do you accept?', answer: 'Payment is settled on site once the truck is moving again, and you get an itemised digital invoice by email covering labour and parts. Roadside we take debit and all major credit cards on the mechanic\u2019s card reader, plus Interac e-Transfer and cash \u2014 nobody has to go hunting for a bank machine at 3am. Company cheques are accepted from established account holders. Fleet accounts are handled separately \u2014 see below.' },
  { id: 5, question: 'Do you service reefers after hours?', answer: 'Yes \u2014 reefer calls run on the same 24/7 dispatch as everything else. A dead refrigeration unit is a load on a clock, so those calls are treated as emergencies: we diagnose on the shoulder or in your yard and get the box back down to temperature before the freight is written off.' },
  { id: 6, question: 'How are fleet accounts billed?', answer: 'Fleets from 3 to 300 trucks run on a single account: one phone number, one invoice covering every unit, and full digital service records per truck so your compliance file stays current. Approved accounts skip roadside payment and are invoiced once a month instead \u2014 every call on one statement, itemised by unit and work order, payable within 30 days by e-Transfer, cheque or card. We can quote your purchase-order number on the invoice, and the account is opened over the phone before the first call so there is no paperwork at 2am.' },
  { id: 7, question: 'What if the repair cannot be done roadside?', answer: 'Most calls end with the truck driving away. When a repair genuinely needs a shop — a major engine or transmission failure — we tell you on the spot instead of billing hours against a job that cannot finish, and we help arrange the tow and hand over the diagnosis so nobody starts from scratch.' },

  { id: 8, question: 'Do your trucks carry parts?', answer: 'Our service trucks are stocked for the failures we see most: filters, belts, hoses, air line fittings, lamps, batteries and tire service. Anything we do not carry, we source and bring out — you are not phoning parts counters from the shoulder of the highway.' },
];
