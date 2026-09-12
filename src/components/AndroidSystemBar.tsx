import React, { useState, useEffect } from 'react';
import {
  Wifi,
  Signal,
  BatteryCharging,
  Battery,
  Shield,
  Lock,
  MessageSquare,
  Sparkles,
  ChevronLeft,
  Circle,
  Square,
  Minus,
} from 'lucide-react';

interface AndroidStatusBarProps {
  onBackGesture?: () => void;
  showBackAction?: boolean;
}

export const AndroidStatusBar: React.FC<AndroidStatusBarProps> = () => {
  const [timeStr, setTimeStr] = useState('09:41');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 10000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div
      className="w-full h-8 px-4 bg-[#050507] text-[#e3e2e8] flex items-center justify-between text-[11px] font-medium tracking-tight select-none relative z-50 border-b border-[#14141c]"
      id="android-system-status-bar"
    >
      {/* Left System Info: Time & Android Notification Icons */}
      <div className="flex items-center gap-2 z-10">
        <span className="font-semibold text-xs tracking-tight text-white">{timeStr}</span>
        <div className="flex items-center gap-1 opacity-80">
          {/* S'ovo Encrypted notification badge */}
          <div className="w-3.5 h-3.5 rounded-full bg-[#18160f] border border-[#d4af37]/60 flex items-center justify-center">
            <Lock className="w-2 h-2 text-[#ffd700]" />
          </div>
          <div className="w-3.5 h-3.5 rounded-full bg-[#13131c] flex items-center justify-center">
            <MessageSquare className="w-2 h-2 text-gray-300" />
          </div>
        </div>
      </div>

      {/* Center: Android Camera Punch Hole Cutout */}
      <div className="absolute left-1/2 -translate-x-1/2 top-1.5 flex items-center justify-center">
        <div className="w-3.5 h-3.5 rounded-full bg-black ring-1 ring-[#1f1e28] flex items-center justify-center shadow-inner">
          <div className="w-1.5 h-1.5 rounded-full bg-[#0a0f1d] ring-0.5 ring-[#1c2c44]/60" />
        </div>
      </div>

      {/* Right System Info: 5G, VoLTE, Wi-Fi, Knox, Battery */}
      <div className="flex items-center gap-1.5 text-[10px] font-mono font-semibold z-10 text-gray-300">
        <span className="text-[9px] text-[#ffd700] px-1 py-0.2 rounded bg-[#1f1a0e] border border-[#d4af37]/30 font-bold">
          5G+
        </span>
        <Signal className="w-3 h-3 text-white" />
        <Wifi className="w-3 h-3 text-white" />
        <div className="flex items-center gap-1 ml-0.5">
          <span className="text-[10px] text-gray-300 font-sans font-medium">96%</span>
          <div className="w-4 h-2.5 rounded-[3px] border border-gray-400 p-[1px] flex items-center">
            <div className="h-full w-[90%] bg-emerald-400 rounded-[1px]" />
          </div>
        </div>
      </div>
    </div>
  );
};

interface AndroidNavigationBarProps {
  onBack?: () => void;
  onHome?: () => void;
  onRecents?: () => void;
  styleMode?: 'gesture' | '3button';
}

export const AndroidNavigationBar: React.FC<AndroidNavigationBarProps> = ({
  onBack,
  onHome,
  onRecents,
  styleMode = 'gesture',
}) => {
  return (
    <div
      className="w-full h-6 bg-[#050507] flex items-center justify-center select-none relative z-40 border-t border-[#12121a]"
      id="android-system-navigation-bar"
    >
      {styleMode === 'gesture' ? (
        /* Android 14/15 Gesture Navigation Bar Handle */
        <div
          onClick={onHome}
          className="w-32 h-1 bg-gray-500/80 hover:bg-[#ffd700] rounded-full transition-all cursor-pointer active:scale-95 shadow-sm"
          title="Android Home Gesture"
        />
      ) : (
        /* Android 3-Button Navigation Bar */
        <div className="w-full max-w-xs flex items-center justify-around text-gray-400">
          <button
            type="button"
            onClick={onBack}
            className="p-1 hover:text-[#ffd700] transition active:scale-90"
            title="Back"
          >
            <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
          </button>
          <button
            type="button"
            onClick={onHome}
            className="p-1 hover:text-[#ffd700] transition active:scale-90"
            title="Home"
          >
            <Circle className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onRecents}
            className="p-1 hover:text-[#ffd700] transition active:scale-90"
            title="Recent Apps"
          >
            <Square className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
};
