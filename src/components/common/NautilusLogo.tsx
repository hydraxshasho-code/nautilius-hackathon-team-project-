import React, { useState, useEffect } from 'react';
import nautilusLogoImg from '../../assets/images/nautilus_vibrant_logo_1790445860207.jpg';

interface NautilusLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
}

export const NautilusLogo: React.FC<NautilusLogoProps> = ({
  size = 'md',
  showText = true,
  className = '',
}) => {
  const [imgSrc, setImgSrc] = useState<string>(nautilusLogoImg || '/nautilus_vibrant_logo_1790445860207.jpg');
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
    setImgSrc(nautilusLogoImg || '/nautilus_vibrant_logo_1790445860207.jpg');
  }, [size]);

  const handleImageError = () => {
    if (imgSrc !== '/nautilus_vibrant_logo_1790445860207.jpg') {
      setImgSrc('/nautilus_vibrant_logo_1790445860207.jpg');
    } else {
      setImageFailed(true);
    }
  };

  const sizeMap = {
    sm: { box: 'w-7 h-7', icon: 18, text: 'text-sm', sub: 'text-[8px]' },
    md: { box: 'w-10 h-10', icon: 24, text: 'text-base', sub: 'text-[9px]' },
    lg: { box: 'w-12 h-12', icon: 30, text: 'text-lg', sub: 'text-[10px]' },
    xl: { box: 'w-16 h-16', icon: 40, text: 'text-2xl', sub: 'text-xs' },
  };

  const current = sizeMap[size];

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Vibrant Glowing Nautilus Emblem */}
      <div className="relative group shrink-0">
        {/* Multi-layered dynamic neon ambient glow */}
        <div className="absolute -inset-1.5 bg-gradient-to-r from-cyan-400 via-teal-300 to-blue-600 rounded-2xl blur-md opacity-80 group-hover:opacity-100 group-hover:blur-lg transition duration-700 animate-pulse" />
        <div className="absolute -inset-0.5 bg-cyan-400/40 rounded-xl blur-xs" />

        {/* Core emblem container */}
        <div
          className={`relative ${current.box} rounded-xl overflow-hidden border border-cyan-300/80 shadow-2xl shadow-cyan-500/50 bg-slate-950 flex items-center justify-center`}
        >
          {/* High-res bundled vibrant emblem image */}
          {!imageFailed ? (
            <img
              src={imgSrc}
              alt="NAUTILUS Logo"
              className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500"
              onError={handleImageError}
            />
          ) : (
            /* Standalone Gorgeous Vector Nautilus Spiral Shell & Tactical Reticle */
            <svg viewBox="0 0 100 100" className="w-full h-full p-1" fill="none">
              <defs>
                <linearGradient id="nautilusGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#22d3ee" />
                  <stop offset="50%" stopColor="#14b8a6" />
                  <stop offset="100%" stopColor="#0284c7" />
                </linearGradient>
              </defs>
              {/* Tactical outer radar circles */}
              <circle cx="50" cy="50" r="45" stroke="#00f0ff" strokeWidth="2" strokeDasharray="4 2" />
              <circle cx="50" cy="50" r="34" stroke="#06b6d4" strokeWidth="1.5" strokeOpacity="0.6" />
              <circle cx="50" cy="50" r="20" stroke="#14b8a6" strokeWidth="1" strokeOpacity="0.8" />
              {/* Nautilus golden logarithmic spiral chambers */}
              <path
                d="M 50 50 A 5 5 0 0 1 55 50 A 10 10 0 0 1 45 60 A 18 18 0 0 1 32 45 A 28 28 0 0 1 50 22 A 40 40 0 0 1 85 55"
                stroke="url(#nautilusGrad)"
                strokeWidth="4"
                strokeLinecap="round"
              />
              <path
                d="M 50 50 A 4 4 0 0 1 54 50 A 8 8 0 0 1 46 58 A 14 14 0 0 1 36 46 A 22 22 0 0 1 50 28"
                stroke="#67e8f9"
                strokeWidth="2"
                strokeLinecap="round"
                opacity="0.8"
              />
              {/* Crosshair reticle ticks */}
              <line x1="50" y1="2" x2="50" y2="10" stroke="#22d3ee" strokeWidth="2.5" />
              <line x1="50" y1="90" x2="50" y2="98" stroke="#22d3ee" strokeWidth="2.5" />
              <line x1="2" y1="50" x2="10" y2="50" stroke="#22d3ee" strokeWidth="2.5" />
              <line x1="90" y1="50" x2="98" y2="50" stroke="#22d3ee" strokeWidth="2.5" />
              <circle cx="50" cy="50" r="3" fill="#38bdf8" />
            </svg>
          )}

          {/* Rotating tactical sweep line */}
          <div
            className="absolute inset-0 border border-cyan-400/30 rounded-xl pointer-events-none animate-spin"
            style={{ animationDuration: '12s' }}
          />
        </div>
      </div>

      {showText && (
        <div className="flex flex-col justify-center">
          <div className="flex items-center gap-1.5">
            <span
              className={`font-black ${current.text} tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-teal-200 to-white drop-shadow-[0_0_12px_rgba(6,182,212,0.4)]`}
            >
              NAUTILUS
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
          </div>
          <span
            className={`${current.sub} font-mono text-cyan-400 tracking-[0.25em] leading-none font-bold uppercase`}
          >
            MARITIME COMMAND
          </span>
        </div>
      )}
    </div>
  );
};
