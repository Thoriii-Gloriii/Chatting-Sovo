import { supabase } from '../lib/supabase';
import { uploadFileToStorage, MAX_ATTACHMENT_BYTES, validateAttachment } from '../lib/upload';
import { parseEncryptedText, decryptMessage } from '../crypto/e2ee';
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Conversation, Message, User, UserSettings, MediaType } from '../types';
import { sound } from '../lib/sound';
import { formatFileSize } from '../lib/crypto';
import {
  ArrowLeft,
  ShieldCheck,
  Lock,
  Paperclip,
  Mic,
  MicOff,
  Send,
  MoreVertical,
  Check,
  CheckCheck,
  FileText,
  Video,
  Image as ImageIcon,
  Clock,
  Sparkles,
  Download,
  Phone,
  Video as VideoIcon,
  Smile,
  X,
  Users,
  Info,
  KeyRound,
  Play,
  Pause,
  Trash2,
  Camera,
  AlertCircle,
} from 'lucide-react';

interface ChatRoomProps {
  conversation: Conversation;
  messages: Message[];
  currentUser: User;
  settings: UserSettings;
  onBack: () => void;
  onSendMessage: (
    text: string,
    mediaData?: {
      url?: string;
      type?: MediaType;
      fileName?: string;
      fileSize?: string;
      fileSizeBytes?: number;
      duration?: number;
    }
  ) => void;
  onOpenE2EEModal: () => void;
  onStartCall: (type: 'audio' | 'video') => void;
  onToggleReaction: (messageId: string, emoji: string) => void;
}

export const ChatRoom: React.FC<ChatRoomProps> = ({
  conversation,
  messages: initialMessages,  currentUser,
  settings,
  onBack,
  onSendMessage,
  onOpenE2EEModal,
  onStartCall,
  onToggleReaction,
}) => {
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Message[]>(initialMessages || []);

  useEffect(() => {
    if (!conversation) return;

    // Initial load
    supabase
      .from('messages')
      .select('*')
      .eq('conversationId', conversation.id)
      .order('timestamp', { ascending: true })
      .then(({ data, error }) => {
        if (error) console.error('Failed to load messages', error);
        if (data) setMessages(data as Message[]);
      });

    // Realtime subscription. INSERT alone was not enough: reactions and
    // delivery-status changes are UPDATEs, so without this second handler they
    // were written to the database and never reflected in an open chat.
    const channel = supabase
      .channel(`messages:${conversation.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversationId=eq.${conversation.id}` },
        (payload) => {
          setMessages((prev) => {
            const already = prev.some((m) => m.id === payload.new.id);
            return already ? prev : [...prev, payload.new as Message];
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversationId=eq.${conversation.id}` },
        (payload) => {
          const updated = payload.new as Message;
          setMessages((prev) => prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)));
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages', filter: `conversationId=eq.${conversation.id}` },
        (payload) => {
          const gone = payload.old as { id?: string };
          if (gone?.id) setMessages((prev) => prev.filter((m) => m.id !== gone.id));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversation?.id]);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [selectedReactionMsgId, setSelectedReactionMsgId] = useState<string | null>(null);

  const [attachError, setAttachError] = useState<string | null>(null);
  const [plainText, setPlainText] = useState<Record<string, string>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  // Separate pickers: one generic file chooser cannot express "photos only",
  // "videos only" or "open the camera", so all three attachment buttons used
  // to open the same accept="*/*" dialog.
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, uploadProgress]);

  // Direct-chat message bodies are stored as an encrypted JSON payload. Without
  // this pass the bubble rendered the raw ciphertext JSON, which is what the
  // E2EE banner was promising to protect but nothing was ever unwrapping.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const updates: Record<string, string> = {};
      for (const msg of messages) {
        if (!msg.text || plainText[msg.id] !== undefined) continue;
        const payload = parseEncryptedText(msg.text);
        if (!payload) continue;
        const decoded = await decryptMessage(payload, msg.senderId === currentUser.id);
        updates[msg.id] =
          decoded ?? 'This message was encrypted for another device and cannot be opened here.';
      }
      if (!cancelled && Object.keys(updates).length) {
        setPlainText((prev) => ({ ...prev, ...updates }));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, currentUser.id]);

  /** The text to show for a bubble: decrypted when encrypted, as-is otherwise. */
  const textOf = (msg: Message): string => {
    if (!msg.text) return '';
    if (!parseEncryptedText(msg.text)) return msg.text;
    return plainText[msg.id] ?? 'Decrypting…';
  };

  // Voice recording timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecordingVoice) {
      interval = setInterval(() => {
        setRecordSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setRecordSeconds(0);
    }
    return () => clearInterval(interval);
  }, [isRecordingVoice]);

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;
    sound.playSend();
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;

    const problem = validateAttachment(file, MAX_ATTACHMENT_BYTES);
    if (problem) {
      setAttachError(problem);
      input.value = '';
      return;
    }

    setAttachError(null);
    setShowAttachMenu(false);
    setUploadProgress(5);
    sound.playTap();

    const formattedSize = formatFileSize(file.size);
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    const isAudio = file.type.startsWith('audio/');

    let mediaType: MediaType = 'document';
    if (isImage) mediaType = 'image';
    else if (isVideo) mediaType = 'video';
    else if (isAudio) mediaType = 'audio';

    try {
      const url = await uploadFileToStorage(
        `chat-media/${conversation.id}/${Date.now()}_${file.name}`,
        file,
        { onProgress: setUploadProgress, contentType: file.type }
      );
      sound.playSend();
      onSendMessage('', {
        url,
        type: mediaType,
        fileName: file.name,
        fileSize: formattedSize,
        fileSizeBytes: file.size,
      });
    } catch (err) {
      console.error('File upload failed', err);
      setAttachError(
        err instanceof Error ? err.message : 'Failed to upload that file. Please try again.'
      );
    } finally {
      setUploadProgress(null);
      input.value = '';
    }
  };

  /** Opens a picker and closes the attachment sheet behind it. */
  const openPicker = (ref: React.RefObject<HTMLInputElement | null>) => {
    sound.playTap();
    setAttachError(null);
    setShowAttachMenu(false);
    ref.current?.click();
  };

  /**
   * MediaRecorder support differs by engine. Passing no mimeType leaves the
   * container to the browser and produced files the receiving side could not
   * always decode, so negotiate an explicitly supported one and keep the
   * matching file extension.
   */
  const pickRecordingFormat = (): { mimeType?: string; extension: string } => {
    const candidates: Array<{ mimeType: string; extension: string }> = [
      { mimeType: 'audio/webm;codecs=opus', extension: 'webm' },
      { mimeType: 'audio/webm', extension: 'webm' },
      { mimeType: 'audio/ogg;codecs=opus', extension: 'ogg' },
      { mimeType: 'audio/mp4', extension: 'm4a' },
    ];
    for (const option of candidates) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(option.mimeType)) {
        return option;
      }
    }
    return { extension: 'webm' };
  };

  const recordingFormatRef = useRef<{ mimeType?: string; extension: string }>({ extension: 'webm' });

  const handleStartVoiceRecord = async () => {
    setAttachError(null);
    sound.resume();

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setAttachError('Voice notes are not supported on this device.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      mediaStreamRef.current = stream;
      recordedChunksRef.current = [];

      const format = pickRecordingFormat();
      recordingFormatRef.current = format;

      const recorder = format.mimeType
        ? new MediaRecorder(stream, { mimeType: format.mimeType })
        : new MediaRecorder(stream);

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) recordedChunksRef.current.push(ev.data);
      };
      recorder.onerror = () => {
        stopRecordingStream();
        setIsRecordingVoice(false);
        setAttachError('Recording stopped unexpectedly. Please try again.');
      };

      mediaRecorderRef.current = recorder;
      // Timeslice so long recordings flush progressively instead of buffering
      // the whole clip in one blob at stop().
      recorder.start(1000);
      sound.playTap();
      setIsRecordingVoice(true);
    } catch (err) {
      console.error('Microphone access failed', err);
      const name = (err as DOMException)?.name;
      setAttachError(
        name === 'NotAllowedError' || name === 'SecurityError'
          ? 'Microphone access was denied. Enable the microphone permission for S\u2019ovo in Android settings.'
          : name === 'NotFoundError'
          ? 'No microphone was found on this device.'
          : 'Could not access the microphone.'
      );
    }
  };

  const stopRecordingStream = () => {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  };

  const handleFinishVoiceRecord = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) {
      stopRecordingStream();
      setIsRecordingVoice(false);
      return;
    }

    // A sub-second tap is a cancel, not a send — but the recorder still has to
    // be stopped, otherwise it stays live and leaks into the next recording.
    if (recordSeconds < 1) {
      try {
        if (recorder.state !== 'inactive') recorder.stop();
      } catch {
        // already stopped
      }
      mediaRecorderRef.current = null;
      stopRecordingStream();
      setIsRecordingVoice(false);
      return;
    }

    const durationSeconds = recordSeconds;
    const { extension } = recordingFormatRef.current;

    recorder.onstop = async () => {
      stopRecordingStream();
      mediaRecorderRef.current = null;

      const mimeType = recorder.mimeType || recordingFormatRef.current.mimeType || 'audio/webm';
      const blob = new Blob(recordedChunksRef.current, { type: mimeType });
      recordedChunksRef.current = [];
      setIsRecordingVoice(false);

      if (blob.size === 0) {
        setAttachError('That recording came out empty. Please try again.');
        return;
      }

      setUploadProgress(5);
      const fileName = `Voice_${new Date().toISOString().replace(/[:.]/g, '-')}.${extension}`;
      try {
        const url = await uploadFileToStorage(
          `chat-media/${conversation.id}/${Date.now()}_${fileName}`,
          blob,
          { onProgress: setUploadProgress, contentType: mimeType }
        );
        sound.playSend();
        onSendMessage('', {
          url,
          type: 'voice_note',
          fileName,
          fileSize: formatFileSize(blob.size),
          fileSizeBytes: blob.size,
          duration: durationSeconds,
        });
      } catch (err) {
        console.error('Voice note upload failed', err);
        setAttachError(
          err instanceof Error ? err.message : 'Failed to send that voice note. Please try again.'
        );
      } finally {
        setUploadProgress(null);
      }
    };

    try {
      if (recorder.state !== 'inactive') recorder.stop();
    } catch {
      stopRecordingStream();
      setIsRecordingVoice(false);
    }
  };

  const handleCancelVoiceRecord = () => {
    sound.playTap();
    const recorder = mediaRecorderRef.current;
    if (recorder) {
      // Drop the onstop handler first so cancelling never uploads the clip.
      recorder.onstop = null;
      try {
        if (recorder.state !== 'inactive') recorder.stop();
      } catch {
        // already stopped
      }
    }
    mediaRecorderRef.current = null;
    recordedChunksRef.current = [];
    stopRecordingStream();
    setIsRecordingVoice(false);
  };

  const toggleAudioPlay = (msgId: string, url?: string) => {
    sound.playTap();
    if (playingAudioId === msgId) {
      audioPlayerRef.current?.pause();
      setPlayingAudioId(null);
      return;
    }
    if (!url) return;
    if (!audioPlayerRef.current) {
      audioPlayerRef.current = new Audio();
      audioPlayerRef.current.onended = () => setPlayingAudioId(null);
      audioPlayerRef.current.onerror = () => {
        setPlayingAudioId(null);
        setAttachError('That audio clip could not be played.');
      };
    }
    const player = audioPlayerRef.current;
    player.pause();
    player.src = url;
    player.currentTime = 0;
    player
      .play()
      .then(() => setPlayingAudioId(msgId))
      .catch((err) => {
        console.error('Audio playback failed', err);
        setPlayingAudioId(null);
        setAttachError('That audio clip could not be played.');
      });
  };

  useEffect(() => {
    return () => {
      audioPlayerRef.current?.pause();
      audioPlayerRef.current = null;
      mediaRecorderRef.current?.stream?.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const formatAudioDuration = (seconds?: number) => {
    const total = seconds || 0;
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className="flex flex-col h-[calc(100vh-68px)] md:h-[calc(100vh-80px)] w-full max-w-4xl mx-auto bg-[#07070b] border-x border-[#1c1b24] shadow-2xl relative select-none"
      id="sovo-chat-room"
    >
      {/* Hidden pickers — one per attachment kind so the OS shows the right
          chooser (gallery / video library / camera) instead of a raw file list. */}
      <input ref={fileInputRef} type="file" onChange={handleFileUpload} className="hidden" accept="*/*" />
      <input
        ref={photoInputRef}
        type="file"
        onChange={handleFileUpload}
        className="hidden"
        accept="image/*"
      />
      <input
        ref={videoInputRef}
        type="file"
        onChange={handleFileUpload}
        className="hidden"
        accept="video/*"
      />
      <input
        ref={cameraInputRef}
        type="file"
        onChange={handleFileUpload}
        className="hidden"
        accept="image/*,video/*"
        capture="environment"
      />

      {/* Top Navigation Bar */}
      <header className="h-16 px-4 py-2.5 bg-[#0c0c12]/95 backdrop-blur-md border-b border-[#22212d] flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              sound.playTap();
              onBack();
            }}
            className="p-2 -ml-1 rounded-full text-gray-300 hover:text-white hover:bg-[#1a1924] transition cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div
            onClick={() => setShowDetailsModal(true)}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="relative">
              <img
                src={conversation.avatar}
                alt={conversation.name}
                className="w-10 h-10 rounded-full object-cover border border-[#d4af37]/40 shadow-sm"
              />
              {conversation.type === 'direct' && conversation.isOnline && (
                <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-black" />
              )}
            </div>

            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-display font-bold text-white group-hover:text-[#ffd700] transition">
                  {conversation.name}
                </span>
                {conversation.isEncrypted && (
                  <ShieldCheck className="w-3.5 h-3.5 text-[#ffd700]" />
                )}
              </div>

              <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                {conversation.type === 'group' ? (
                  <span className="text-[#d4af37] font-semibold">
                    {conversation.memberCount} / {conversation.maxMembers} members
                  </span>
                ) : conversation.username ? (
                  <span className="font-mono text-[#ffd700]">@{conversation.username}</span>
                ) : (
                  <span>{conversation.isOnline ? 'Online' : 'Offline'}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Header Action Buttons: Calls, E2EE Verifier, Details */}
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={() => {
              sound.playTap();
              onStartCall('audio');
            }}
            className="p-2 rounded-xl text-[#ffd700] bg-[#17150e] hover:bg-[#252014] border border-[#d4af37]/30 transition cursor-pointer"
            title="Encrypted Voice Call"
          >
            <Phone className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              sound.playTap();
              onStartCall('video');
            }}
            className="p-2 rounded-xl text-[#ffd700] bg-[#17150e] hover:bg-[#252014] border border-[#d4af37]/30 transition cursor-pointer"
            title="Encrypted Video Call"
          >
            <VideoIcon className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              sound.playTap();
              onOpenE2EEModal();
            }}
            className="p-2 rounded-xl text-gray-300 hover:text-[#ffd700] bg-[#12121a] hover:bg-[#1c1b26] border border-[#272635] transition cursor-pointer"
            title="Inspect E2EE Safety Keys"
          >
            <Lock className="w-4 h-4 text-[#d4af37]" />
          </button>

          <button
            type="button"
            onClick={() => {
              sound.playTap();
              setShowDetailsModal(true);
            }}
            className="p-2 rounded-xl text-gray-300 hover:text-white bg-[#12121a] hover:bg-[#1c1b26] border border-[#272635] transition cursor-pointer"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* End-to-End Encryption Security Banner */}
      <div className="py-1.5 px-4 bg-[#12110c] border-b border-[#d4af37]/20 flex items-center justify-center gap-2 text-[11px] text-[#d4af37]">
        <Lock className="w-3 h-3 text-[#ffd700]" />
        <span>End-to-End Encrypted (S’ovo 4096-bit zero storage). Fingerprint:</span>
        <span className="font-mono font-bold text-[#fff2a3] text-[10px]">
          {conversation.e2eeKeyFingerprint.slice(0, 16)}...
        </span>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
        {/* Chat introduction card */}
        <div className="max-w-xs mx-auto text-center p-3 rounded-2xl bg-[#0e0e15] border border-[#22212d] text-xs text-gray-400">
          <p className="font-semibold text-white mb-1">
            {conversation.type === 'group' ? conversation.name : `Chat with ${conversation.name}`}
          </p>
          <p className="text-[11px] leading-relaxed">
            {conversation.type === 'group'
              ? `High-capacity group with up to 500 participants and 2GB file transfers.`
              : `All messages, calls, and up to 2GB media shared here are protected by S'ovo double-ratchet cryptography.`}
          </p>
        </div>

        {/* Message bubbles list */}
        {messages.map((msg) => {
          const isMe = msg.senderId === currentUser.id;

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group relative`}
            >
              <div
                className={`max-w-[85%] sm:max-w-[70%] rounded-2xl p-3 shadow-md relative transition-all ${
                  isMe
                    ? 'bg-gradient-to-br from-[#282110] via-[#1a170d] to-[#121008] border border-[#d4af37]/40 text-white rounded-br-xs'
                    : 'bg-[#111118] border border-[#262534] text-gray-100 rounded-bl-xs'
                }`}
              >
                {/* Group sender name */}
                {conversation.type === 'group' && !isMe && (
                  <p className="text-[11px] font-bold text-[#ffd700] mb-1 font-mono">
                    {msg.senderName}
                  </p>
                )}

                {/* Media rendering: Photos, Videos, Documents up to 2GB, Audio */}
                {msg.mediaType === 'image' && msg.mediaUrl && (
                  <div className="rounded-xl overflow-hidden mb-2 border border-black/40">
                    <a href={msg.mediaUrl} target="_blank" rel="noreferrer">
                      <img
                        src={msg.mediaUrl}
                        alt={msg.fileName || 'Shared photo'}
                        loading="lazy"
                        className="w-full max-h-72 object-cover"
                      />
                    </a>
                  </div>
                )}

                {msg.mediaType === 'video' && msg.mediaUrl && (
                  <div className="rounded-xl overflow-hidden mb-2 border border-black/40 bg-black">
                    <video
                      src={msg.mediaUrl}
                      controls
                      playsInline
                      preload="metadata"
                      className="w-full max-h-72"
                    />
                  </div>
                )}

                {/* 2GB Encrypted File Attachment Card */}
                {(msg.mediaType === 'document' || msg.mediaType === 'encrypted_file') && (
                  <div className="flex items-center gap-3 p-2.5 rounded-xl bg-[#09090e] border border-[#d4af37]/30 mb-1.5">
                    <div className="p-2.5 rounded-lg bg-[#1c180e] text-[#ffd700] border border-[#d4af37]/40">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white truncate">
                        {msg.fileName || 'Encrypted_Payload.bin'}
                      </p>
                      <p className="text-[10px] text-[#ffd700] font-mono">
                        {msg.fileSize || 'Attachment'} • Encrypted transfer
                      </p>
                    </div>
                    {/* Previously this only popped an alert() saying it was
                        downloading — nothing was ever fetched. A real anchor
                        hands the URL to the WebView's DownloadListener
                        (see MainActivity), which saves it via DownloadManager. */}
                    <a
                      href={msg.mediaUrl}
                      download={msg.fileName || 'sovo-attachment'}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => sound.playTap()}
                      className="p-2 rounded-lg bg-[#191924] hover:bg-[#282738] text-[#d4af37] cursor-pointer transition"
                      title={`Download ${msg.fileName || 'attachment'}`}
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  </div>
                )}

                {/* Voice Note Attachment Player */}
                {(msg.mediaType === 'voice_note' || msg.mediaType === 'audio') && (
                  <div className="flex items-center gap-2.5 p-2 rounded-xl bg-[#09090e] border border-[#272635] mb-1.5 min-w-[200px]">
                    <button
                      type="button"
                      onClick={() => toggleAudioPlay(msg.id, msg.mediaUrl)}
                      className="w-8 h-8 rounded-full gold-gradient-bg text-black flex items-center justify-center cursor-pointer shadow flex-shrink-0"
                    >
                      {playingAudioId === msg.id ? (
                        <Pause className="w-3.5 h-3.5 fill-black" />
                      ) : (
                        <Play className="w-3.5 h-3.5 fill-black ml-0.5" />
                      )}
                    </button>

                    {/* Animated waveform visualizer bars */}
                    <div className="flex-1 flex items-center gap-0.5 h-6">
                      {[40, 70, 30, 90, 50, 100, 80, 45, 60, 85, 30, 75, 95, 60, 40].map(
                        (h, i) => (
                          <div
                            key={i}
                            className={`w-1 rounded-full transition-all ${
                              playingAudioId === msg.id
                                ? 'bg-[#ffd700] animate-pulse'
                                : 'bg-[#3b3a4a]'
                            }`}
                            style={{ height: `${h}%` }}
                          />
                        )
                      )}
                    </div>

                    <span className="text-[10px] font-mono text-gray-400">
                      {formatAudioDuration(msg.audioDurationSeconds)}
                    </span>
                  </div>
                )}

                {/* Text Message Content (decrypted for E2EE direct chats) */}
                {textOf(msg) && (
                  <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words">
                    {textOf(msg)}
                  </p>
                )}

                {/* Bubble Footer: Timestamp & Read Receipts */}
                <div className="flex items-center justify-end gap-1.5 mt-1 text-[10px] text-gray-400">
                  <span>
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>

                  {isMe && (
                    <span className="flex items-center">
                      {msg.status === 'sending' && (
                        <Clock className="w-3 h-3 text-gray-400 animate-spin" />
                      )}
                      {msg.status === 'sent' && <Check className="w-3 h-3 text-gray-400" />}
                      {msg.status === 'delivered' && (
                        <CheckCheck className="w-3.5 h-3.5 text-gray-400" />
                      )}
                      {msg.status === 'read' && (
                        <CheckCheck
                          className={`w-3.5 h-3.5 ${
                            settings.readReceipts
                              ? 'text-[#ffd700] drop-shadow-[0_0_4px_#ffd700]'
                              : 'text-gray-400'
                          }`}
                        />
                      )}
                    </span>
                  )}
                </div>

                {/* Reaction badge */}
                {msg.userReaction && (
                  <div className="absolute -bottom-2 -right-1 px-1.5 py-0.5 rounded-full bg-[#1c180e] border border-[#d4af37]/60 text-xs shadow-sm">
                    {msg.userReaction}
                  </div>
                )}
              </div>

              {/* Hover Quick Reaction Bar */}
              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 mt-1 bg-[#12121a] border border-[#272635] px-2 py-0.5 rounded-full">
                {['🔥', '👑', '✨', '💛', '🔒'].map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      sound.playTap();
                      onToggleReaction(msg.id, emoji);
                    }}
                    className="hover:scale-125 transition-transform text-xs cursor-pointer"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          );
        })}

        {/* 2GB Upload Progress Indicator */}
        {uploadProgress !== null && (
          <div className="max-w-[80%] ml-auto p-3 rounded-2xl bg-[#1a170e] border border-[#ffd700]/50 text-white shadow-lg animate-fadeIn">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-semibold text-[#ffd700] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Uploading attachment…
              </span>
              <span className="font-mono text-[#ffd700]">{uploadProgress}%</span>
            </div>
            <div className="w-full h-1.5 bg-black/60 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#d4af37] to-[#fff2a3] transition-all duration-200"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Attachment Menu Popup */}
      <AnimatePresence>
        {showAttachMenu && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute bottom-20 left-4 z-30 p-3 bg-[#0d0d14] border border-[#d4af37]/40 rounded-2xl shadow-2xl grid grid-cols-4 gap-2 w-80 text-white"
          >
            <button
              type="button"
              onClick={() => openPicker(photoInputRef)}
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-[#14141d] hover:bg-[#1f1e29] border border-[#272635] text-xs font-semibold cursor-pointer"
            >
              <div className="p-2 rounded-full bg-[#1c180e] text-[#ffd700]">
                <ImageIcon className="w-5 h-5" />
              </div>
              <span className="text-[11px]">Photos</span>
            </button>

            <button
              type="button"
              onClick={() => openPicker(videoInputRef)}
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-[#14141d] hover:bg-[#1f1e29] border border-[#272635] text-xs font-semibold cursor-pointer"
            >
              <div className="p-2 rounded-full bg-[#1c180e] text-[#ffd700]">
                <Video className="w-5 h-5" />
              </div>
              <span className="text-[11px]">Video</span>
            </button>

            <button
              type="button"
              onClick={() => openPicker(cameraInputRef)}
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-[#14141d] hover:bg-[#1f1e29] border border-[#272635] text-xs font-semibold cursor-pointer"
            >
              <div className="p-2 rounded-full bg-[#1c180e] text-[#ffd700]">
                <Camera className="w-5 h-5" />
              </div>
              <span className="text-[11px]">Camera</span>
            </button>

            <button
              type="button"
              onClick={() => openPicker(fileInputRef)}
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-[#14141d] hover:bg-[#1f1e29] border border-[#272635] text-xs font-semibold cursor-pointer"
            >
              <div className="p-2 rounded-full bg-[#1c180e] text-[#ffd700]">
                <FileText className="w-5 h-5" />
              </div>
              <span className="text-[11px]">File</span>
            </button>

            <p className="col-span-4 text-center text-[10px] text-gray-500 pt-1">
              Up to {Math.round(MAX_ATTACHMENT_BYTES / 1024 / 1024)}MB per attachment
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Message Input Bar */}
      <footer className="p-3 bg-[#0c0c12]/95 backdrop-blur-md border-t border-[#22212d] z-20">
        {/* Attachment / microphone failures used to go to alert() or only the
            console; surface them inline so the cause is visible in the APK. */}
        {attachError && (
          <div className="mb-2 flex items-start gap-2 px-3 py-2 rounded-xl bg-red-950/60 border border-red-800/60 text-[11px] text-red-200">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span className="flex-1">{attachError}</span>
            <button
              type="button"
              onClick={() => setAttachError(null)}
              className="text-red-300 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        {!isRecordingVoice ? (
          <form onSubmit={handleSend} className="flex items-center gap-2">
            {/* Attachment Button */}
            <button
              type="button"
              onClick={() => {
                sound.playTap();
                setShowAttachMenu(!showAttachMenu);
              }}
              className="p-2.5 rounded-full bg-[#14141d] hover:bg-[#201f2c] border border-[#272635] text-gray-300 hover:text-[#ffd700] transition cursor-pointer"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            {/* Text Input */}
            <div className="relative flex-1">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Type an end-to-end encrypted message..."
                className="w-full pl-4 pr-10 py-3 bg-[#13131b] border border-[#262534] focus:border-[#ffd700] rounded-2xl text-xs sm:text-sm text-white placeholder-gray-500 outline-none transition"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                <Lock className="w-3.5 h-3.5 text-[#d4af37]" />
              </span>
            </div>

            {/* Voice record or Send Button */}
            {inputText.trim() ? (
              <button
                type="submit"
                className="w-11 h-11 rounded-2xl gold-gradient-bg text-black flex items-center justify-center shadow-lg transition active:scale-95 cursor-pointer"
              >
                <Send className="w-4 h-4 fill-black" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  sound.resume();
                  void handleStartVoiceRecord();
                }}
                className="w-11 h-11 rounded-2xl bg-[#18160e] border border-[#d4af37]/40 text-[#ffd700] hover:bg-[#282214] flex items-center justify-center shadow transition active:scale-95 cursor-pointer"
                title="Record Voice Note"
              >
                <Mic className="w-4 h-4" />
              </button>
            )}
          </form>
        ) : (
          /* Live Voice Recording Bar */
          <div className="flex items-center justify-between p-2 rounded-2xl bg-[#1c180e] border border-[#ffd700]/50 text-white animate-fadeIn">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-red-600 animate-pulse flex items-center justify-center">
                <Mic className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#ffd700]">Recording Voice Message</p>
                <p className="text-[10px] font-mono text-gray-300">
                  {formatAudioDuration(recordSeconds)} • Encrypting audio stream
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCancelVoiceRecord}
                className="p-2 rounded-xl text-gray-400 hover:text-red-400 bg-black/40 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleFinishVoiceRecord}
                className="px-3.5 py-1.5 rounded-xl gold-gradient-bg text-black font-semibold text-xs flex items-center gap-1 cursor-pointer shadow active:scale-95"
              >
                <Send className="w-3.5 h-3.5 fill-black" />
                <span>Send</span>
              </button>
            </div>
          </div>
        )}
      </footer>

      {/* Conversation Details & Group Members Modal */}
      <AnimatePresence>
        {showDetailsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-[#0c0c12] border border-[#d4af37]/35 rounded-3xl p-6 shadow-2xl text-white"
            >
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#20202a]">
                <h3 className="font-display font-bold text-lg text-gold-glossy">
                  {conversation.type === 'group' ? 'Group Details' : 'Contact Profile'}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowDetailsModal(false)}
                  className="p-1 rounded-full text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex flex-col items-center text-center mb-6">
                <img
                  src={conversation.avatar}
                  alt={conversation.name}
                  className="w-20 h-20 rounded-full object-cover border-2 border-[#d4af37] mb-2 shadow-lg"
                />
                <h4 className="text-base font-bold text-white">{conversation.name}</h4>
                {conversation.username && (
                  <p className="text-xs font-mono text-[#ffd700]">@{conversation.username}</p>
                )}
                {conversation.groupDescription && (
                  <p className="text-xs text-gray-300 mt-2 max-w-xs leading-relaxed">
                    {conversation.groupDescription}
                  </p>
                )}
              </div>

              {/* Group participant badge */}
              {conversation.type === 'group' && (
                <div className="p-3 rounded-2xl bg-[#12121a] border border-[#272635] mb-4">
                  <div className="flex items-center justify-between text-xs mb-1 font-semibold">
                    <span className="text-gray-300">Group Capacity</span>
                    <span className="text-[#ffd700] font-mono">
                      {conversation.memberCount} / 500 Members
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-[#1f1e29] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#d4af37]"
                      style={{ width: `${(conversation.memberCount / 500) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Security Key Inspector Button */}
              <button
                type="button"
                onClick={() => {
                  setShowDetailsModal(false);
                  onOpenE2EEModal();
                }}
                className="w-full py-3 rounded-xl bg-[#17150e] border border-[#d4af37]/40 text-[#ffd700] text-xs font-bold flex items-center justify-center gap-2 hover:bg-[#252014] transition cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Verify 4096-bit Security Safety Numbers</span>
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};



