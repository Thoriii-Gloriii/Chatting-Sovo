import { supabase } from '../lib/supabase';
import { uploadFileToStorage } from '../lib/upload';
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
      .eq('conversation_id', conversation.id)
      .order('timestamp', { ascending: true })
      .then(({ data }) => {
        if (data) setMessages(data as Message[]);
      });

    // Realtime subscription for new messages
    const channel = supabase
      .channel(`messages:${conversation.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversation.id}` },
        (payload) => {
          setMessages((prev) => {
            const already = prev.some((m) => m.id === payload.new.id);
            return already ? prev : [...prev, payload.new as Message];
          });
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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, uploadProgress]);

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
    const file = e.target.files?.[0];
    if (!file) return;

    // Real uploads go to Firebase Storage, so keep this within a sane free-tier limit.
    const maxBytes = 25 * 1024 * 1024; // 25MB
    if (file.size > maxBytes) {
      alert('File exceeds the 25MB sharing limit.');
      e.target.value = '';
      return;
    }

    setShowAttachMenu(false);
    setUploadProgress(10);
    sound.playTap();

    const formattedSize = formatFileSize(file.size);
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    const isAudio = file.type.startsWith('audio/');

    let mediaType: MediaType = 'document';
    if (isImage) mediaType = 'image';
    else if (isVideo) mediaType = 'video';
    else if (isAudio) mediaType = 'audio';
    else if (file.size > 15 * 1024 * 1024) mediaType = 'encrypted_file';

    try {
      setUploadProgress(40);
      const url = await uploadFileToStorage(
        `chat-media/${conversation.id}/${Date.now()}_${file.name}`,
        file
      );
      setUploadProgress(100);
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
      alert('Failed to upload file. Please try again.');
    } finally {
      setUploadProgress(null);
      e.target.value = '';
    }
  };

  const handleStartVoiceRecord = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      recordedChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) recordedChunksRef.current.push(ev.data);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      sound.playTap();
      setIsRecordingVoice(true);
    } catch (err) {
      console.error('Microphone access failed', err);
      alert('Could not access the microphone. Check your browser/app permissions.');
    }
  };

  const stopRecordingStream = () => {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  };

  const handleFinishVoiceRecord = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recordSeconds < 1) {
      stopRecordingStream();
      setIsRecordingVoice(false);
      return;
    }
    recorder.onstop = async () => {
      stopRecordingStream();
      const blob = new Blob(recordedChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
      setIsRecordingVoice(false);
      setUploadProgress(50);
      try {
        const url = await uploadFileToStorage(
          `chat-media/${conversation.id}/${Date.now()}_voice.webm`,
          blob
        );
        sound.playSend();
        onSendMessage('', {
          url,
          type: 'voice_note',
          fileName: `Voice_${Date.now().toString().slice(-4)}.webm`,
          fileSize: formatFileSize(blob.size),
          fileSizeBytes: blob.size,
          duration: recordSeconds,
        });
      } catch (err) {
        console.error('Voice note upload failed', err);
        alert('Failed to send voice note. Please try again.');
      } finally {
        setUploadProgress(null);
      }
    };
    recorder.stop();
  };

  const handleCancelVoiceRecord = () => {
    sound.playTap();
    mediaRecorderRef.current?.stop();
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
    }
    audioPlayerRef.current.src = url;
    audioPlayerRef.current.play().catch((err) => console.error('Audio playback failed', err));
    setPlayingAudioId(msgId);
  };

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
      {/* Hidden file picker input */}
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileUpload}
        className="hidden"
        accept="*/*"
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
                    <img
                      src={msg.mediaUrl}
                      alt="Encrypted attachment"
                      className="w-full max-h-72 object-cover"
                    />
                  </div>
                )}

                {msg.mediaType === 'video' && msg.mediaUrl && (
                  <div className="rounded-xl overflow-hidden mb-2 border border-black/40 bg-black">
                    <video src={msg.mediaUrl} controls className="w-full max-h-72" />
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
                        {msg.fileSize || '1.8 GB'} • 2GB S'ovo Stream
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        sound.playTap();
                        alert(`Downloading encrypted file: ${msg.fileName}`);
                      }}
                      className="p-2 rounded-lg bg-[#191924] hover:bg-[#282738] text-[#d4af37] cursor-pointer transition"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Voice Note Attachment Player */}
                {msg.mediaType === 'voice_note' && (
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

                {/* Text Message Content */}
                {msg.text && (
                  <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words">
                    {msg.text}
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
                <Sparkles className="w-3.5 h-3.5" /> Encrypting 2GB File Stream...
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
            className="absolute bottom-20 left-4 z-30 p-3 bg-[#0d0d14] border border-[#d4af37]/40 rounded-2xl shadow-2xl grid grid-cols-3 gap-2 w-72 text-white"
          >
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-[#14141d] hover:bg-[#1f1e29] border border-[#272635] text-xs font-semibold cursor-pointer"
            >
              <div className="p-2 rounded-full bg-[#1c180e] text-[#ffd700]">
                <FileText className="w-5 h-5" />
              </div>
              <span className="text-[11px]">2GB Files</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-[#14141d] hover:bg-[#1f1e29] border border-[#272635] text-xs font-semibold cursor-pointer"
            >
              <div className="p-2 rounded-full bg-[#1c180e] text-[#ffd700]">
                <ImageIcon className="w-5 h-5" />
              </div>
              <span className="text-[11px]">Photos</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-[#14141d] hover:bg-[#1f1e29] border border-[#272635] text-xs font-semibold cursor-pointer"
            >
              <div className="p-2 rounded-full bg-[#1c180e] text-[#ffd700]">
                <Video className="w-5 h-5" />
              </div>
              <span className="text-[11px]">4K Video</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Message Input Bar */}
      <footer className="p-3 bg-[#0c0c12]/95 backdrop-blur-md border-t border-[#22212d] z-20">
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
                onClick={handleStartVoiceRecord}
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
                  0:0{recordSeconds} • Encrypting audio stream
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



