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
      className="flex flex-col h-[calc(100vh-68px)] md:h-[calc(100vh-80px)] w-full max-w-4xl mx-auto bg-[#07070b] border-x border-[#1c1b24] shadow-2xl relative select-none"
      id="sovo-calls-view"
    >
      {/* Top Header */}
      <div className="p-4 bg-[#0c0c12]/95 backdrop-blur-md border-b border-[#22212d] flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-extrabold text-gold-glossy tracking-tight">
            Encrypted Calls
          </h2>
          <p className="text-xs text-gray-400">Peer-to-peer WebRTC, DTLS-SRTP encrypted</p>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#17150e] border border-[#d4af37]/30 text-xs font-semibold text-[#ffd700]">
          <Lock className="w-3 h-3" />
          <span>E2EE Audio &amp; Video</span>
        </div>
      </div>

      {/* Calls Log List */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#181720] p-2 scrollbar-thin">
        {calls.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-8 gap-3 text-gray-500">
            <div className="p-4 rounded-full bg-[#111118] border border-[#272635]">
              <PhoneCall className="w-7 h-7 text-[#d4af37]" />
            </div>
            <p className="text-sm font-semibold text-gray-300">No calls yet</p>
            <p className="text-xs leading-relaxed">
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
                    {call.peerUsername && (
                      <span className="text-[11px] font-mono text-[#ffd700]">
                        @{call.peerUsername}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                    <span className="capitalize">{call.type} call</span>
                    <span>•</span>
                    <span className={isMissed ? 'text-red-400' : ''}>
                      {call.status === 'declined'
                        ? 'Declined'
                        : call.durationSeconds > 0
                        ? formatDuration(call.durationSeconds)
                        : 'No answer'}
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
                    sound.resume();
                    sound.playTap();
                    onInitiateCall(call.peerId, call.peerName, 'audio');
                  }}
                  className="p-2.5 rounded-xl bg-[#14141d] hover:bg-[#201f2c] border border-[#272635] text-[#ffd700] transition cursor-pointer"
                  title="Voice Call"
                >
                  <Phone className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    sound.resume();
                    sound.playTap();
                    onInitiateCall(call.peerId, call.peerName, 'video');
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
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-between bg-black/95 backdrop-blur-2xl text-white p-8">
      <div className="flex flex-col items-center gap-2 pt-16">
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#17150e] border border-[#d4af37]/40 text-xs text-[#ffd700]">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Incoming encrypted {invite.type} call</span>
        </div>
      </div>

      <div className="flex flex-col items-center text-center">
        <div className="w-32 h-32 rounded-full border-4 border-[#d4af37] p-1 shadow-[0_0_40px_rgba(212,175,55,0.35)] animate-pulse mb-5">
          <img
            src={invite.fromAvatar}
            alt={invite.fromName}
            className="w-full h-full rounded-full object-cover"
          />
        </div>
        <h3 className="text-2xl font-display font-bold mb-1">{invite.fromName}</h3>
        <p className="text-xs text-[#ffd700]">is calling you on S&rsquo;ovo</p>
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
          <span className="text-[11px] text-gray-400">Decline</span>
        </button>

        <button
          type="button"
          onClick={onAccept}
          className="flex flex-col items-center gap-2 cursor-pointer"
        >
          <span className="p-5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-2xl transition active:scale-95 animate-bounce">
            {invite.type === 'video' ? <Video className="w-7 h-7" /> : <Phone className="w-7 h-7" />}
          </span>
          <span className="text-[11px] text-gray-400">Accept</span>
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
  peerName,
  peerAvatar,
  callType,
  callState,
  localStream,
  remoteStream,
  errorMessage,
  onToggleMute,
  onToggleCamera,
  onSwitchCamera,
  onEndCall,
}) => {
  const [seconds, setSeconds] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  // The timer only runs once media is actually flowing, so the call log
  // records real connected time rather than time spent ringing.
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
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
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
      {/* Remote video fills the screen on a video call */}
      {callType === 'video' && (
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className={`absolute inset-0 w-full h-full object-cover ${
            hasRemoteVideo ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}
      {/* Remote audio always plays, video call or not */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/20 to-black/90 pointer-events-none" />

      {/* Top status */}
      <div className="relative flex flex-col items-center gap-1.5 pt-10 px-6">
        <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-[#17150e] border border-[#d4af37]/40 text-xs text-[#ffd700]">
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

      {/* Centre: peer identity (hidden once their video is on screen) */}
      {!hasRemoteVideo && (
        <div className="relative flex flex-col items-center text-center">
          <div className="w-32 h-32 rounded-full border-4 border-[#d4af37] p-1 shadow-[0_0_30px_rgba(212,175,55,0.3)] mb-4">
            <img
              src={peerAvatar}
              alt={peerName}
              className="w-full h-full rounded-full object-cover"
            />
          </div>
          <h3 className="text-2xl font-display font-bold mb-1">{peerName}</h3>
          <p className="text-xs text-[#ffd700]">
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
          className={`absolute top-24 right-4 w-28 h-40 rounded-2xl object-cover border-2 border-[#d4af37]/60 shadow-2xl bg-black z-10 ${
            isVideoOff ? 'hidden' : ''
          }`}
        />
      )}

      {/* Controls */}
      <div className="relative flex items-center justify-center gap-6 pb-10">
        <button
          type="button"
          onClick={() => {
            sound.playTap();
            const next = !isMuted;
            setIsMuted(next);
            onToggleMute(next);
          }}
          title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
          className={`p-4 rounded-full border transition cursor-pointer ${
            isMuted
              ? 'bg-red-950/70 border-red-700 text-red-300'
              : 'bg-[#181822]/90 border-white/20 text-white'
          }`}
        >
          {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </button>

        <button
          type="button"
          onClick={() => {
            sound.playTap();
            onEndCall();
          }}
          className="p-5 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-2xl transition transform active:scale-95 cursor-pointer"
          title="End call"
        >
          <PhoneOff className="w-7 h-7" />
        </button>

        {callType === 'video' ? (
          <>
            <button
              type="button"
              onClick={() => {
                sound.playTap();
                const next = !isVideoOff;
                setIsVideoOff(next);
                onToggleCamera(next);
              }}
              title={isVideoOff ? 'Turn camera on' : 'Turn camera off'}
              className={`p-4 rounded-full border transition cursor-pointer ${
                isVideoOff
                  ? 'bg-red-950/70 border-red-700 text-red-300'
                  : 'bg-[#181822]/90 border-white/20 text-white'
              }`}
            >
              {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
            </button>

            <button
              type="button"
              onClick={() => {
                sound.playTap();
                onSwitchCamera();
              }}
              title="Switch camera"
              className="p-4 rounded-full border bg-[#181822]/90 border-white/20 text-white transition cursor-pointer"
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
