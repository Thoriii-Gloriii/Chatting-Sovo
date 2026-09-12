import React, { useEffect, useState } from "react";
import { motion } from "motion/react";
import { SovoLogo } from "./SovoLogo";
import { Lock } from "lucide-react";

interface SplashScreenProps {
  onComplete: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const [progress, setProgress] = useState(10);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(onComplete, 400);
          return 100;
        }
        return prev + Math.floor(Math.random() * 25) + 15;
      });
    }, 180);
    return () => clearInterval(interval);
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#050507] text-[#f4f4f6] px-6 select-none overflow-hidden"
      id="sovo-splash-screen"
    >
      {/* Ambient background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-[#d4af37]/12 blur-[120px]" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full bg-[#aa7c11]/8 blur-[100px]" />
        {/* Gold streaks */}
        <svg className="absolute top-0 right-0 w-80 h-80 opacity-20" viewBox="0 0 320 320">
          <path d="M320 0 Q200 140 140 320" stroke="url(#sg1)" strokeWidth="1.5" fill="none"/>
          <path d="M295 0 Q175 150 115 320" stroke="url(#sg1)" strokeWidth="0.8" fill="none"/>
          <defs>
            <linearGradient id="sg1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffd700" stopOpacity="0.8"/>
              <stop offset="100%" stopColor="#d4af37" stopOpacity="0"/>
            </linearGradient>
          </defs>
        </svg>
        <svg className="absolute bottom-0 left-0 w-72 h-72 opacity-15" viewBox="0 0 300 300">
          <path d="M0 300 Q120 180 300 100" stroke="url(#sg2)" strokeWidth="1.5" fill="none"/>
          <defs>
            <linearGradient id="sg2" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ffd700" stopOpacity="0.6"/>
              <stop offset="100%" stopColor="#d4af37" stopOpacity="0"/>
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Center content */}
      <div className="flex flex-col items-center text-center relative z-10">
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative mb-8"
        >
          <SovoLogo size="hero" withGlow animated />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="text-5xl font-display font-extrabold tracking-tight text-gold-glossy mb-3"
        >
          S&apos;ovo
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55 }}
          className="text-base font-medium text-[#888899] tracking-wide"
        >
          Private. Encrypted. Yours.
        </motion.p>
      </div>

      {/* Bottom: progress + E2EE badge */}
      <div className="absolute bottom-10 left-0 right-0 flex flex-col items-center gap-4 px-10 z-10">
        <div className="w-full max-w-xs h-0.5 bg-[#16161c] rounded-full overflow-hidden border border-[#d4af37]/10 relative">
          <motion.div
            className="h-full bg-gradient-to-r from-[#aa7c11] via-[#ffd700] to-[#fff3a8] rounded-full"
            style={{ width: `${Math.min(100, progress)}%` }}
            transition={{ ease: "easeInOut" }}
          />
        </div>
        <div className="flex items-center gap-2 text-[11px] text-[#555568]">
          <Lock className="w-3 h-3 text-[#d4af37]"/>
          <span>End-to-end encrypted by default</span>
        </div>
      </div>
    </motion.div>
  );
};
