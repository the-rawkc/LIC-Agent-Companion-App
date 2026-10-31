import React from 'react';

interface AppLogoProps {
  size?: number;
  showText?: boolean;
  className?: string;
}

export function AppLogo({ size = 40, showText = false, className = '' }: AppLogoProps) {
  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 512 512"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 drop-shadow-md select-none transition-transform hover:scale-105 duration-200"
      >
        <defs>
          <linearGradient id="shieldBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#061224" />
            <stop offset="50%" stopColor="#0b1e38" />
            <stop offset="100%" stopColor="#142c4d" />
          </linearGradient>

          <linearGradient id="goldStroke" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="35%" stopColor="#f59e0b" />
            <stop offset="70%" stopColor="#d97706" />
            <stop offset="100%" stopColor="#92400e" />
          </linearGradient>

          <linearGradient id="flameGrad" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="40%" stopColor="#f97316" />
            <stop offset="80%" stopColor="#fde047" />
            <stop offset="100%" stopColor="#ffffff" />
          </linearGradient>

          <linearGradient id="innerGlow" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#1e3a8a" stopOpacity="0" />
          </linearGradient>

          <filter id="goldGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Squircle Outer Base */}
        <rect
          x="16"
          y="16"
          width="480"
          height="480"
          rx="128"
          fill="url(#shieldBg)"
          stroke="url(#goldStroke)"
          strokeWidth="18"
        />

        {/* Ambient Top Glow */}
        <circle cx="256" cy="180" r="160" fill="url(#innerGlow)" />

        {/* Protective Heraldic Outer Shield Contour */}
        <path
          d="M256 64 C352 64, 404 102, 404 200 C404 316, 256 424, 256 440 C256 440, 108 316, 108 200 C108 102, 160 64, 256 64 Z"
          fill="none"
          stroke="url(#goldStroke)"
          strokeWidth="12"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Inner Security Arch */}
        <path
          d="M256 94 C330 94, 374 126, 374 200 C374 290, 256 384, 256 398 C256 398, 138 290, 138 200 C138 126, 182 94, 256 94 Z"
          fill="#0a192f"
          fillOpacity="0.6"
          stroke="#38bdf8"
          strokeWidth="3"
          strokeDasharray="6 6"
        />

        {/* Supporting Hands of Care / Protection (Yogakshemam Vahamyaham) */}
        <path
          d="M168 286 C180 236, 224 212, 256 212 C288 212, 332 236, 344 286 C354 326, 308 358, 256 368 C204 358, 158 326, 168 286 Z"
          fill="#ffffff"
          fillOpacity="0.95"
        />

        {/* Hand detail cuts */}
        <path
          d="M200 300 C216 270, 240 256, 256 256 C272 256, 296 270, 312 300"
          fill="none"
          stroke="#0f2744"
          strokeWidth="6"
          strokeLinecap="round"
        />

        {/* Eternal Flame (Deepam of Security & Trust) */}
        <path
          d="M256 120 C270 156, 292 186, 292 216 C292 242, 276 260, 256 260 C236 260, 220 242, 220 216 C220 186, 242 156, 256 120 Z"
          fill="url(#flameGrad)"
          filter="url(#goldGlow)"
        />

        {/* Inner Flame Core */}
        <path
          d="M256 160 C264 185, 274 202, 274 220 C274 235, 266 245, 256 245 C246 245, 238 235, 238 220 C238 202, 248 185, 256 160 Z"
          fill="#ffffff"
        />

        {/* Star Sparkles of Financial Prosperity */}
        <polygon
          points="184,170 187,178 195,181 187,184 184,192 181,184 173,181 181,178"
          fill="#fbbf24"
        />
        <polygon
          points="328,170 331,178 339,181 331,184 328,192 325,184 317,181 325,178"
          fill="#fbbf24"
        />
      </svg>

      {showText && (
        <div className="flex flex-col leading-none">
          <span className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white flex items-center gap-1">
            <span>LIC</span>
            <span className="text-amber-500 dark:text-amber-400 font-black">Companion</span>
          </span>
          <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 dark:text-slate-500 mt-0.5">
            Agent Digital Workspace
          </span>
        </div>
      )}
    </div>
  );
}
