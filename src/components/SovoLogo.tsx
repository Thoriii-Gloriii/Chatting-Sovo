import React from "react";

interface SovoLogoProps {
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "hero";
  className?: string;
  showText?: boolean;
  withGlow?: boolean;
  animated?: boolean;
}

export const SovoLogo: React.FC<SovoLogoProps> = ({
  size = "md", className = "", showText = false, withGlow = true, animated = false,
}) => {
  const sizeMap = { sm: "w-7 h-7", md: "w-10 h-10", lg: "w-14 h-14", xl: "w-20 h-20", "2xl": "w-28 h-28", hero: "w-36 h-36" };
  const textMap = { sm: "text-lg", md: "text-xl", lg: "text-2xl", xl: "text-3xl", "2xl": "text-4xl", hero: "text-5xl" };

  return (
    <div className={`inline-flex items-center gap-3 ${className}`} id="sovo-brand-logo">
      <div className={`relative flex items-center justify-center flex-shrink-0 ${sizeMap[size]}`}>
        {withGlow && (
          <div className={`absolute inset-0 rounded-full bg-[#d4af37]/20 blur-xl ${animated ? "animate-pulse" : ""}`} />
        )}
        <img
          src="/sovo-logo.jpg"
          alt="S'ovo Logo"
          className={`relative z-10 w-full h-full object-contain drop-shadow-[0_8px_24px_rgba(0,0,0,0.9)] ${animated ? "hover:scale-105 transition-transform duration-300" : ""}`}
          onError={(e) => {
            const target = e.currentTarget;
            target.style.display = "none";
            const fb = target.parentElement?.querySelector(".logo-svg-fallback") as HTMLElement | null;
            if (fb) fb.style.display = "flex";
          }}
        />
        {/* SVG fallback */}
        <div className="logo-svg-fallback hidden absolute inset-0 z-10 items-center justify-center rounded-2xl bg-gradient-to-b from-[#1c1a16] to-[#0a0a0c] border border-[#d4af37]/40 shadow-inner p-1.5" style={{ display: "none" }}>
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <defs>
              <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fff2a3"/>
                <stop offset="50%" stopColor="#d4af37"/>
                <stop offset="100%" stopColor="#8c6407"/>
              </linearGradient>
            </defs>
            <path d="M50 10 C 28 10 12 26 12 48 C 12 60 18 70 28 77 L 22 90 L 38 84 C 42 85 46 86 50 86 C 72 86 88 70 88 48 C 88 26 72 10 50 10 Z" fill="#121215" stroke="url(#goldGrad)" strokeWidth="4"/>
            <circle cx="38" cy="48" r="5" fill="url(#goldGrad)"/>
            <circle cx="50" cy="48" r="5" fill="url(#goldGrad)"/>
            <circle cx="62" cy="48" r="5" fill="url(#goldGrad)"/>
          </svg>
        </div>
      </div>
      {showText && (
        <div className="flex flex-col">
          <span className={`font-display font-extrabold tracking-tight text-gold-glossy ${textMap[size]}`}>S&apos;ovo</span>
          <span className="text-[10px] tracking-[0.25em] uppercase font-semibold text-[#a39060] -mt-1">Encrypted</span>
        </div>
      )}
    </div>
  );
};
