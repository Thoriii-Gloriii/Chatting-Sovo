import React, { useState, useEffect } from 'react';
import {
  Wifi,
  Signal,
  Lock,
  MessageSquare,
  ChevronLeft,
  Circle,
  Square,
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
      className="w-full h-8 px-4 flex items-center justify-between text-[11px] font-medium tracking-tight select-none relative z-50"
      style={{
        backgroundColor: "var(--color-bg)",
        color: "var(--color-text)",
        borderBottom: "1px solid var(--color-border)",
      }}
      id="android-system-status-bar"
    >
      {/* Left: Time & notifications */}
      <div className="flex items-center gap-2 z-10">
        <span className="font-semibold text-xs tracking-tight" style={{ color: "var(--color-text)" }}>
          {timeStr}
        </span>
        <div className="flex items-center gap-1 opacity-80">
          <div
            className="w-3.5 h-3.5 rounded-full flex items-center justify-center"
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid rgba(212,175,55,0.60)",
            }}
          >
            <Lock className="w-2 h-2" style={{ color: "var(--color-gold-bright)" }} />
          </div>
          <div
            className="w-3.5 h-3.5 rounded-full flex items-center justify-center"
            style={{ backgroundColor: "var(--color-surface)" }}
          >
            <MessageSquare className="w-2 h-2" style={{ color: "var(--color-text-secondary)" }} />
          </div>
        </div>
      </div>

      {/* Center: punch-hole camera */}
      <div className="absolute left-1/2 -translate-x-1/2 top-1.5 flex items-center justify-center">
        <div className="w-3.5 h-3.5 rounded-full bg-black ring-1 ring-[#1f1e28] flex items-center justify-center shadow-inner">
          <div className="w-1.5 h-1.5 rounded-full bg-[#0a0f1d] ring-0.5 ring-[#1c2c44]/60" />
        </div>
      </div>

      {/* Right: 5G, signal, wifi, battery */}
      <div
        className="flex items-center gap-1.5 text-[10px] font-mono font-semibold z-10"
        style={{ color: "var(--color-text-secondary)" }}
      >
        <span
          className="text-[9px] px-1 rounded font-bold"
          style={{
            color: "var(--color-gold-bright)",
            backgroundColor: "var(--color-surface)",
            border: "1px solid rgba(212,175,55,0.30)",
          }}
        >
          5G+
        </span>
        <Signal className="w-3 h-3" style={{ color: "var(--color-text)" }} />
        <Wifi className="w-3 h-3" style={{ color: "var(--color-text)" }} />
        <div className="flex items-center gap-1 ml-0.5">
          <span className="text-[10px] font-sans font-medium" style={{ color: "var(--color-text-secondary)" }}>
            96%
          </span>
          <div
            className="w-4 h-2.5 p-[1px] flex items-center"
            style={{
              borderRadius: "3px",
              border: "1px solid var(--color-text-secondary)",
            }}
          >
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
      className="w-full h-5 flex items-center justify-center select-none relative z-40"
      style={{
        backgroundColor: "var(--color-bg)",
        borderTop: "1px solid var(--color-border)",
      }}
      id="android-system-navigation-bar"
    >
      {styleMode === 'gesture' ? (
        <div
          onClick={onHome}
          className="w-28 h-1 rounded-full transition-all cursor-pointer active:scale-95"
          style={{ backgroundColor: "rgba(255,255,255,0.35)" }}
          onMouseEnter={(e) => ((e.target as HTMLElement).style.backgroundColor = "var(--color-gold)")}
          onMouseLeave={(e) => ((e.target as HTMLElement).style.backgroundColor = "rgba(255,255,255,0.35)")}
          title="Android Home Gesture"
        />
      ) : (
        <div className="w-full max-w-xs flex items-center justify-around" style={{ color: "var(--color-text-secondary)" }}>
          <button
            type="button"
            onClick={onBack}
            className="p-1 transition active:scale-90"
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--color-gold)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--color-text-secondary)")}
            title="Back"
          >
            <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
          </button>
          <button
            type="button"
            onClick={onHome}
            className="p-1 transition active:scale-90"
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--color-gold)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--color-text-secondary)")}
            title="Home"
          >
            <Circle className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onRecents}
            className="p-1 transition active:scale-90"
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--color-gold)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--color-text-secondary)")}
            title="Recent Apps"
          >
            <Square className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
};
