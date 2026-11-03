import React from 'react';

// Ornate Golden Corner Filigree (SVG for all 4 corners)
export function OrnateCorner({ className = '', position = 'top-left' }: { className?: string; position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' }) {
  const rotation = {
    'top-left': '',
    'top-right': 'scale-x-[-1]',
    'bottom-left': 'scale-y-[-1]',
    'bottom-right': 'scale-x-[-1] scale-y-[-1]',
  }[position];

  return (
    <svg
      viewBox="0 0 100 100"
      className={`w-14 h-14 sm:w-18 sm:h-18 absolute pointer-events-none drop-shadow-sm ${rotation} ${className}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Outer corner frame */}
      <path d="M6 94 V20 C6 12 12 6 20 6 H94" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M14 94 V24 C14 18 18 14 24 14 H94" stroke="#f59e0b" strokeWidth="1" strokeOpacity="0.7" strokeDasharray="3 3" />
      {/* Royal corner petal/leaf motif */}
      <circle cx="10" cy="10" r="3" fill="#fef08a" />
      <path d="M6 30 C18 30 30 18 30 6" stroke="#fbbf24" strokeWidth="2" fill="none" />
      <path d="M6 46 C28 46 46 28 46 6" stroke="#fbbf24" strokeWidth="1.5" strokeOpacity="0.6" fill="none" />
      <circle cx="28" cy="28" r="4" fill="#f59e0b" />
      <circle cx="28" cy="28" r="2" fill="#fff" />
    </svg>
  );
}

// Hanging Festoon / Toran Garland across the top
export function HangingFestoon() {
  return (
    <svg
      viewBox="0 0 600 60"
      className="w-full h-10 sm:h-12 absolute top-0 left-0 right-0 pointer-events-none opacity-80"
      preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Scalloped marigold garland string */}
      <path d="M0,5 Q75,45 150,5 Q225,45 300,5 Q375,45 450,5 Q525,45 600,5" fill="none" stroke="#f59e0b" strokeWidth="3" />
      <path d="M0,10 Q75,50 150,10 Q225,50 300,10 Q375,50 450,10 Q525,50 600,10" fill="none" stroke="#ea580c" strokeWidth="2" strokeDasharray="4 4" />
      {/* Hanging golden bells & beads */}
      {[75, 225, 375, 525].map((x, i) => (
        <g key={i}>
          <line x1={x} y1="28" x2={x} y2="44" stroke="#fbbf24" strokeWidth="1.5" />
          <circle cx={x} cy="48" r="4.5" fill="#fef08a" stroke="#d97706" strokeWidth="1" />
        </g>
      ))}
      {[150, 300, 450].map((x, i) => (
        <g key={`leaf-${i}`}>
          <polygon points={`${x-6},5 ${x+6},5 ${x},20`} fill="#16a34a" />
        </g>
      ))}
    </svg>
  );
}

// Detailed Festival Hero Artwork Components for Live Preview
export function FestivalArtworkImage({ themeId }: { themeId: string }) {
  switch (themeId) {
    case 'diwali':
      return (
        <div className="relative w-44 h-44 sm:w-52 sm:h-52 mx-auto flex items-center justify-center">
          {/* Radiant mandala background */}
          <div className="absolute inset-0 rounded-full bg-radial from-amber-400/25 via-amber-600/10 to-transparent animate-pulse" />
          <svg viewBox="0 0 200 200" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <radialGradient id="diwaliGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#fef08a" stopOpacity="0.9" />
                <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#d97706" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="flameGrad" x1="50%" y1="0%" x2="50%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="25%" stopColor="#fef08a" />
                <stop offset="60%" stopColor="#f97316" />
                <stop offset="100%" stopColor="#dc2626" />
              </linearGradient>
              <linearGradient id="brassBase" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fef08a" />
                <stop offset="35%" stopColor="#d97706" />
                <stop offset="70%" stopColor="#92400e" />
                <stop offset="100%" stopColor="#78350f" />
              </linearGradient>
            </defs>

            {/* Rangoli Star Petals */}
            <g opacity="0.45" stroke="#fbbf24" strokeWidth="1.2" fill="none">
              <circle cx="100" cy="100" r="82" strokeDasharray="3 3" />
              <circle cx="100" cy="100" r="70" />
              {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
                <circle
                  key={deg}
                  cx={100 + 70 * Math.cos((deg * Math.PI) / 180)}
                  cy={100 + 70 * Math.sin((deg * Math.PI) / 180)}
                  r="5"
                  fill="#fbbf24"
                />
              ))}
            </g>

            {/* Glowing Diya Flame Halo */}
            <circle cx="100" cy="80" r="45" fill="url(#diwaliGlow)" />

            {/* Main Center Diya Base */}
            <path
              d="M40 125 C45 155 155 155 160 125 C145 132 120 135 100 135 C80 135 55 132 40 125 Z"
              fill="url(#brassBase)"
              stroke="#fbbf24"
              strokeWidth="2"
            />
            {/* Diya Rim Ornament */}
            <path
              d="M38 123 Q100 142 162 123 Q100 130 38 123 Z"
              fill="#fbbf24"
              stroke="#b45309"
              strokeWidth="1"
            />

            {/* Diya Flame */}
            <path
              d="M100 45 C115 70 120 95 100 108 C80 95 85 70 100 45 Z"
              fill="url(#flameGrad)"
              className="drop-shadow-[0_0_12px_#f59e0b]"
            />
            {/* Flame Inner Core */}
            <path
              d="M100 60 C108 76 110 90 100 98 C90 90 92 76 100 60 Z"
              fill="#ffffff"
            />

            {/* Side Small Diyas */}
            <g transform="translate(18, 20) scale(0.65)">
              <circle cx="35" cy="115" r="20" fill="url(#diwaliGlow)" />
              <path d="M15 130 C20 148 50 148 55 130 Z" fill="url(#brassBase)" />
              <path d="M35 105 C42 118 42 126 35 130 C28 126 28 118 35 105 Z" fill="url(#flameGrad)" />
            </g>
            <g transform="translate(125, 20) scale(0.65)">
              <circle cx="35" cy="115" r="20" fill="url(#diwaliGlow)" />
              <path d="M15 130 C20 148 50 148 55 130 Z" fill="url(#brassBase)" />
              <path d="M35 105 C42 118 42 126 35 130 C28 126 28 118 35 105 Z" fill="url(#flameGrad)" />
            </g>

            {/* Floating Sparkles */}
            <circle cx="45" cy="60" r="2" fill="#fff" className="animate-ping" />
            <circle cx="155" cy="55" r="2.5" fill="#fef08a" />
            <circle cx="170" cy="95" r="1.5" fill="#fde047" />
            <circle cx="30" cy="90" r="2" fill="#fef08a" />
          </svg>
        </div>
      );

    case 'new_year':
      return (
        <div className="relative w-44 h-44 sm:w-52 sm:h-52 mx-auto flex items-center justify-center">
          <svg viewBox="0 0 200 200" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <radialGradient id="nyGold" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#fef08a" />
                <stop offset="100%" stopColor="#ca8a04" />
              </radialGradient>
            </defs>

            {/* Spectacular Fireworks Bursts */}
            {/* Burst 1: Center Gold */}
            <g transform="translate(100, 65)">
              {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
                <line
                  key={deg}
                  x1="0"
                  y1="0"
                  x2={38 * Math.cos((deg * Math.PI) / 180)}
                  y2={38 * Math.sin((deg * Math.PI) / 180)}
                  stroke="#fbbf24"
                  strokeWidth="2"
                  strokeDasharray="4 2"
                />
              ))}
              <circle cx="0" cy="0" r="6" fill="#ffffff" />
            </g>

            {/* Burst 2: Left Cyan */}
            <g transform="translate(45, 45)">
              {[15, 60, 105, 150, 195, 240, 285, 330].map((deg) => (
                <line
                  key={deg}
                  x1="0"
                  y1="0"
                  x2={24 * Math.cos((deg * Math.PI) / 180)}
                  y2={24 * Math.sin((deg * Math.PI) / 180)}
                  stroke="#38bdf8"
                  strokeWidth="1.8"
                />
              ))}
            </g>

            {/* Burst 3: Right Magenta */}
            <g transform="translate(160, 50)">
              {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
                <line
                  key={deg}
                  x1="0"
                  y1="0"
                  x2={26 * Math.cos((deg * Math.PI) / 180)}
                  y2={26 * Math.sin((deg * Math.PI) / 180)}
                  stroke="#f43f5e"
                  strokeWidth="1.8"
                />
              ))}
            </g>

            {/* Golden 2027 Celebration Emblem */}
            <rect x="42" y="125" width="116" height="42" rx="12" fill="#0f172a" stroke="#fbbf24" strokeWidth="2.5" />
            <text x="100" y="154" fill="url(#nyGold)" fontSize="26" fontWeight="900" fontFamily="sans-serif" textAnchor="middle" letterSpacing="4">
              2027
            </text>

            {/* Champagne stars */}
            <polygon points="100,105 103,115 113,115 105,121 108,131 100,125 92,131 95,121 87,115 97,115" fill="#fef08a" />
            <circle cx="30" cy="110" r="3" fill="#fef08a" />
            <circle cx="170" cy="115" r="3" fill="#38bdf8" />
            <circle cx="75" cy="115" r="2" fill="#f43f5e" />
            <circle cx="125" cy="115" r="2" fill="#fbbf24" />
          </svg>
        </div>
      );

    case 'holi':
      return (
        <div className="relative w-44 h-44 sm:w-52 sm:h-52 mx-auto flex items-center justify-center">
          <svg viewBox="0 0 200 200" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <radialGradient id="pinkCloud" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="yellowCloud" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#facc15" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#facc15" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="cyanCloud" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="purpleCloud" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#a855f7" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Vibrant Gulal Powder Clouds */}
            <circle cx="65" cy="70" r="42" fill="url(#pinkCloud)" />
            <circle cx="135" cy="65" r="45" fill="url(#yellowCloud)" />
            <circle cx="85" cy="120" r="45" fill="url(#cyanCloud)" />
            <circle cx="140" cy="125" r="40" fill="url(#purpleCloud)" />

            {/* Splash Droplets */}
            {[
              [40, 45, 6, '#f43f5e'],
              [160, 40, 7, '#facc15'],
              [35, 120, 5, '#06b6d4'],
              [170, 110, 6, '#a855f7'],
              [100, 35, 5, '#ec4899'],
              [50, 150, 4, '#10b981'],
              [155, 160, 5, '#f59e0b'],
            ].map(([cx, cy, r, fill], idx) => (
              <circle key={idx} cx={Number(cx)} cy={Number(cy)} r={Number(r)} fill={String(fill)} />
            ))}

            {/* Ornate Golden Pichkari (Water Gun) */}
            <g transform="translate(30, 115) rotate(-35)">
              <rect x="0" y="0" width="110" height="18" rx="6" fill="#fbbf24" stroke="#78350f" strokeWidth="2" />
              <rect x="15" y="-3" width="12" height="24" rx="2" fill="#f59e0b" />
              <rect x="45" y="-3" width="12" height="24" rx="2" fill="#f59e0b" />
              <rect x="75" y="-3" width="12" height="24" rx="2" fill="#f59e0b" />
              <polygon points="110,3 125,9 110,15" fill="#f59e0b" stroke="#78350f" strokeWidth="1.5" />
              <rect x="-25" y="5" width="25" height="8" fill="#d97706" />
              <circle cx="-25" cy="9" r="7" fill="#fbbf24" stroke="#78350f" strokeWidth="1.5" />
            </g>
          </svg>
        </div>
      );

    case 'dussehra':
      return (
        <div className="relative w-44 h-44 sm:w-52 sm:h-52 mx-auto flex items-center justify-center">
          <svg viewBox="0 0 200 200" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <radialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#fef08a" stopOpacity="0.8" />
                <stop offset="60%" stopColor="#ea580c" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#7c2d12" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Radiant Sun of Victory */}
            <circle cx="100" cy="100" r="70" fill="url(#sunGlow)" />
            <circle cx="100" cy="100" r="38" fill="#fbbf24" stroke="#ea580c" strokeWidth="2.5" />
            {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
              <line
                key={deg}
                x1={100 + 44 * Math.cos((deg * Math.PI) / 180)}
                y1={100 + 44 * Math.sin((deg * Math.PI) / 180)}
                x2={100 + 58 * Math.cos((deg * Math.PI) / 180)}
                y2={100 + 58 * Math.sin((deg * Math.PI) / 180)}
                stroke="#f59e0b"
                strokeWidth="3"
                strokeLinecap="round"
              />
            ))}

            {/* Lord Rama's Golden Bow (Kodanda Dhanush) */}
            <path
              d="M35 155 Q10 100 35 45"
              stroke="#fbbf24"
              strokeWidth="6"
              fill="none"
              strokeLinecap="round"
              className="drop-shadow-md"
            />
            {/* Bow String */}
            <line x1="35" y1="45" x2="35" y2="155" stroke="#fef08a" strokeWidth="2" strokeDasharray="3 2" />

            {/* Drawn Arrow of Truth */}
            <line x1="20" y1="100" x2="165" y2="100" stroke="#fef08a" strokeWidth="3.5" />
            <polygon points="175,100 155,93 155,107" fill="#f59e0b" stroke="#78350f" strokeWidth="1" />
            {/* Fiery Arrowhead Tip */}
            <circle cx="178" cy="100" r="6" fill="#facc15" className="animate-ping" />
          </svg>
        </div>
      );

    case 'ganesh_chaturthi':
      return (
        <div className="relative w-44 h-44 sm:w-52 sm:h-52 mx-auto flex items-center justify-center">
          <svg viewBox="0 0 200 200" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <radialGradient id="ganeshGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#fef08a" stopOpacity="0.8" />
                <stop offset="60%" stopColor="#f97316" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#7c2d12" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Divine Aura */}
            <circle cx="100" cy="95" r="70" fill="url(#ganeshGlow)" />

            {/* Lord Ganesha Divine Silhouette / Face Contour */}
            {/* Mukut (Golden Crown) */}
            <polygon points="100,25 118,55 82,55" fill="#fbbf24" stroke="#b45309" strokeWidth="2" />
            <rect x="75" y="55" width="50" height="8" rx="2" fill="#f59e0b" />
            <circle cx="100" cy="38" r="4" fill="#dc2626" />

            {/* Divine Ears */}
            <path d="M75 60 C40 60 40 95 72 105" stroke="#fbbf24" strokeWidth="4.5" fill="none" strokeLinecap="round" />
            <path d="M125 60 C160 60 160 95 128 105" stroke="#fbbf24" strokeWidth="4.5" fill="none" strokeLinecap="round" />

            {/* Tilak on Forehead */}
            <path d="M92 68 Q100 78 108 68" stroke="#dc2626" strokeWidth="3" fill="none" />
            <circle cx="100" cy="73" r="3" fill="#fbbf24" />

            {/* Sacred Curved Trunk with Modak */}
            <path
              d="M100 78 C90 95 86 115 92 135 C95 145 106 150 114 142 C120 135 116 122 106 120"
              stroke="#fbbf24"
              strokeWidth="5"
              fill="none"
              strokeLinecap="round"
            />
            {/* Golden Modak in Trunk */}
            <path d="M106 118 C103 112 112 110 114 116 Z" fill="#fef08a" stroke="#d97706" strokeWidth="1.5" />

            {/* Abhaya Mudra Blessing Hand */}
            <circle cx="140" cy="125" r="14" fill="#f59e0b" stroke="#fbbf24" strokeWidth="2" />
            <text x="140" y="130" fill="#78350f" fontSize="14" fontWeight="bold" textAnchor="middle">ॐ</text>

            {/* Red Hibiscus Flower */}
            <circle cx="60" cy="145" r="8" fill="#dc2626" />
            <circle cx="60" cy="145" r="3" fill="#facc15" />
          </svg>
        </div>
      );

    case 'shivratri':
      return (
        <div className="relative w-44 h-44 sm:w-52 sm:h-52 mx-auto flex items-center justify-center">
          <svg viewBox="0 0 200 200" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            {/* Cosmic Aura */}
            <circle cx="100" cy="95" r="68" fill="#38bdf8" fillOpacity="0.15" />

            {/* Holy Golden Crescent Moon (Chandra) */}
            <path d="M130 40 A22 22 0 1 0 148 68 A26 26 0 1 1 130 40 Z" fill="#fef08a" className="drop-shadow-sm" />

            {/* Lord Shiva Holy Trishul (Trident) */}
            {/* Main Staff */}
            <line x1="100" y1="40" x2="100" y2="175" stroke="#fbbf24" strokeWidth="5" strokeLinecap="round" />
            {/* Center Spear Tip */}
            <polygon points="100,20 92,45 108,45" fill="#fef08a" stroke="#b45309" strokeWidth="1.5" />
            {/* Outer Curved Prongs */}
            <path d="M70 48 Q70 85 100 85 Q130 85 130 48" stroke="#fbbf24" strokeWidth="4.5" fill="none" strokeLinecap="round" />
            <polygon points="70,42 64,56 76,56" fill="#fef08a" />
            <polygon points="130,42 124,56 136,56" fill="#fef08a" />

            {/* Holy Damru */}
            <g transform="translate(100, 110)">
              <polygon points="-16,-12 16,-12 0,0" fill="#ea580c" stroke="#78350f" strokeWidth="1" />
              <polygon points="-16,12 16,12 0,0" fill="#ea580c" stroke="#78350f" strokeWidth="1" />
              <line x1="-16" y1="-12" x2="16" y2="-12" stroke="#fbbf24" strokeWidth="2" />
              <line x1="-16" y1="12" x2="16" y2="12" stroke="#fbbf24" strokeWidth="2" />
              <circle cx="0" cy="0" r="3" fill="#ffffff" />
            </g>

            {/* Sacred Tripundra & Third Eye */}
            <g transform="translate(100, 72)">
              <line x1="-12" y1="-4" x2="12" y2="-4" stroke="#ffffff" strokeWidth="2" />
              <line x1="-14" y1="0" x2="14" y2="0" stroke="#ffffff" strokeWidth="2" />
              <line x1="-12" y1="4" x2="12" y2="4" stroke="#ffffff" strokeWidth="2" />
              <circle cx="0" cy="0" r="2.5" fill="#dc2626" />
            </g>

            {/* Sacred Green Bilva Leaf */}
            <g transform="translate(48, 130) scale(0.9)">
              <ellipse cx="12" cy="0" rx="9" ry="6" fill="#16a34a" />
              <ellipse cx="0" cy="10" rx="6" ry="9" fill="#16a34a" />
              <ellipse cx="24" cy="10" rx="6" ry="9" fill="#16a34a" />
            </g>
          </svg>
        </div>
      );

    case 'raksha_bandhan':
      return (
        <div className="relative w-44 h-44 sm:w-52 sm:h-52 mx-auto flex items-center justify-center">
          <svg viewBox="0 0 200 200" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            {/* Flowing Silk Rakhi Threads */}
            <path d="M10 100 Q60 85 80 100" stroke="#dc2626" strokeWidth="4" fill="none" />
            <path d="M10 105 Q60 115 80 102" stroke="#fbbf24" strokeWidth="3" fill="none" />
            <path d="M120 100 Q140 85 190 100" stroke="#dc2626" strokeWidth="4" fill="none" />
            <path d="M120 102 Q140 115 190 105" stroke="#fbbf24" strokeWidth="3" fill="none" />

            {/* Tassels */}
            <circle cx="15" cy="102" r="5" fill="#fbbf24" />
            <circle cx="185" cy="102" r="5" fill="#fbbf24" />

            {/* Ornate Circular Rakhi Medallion */}
            <circle cx="100" cy="100" r="44" fill="#fbbf24" stroke="#b45309" strokeWidth="2" />
            <circle cx="100" cy="100" r="36" fill="#dc2626" />

            {/* Golden Pearl Ring */}
            {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
              <circle
                key={deg}
                cx={100 + 40 * Math.cos((deg * Math.PI) / 180)}
                cy={100 + 40 * Math.sin((deg * Math.PI) / 180)}
                r="3.5"
                fill="#fef08a"
                stroke="#d97706"
                strokeWidth="0.8"
              />
            ))}

            {/* Center Golden Filigree Flower & Ruby */}
            <circle cx="100" cy="100" r="22" fill="#f59e0b" stroke="#fef08a" strokeWidth="1.5" />
            <circle cx="100" cy="100" r="12" fill="#991b1b" stroke="#fef08a" strokeWidth="2" />
            <circle cx="97" cy="97" r="3" fill="#ffffff" />
          </svg>
        </div>
      );

    case 'eid':
      return (
        <div className="relative w-44 h-44 sm:w-52 sm:h-52 mx-auto flex items-center justify-center">
          <svg viewBox="0 0 200 200" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            {/* Glowing Golden Crescent Moon (Hilal) */}
            <path
              d="M110 30 A52 52 0 1 0 148 115 A60 60 0 1 1 110 30 Z"
              fill="#fbbf24"
              stroke="#fef08a"
              strokeWidth="2"
              className="drop-shadow-[0_0_15px_rgba(251,191,36,0.6)]"
            />
            {/* Sparkling Star */}
            <polygon points="120,65 124,78 138,78 127,86 131,100 120,91 109,100 113,86 102,78 116,78" fill="#fef08a" />

            {/* Hanging Traditional Fanoos (Lantern) */}
            <g transform="translate(50, 20)">
              <line x1="20" y1="0" x2="20" y2="45" stroke="#fbbf24" strokeWidth="1.5" />
              <polygon points="12,45 28,45 24,55 16,55" fill="#f59e0b" />
              <rect x="10" y="55" width="20" height="28" rx="4" fill="#047857" stroke="#fbbf24" strokeWidth="2" />
              <circle cx="20" cy="69" r="6" fill="#fef08a" className="animate-pulse" />
              <polygon points="14,83 26,83 20,92" fill="#f59e0b" />
            </g>

            <g transform="translate(130, 75) scale(0.8)">
              <line x1="20" y1="0" x2="20" y2="35" stroke="#fbbf24" strokeWidth="1.5" />
              <rect x="10" y="35" width="20" height="25" rx="3" fill="#047857" stroke="#fbbf24" strokeWidth="2" />
              <circle cx="20" cy="47" r="5" fill="#fef08a" />
            </g>

            {/* Twinkling stars */}
            <circle cx="35" cy="40" r="1.5" fill="#fef08a" />
            <circle cx="170" cy="50" r="2" fill="#fff" />
            <circle cx="65" cy="140" r="2" fill="#fef08a" />
          </svg>
        </div>
      );

    case 'republic_day':
      return (
        <div className="relative w-44 h-44 sm:w-52 sm:h-52 mx-auto flex items-center justify-center">
          <svg viewBox="0 0 200 200" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            {/* Flowing Indian Tricolor Ribbon Waves */}
            <path d="M15 65 Q60 35 100 65 Q140 95 185 65 L185 95 Q140 125 100 95 Q60 65 15 95 Z" fill="#f97316" />
            <path d="M15 95 Q60 65 100 95 Q140 125 185 95 L185 125 Q140 155 100 125 Q60 95 15 125 Z" fill="#ffffff" />
            <path d="M15 125 Q60 95 100 125 Q140 155 185 125 L185 155 Q140 185 100 155 Q60 125 15 155 Z" fill="#16a34a" />

            {/* Ashoka Chakra in White Band */}
            <g transform="translate(100, 110)">
              <circle cx="0" cy="0" r="17" stroke="#1e3a8a" strokeWidth="2" fill="none" />
              <circle cx="0" cy="0" r="3" fill="#1e3a8a" />
              {[0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, 195, 210, 225, 240, 255, 270, 285, 300, 315, 330, 345].map((deg) => (
                <line
                  key={deg}
                  x1="0"
                  y1="0"
                  x2={17 * Math.cos((deg * Math.PI) / 180)}
                  y2={17 * Math.sin((deg * Math.PI) / 180)}
                  stroke="#1e3a8a"
                  strokeWidth="1.2"
                />
              ))}
            </g>

            {/* White Peace Dove flying */}
            <g transform="translate(40, 30) scale(0.7)">
              <path d="M10 20 Q25 0 45 10 Q35 25 25 25 Q15 30 10 20 Z" fill="#ffffff" />
              <circle cx="40" cy="12" r="1.5" fill="#1e293b" />
            </g>
          </svg>
        </div>
      );

    case 'makar_sankranti':
      return (
        <div className="relative w-44 h-44 sm:w-52 sm:h-52 mx-auto flex items-center justify-center">
          <svg viewBox="0 0 200 200" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            {/* Radiant Sun */}
            <circle cx="150" cy="50" r="28" fill="#facc15" stroke="#f59e0b" strokeWidth="2" />

            {/* Soaring Colorful Kites (Patang) */}
            {/* Kite 1: Main Red & Yellow */}
            <g transform="translate(75, 45) rotate(25)">
              <polygon points="0,-35 30,0 0,35 -30,0" fill="#dc2626" stroke="#fbbf24" strokeWidth="2" />
              <polygon points="0,-35 0,35 -30,0" fill="#f59e0b" />
              <line x1="0" y1="-35" x2="0" y2="35" stroke="#fef08a" strokeWidth="2" />
              <path d="M-30 0 Q0 -15 30 0" stroke="#fef08a" strokeWidth="2" fill="none" />
              <polygon points="0,35 -8,48 8,48" fill="#f59e0b" />
              {/* String / Manjha */}
              <path d="M0 35 Q-20 70 -50 110" stroke="#fef08a" strokeWidth="1.5" strokeDasharray="3 3" fill="none" />
            </g>

            {/* Kite 2: Green & Cyan */}
            <g transform="translate(145, 120) rotate(-20) scale(0.65)">
              <polygon points="0,-35 30,0 0,35 -30,0" fill="#0284c7" stroke="#fbbf24" strokeWidth="2" />
              <polygon points="0,-35 0,35 -30,0" fill="#16a34a" />
              <polygon points="0,35 -8,48 8,48" fill="#fbbf24" />
            </g>

            {/* Wooden Firki / Thread Spool */}
            <g transform="translate(45, 145) rotate(15)">
              <rect x="0" y="0" width="36" height="12" rx="3" fill="#ea580c" />
              <rect x="8" y="-4" width="20" height="20" rx="2" fill="#ffffff" stroke="#d97706" strokeWidth="1.5" />
              <line x1="12" y1="-4" x2="12" y2="16" stroke="#dc2626" strokeWidth="2" />
              <line x1="18" y1="-4" x2="18" y2="16" stroke="#f59e0b" strokeWidth="2" />
              <line x1="24" y1="-4" x2="24" y2="16" stroke="#dc2626" strokeWidth="2" />
            </g>
          </svg>
        </div>
      );

    case 'birthday':
      return (
        <div className="relative w-44 h-44 sm:w-52 sm:h-52 mx-auto flex items-center justify-center">
          <svg viewBox="0 0 200 200" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            {/* Floating Glossy Colorful Balloons */}
            {/* Balloon 1: Gold */}
            <g transform="translate(60, 45)">
              <ellipse cx="0" cy="0" rx="22" ry="28" fill="#fbbf24" stroke="#d97706" strokeWidth="1.5" />
              <ellipse cx="-7" cy="-10" rx="5" ry="9" fill="#ffffff" fillOpacity="0.4" />
              <polygon points="-3,28 3,28 0,34" fill="#d97706" />
              <path d="M0 34 Q5 60 -10 90" stroke="#fef08a" strokeWidth="1.2" fill="none" />
            </g>

            {/* Balloon 2: Magenta */}
            <g transform="translate(135, 40)">
              <ellipse cx="0" cy="0" rx="24" ry="30" fill="#ec4899" stroke="#be185d" strokeWidth="1.5" />
              <ellipse cx="-7" cy="-10" rx="5" ry="10" fill="#ffffff" fillOpacity="0.4" />
              <polygon points="-3,30 3,30 0,36" fill="#be185d" />
              <path d="M0 36 Q-8 65 15 95" stroke="#f472b6" strokeWidth="1.2" fill="none" />
            </g>

            {/* Balloon 3: Royal Blue */}
            <g transform="translate(100, 30)">
              <ellipse cx="0" cy="0" rx="22" ry="28" fill="#3b82f6" stroke="#1d4ed8" strokeWidth="1.5" />
              <ellipse cx="-7" cy="-10" rx="5" ry="9" fill="#ffffff" fillOpacity="0.4" />
              <polygon points="-3,28 3,28 0,34" fill="#1d4ed8" />
              <path d="M0 34 Q-5 60 5 95" stroke="#60a5fa" strokeWidth="1.2" fill="none" />
            </g>

            {/* Two-Tier Celebration Birthday Cake with Candle */}
            {/* Bottom tier */}
            <rect x="55" y="130" width="90" height="30" rx="6" fill="#f8fafc" stroke="#fbbf24" strokeWidth="2" />
            <path d="M55 140 Q77 148 100 140 Q122 148 145 140" stroke="#f43f5e" strokeWidth="3" fill="none" />
            {/* Top tier */}
            <rect x="70" y="105" width="60" height="26" rx="5" fill="#f8fafc" stroke="#fbbf24" strokeWidth="2" />
            <path d="M70 114 Q85 120 100 114 Q115 120 130 114" stroke="#f43f5e" strokeWidth="3" fill="none" />
            {/* Candle & Flame */}
            <rect x="97" y="88" width="6" height="17" fill="#fbbf24" />
            <path d="M100 75 C104 82 104 86 100 88 C96 86 96 82 100 75 Z" fill="#f97316" className="animate-pulse" />
            <circle cx="100" cy="80" r="2" fill="#fff" />
          </svg>
        </div>
      );

    case 'lic_trust':
    default:
      return (
        <div className="relative w-44 h-44 sm:w-52 sm:h-52 mx-auto flex items-center justify-center">
          <svg viewBox="0 0 200 200" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            {/* Radiant Protective Shield */}
            <path
              d="M100 25 L160 50 C160 115 125 155 100 170 C75 155 40 115 40 50 Z"
              fill="#1e3a8a"
              stroke="#fbbf24"
              strokeWidth="3.5"
              className="drop-shadow-lg"
            />
            {/* Inner Shield */}
            <path
              d="M100 35 L150 56 C150 110 120 144 100 156 C80 144 50 110 50 56 Z"
              fill="#0f172a"
              stroke="#f59e0b"
              strokeWidth="1.5"
            />

            {/* Glowing Hands of Protection (LIC Symbolism) */}
            {/* Left Protective Palm */}
            <path
              d="M65 120 C70 95 90 90 98 102 C90 112 80 120 72 132 Z"
              fill="#fbbf24"
              stroke="#b45309"
              strokeWidth="1.5"
            />
            {/* Right Protective Palm */}
            <path
              d="M135 120 C130 95 110 90 102 102 C110 112 120 120 128 132 Z"
              fill="#fbbf24"
              stroke="#b45309"
              strokeWidth="1.5"
            />

            {/* Happy Protected Family Silhouette */}
            {/* Father & Mother */}
            <circle cx="92" cy="74" r="6" fill="#fef08a" />
            <circle cx="108" cy="76" r="5.5" fill="#fef08a" />
            <path d="M84 94 C84 83 100 83 100 94 Z" fill="#fef08a" />
            <path d="M100 94 C100 85 116 85 116 94 Z" fill="#fef08a" />
            {/* Child */}
            <circle cx="100" cy="85" r="4" fill="#38bdf8" />
            <path d="M94 98 C94 91 106 91 106 98 Z" fill="#38bdf8" />

            {/* Golden Star of Security */}
            <polygon points="100,42 102,48 108,48 103,52 105,58 100,54 95,58 97,52 92,48 98,48" fill="#fef08a" />
          </svg>
        </div>
      );
  }
}
