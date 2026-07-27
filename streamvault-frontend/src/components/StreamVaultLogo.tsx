import type { CSSProperties } from 'react';

interface StreamVaultLogoProps {
  size?: number;
  compact?: boolean;
  className?: string;
}

export default function StreamVaultLogo({
  size = 44,
  compact = false,
  className = '',
}: StreamVaultLogoProps) {
  const markStyle: CSSProperties = {
    width: size,
    height: size,
  };

  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <div className="relative shrink-0" style={markStyle} aria-hidden="true">
        <svg viewBox="0 0 64 64" className="h-full w-full drop-shadow-[0_10px_24px_rgba(255,149,87,0.28)]">
          <defs>
            <linearGradient id="sv-logo-bg" x1="10%" y1="10%" x2="88%" y2="92%">
              <stop offset="0%" stopColor="#FFE8B7" />
              <stop offset="52%" stopColor="#FFC562" />
              <stop offset="100%" stopColor="#FF8358" />
            </linearGradient>
            <linearGradient id="sv-logo-stroke" x1="16%" y1="14%" x2="84%" y2="88%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.88)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.18)" />
            </linearGradient>
          </defs>

          <rect x="4" y="4" width="56" height="56" rx="18" fill="url(#sv-logo-bg)" />
          <rect x="4.5" y="4.5" width="55" height="55" rx="17.5" fill="none" stroke="url(#sv-logo-stroke)" />

          <path
            d="M19 20.5h19.5c4.1 0 7.5 3.4 7.5 7.5v8c0 8.3-5.4 15.6-13.3 18.1a3 3 0 0 1-1.8 0C23.4 51.6 18 44.3 18 36v-8c0-4.1 3.4-7.5 7.5-7.5Z"
            fill="#0A0D13"
            opacity="0.94"
          />
          <path
            d="M26 17.5c0-3.3 2.7-6 6-6s6 2.7 6 6v3h-3v-3a3 3 0 0 0-6 0v3h-3v-3Z"
            fill="#0A0D13"
            opacity="0.82"
          />
          <path d="M30 28.2 39.8 34 30 39.8V28.2Z" fill="#FFC562" />
          <circle cx="32" cy="34" r="11.5" fill="none" stroke="#5AD3FF" strokeOpacity="0.32" strokeWidth="1.8" />
        </svg>
      </div>

      {!compact && (
        <div className="min-w-0 text-left leading-none">
          <span className="block font-display text-[0.95rem] font-bold uppercase tracking-[0.26em] text-[#FFD48C] sm:text-[1rem]">
            StreamVault
          </span>
          <span className="mt-1 block text-[0.62rem] uppercase tracking-[0.3em] text-white/38 sm:text-[0.66rem]">
            Cinema Index
          </span>
        </div>
      )}
    </div>
  );
}