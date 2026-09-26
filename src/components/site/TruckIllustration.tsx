import React from 'react';

/**
 * Hero artwork — inline SVG recreation of the prototype's heavy-duty truck
 * on its lit service platform. No raster image is used anywhere: every
 * gradient, filter and path below is declarative SVG so it stays crisp at
 * any size and inherits the amber/steel palette.
 */
const TruckIllustration: React.FC<{ className?: string }> = ({ className }) => (
  <div className={className}>
    <svg
      viewBox="0 0 520 440"
      className="w-full h-auto"
      role="img"
      aria-label="Illustration of a heavy-duty semi truck with an amber roof beacon on a dark service platform"
    >
      <defs>
        <radialGradient id="tk-platform" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#222A34" />
          <stop offset="70%" stopColor="#151A21" />
          <stop offset="100%" stopColor="#0E1116" />
        </radialGradient>
        <linearGradient id="tk-cabFront" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3D4854" />
          <stop offset="45%" stopColor="#2A323C" />
          <stop offset="100%" stopColor="#1A2029" />
        </linearGradient>
        <linearGradient id="tk-cabSide" x1="0" y1="0" x2="1" y2="0.4">
          <stop offset="0%" stopColor="#242C36" />
          <stop offset="100%" stopColor="#151A21" />
        </linearGradient>
        <linearGradient id="tk-roof" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stopColor="#5A6673" />
          <stop offset="100%" stopColor="#333C47" />
        </linearGradient>
        <linearGradient id="tk-trailer" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#333C47" />
          <stop offset="55%" stopColor="#222A33" />
          <stop offset="100%" stopColor="#161C23" />
        </linearGradient>
        <linearGradient id="tk-glass" x1="0.1" y1="0" x2="0.7" y2="1">
          <stop offset="0%" stopColor="#9CC9E8" stopOpacity="0.55" />
          <stop offset="60%" stopColor="#2E3B48" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#1B222A" />
        </linearGradient>
        <linearGradient id="tk-grille" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E9EDF2" />
          <stop offset="100%" stopColor="#7C8794" />
        </linearGradient>
        <linearGradient id="tk-amber" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFDE9A" />
          <stop offset="45%" stopColor="#FFB020" />
          <stop offset="100%" stopColor="#C57C06" />
        </linearGradient>
        <radialGradient id="tk-lamp" cx="0.5" cy="0.4" r="0.6">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="40%" stopColor="#FFE9B5" />
          <stop offset="100%" stopColor="#FFB020" stopOpacity="0.05" />
        </radialGradient>
        <linearGradient id="tk-cone" x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor="#FFB020" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#FFB020" stopOpacity="0" />
        </linearGradient>
        <filter id="tk-soft" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
        <filter id="tk-glow" x="-90%" y="-90%" width="280%" height="280%">
          <feGaussianBlur stdDeviation="5" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <clipPath id="tk-coneClip">
          <ellipse cx="260" cy="352" rx="176" ry="54" />
        </clipPath>
      </defs>

      {/* Service platform */}
      <ellipse cx="260" cy="368" rx="186" ry="58" fill="#090C10" opacity="0.85" filter="url(#tk-soft)" />
      <ellipse cx="260" cy="352" rx="176" ry="54" fill="url(#tk-platform)" />
      <ellipse cx="260" cy="352" rx="176" ry="54" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" />
      <ellipse cx="260" cy="352" rx="140" ry="42" fill="none" stroke="#FFB020" strokeWidth="2.5" opacity="0.75" filter="url(#tk-glow)" />
      <g style={{ transformOrigin: '260px 352px' }} className="ring-pulse">
        <ellipse cx="260" cy="352" rx="140" ry="42" fill="none" stroke="#FFB020" strokeWidth="2" />
      </g>
      <ellipse cx="258" cy="336" rx="126" ry="24" fill="#000" opacity="0.62" filter="url(#tk-soft)" />

      {/* Truck + trailer, gently floating */}
      <g className="float-slow" style={{ transformOrigin: '260px 210px' }}>
        <path d="M296 128 L446 156 L446 286 L296 300 Z" fill="url(#tk-trailer)" />
        <path d="M296 128 L446 156 L446 168 L296 143 Z" fill="#FFFFFF" opacity="0.10" />
        <g stroke="#0E1116" strokeWidth="2" opacity="0.5">
          <path d="M330 134v163M364 140v156M398 146v148M430 152v140" />
        </g>
        <rect x="292" y="288" width="156" height="9" rx="4" fill="#11161C" opacity="0.9" />
        <path d="M296 296 L446 284 L446 292 L296 304 Z" fill="#FFB020" opacity="0.28" />
        <path d="M150 288 L300 300 L300 312 L150 302 Z" fill="#1A2029" />
        <path d="M188 118 L296 128 L296 300 L188 292 Z" fill="url(#tk-cabSide)" />
        <path d="M188 118 L296 128 L296 142 L188 133 Z" fill="#FFFFFF" opacity="0.08" />
        <rect x="206" y="158" width="72" height="44" rx="8" fill="url(#tk-glass)" opacity="0.7" />
        <path d="M196 232 L290 240 L290 252 L196 244 Z" fill="url(#tk-amber)" opacity="0.85" />
        <path d="M86 130 L188 118 L188 292 L86 302 Z" fill="url(#tk-cabFront)" />
        <path d="M86 130 L188 118 L188 134 L86 146 Z" fill="#FFFFFF" opacity="0.14" />
        <path d="M98 148 L180 138 L180 196 L98 204 Z" fill="url(#tk-glass)" />
        <path d="M98 148 L180 138 L180 150 L98 161 Z" fill="#9CC9E8" opacity="0.35" />
        <path d="M104 200 L146 144 L158 143 L112 201 Z" fill="#FFFFFF" opacity="0.10" />
        <rect x="100" y="216" width="78" height="46" rx="9" fill="#1A2029" />
        <g fill="url(#tk-grille)" opacity="0.92">
          <rect x="106" y="222" width="66" height="5.4" rx="2.7" />
          <rect x="106" y="232" width="66" height="5.4" rx="2.7" />
          <rect x="106" y="242" width="66" height="5.4" rx="2.7" />
          <rect x="106" y="252" width="66" height="5.4" rx="2.7" />
        </g>
        <path d="M88 268 L186 260 L186 288 L88 298 Z" fill="#39434F" />
        <path d="M88 268 L186 260 L186 268 L88 277 Z" fill="#FFFFFF" opacity="0.16" />
        <rect x="96" y="276" width="20" height="8" rx="4" fill="#0E1116" opacity="0.6" />

        {/* Headlamps */}
        <g filter="url(#tk-glow)">
          <rect x="94" y="200" width="30" height="13" rx="6.5" fill="url(#tk-lamp)" />
          <rect x="152" y="195" width="30" height="13" rx="6.5" fill="url(#tk-lamp)" />
        </g>
        <ellipse cx="109" cy="207" rx="42" ry="20" fill="url(#tk-lamp)" opacity="0.22" />
        <ellipse cx="167" cy="202" rx="42" ry="20" fill="url(#tk-lamp)" opacity="0.22" />

        {/* Roof marker lights */}
        <g fill="url(#tk-amber)">
          <rect x="100" y="132" width="13" height="6" rx="3" />
          <rect x="122" y="130" width="13" height="6" rx="3" />
          <rect x="144" y="127" width="13" height="6" rx="3" />
          <rect x="166" y="124" width="13" height="6" rx="3" />
        </g>
        <rect x="290" y="128" width="13" height="104" rx="6" fill="url(#tk-roof)" />
        <rect x="290" y="128" width="5" height="104" rx="2.5" fill="#FFFFFF" opacity="0.2" />

        {/* Wheels */}
        <g>
          <ellipse cx="136" cy="300" rx="27" ry="28" fill="#0B0E12" />
          <ellipse cx="136" cy="300" rx="27" ry="28" fill="#FFFFFF" opacity="0.05" />
          <circle cx="136" cy="300" r="13" fill="#6E7885" />
          <circle cx="136" cy="300" r="5" fill="#FFB020" />
        </g>
        <g>
          <ellipse cx="256" cy="310" rx="26" ry="27" fill="#0B0E12" />
          <circle cx="256" cy="310" r="12" fill="#5E6874" />
          <circle cx="256" cy="310" r="4.4" fill="#FFB020" opacity="0.8" />
        </g>
        <g>
          <ellipse cx="374" cy="304" rx="24" ry="25" fill="#0B0E12" />
          <circle cx="374" cy="304" r="11" fill="#4E5865" />
        </g>
        <g>
          <ellipse cx="418" cy="300" rx="23" ry="24" fill="#0B0E12" />
          <circle cx="418" cy="300" r="10" fill="#4E5865" />
        </g>

        {/* Amber roof beacon with sweeping cone */}
        <g style={{ transformOrigin: '137px 120px' }}>
          <g className="spin-slow" style={{ transformOrigin: '137px 120px' }}>
            <path d="M137 120 L98 46 L176 46 Z" fill="url(#tk-cone)" />
          </g>
          <ellipse cx="137" cy="120" rx="34" ry="14" fill="#FFB020" opacity="0.2" filter="url(#tk-soft)" />
          <rect x="116" y="116" width="42" height="10" rx="5" fill="#2A323C" />
          <path d="M119 116a18 18 0 0 1 36 0z" fill="url(#tk-amber)" filter="url(#tk-glow)" />
          <path d="M126 116a11 11 0 0 1 8-10.4c-3 2.6-4.6 6-4.6 10.4z" fill="#FFF6E0" opacity="0.6" />
        </g>
      </g>

      <g clipPath="url(#tk-coneClip)" opacity="0.28">
        <path d="M150 340 L300 352 L300 400 L150 400 Z" fill="#FFB020" opacity="0.10" filter="url(#tk-soft)" />
      </g>
    </svg>
  </div>
);

export default TruckIllustration;
