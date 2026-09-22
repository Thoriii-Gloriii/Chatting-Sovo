/**
 * webrtc.ts — real peer-to-peer audio/video calling for S'ovo Chat.
 *
 * Before this module, "calls" were a UI simulation: an overlay with a stock
 * photo, a timer, decorative mute/camera buttons, and a call-log row whose
 * duration was Math.random(). Nothing was captured, nothing was transmitted,
 * and the person on the other end was never told a call existed.
 *
 * Transport
 *   Media  — RTCPeerConnection, direct peer-to-peer, DTLS-SRTP encrypted.
 *   Signal — Supabase Realtime broadcast. No extra server to run: the SDP
 *            offer/answer and ICE candidates ride the same Realtime socket
 *            the chat already holds open.
 *
 * Channels
 *   sovo-user-<uid>     — per-account inbox. Carries only `invite` / `cancel`,
 *                       so a signed-in client always hears an incoming call.
 *   sovo-call-<callId>  — per-call room. Both parties join it and exchange
 *                       `accept`, `decline`, `offer`, `answer`, `ice`, `hangup`.
 *
 * NAT traversal
 *   Public STUN covers most networks. Mobile carriers behind CGNAT / symmetric
 *   NAT need a TURN relay; configure one (see setTurnServers) or a minority of
 *   calls will ring, connect ICE, and then fail to carry media.
 */

import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type CallType = 'audio' | 'video';

export type CallState =
  | 'idle'
  | 'ringing-out'
  | 'ringing-in'
  | 'connecting'
  | 'connected'
  | 'ended';

export type CallEndReason =
  | 'hangup'
  | 'declined'
  | 'unanswered'
  | 'failed'
  | 'cancelled'
  | 'permission-denied';

export interface CallInvite {
  callId: string;
  fromUserId: string;
  fromName: string;
  fromAvatar: string;
  type: CallType;
}

interface SignalEnvelope {
  callId: string;
  from: string;
  [key: string]: unknown;
}

const TURN_STORAGE_KEY = 'sovo_turn_servers';

const STUN_SERVERS: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
];

/**
 * Persists TURN credentials for this device. Call once with the details of a
 * TURN server (e.g. a coturn instance or a hosted provider) to make calls work
 * on carrier-grade NAT:
 *
 *   setTurnServers([{ urls: 'turn:turn.example.com:3478',
 *                     username: 'user', credential: 'pass' }]);
 */
export function setTurnServers(servers: RTCIceServer[]): void {
  try {
    localStorage.setItem(TURN_STORAGE_KEY, JSON.stringify(servers));
  } catch {
    // storage unavailable — fall back to STUN-only for this session
  }
}

export function getIceServers(): RTCIceServer[] {
  try {
    const raw = localStorage.getItem(TURN_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) return [...STUN_SERVERS, ...parsed];
    }
  } catch {
    // ignore malformed config and fall through
  }
  return STUN_SERVERS;
}

/** True when this runtime can actually place a call. */
export function callingSupported(): boolean {
  return (
    typeof RTCPeerConnection !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia
  );
}

function newCallId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? `call_${crypto.randomUUID()}`
    : `call_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function joinChannel(topic: string): Promise<RealtimeChannel> {
  const channel = supabase.channel(topic, {
    config: { broadcast: { self: false, ack: false } },
  });
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Signalling channel timed out')), 12000);
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(timeout);
        resolve();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        clearTimeout(timeout);
        reject(new Error(`Signalling channel failed: ${status}`));
      }
    });
  });
  return channel;
}

/**
 * Listens on this account's inbox for incoming call invites.
 * Returns an unsubscribe function.
 */
export function listenForIncomingCalls(
  myUserId: string,
  onInvite: (invite: CallInvite) => void,
  onCancel: (callId: string) => void
): () => void {
  const channel = supabase.channel(`sovo-user-${myUserId}`, {
    config: { broadcast: { self: false, ack: false } },
  });

  channel
    .on('broadcast', { event: 'invite' }, ({ payload }) => {
      const p = payload as CallInvite;
      if (!p?.callId || !p?.fromUserId || p.fromUserId === myUserId) return;
      onInvite(p);
    })
    .on('broadcast', { event: 'cancel' }, ({ payload }) => {
      const p = payload as { callId?: string };
      if (p?.callId) onCancel(p.callId);
    })
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

export interface CallHandlers {
  onStateChange?: (state: CallState) => void;
  onLocalStream?: (stream: MediaStream) => void;
  onRemoteStream?: (stream: MediaStream) => void;
  /** Fires exactly once per call. durationSeconds is real connected time. */
  onEnded?: (reason: CallEndReason, durationSeconds: number) => void;
  onError?: (message: string) => void;
}

/** How long an outgoing call rings before it is written off as unanswered. */
const RING_TIMEOUT_MS = 45_000;

/**
 * One call, from either side. Construct it, then call `place()` (caller) or
 * `accept()` (callee). `hangup()` is safe to call at any point and more than
 * once.
 */
export class SovoCall {
  readonly callId: string;
  readonly type: CallType;
  readonly peerId: string;
  readonly isCaller: boolean;

  private pc: RTCPeerConnection | null = null;
  private callChannel: RealtimeChannel | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream = new MediaStream();
  private handlers: CallHandlers;
  private state: CallState = 'idle';
  private connectedAt: number | null = null;
  private ringTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private remoteDescriptionSet = false;
  private finished = false;
  private wakeLock: { release: () => Promise<void> } | null = null;

  constructor(opts: {
    callId?: string;
    peerId: string;
    type: CallType;
    isCaller: boolean;
    handlers?: CallHandlers;
  }) {
    this.callId = opts.callId || newCallId();
    this.peerId = opts.peerId;
    this.type = opts.type;
    this.isCaller = opts.isCaller;
    this.handlers = opts.handlers || {};
  }

  // ── public API ────────────────────────────────────────────────────────────

  /** Caller side: capture media, ring the peer, wait for an answer. */
  async place(me: { id: string; name: string; avatar: string }): Promise<void> {
    if (!callingSupported()) {
      this.fail('Calling is not supported on this device.');
      return;
    }
    try {
      this.setState('ringing-out');
      await this.openMedia();
      await this.openCallChannel(me.id);

      // Ring the callee's inbox.
      const inbox = await joinChannel(`sovo-user-${this.peerId}`);
      await inbox.send({
        type: 'broadcast',
        event: 'invite',
        payload: {
          callId: this.callId,
          fromUserId: me.id,
          fromName: me.name,
          fromAvatar: me.avatar,
          type: this.type,
        } satisfies CallInvite,
      });
      void supabase.removeChannel(inbox);

      this.ringTimer = setTimeout(() => {
        void this.cancelOutgoing('unanswered');
      }, RING_TIMEOUT_MS);
    } catch (err) {
      this.fail(err instanceof Error ? err.message : 'Could not start the call.');
    }
  }

  /** Callee side: capture media, join the room, tell the caller to send an offer. */
  async accept(myUserId: string): Promise<void> {
    if (!callingSupported()) {
      this.fail('Calling is not supported on this device.');
      return;
    }
    try {
      this.setState('connecting');
      await this.openMedia();
      await this.openCallChannel(myUserId);
      await this.send('accept', {});
    } catch (err) {
      this.fail(err instanceof Error ? err.message : 'Could not answer the call.');
    }
  }

  /** Callee side: refuse without capturing any media. */
  async decline(myUserId: string): Promise<void> {
    try {
      this.callChannel = await joinChannel(`sovo-call-${this.callId}`);
      await this.send('decline', { from: myUserId });
    } catch {
      // the caller will fall back to its ring timeout
    }
    this.finish('declined');
  }

  /** Ends the call from either side and notifies the peer. */
  async hangup(): Promise<void> {
    if (this.finished) return;
    try {
      await this.send('hangup', {});
    } catch {
      // best effort — teardown still runs
    }
    this.finish(this.connectedAt ? 'hangup' : 'cancelled');
  }

  /** Mutes/unmutes the outgoing microphone. Returns the new muted state. */
  setMuted(muted: boolean): boolean {
    this.localStream?.getAudioTracks().forEach((t) => {
      t.enabled = !muted;
    });
    return muted;
  }

  /** Enables/disables the outgoing camera. Returns the new camera-off state. */
  setCameraOff(off: boolean): boolean {
    this.localStream?.getVideoTracks().forEach((t) => {
      t.enabled = !off;
    });
    return off;
  }

  /** Flips between the front and rear camera on a video call. */
  async switchCamera(): Promise<void> {
    if (this.type !== 'video' || !this.pc || !this.localStream) return;
    const current = this.localStream.getVideoTracks()[0];
    const facing = current?.getSettings().facingMode === 'environment' ? 'user' : 'environment';
    try {
      const next = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing },
        audio: false,
      });
      const nextTrack = next.getVideoTracks()[0];
      const sender = this.pc.getSenders().find((s) => s.track?.kind === 'video');
      if (sender && nextTrack) {
        await sender.replaceTrack(nextTrack);
        current?.stop();
        this.localStream.removeTrack(current);
        this.localStream.addTrack(nextTrack);
        this.handlers.onLocalStream?.(this.localStream);
      }
    } catch (err) {
      this.handlers.onError?.(
        err instanceof Error ? err.message : 'Could not switch camera.'
      );
    }
  }

  getState(): CallState {
    return this.state;
  }

  // ── internals ─────────────────────────────────────────────────────────────

  private setState(next: CallState) {
    if (this.state === next) return;
    this.state = next;
    this.handlers.onStateChange?.(next);
  }

  private async openMedia(): Promise<void> {
    const constraints: MediaStreamConstraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video:
        this.type === 'video'
          ? { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }
          : false,
    };

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      const name = (err as DOMException)?.name;
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        throw new Error(
          this.type === 'video'
            ? 'Camera and microphone access was denied. Enable them for S’ovo in Android settings.'
            : 'Microphone access was denied. Enable it for S’ovo in Android settings.'
        );
      }
      if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        throw new Error('No camera or microphone was found on this device.');
      }
      throw new Error('Could not open the microphone or camera.');
    }

    this.handlers.onLocalStream?.(this.localStream);
    await this.requestWakeLock();
    this.buildPeerConnection();
  }

  private buildPeerConnection() {
    const pc = new RTCPeerConnection({
      iceServers: getIceServers(),
      // Bundling keeps a single transport for audio+video, which halves the
      // ICE work on flaky mobile networks.
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
    });

    this.localStream?.getTracks().forEach((track) => {
      pc.addTrack(track, this.localStream as MediaStream);
    });

    pc.ontrack = (ev) => {
      ev.streams[0]?.getTracks().forEach((track) => {
        if (!this.remoteStream.getTracks().includes(track)) {
          this.remoteStream.addTrack(track);
        }
      });
      this.handlers.onRemoteStream?.(this.remoteStream);
    };

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        void this.send('ice', { candidate: ev.candidate.toJSON() });
      }
    };

    pc.onconnectionstatechange = () => {
      switch (pc.connectionState) {
        case 'connected':
          this.clearRingTimer();
          if (!this.connectedAt) this.connectedAt = Date.now();
          this.setState('connected');
          break;
        case 'failed':
          // ICE could not find a path — almost always a NAT that needs TURN.
          this.handlers.onError?.(
            'The connection dropped. If this keeps happening on mobile data, a TURN relay is needed.'
          );
          this.finish('failed');
          break;
        case 'disconnected':
          // Transient on mobile; give ICE a chance to restart before ending.
          setTimeout(() => {
            if (this.pc?.connectionState === 'disconnected') this.finish('failed');
          }, 6000);
          break;
        default:
          break;
      }
    };

    this.pc = pc;
  }

  private async openCallChannel(myUserId: string): Promise<void> {
    const channel = await joinChannel(`sovo-call-${this.callId}`);

    channel
      .on('broadcast', { event: 'accept' }, () => {
        if (!this.isCaller) return;
        this.clearRingTimer();
        this.setState('connecting');
        void this.sendOffer();
      })
      .on('broadcast', { event: 'decline' }, () => {
        if (!this.isCaller) return;
        this.finish('declined');
      })
      .on('broadcast', { event: 'offer' }, ({ payload }) => {
        const p = payload as SignalEnvelope & { sdp: RTCSessionDescriptionInit };
        if (this.isCaller || p.from === myUserId) return;
        void this.handleOffer(p.sdp);
      })
      .on('broadcast', { event: 'answer' }, ({ payload }) => {
        const p = payload as SignalEnvelope & { sdp: RTCSessionDescriptionInit };
        if (!this.isCaller || p.from === myUserId) return;
        void this.handleAnswer(p.sdp);
      })
      .on('broadcast', { event: 'ice' }, ({ payload }) => {
        const p = payload as SignalEnvelope & { candidate: RTCIceCandidateInit };
        if (p.from === myUserId || !p.candidate) return;
        void this.handleCandidate(p.candidate);
      })
      .on('broadcast', { event: 'hangup' }, () => {
        this.finish(this.connectedAt ? 'hangup' : 'declined');
      });

    this.callChannel = channel;
    this.myUserId = myUserId;
  }

  private myUserId = '';

  private async send(event: string, payload: Record<string, unknown>): Promise<void> {
    if (!this.callChannel) return;
    await this.callChannel.send({
      type: 'broadcast',
      event,
      payload: { callId: this.callId, from: this.myUserId, ...payload },
    });
  }

  private async sendOffer(): Promise<void> {
    if (!this.pc) return;
    try {
      const offer = await this.pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: this.type === 'video',
      });
      await this.pc.setLocalDescription(offer);
      await this.send('offer', { sdp: offer });
    } catch (err) {
      this.fail(err instanceof Error ? err.message : 'Could not negotiate the call.');
    }
  }

  private async handleOffer(sdp: RTCSessionDescriptionInit): Promise<void> {
    if (!this.pc) return;
    try {
      await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
      this.remoteDescriptionSet = true;
      await this.drainCandidates();

      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);
      await this.send('answer', { sdp: answer });
    } catch (err) {
      this.fail(err instanceof Error ? err.message : 'Could not answer the call.');
    }
  }

  private async handleAnswer(sdp: RTCSessionDescriptionInit): Promise<void> {
    if (!this.pc || this.pc.signalingState === 'stable') return;
    try {
      await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
      this.remoteDescriptionSet = true;
      await this.drainCandidates();
    } catch (err) {
      this.fail(err instanceof Error ? err.message : 'Could not complete the call.');
    }
  }

  /**
   * ICE candidates routinely arrive before the remote description is set;
   * adding one then throws and silently costs you a connection path. Buffer
   * until the description lands, then flush.
   */
  private async handleCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.pc) return;
    if (!this.remoteDescriptionSet) {
      this.pendingCandidates.push(candidate);
      return;
    }
    try {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch {
      // A rejected candidate is not fatal; other paths may still succeed.
    }
  }

  private async drainCandidates(): Promise<void> {
    const queued = this.pendingCandidates;
    this.pendingCandidates = [];
    for (const c of queued) {
      try {
        await this.pc?.addIceCandidate(new RTCIceCandidate(c));
      } catch {
        // ignore
      }
    }
  }

  private async cancelOutgoing(reason: CallEndReason): Promise<void> {
    try {
      const inbox = await joinChannel(`sovo-user-${this.peerId}`);
      await inbox.send({
        type: 'broadcast',
        event: 'cancel',
        payload: { callId: this.callId },
      });
      void supabase.removeChannel(inbox);
    } catch {
      // ignore
    }
    this.finish(reason);
  }

  private async requestWakeLock(): Promise<void> {
    try {
      const wl = (navigator as Navigator & {
        wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
      }).wakeLock;
      if (wl) this.wakeLock = await wl.request('screen');
    } catch {
      // screen may still sleep — not fatal
    }
  }

  private clearRingTimer() {
    if (this.ringTimer) {
      clearTimeout(this.ringTimer);
      this.ringTimer = null;
    }
  }

  private fail(message: string) {
    this.handlers.onError?.(message);
    this.finish(message.toLowerCase().includes('denied') ? 'permission-denied' : 'failed');
  }

  /** Idempotent teardown. Releases the mic/camera — this must always run. */
  private finish(reason: CallEndReason) {
    if (this.finished) return;
    this.finished = true;
    this.clearRingTimer();

    const duration = this.connectedAt ? Math.round((Date.now() - this.connectedAt) / 1000) : 0;

    this.localStream?.getTracks().forEach((t) => t.stop());
    this.remoteStream.getTracks().forEach((t) => t.stop());
    this.localStream = null;

    try {
      this.pc?.close();
    } catch {
      // ignore
    }
    this.pc = null;

    if (this.callChannel) {
      void supabase.removeChannel(this.callChannel);
      this.callChannel = null;
    }

    void this.wakeLock?.release().catch(() => undefined);
    this.wakeLock = null;

    this.setState('ended');
    this.handlers.onEnded?.(reason, duration);
  }
}
