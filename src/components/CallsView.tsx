import React, { useState, useEffect } from 'react';
import { CallRecord, User } from '../types';
import {
  Phone,
  Video,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  ShieldCheck,
  Lock,
  Mic,
  MicOff,
  VideoOff,
  PhoneOff,
  Sparkles,
  Volume2,
} from 'lucide-react';
import { sound } from '../lib/sound';

interface CallsViewProps {
  calls: CallRecord[];
  currentUser: User;
  onInitiateCall: (peerName: string, type: 'audio' | 'video') => void;
}

export const CallsView: React.FC<CallsViewProps> = ({ calls, currentUser, onInitiateCall }) => {
  return (
    <div
      className="flex flex-col h-[calc(100vh-68px)] md:h-[calc(100vh-80px)] w-full max-w-4xl mx-auto bg-[#07070b] border-x border-[#1c1b24] shadow-2xl relative select-none"
      id="sovo-calls-view"
    >
      {/* Top Header */}
      <div className="p-4 bg-[#0c0c12]/95 backdrop-blur-md border-b border-[#22212d] flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-extrabold text-gold-glossy tracking-tight">
            Encrypted Calls
          </h2>
          <p className="text-xs text-gray-400">Zero latency peer-to-peer WebRTC encryption</p>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#17150e] border border-[#d4af37]/30 text-xs font-semibold text-[#ffd700]">
          <Lock className="w-3 h-3" />
          <span>E2EE Audio & Video</span>
        </div>
      </div>

      {/* Calls Log List */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#181720] p-2 scrollbar-thin">
        {calls.map((call) => {
          const isIncoming = call.direction === 'incoming';
          const isOutgoing = call.direction === 'outgoing';
          const isMissed = call.status === 'missed';

          return (
            <div
              key={call.id}
              className="p-3.5 rounded-2xl hover:bg-[#111118] transition flex items-center justify-between"
            >
              <div className="flex items-center gap-3.5">
                <div className="relative">
                  <img
                    src={call.peerAvatar}
                    alt={call.peerName}
                    className="w-11 h-11 rounded-full object-cover border border-[#d4af37]/40 shadow-sm"
                  />
                  <div
                    className={`absolute -bottom-1 -right-1 p-1 rounded-full text-black ${
                      isMissed
                        ? 'bg-red-500 text-white'
                        : isIncoming
                        ? 'bg-emerald-400'
                        : 'bg-[#d4af37]'
                    }`}
                  >
                    {isMissed ? (
                      <PhoneMissed className="w-2.5 h-2.5" />
                    ) : isIncoming ? (
                      <PhoneIncoming className="w-2.5 h-2.5 text-black" />
                    ) : (
                      <PhoneOutgoing className="w-2.5 h-2.5 text-black" />
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-white">{call.peerName}</span>
                    <span className="text-[11px] font-mono text-[#ffd700]">
                      @{call.peerUsername}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                    <span className="capitalize">{call.type} Call</span>
                    <span>•</span>
                    <span>
                      {call.durationSeconds > 0
                        ? `${Math.floor(call.durationSeconds / 60)}m ${
                            call.durationSeconds % 60
                          }s`
                        : 'Missed'}
                    </span>
                    <span>•</span>
                    <span className="text-[11px] text-gray-500">
                      {new Date(call.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Call Back Actions */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    sound.playTap();
                    onInitiateCall(call.peerName, 'audio');
                  }}
                  className="p-2.5 rounded-xl bg-[#14141d] hover:bg-[#201f2c] border border-[#272635] text-[#ffd700] transition cursor-pointer"
                  title="Voice Call"
                >
                  <Phone className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    sound.playTap();
                    onInitiateCall(call.peerName, 'video');
                  }}
                  className="p-2.5 rounded-xl bg-[#14141d] hover:bg-[#201f2c] border border-[#272635] text-[#ffd700] transition cursor-pointer"
                  title="Video Call"
                >
                  <Video className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Active Call Screen Overlay
export const ActiveCallOverlay: React.FC<{
  peerName: string;
  callType: 'audio' | 'video';
  onEndCall: () => void;
}> = ({ peerName, callType, onEndCall }) => {
  const [seconds, setSeconds] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-between bg-black/95 text-white p-6 backdrop-blur-2xl">
      {/* Top Security & Verification Emojis */}
      <div className="flex flex-col items-center gap-1.5 pt-6">
        <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-[#17150e] border border-[#d4af37]/40 text-xs text-[#ffd700]">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Encrypted Call • Safety Verification: 🔐 💎 ⚡ 👑</span>
        </div>
        <p className="text-xs font-mono text-gray-400 mt-1">{formatTimer(seconds)}</p>
      </div>

      {/* Center Persona Avatar & Waveform */}
      <div className="flex flex-col items-center text-center">
        <div className="relative mb-4">
          <div className="w-32 h-32 rounded-full border-4 border-[#d4af37] p-1 shadow-[0_0_30px_rgba(212,175,55,0.3)] animate-pulse">
            <img
              src="https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&auto=format&fit=crop&q=80"
              alt={peerName}
              className="w-full h-full rounded-full object-cover"
            />
          </div>
        </div>

        <h3 className="text-2xl font-display font-bold text-white mb-1">{peerName}</h3>
        <p className="text-xs text-[#ffd700]">
          {callType === 'video' ? 'Encrypted HD Video Stream' : 'Secure High-Definition Audio'}
        </p>

        {/* Live sound visualizer */}
        <div className="flex items-center gap-1 mt-6 h-8">
          {[30, 60, 90, 40, 100, 70, 80, 50, 95, 35, 75, 45].map((h, i) => (
            <div
              key={i}
              className="w-1 bg-[#ffd700] rounded-full animate-pulse"
              style={{ height: `${h}%`, animationDelay: `${i * 0.1}s` }}
            />
          ))}
        </div>
      </div>

      {/* Bottom Action Controls */}
      <div className="flex items-center justify-center gap-6 pb-8">
        <button
          type="button"
          onClick={() => {
            sound.playTap();
            setIsMuted(!isMuted);
          }}
          className={`p-4 rounded-full border transition cursor-pointer ${
            isMuted
              ? 'bg-red-950/60 border-red-700 text-red-300'
              : 'bg-[#181822] border-white/20 text-white'
          }`}
        >
          {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </button>

        {/* End Call Button */}
        <button
          type="button"
          onClick={() => {
            sound.playTap();
            onEndCall();
          }}
          className="p-5 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-2xl transition transform active:scale-95 cursor-pointer"
        >
          <PhoneOff className="w-7 h-7" />
        </button>

        <button
          type="button"
          onClick={() => {
            sound.playTap();
            setIsVideoOff(!isVideoOff);
          }}
          className={`p-4 rounded-full border transition cursor-pointer ${
            isVideoOff
              ? 'bg-red-950/60 border-red-700 text-red-300'
              : 'bg-[#181822] border-white/20 text-white'
          }`}
        >
          {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
        </button>
      </div>
    </div>
  );
};
