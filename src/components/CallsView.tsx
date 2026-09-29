import React, { useState, useEffect, useRef } from 'react';
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
  SwitchCamera,
  AlertTriangle,
  PhoneCall,
} from 'lucide-react';
import { sound } from '../lib/sound';
import { CallState, CallType, CallInvite } from '../lib/webrtc';

interface CallsViewProps {
  calls: CallRecord[];
  currentUser: User;
  onInitiateCall: (peerId: string, peerName: string, type: CallType) => void;
}

const formatDuration = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
};

export const CallsView: React.FC<CallsViewProps> = ({ calls, onInitiateCall }) => {
  return (
    <div
      className="flex flex-col h-[calc(100vh-68px)] md:h-[calc(100vh-80px)] w-full max-w-4xl mx-auto relative select-none"
      style={{
        backgroundColor: "var(--color-surface)",
        borderLeft: "1px solid var(--color-border)",
        borderRight: "1px solid var(--color-border)",
      }}
      id="sovo-calls-view"
    >
      {/* Header */}
      <div
        className="p-4 backdrop-blur-md flex items-center justify-between"
        style={{
          backgroundColor: "var(--color-surface)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <div>
          <h2 className="text-2xl font-display font-extrabold text-gold-glossy tracking-tight">
            Encrypted Calls
          </h2>
          <p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
            Peer-to-peer WebRTC, DTLS-SRTP encrypted
          </p>
        </div>

        <div
          className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
          style={{
            backgroundColor: "rgba(212,175,55,0.10)",
            border: "1px solid rgba(212,175,55,0.30)",
            color: "var(--color-gold-bright)",
          }}
        >
          <Lock className="w-3 h-3" />
          <span>E2EE Audio &amp; Video</span>
        </div>
      </div>

      {/* Calls list */}
      <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
        {calls.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-8 gap-3">
            <div
              className="p-4 rounded-full"
              style={{
                backgroundColor: "var(--color-elevated)",
                border: "1px solid var(--color-border)",
              }}
            >
              <PhoneCall className="w-7 h-7" style={{ color: "var(--color-gold)" }} />
            </div>
            <p className="text-sm font-semibold" style={{ color: "var(--color-text-secondary)" }}>
              No calls yet
            </p>
            <p className="text-xs leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
              Open a chat and tap the phone or video icon to place your first encrypted call.
            </p>
          </div>
        )}

        {calls.map((call) => {
          const isIncoming = call.direction === 'incoming';
          const isMissed = call.status === 'missed' || call.status === 'declined';

          return (
            <div
              key={call.id}
              className="p-3.5 flex items-center justify-between transition"
              style={{ borderRadius: "var(--radius-md)" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--color-elevated)")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              <div className="flex items-center gap-3.5">
                <div className="relative">
                  <img
                    src={call.peerAvatar}
                    alt={call.peerName}
                    className="w-11 h-11 rounded-full object-cover shadow-sm"
                    style={{ border: "1px solid rgba(212,175,55,0.40)" }}
                  />
                  <div
                    className="absolute -bottom-1 -right-1 p-1 rounded-full"
                    style={{
                      backgroundColor: isMissed ? "#ef4444" : isIncoming ? "#34d399" : "var(--color-gold)",
                      color: "black",
                    }}
                  >
                    {isMissed ? (
                      <PhoneMissed className="w-2.5 h-2.5 text-white" />
                    ) : isIncoming ? (
                      <PhoneIncoming className="w-2.5 h-2.5 text-black" />
                    ) : (
                      <PhoneOutgoing className="w-2.5 h-2.5 text-black" />
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold" style={{ color: "var(--color-text)" }}>
                      {call.peerName}
                    </span>
                    {call.peerUsername && (
                      <span className="text-[11px] font-mono" style={{ color: "var(--color-gold-bright)" }}>
                        @{call.peerUsername}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs mt-0.5" style={{ color: "var(--color-text-secondary)" }}>
                    <span className="capitalize">{call.type} call</span>
                    <span>•</span>
                    <span style={{ color: isMissed ? "#f87171" : undefined }}>
                      {call.status === 'declined'
                        ? 'Declined'
                        : call.durationSeconds > 0
                        ? formatDuration(call.durationSeconds)
                        : 'No answer'}
                    </span>
                    <span>•</span>
                    <span className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
                      {new Date(call.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Call-back buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { sound.resume(); sound.playTap(); onInitiateCall(call.peerId, call.peerName, 'audio'); }}
                  className="p-2.5 transition cursor-pointer tap-target flex items-center justify-center"
                  style={{
                    backgroundColor: "var(--color-elevated)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-sm)",
                    color: "var(--color-gold-bright)",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--color-surface)")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--color-elevated)")}
                  title="Voice Call"
                >
                  <Phone className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => { sound.resume(); sound.playTap(); onInitiateCall(call.peerId, call.peerName, 'video'); }}
                  className="p-2.5 transition cursor-pointer tap-target flex items-center justify-center"
                  style={{
                    backgroundColor: "var(--color-elevated)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-sm)",
                    color: "var(--color-gold-bright)",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--color-surface)")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--color-elevated)")}
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

// ─────────────────────────────────────────────────────────────────────────────
// Incoming call ring screen
// ─────────────────────────────────────────────────────────────────────────────

export const IncomingCallModal: React.FC<{
  invite: CallInvite;
  onAccept: () => void;
  onDecline: () => void;
}> = ({ invite, onAccept, onDecline }) => {
  useEffect(() => {
    sound.startRinging();
    return () => sound.stopRinging();
  }, []);

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-between backdrop-blur-2xl p-8"
      style={{ backgroundColor: "rgba(0,0,0,0.95)", color: "var(--color-text)" }}
    >
      <div className="flex flex-col items-center gap-2 pt-16">
        <div
          className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs"
          style={{
            backgroundColor: "rgba(212,175,55,0.10)",
            border: "1px solid rgba(212,175,55,0.40)",
            color: "var(--color-gold-bright)",
          }}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Incoming encrypted {invite.type} call</span>
        </div>
      </div>

      <div className="flex flex-col items-center text-center">
        <div
          className="w-32 h-32 rounded-full p-1 shadow-[0_0_40px_rgba(212,175,55,0.35)] animate-pulse mb-5"
          style={{ border: "4px solid var(--color-gold)" }}
        >
          <img
            src={invite.fromAvatar}
            alt={invite.fromName}
            className="w-full h-full rounded-full object-cover"
          />
        </div>
        <h3 className="text-2xl font-display font-bold mb-1">{invite.fromName}</h3>
        <p className="text-xs" style={{ color: "var(--color-gold-bright)" }}>
          is calling you on S&apos;ovo
        </p>
      </div>

      <div className="flex items-center justify-center gap-16 pb-10">
        <button
          type="button"
          onClick={onDecline}
          className="flex flex-col items-center gap-2 cursor-pointer"
        >
          <span className="p-5 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-2xl transition active:scale-95">
            <PhoneOff className="w-7 h-7" />
          </span>
          <span className="text-[11px]" style={{ color: "var(--color-text-secondary)" }}>Decline</span>
        </button>

        <button
          type="button"
          onClick={onAccept}
          className="flex flex-col items-center gap-2 cursor-pointer"
        >
          <span className="p-5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-2xl transition active:scale-95 animate-bounce">
            {invite.type === 'video' ? <Video className="w-7 h-7" /> : <Phone className="w-7 h-7" />}
          </span>
          <span className="text-[11px]" style={{ color: "var(--color-text-secondary)" }}>Accept</span>
        </button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Active call screen — bound to real MediaStreams
// ─────────────────────────────────────────────────────────────────────────────

const STATE_LABEL: Record<CallState, string> = {
  idle: 'Preparing…',
  'ringing-out': 'Ringing…',
  'ringing-in': 'Incoming…',
  connecting: 'Connecting…',
  connected: 'Connected',
  ended: 'Call ended',
};

export const ActiveCallOverlay: React.FC<{
  peerName: string;
  peerAvatar: string;
  callType: CallType;
  callState: CallState;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  errorMessage: string | null;
  onToggleMute: (muted: boolean) => void;
  onToggleCamera: (off: boolean) => void;
  onSwitchCamera: () => void;
  onEndCall: () => void;
}> = ({
  peerName, peerAvatar, callType, callState,
  localStream, remoteStream, errorMessage,
  onToggleMute, onToggleCamera, onSwitchCamera, onEndCall,
}) => {
  const [seconds, setSeconds] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (callState !== 'connected') return;
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [callState]);

  useEffect(() => {
    if (callState === 'ringing-out') {
      sound.startRinging();
      return () => sound.stopRinging();
    }
    sound.stopRinging();
  }, [callState]);

  useEffect(() => {
    if (localVideoRef.current && localStream) localVideoRef.current.srcObject = localStream;
  }, [localStream]);

  useEffect(() => {
    if (!remoteStream) return;
    if (callType === 'video' && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
      void remoteVideoRef.current.play().catch(() => undefined);
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remoteStream;
      void remoteAudioRef.current.play().catch(() => undefined);
    }
  }, [remoteStream, callType]);

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const hasRemoteVideo = callType === 'video' && !!remoteStream?.getVideoTracks().length;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-between bg-black text-white backdrop-blur-2xl">
      {callType === 'video' && (
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className={`absolute inset-0 w-full h-full object-cover ${hasRemoteVideo ? 'opacity-100' : 'opacity-0'}`}
        />
      )}
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/20 to-black/90 pointer-events-none" />

      {/* Top status */}
      <div className="relative flex flex-col items-center gap-1.5 pt-10 px-6">
        <div
          className="flex items-center gap-1 px-3 py-1 rounded-full text-xs"
          style={{
            backgroundColor: "rgba(212,175,55,0.10)",
            border: "1px solid rgba(212,175,55,0.40)",
            color: "var(--color-gold-bright)",
          }}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>End-to-end encrypted (DTLS-SRTP)</span>
        </div>
        <p className="text-xs font-mono text-gray-300 mt-1">
          {callState === 'connected' ? formatTimer(seconds) : STATE_LABEL[callState]}
        </p>

        {errorMessage && (
          <div className="mt-3 flex items-start gap-2 max-w-sm px-3 py-2 rounded-xl bg-red-950/70 border border-red-700/60 text-[11px] text-red-200">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {/* Centre: peer identity */}
      {!hasRemoteVideo && (
        <div className="relative flex flex-col items-center text-center">
          <div
            className="w-32 h-32 rounded-full p-1 shadow-[0_0_30px_rgba(212,175,55,0.3)] mb-4"
            style={{ border: "4px solid var(--color-gold)" }}
          >
            <img src={peerAvatar} alt={peerName} className="w-full h-full rounded-full object-cover" />
          </div>
          <h3 className="text-2xl font-display font-bold mb-1">{peerName}</h3>
          <p className="text-xs" style={{ color: "var(--color-gold-bright)" }}>
            {callType === 'video' ? 'Encrypted video call' : 'Encrypted voice call'}
          </p>
        </div>
      )}
      {hasRemoteVideo && <div className="flex-1" />}

      {/* Local self-view */}
      {callType === 'video' && (
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className={`absolute top-24 right-4 w-28 h-40 rounded-2xl object-cover shadow-2xl bg-black z-10 ${isVideoOff ? 'hidden' : ''}`}
          style={{ border: "2px solid rgba(212,175,55,0.60)" }}
        />
      )}

      {/* Controls */}
      <div className="relative flex items-center justify-center gap-6 pb-10">
        <button
          type="button"
          onClick={() => { sound.playTap(); const next = !isMuted; setIsMuted(next); onToggleMute(next); }}
          title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
          className={`p-4 rounded-full border transition cursor-pointer ${
            isMuted ? 'bg-red-950/70 border-red-700 text-red-300' : 'bg-black/60 border-white/20 text-white'
          }`}
        >
          {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </button>

        <button
          type="button"
          onClick={() => { sound.playTap(); onEndCall(); }}
          className="p-5 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-2xl transition transform active:scale-95 cursor-pointer"
          title="End call"
        >
          <PhoneOff className="w-7 h-7" />
        </button>

        {callType === 'video' ? (
          <>
            <button
              type="button"
              onClick={() => { sound.playTap(); const next = !isVideoOff; setIsVideoOff(next); onToggleCamera(next); }}
              title={isVideoOff ? 'Turn camera on' : 'Turn camera off'}
              className={`p-4 rounded-full border transition cursor-pointer ${
                isVideoOff ? 'bg-red-950/70 border-red-700 text-red-300' : 'bg-black/60 border-white/20 text-white'
              }`}
            >
              {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
            </button>

            <button
              type="button"
              onClick={() => { sound.playTap(); onSwitchCamera(); }}
              title="Switch camera"
              className="p-4 rounded-full border bg-black/60 border-white/20 text-white transition cursor-pointer"
            >
              <SwitchCamera className="w-6 h-6" />
            </button>
          </>
        ) : (
          <div className="p-4 w-14" />
        )}
      </div>
    </div>
  );
};
