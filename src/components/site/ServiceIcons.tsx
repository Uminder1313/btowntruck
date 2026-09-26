import React from 'react';

/**
 * The prototype's dimensional service icons, recreated as inline SVG.
 * A single shared <defs> block holds the steel / dark / amber / ice / glass
 * gradients so each 48x48 glyph stays lightweight.
 */
export const IconGradients: React.FC = () => (
  <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: 'absolute' }}>
    <defs>
      <linearGradient id="g3d-steel" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#F4F5F7" />
        <stop offset="48%" stopColor="#B9C1CC" />
        <stop offset="100%" stopColor="#6E7885" />
      </linearGradient>
      <linearGradient id="g3d-dark" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#3A4450" />
        <stop offset="55%" stopColor="#242C36" />
        <stop offset="100%" stopColor="#141A21" />
      </linearGradient>
      <linearGradient id="g3d-amber" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#FFDA8C" />
        <stop offset="45%" stopColor="#FFB020" />
        <stop offset="100%" stopColor="#C77D07" />
      </linearGradient>
      <linearGradient id="g3d-ice" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#DCEEFB" />
        <stop offset="50%" stopColor="#9CC9E8" />
        <stop offset="100%" stopColor="#5E8BAB" />
      </linearGradient>
      <linearGradient id="g3d-glass" x1="0" y1="0" x2="0.4" y2="1">
        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.35" />
        <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.04" />
      </linearGradient>
      <radialGradient id="g3d-lamp" cx="0.5" cy="0.35" r="0.7">
        <stop offset="0%" stopColor="#FFF4D6" />
        <stop offset="55%" stopColor="#FFB020" />
        <stop offset="100%" stopColor="#B87708" />
      </radialGradient>
    </defs>
  </svg>
);

const STEEL = 'url(#g3d-steel)';
const DARK = 'url(#g3d-dark)';
const AMBER = 'url(#g3d-amber)';
const ICE = 'url(#g3d-ice)';
const GLASS = 'url(#g3d-glass)';

type IconProps = { size?: number; className?: string };

const frame = (size: number, className: string | undefined, children: React.ReactNode) => (
  <svg viewBox="0 0 48 48" width={size} height={size} className={className} aria-hidden="true" focusable="false">
    {children}
  </svg>
);

/** Engine — mobile truck & trailer repair */
const Engine: React.FC<IconProps> = ({ size = 44, className }) =>
  frame(size, className, (
    <>
      <rect x="6" y="18" width="30" height="20" rx="6" fill={STEEL} />
      <rect x="14" y="10" width="14" height="10" rx="4" fill={STEEL} />
      <rect x="8" y="20" width="26" height="6" rx="3" fill={GLASS} />
      <rect x="34" y="22" width="9" height="12" rx="4" fill={DARK} />
      <rect x="2" y="24" width="6" height="9" rx="3" fill={DARK} />
      <path d="M24 24l-5 8h5l-3 7 9-10h-5l3-5z" fill={AMBER} />
    </>
  ));

/** Diesel — diagnostics & fuel systems */
const Diesel: React.FC<IconProps> = ({ size = 44, className }) =>
  frame(size, className, (
    <>
      <rect x="7" y="10" width="20" height="30" rx="6" fill={STEEL} />
      <rect x="10" y="14" width="14" height="9" rx="3" fill={DARK} />
      <rect x="10" y="14" width="14" height="4" rx="2" fill={GLASS} />
      <rect x="11" y="28" width="12" height="3.4" rx="1.7" fill="#8A93A0" />
      <path d="M31 16h5a4 4 0 0 1 4 4v11a3 3 0 1 0 6 0v-6" stroke={DARK} strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M38 4c3.6 4.3 5.6 7.2 5.6 9.6a5.6 5.6 0 1 1-11.2 0C32.4 11.2 34.4 8.3 38 4z" fill={AMBER} />
      <ellipse cx="36.2" cy="10.6" rx="1.4" ry="2.1" fill="#FFF3D4" opacity="0.75" />
    </>
  ));

/** Tires — roadside tire service */
const Tire: React.FC<IconProps> = ({ size = 44, className }) =>
  frame(size, className, (
    <>
      <circle cx="24" cy="24" r="19" fill={DARK} />
      <circle cx="24" cy="24" r="19" fill={GLASS} />
      <circle cx="24" cy="24" r="12.5" fill="#11161C" />
      <circle cx="24" cy="24" r="8.5" fill={STEEL} />
      <circle cx="24" cy="24" r="3.4" fill={AMBER} />
      <g stroke="#0E1116" strokeWidth="2.4" opacity="0.65">
        <path d="M24 5v6M24 37v6M5 24h6M37 24h6M11 11l4 4M33 33l4 4M37 11l-4 4M15 33l-4 4" />
      </g>
    </>
  ));

/** Battery — jump start & cold-start */
const Battery: React.FC<IconProps> = ({ size = 44, className }) =>
  frame(size, className, (
    <>
      <rect x="5" y="14" width="34" height="24" rx="5" fill={STEEL} />
      <rect x="7" y="16" width="30" height="8" rx="3" fill={GLASS} />
      <rect x="11" y="9" width="7" height="6" rx="2" fill={DARK} />
      <rect x="26" y="9" width="7" height="6" rx="2" fill={DARK} />
      <rect x="41" y="21" width="5" height="10" rx="2.5" fill={DARK} />
      <path d="M22 19l-5 9h5l-3 8 9-11h-5l3-6z" fill={AMBER} />
    </>
  ));

/** Brakes — brakes & air systems */
const Brakes: React.FC<IconProps> = ({ size = 44, className }) =>
  frame(size, className, (
    <>
      <circle cx="22" cy="24" r="17" fill={DARK} />
      <circle cx="22" cy="24" r="17" fill={GLASS} />
      <circle cx="22" cy="24" r="10" fill={STEEL} />
      <circle cx="22" cy="24" r="4" fill="#11161C" />
      <path d="M36 11a19 19 0 0 1 0 26 6 6 0 0 1-4-5V16a6 6 0 0 1 4-5z" fill={AMBER} />
      <g stroke="#0E1116" strokeWidth="2" opacity="0.5">
        <path d="M22 7v6M22 35v6M5 24h6M33 24h4" />
      </g>
    </>
  ));

/** Reefer — refrigeration units */
const Reefer: React.FC<IconProps> = ({ size = 44, className }) =>
  frame(size, className, (
    <>
      <rect x="5" y="12" width="32" height="26" rx="5" fill={DARK} />
      <rect x="8" y="15" width="26" height="9" rx="3" fill={GLASS} />
      <rect x="37" y="18" width="7" height="14" rx="3" fill={STEEL} />
      <g stroke={ICE} strokeWidth="2.6" strokeLinecap="round">
        <path d="M21 18v14M15 21l12 8M27 21l-12 8" />
      </g>
      <circle cx="21" cy="25" r="3" fill={ICE} />
      <rect x="9" y="33" width="24" height="3" rx="1.5" fill={AMBER} opacity="0.85" />
    </>
  ));

/** Trailer — trailer repair */
const Trailer: React.FC<IconProps> = ({ size = 44, className }) =>
  frame(size, className, (
    <>
      <rect x="4" y="13" width="36" height="20" rx="4" fill={DARK} />
      <rect x="6" y="15" width="32" height="7" rx="3" fill={GLASS} />
      <g stroke="#0E1116" strokeWidth="2" opacity="0.6">
        <path d="M13 14v18M21 14v18M29 14v18" />
      </g>
      <rect x="4" y="33" width="36" height="3.4" rx="1.7" fill={AMBER} opacity="0.8" />
      <circle cx="14" cy="39" r="5" fill="#0B0E12" />
      <circle cx="14" cy="39" r="2" fill={STEEL} />
      <circle cx="28" cy="39" r="5" fill="#0B0E12" />
      <circle cx="28" cy="39" r="2" fill={STEEL} />
      <path d="M40 20h5v6h-5z" fill={STEEL} />
    </>
  ));

/** Fleet — scheduled maintenance */
const Fleet: React.FC<IconProps> = ({ size = 44, className }) =>
  frame(size, className, (
    <>
      <rect x="4" y="8" width="21" height="14" rx="4" fill={DARK} />
      <rect x="6" y="10" width="17" height="5" rx="2.5" fill={GLASS} />
      <circle cx="10" cy="24" r="3.4" fill="#0B0E12" />
      <circle cx="20" cy="24" r="3.4" fill="#0B0E12" />
      <rect x="15" y="26" width="24" height="14" rx="4" fill={STEEL} />
      <rect x="17" y="28" width="20" height="5" rx="2.5" fill={GLASS} />
      <circle cx="21" cy="42" r="3.4" fill="#0B0E12" />
      <circle cx="33" cy="42" r="3.4" fill="#0B0E12" />
      <path d="M32 6l2.6 5.6 6 .8-4.4 4.3 1.1 6-5.3-2.9-5.3 2.9 1.1-6L23.4 12.4l6-.8z" fill={AMBER} />
    </>
  ));

const MAP: Record<string, React.FC<IconProps>> = {
  engine: Engine,
  diesel: Diesel,
  tire: Tire,
  battery: Battery,
  brakes: Brakes,
  reefer: Reefer,
  trailer: Trailer,
  fleet: Fleet,
};

/** Look up a service glyph by its key; falls back to the engine glyph. */
const ServiceIcon: React.FC<{ name: string } & IconProps> = ({ name, size, className }) => {
  const Cmp = MAP[name] ?? Engine;
  return <Cmp size={size} className={className} />;
};

export default ServiceIcon;
