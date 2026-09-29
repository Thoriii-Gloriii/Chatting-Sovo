import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserStatusStory, StatusItem, User, StoryDuration, StoryPrivacy } from '../types';
import { formatStoryExpiration } from '../lib/crypto';
import { sound } from '../lib/sound';
import {
  Heart,
  Send,
  Lock,
  Sparkles,
  Volume2,
  VolumeX,
  Clock,
  ShieldCheck,
  Plus,
  X,
  ChevronDown,
  ChevronUp,
  Music,
  Share2,
  Users,
  Eye,
  Check,
  Image as ImageIcon,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { validateAttachment, MAX_ATTACHMENT_BYTES } from '../lib/upload';

interface StatusReelsViewProps {
  stories: UserStatusStory[];
  currentUser: User;
  onSendStatusReply: (contactId: string, replyText: string, statusItem: StatusItem) => void;
  onAddStatus: (file: File, caption: string, durationDays: StoryDuration, privacy: StoryPrivacy) => Promise<void>;
  onToggleLike: (storyUserId: string, itemId: string) => void;
  /** Story to open directly on (e.g. the user tapped a specific avatar in the
   *  carousel rather than the generic "Statuses" tab). Falls back to the
   *  first story when absent or not found. */
  initialUserId?: string;
  /** Exit the full-screen story viewer back to the previous screen. */
  onClose: () => void;
}

export const StatusReelsView: React.FC<StatusReelsViewProps> = ({
  stories,
  currentUser,
  onSendStatusReply,
  onAddStatus,
  onToggleLike,
  initialUserId,
  onClose,
}) => {
  const [currentUserIndex, setCurrentUserIndex] = useState(() => {
    if (!initialUserId) return 0;
    const idx = stories.findIndex((s) => s.userId === initialUserId);
    return idx >= 0 ? idx : 0;
  });
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isPaused, setIsPaused] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [floatingHearts, setFloatingHearts] = useState<{ id: number; x: number; y: number }[]>([]);

  // New status form state
  const [newCaption, setNewCaption] = useState('');
  const [newDuration, setNewDuration] = useState<StoryDuration>(1);
  const [newPrivacy, setNewPrivacy] = useState<StoryPrivacy>('all_contacts');
  const [newMediaFile, setNewMediaFile] = useState<File | null>(null);
  const [newMediaPreviewUrl, setNewMediaPreviewUrl] = useState<string | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const [postError, setPostError] = useState('');
  const [postProgress, setPostProgress] = useState<number | null>(null);
  const statusFileInputRef = useRef<HTMLInputElement>(null);
  const reelVideoRef = useRef<HTMLVideoElement>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const activeUserStory = stories[currentUserIndex] || stories[0];
  const activeItem = activeUserStory?.items[currentItemIndex] || activeUserStory?.items[0];

  // Auto-progress bar timer
  useEffect(() => {
    if (!activeItem || isPaused || showAddModal) return;

    // Images advance on a fixed beat; a video gets its own length (capped) so
    // a 30-second clip is not cut off after 6.5 seconds.
    const slideMs = activeItem.mediaType === 'video' ? 30_000 : 6_500;
    const timer = setInterval(() => {
      handleNextItem();
    }, slideMs);

    return () => clearInterval(timer);
  }, [currentUserIndex, currentItemIndex, isPaused, showAddModal, activeItem]);

  // Keep the <video> element in step with the reel's pause and mute controls.
  useEffect(() => {
    const el = reelVideoRef.current;
    if (!el) return;
    el.muted = isMuted;
    if (isPaused || showAddModal) {
      el.pause();
    } else {
      void el.play().catch(() => undefined);
    }
  }, [isPaused, isMuted, showAddModal, activeItem?.id]);

  const handleNextItem = () => {
    if (!activeUserStory) return;
    if (currentItemIndex < activeUserStory.items.length - 1) {
      setCurrentItemIndex((prev) => prev + 1);
    } else {
      // Go to next user story
      if (currentUserIndex < stories.length - 1) {
        setCurrentUserIndex((prev) => prev + 1);
        setCurrentItemIndex(0);
      } else {
        // Loop back to start
        setCurrentUserIndex(0);
        setCurrentItemIndex(0);
      }
    }
  };

  const handlePrevItem = () => {
    if (currentItemIndex > 0) {
      setCurrentItemIndex((prev) => prev - 1);
    } else if (currentUserIndex > 0) {
      const prevUser = stories[currentUserIndex - 1];
      setCurrentUserIndex((prev) => prev - 1);
      setCurrentItemIndex(prevUser.items.length - 1);
    }
  };

  const handleVerticalScroll = (direction: 'up' | 'down') => {
    sound.playTap();
    if (direction === 'down' && currentUserIndex < stories.length - 1) {
      setCurrentUserIndex((prev) => prev + 1);
      setCurrentItemIndex(0);
    } else if (direction === 'up' && currentUserIndex > 0) {
      setCurrentUserIndex((prev) => prev - 1);
      setCurrentItemIndex(0);
    }
  };

  const handleDoubleTap = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const heartId = Date.now();
    setFloatingHearts((prev) => [...prev, { id: heartId, x, y }]);
    setTimeout(() => {
      setFloatingHearts((prev) => prev.filter((h) => h.id !== heartId));
    }, 1000);

    if (activeUserStory && activeItem) {
      onToggleLike(activeUserStory.userId, activeItem.id);
      sound.playTap();

      try {
        confetti({
          particleCount: 25,
          spread: 60,
          origin: { x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight },
          colors: ['#ffd700', '#d4af37', '#fff2a3'],
          disableForReducedMotion: true,
        });
      } catch {
        // ignore
      }
    }
  };

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !activeUserStory || !activeItem) return;
    sound.playSend();
    onSendStatusReply(activeUserStory.userId, replyText, activeItem);
    setReplyText('');
  };

  const handleMediaFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      setPostError('Please choose an image or video file.');
      return;
    }

    const problem = validateAttachment(file, MAX_ATTACHMENT_BYTES);
    if (problem) {
      setPostError(problem);
      e.target.value = '';
      return;
    }

    setPostError('');
    setNewMediaFile(file);
    // Free the previous preview before replacing it — these were leaking one
    // blob URL per file the user previewed.
    setNewMediaPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  };

  // Release the outstanding preview URL when the view unmounts.
  useEffect(() => {
    return () => {
      if (newMediaPreviewUrl) URL.revokeObjectURL(newMediaPreviewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMediaFile) {
      setPostError('Choose a photo or video for your status first.');
      return;
    }
    sound.playSend();
    setIsPosting(true);
    setPostProgress(5);
    setPostError('');
    try {
      await onAddStatus(newMediaFile, newCaption || '', newDuration, newPrivacy);
      setPostProgress(100);
      setShowAddModal(false);
      setNewCaption('');
      setNewMediaFile(null);
      setNewMediaPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    } catch (err: any) {
      setPostError(err?.message || 'Failed to post status.');
    } finally {
      setIsPosting(false);
      setPostProgress(null);
    }
  };

  const expirationInfo = activeItem
    ? formatStoryExpiration(activeItem.expiresAt, activeItem.durationDays)
    : null;

  return (
    <div
      ref={containerRef}
      className="relative w-full bg-black overflow-hidden shadow-2xl select-none"
      style={{ height: '100dvh' }}
      id="sovo-tiktok-reels-container"
    >
      {/* Close button — this view now takes over the entire screen (top app
          bar and bottom nav are hidden while it's open), so it needs its
          own explicit way back out. */}
      <button
        type="button"
        onClick={() => {
          sound.playTap();
          onClose();
        }}
        aria-label="Close status"
        className="absolute z-40 flex items-center justify-center w-9 h-9 rounded-full bg-black/50 backdrop-blur-md border border-white/15 text-white transition"
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-gold-bright)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = ''; }}
        style={{ top: 'max(0.5rem, env(safe-area-inset-top))', right: '0.75rem' }}
      >
        <X className="w-5 h-5" />
      </button>

      {/* Top Header Stories Navigation Avatars Carousel */}
      <div className="absolute top-0 left-0 right-0 z-30 pl-3 pr-14 pb-1 bg-gradient-to-b from-black/80 via-black/40 to-transparent" style={{ paddingTop: 'max(8px, env(safe-area-inset-top))' }}>
        <div className="flex items-center gap-2.5 overflow-x-auto pb-1.5 scrollbar-none">
          {/* Add my status button */}
          <button
            type="button"
            onClick={() => {
              sound.playTap();
              setShowAddModal(true);
            }}
            className="flex flex-col items-center flex-shrink-0 cursor-pointer"
          >
            <div className="relative w-11 h-11 rounded-full p-0.5 border-2 border-dashed flex items-center justify-center" style={{ borderColor: 'var(--color-gold)', backgroundColor: 'var(--color-elevated)' }}>
              <img
                src={currentUser.avatarUrl}
                alt="My profile"
                className="w-full h-full rounded-full object-cover"
              />
              <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full text-black flex items-center justify-center text-xs font-bold shadow" style={{ backgroundColor: 'var(--color-gold)' }}>
                <Plus className="w-3 h-3 text-black stroke-[3]" />
              </div>
            </div>
            <span className="text-[10px] font-medium mt-1" style={{ color: 'var(--color-gold-bright)' }}>Post Reel</span>
          </button>

          {/* Contact story avatars */}
          {stories.map((story, idx) => {
            const isActive = idx === currentUserIndex;
            const is3DayUser = story.items.some((i) => i.durationDays === 3);

            return (
              <button
                key={story.userId}
                type="button"
                onClick={() => {
                  sound.playTap();
                  setCurrentUserIndex(idx);
                  setCurrentItemIndex(0);
                }}
                className="flex flex-col items-center flex-shrink-0 cursor-pointer"
              >
              <div
                  className={`relative w-11 h-11 rounded-full p-0.5 transition-all ${
                    isActive
                      ? 'ring-2 ring-offset-2 ring-offset-black scale-105'
                      : 'border-2'
                  }`}
                  style={
                    isActive
                      ? { outline: '2px solid var(--color-gold-bright)', outlineOffset: '2px' }
                      : is3DayUser
                      ? { borderColor: 'var(--color-gold-border)' }
                      : { borderColor: 'var(--color-border)' }
                  }
                >
                  <img
                    src={story.avatarUrl}
                    alt={story.displayName}
                    className="w-full h-full rounded-full object-cover"
                  />
                  {is3DayUser && (
                    <div className="absolute -top-1 -right-1 px-1 text-[8px] font-extrabold text-black rounded-full shadow" style={{ backgroundColor: 'var(--color-gold)' }}>
                      3D
                    </div>
                  )}
                </div>
                <span
                  className={`text-[10px] mt-1 max-w-[54px] truncate ${
                    isActive ? 'font-semibold' : 'text-gray-400'
                  }`}
                  style={isActive ? { color: 'var(--color-gold-bright)' } : undefined}
                >
                  {story.isCurrentUser ? 'You' : story.displayName.split(' ')[0]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Progress Bars for current user items */}
        {activeUserStory && (
          <div className="flex items-center gap-1.5 mt-2">
            {activeUserStory.items.map((item, idx) => {
              const isFinished = idx < currentItemIndex;
              const isCurrent = idx === currentItemIndex;

              return (
                <div
                  key={item.id}
                  className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm"
                >
                  {isFinished && <div className="h-full w-full" style={{ backgroundColor: 'var(--color-gold-bright)' }} />}
                  {isCurrent && (
                    <motion.div
                      initial={{ width: '0%' }}
                      animate={{ width: isPaused ? '0%' : '100%' }}
                      transition={{ duration: 6.5, ease: 'linear' }}
                      className="h-full rounded-full"
                      style={{ background: 'linear-gradient(to right, var(--color-gold), #fff3a8)' }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Main Full-Screen Media / Reel Canvas */}
      {activeItem ? (
        <div
          className="relative w-full h-full bg-zinc-950 flex items-center justify-center overflow-hidden cursor-pointer"
          onDoubleClick={handleDoubleTap}
          onMouseDown={() => setIsPaused(true)}
          onMouseUp={() => setIsPaused(false)}
          onTouchStart={() => setIsPaused(true)}
          onTouchEnd={() => setIsPaused(false)}
        >
          {/* Background media. This was an <img> for every status, so a video
              status — which the composer has always allowed — rendered as a
              broken image. Pick the element from the item's mediaType. */}
          {activeItem.mediaType === 'video' ? (
            <video
              ref={reelVideoRef}
              key={activeItem.id}
              src={activeItem.mediaUrl}
              className="w-full h-full object-contain"
              autoPlay
              playsInline
              loop
              muted={isMuted}
              preload="auto"
            />
          ) : (
            <img
              src={activeItem.mediaUrl}
              alt={activeItem.caption}
              className="w-full h-full object-contain transform scale-100 transition-transform duration-700"
            />
          )}

          {/* Gradient overlays for top and bottom readability */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/90 pointer-events-none" />

          {/* Left/Right click zones for fast stepping */}
          <div
            className="absolute top-20 bottom-24 left-0 w-1/3 z-10 cursor-w-resize"
            onClick={(e) => {
              e.stopPropagation();
              handlePrevItem();
            }}
          />
          <div
            className="absolute top-20 bottom-24 right-0 w-1/3 z-10 cursor-e-resize"
            onClick={(e) => {
              e.stopPropagation();
              handleNextItem();
            }}
          />

          {/* Double Tap Floating Heart Particles */}
          <AnimatePresence>
            {floatingHearts.map((heart) => (
              <motion.div
                key={heart.id}
                initial={{ scale: 0, opacity: 1, y: 0 }}
                animate={{ scale: 2.2, opacity: 0, y: -120 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                style={{ left: heart.x - 24, top: heart.y - 24, color: 'var(--color-gold-bright)' }}
                className="absolute z-40 pointer-events-none"
              >
                <Heart className="w-12 h-12 drop-shadow-[0_0_15px_rgba(255,215,0,0.8)]" style={{ fill: 'var(--color-gold-bright)', color: '#fff2a3' }} />
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Top Contact Info & Security Tags */}
          <div className="absolute top-20 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
            <div className="flex items-center gap-2.5">
              <img
                src={activeUserStory.avatarUrl}
                alt={activeUserStory.displayName}
                className="w-9 h-9 rounded-full object-cover shadow"
                style={{ border: '1px solid var(--color-gold-border)' }}
              />
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-white drop-shadow">
                    {activeUserStory.displayName}
                  </span>
                  <span className="text-xs font-mono" style={{ color: 'var(--color-gold)' }}>
                    @{activeUserStory.username}
                  </span>
                </div>

                {/* Expiration and Privacy Badge */}
                {expirationInfo && (
                  <div className="flex items-center gap-1.5 text-[11px] font-medium" style={{ color: 'var(--color-gold-bright)' }}>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        expirationInfo.is3Day
                          ? 'text-black shadow-sm'
                          : 'bg-black/60 border'
                      }`}
                      style={
                        expirationInfo.is3Day
                          ? { backgroundColor: 'var(--color-gold)' }
                          : { color: 'var(--color-gold-bright)', borderColor: 'var(--color-gold-border)' }
                      }
                    >
                      <Clock className="w-3 h-3" />
                      <span>{expirationInfo.label}</span>
                    </span>

                    <span className="text-white/70 text-[10px] flex items-center gap-0.5">
                      <Lock className="w-2.5 h-2.5" style={{ color: 'var(--color-gold-bright)' }} /> E2EE
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Mute and Audio control */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                sound.playTap();
                setIsMuted(!isMuted);
              }}
              className="p-2 rounded-full bg-black/50 backdrop-blur-md border border-white/15 text-white pointer-events-auto cursor-pointer"
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-gold-bright)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = ''; }}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>

          {/* Right Action Rail (TikTok Style: Like, Views, Share, 3-Day Tag) */}
          <div className="absolute right-3.5 z-20 flex flex-col items-center gap-4 pointer-events-auto" style={{ bottom: 'calc(max(12px, env(safe-area-inset-bottom)) + 80px)' }}>
            {/* Like button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleLike(activeUserStory.userId, activeItem.id);
                sound.playTap();
              }}
              className="flex flex-col items-center gap-1 group cursor-pointer"
            >
              <div
                className={`p-3 rounded-full backdrop-blur-md transition-all ${
                  activeItem.hasLiked
                    ? 'text-black scale-110'
                    : 'bg-black/60 text-white border border-white/20'
                }`}
                style={activeItem.hasLiked ? {
                  backgroundColor: 'var(--color-gold)',
                  boxShadow: '0 0 12px var(--color-gold)',
                } : undefined}
              >
                <Heart
                  className={`w-6 h-6 ${
                    activeItem.hasLiked ? 'fill-black stroke-black' : 'fill-transparent'
                  }`}
                />
              </div>
              <span className="text-[11px] font-bold text-white drop-shadow">
                {activeItem.likesCount}
              </span>
            </button>

            {/* View Counter */}
            <div className="flex flex-col items-center gap-0.5">
              <div className="p-2.5 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-gray-300">
                <Eye className="w-5 h-5" style={{ color: 'var(--color-gold-bright)' }} />
              </div>
              <span className="text-[10px] font-medium text-gray-300">
                {activeItem.viewsCount}
              </span>
            </div>

            {/* TikTok swipe helper arrows */}
            <div className="flex flex-col gap-1 mt-2">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleVerticalScroll('up'); }}
                disabled={currentUserIndex === 0}
                className="p-2 rounded-full bg-black/50 text-white disabled:opacity-30 cursor-pointer"
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-gold-bright)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = ''; }}
                title="Previous Reel (Swipe Up)"
              >
                <ChevronUp className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleVerticalScroll('down'); }}
                disabled={currentUserIndex === stories.length - 1}
                className="p-2 rounded-full bg-black/50 text-white disabled:opacity-30 cursor-pointer"
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-gold-bright)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = ''; }}
                title="Next Reel (Swipe Down)"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Bottom Caption & Music Tag */}
          <div className="absolute left-4 right-20 z-20 pointer-events-none" style={{ bottom: 'calc(max(12px, env(safe-area-inset-bottom)) + 64px)' }}>
            <p className="text-sm font-medium text-white drop-shadow-md mb-2 leading-snug">
              {activeItem.caption}
            </p>

            {activeItem.musicTrack && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md text-xs"
                style={{ border: '1px solid var(--color-gold-border)', color: 'var(--color-gold-bright)' }}>
                <Music className="w-3 h-3 animate-spin" />
                <span className="truncate max-w-[200px] font-mono text-[11px]">
                  {activeItem.musicTrack.title} — {activeItem.musicTrack.artist}
                </span>
              </div>
            )}
          </div>

          {/* Bottom Reply Bar */}
          <div className="absolute left-3 right-3 z-30 pointer-events-auto" style={{ bottom: 'max(12px, env(safe-area-inset-bottom))' }}>
            <form
              onSubmit={handleSendReply}
              className="flex items-center gap-2 p-1.5 pl-4 rounded-full backdrop-blur-xl shadow-2xl"
              style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-gold-border)' }}
            >
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder={`Reply to ${activeUserStory.displayName.split(' ')[0]}...`}
                className="flex-1 bg-transparent text-xs text-white placeholder-gray-400 outline-none"
              />

              {/* Quick Golden Reaction Emojis */}
              {['🔥', '✨', '👑', '💛'].map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    sound.playTap();
                    onSendStatusReply(activeUserStory.userId, emoji, activeItem);
                  }}
                  className="w-7 h-7 flex items-center justify-center hover:scale-125 transition-transform text-sm cursor-pointer"
                >
                  {emoji}
                </button>
              ))}

              <button
                type="submit"
                disabled={!replyText.trim()}
                className="w-8 h-8 rounded-full gold-gradient-bg text-black flex items-center justify-center disabled:opacity-40 cursor-pointer shadow-md transition-transform active:scale-95"
              >
                <Send className="w-4 h-4 fill-black" />
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center text-gray-500">
          <p>No active statuses right now.</p>
        </div>
      )}

      {/* Add New Status Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md p-6 shadow-2xl text-white rounded-3xl"
              style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-gold-border)' }}
            >
              <div className="flex items-center justify-between mb-4 pb-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5" style={{ color: 'var(--color-gold-bright)' }} />
                  <h3 className="font-display font-bold text-lg text-gold-glossy">
                    Create S'ovo Status
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="p-1 rounded-full text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateStatus} className="space-y-4">
                {/* Media Selection */}
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                    Photo or Video
                  </label>
                  <input
                    ref={statusFileInputRef}
                    type="file"
                    accept="image/*,video/*"
                    className="hidden"
                    onChange={handleMediaFileChange}
                  />
                  <div
                    onClick={() => statusFileInputRef.current?.click()}
                    className="relative h-40 rounded-xl overflow-hidden cursor-pointer border-2 border-dashed transition flex items-center justify-center"
                    style={{
                      borderColor: newMediaPreviewUrl ? 'var(--color-gold-bright)' : 'var(--color-border)',
                    }}
                    onMouseEnter={(e) => { if (!newMediaPreviewUrl) (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-gold-border)'; }}
                    onMouseLeave={(e) => { if (!newMediaPreviewUrl) (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-border)'; }}
                  >
                    {newMediaPreviewUrl ? (
                      newMediaFile?.type.startsWith('video/') ? (
                        <video src={newMediaPreviewUrl} className="w-full h-full object-contain" muted />
                      ) : (
                        <img src={newMediaPreviewUrl} alt="Selected status" className="w-full h-full object-contain" />
                      )
                    ) : (
                      <div className="flex flex-col items-center gap-1.5" style={{ color: 'var(--color-text-muted)' }}>
                        <ImageIcon className="w-6 h-6" />
                        <span className="text-[11px]">Tap to choose a photo or video</span>
                      </div>
                    )}
                  </div>
                  {postError && <p className="text-[11px] mt-1.5" style={{ color: 'var(--color-danger-text)' }}>{postError}</p>}
                </div>

                {/* Caption input */}
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                    Status Caption
                  </label>
                  <input
                    type="text"
                    value={newCaption}
                    onChange={(e) => setNewCaption(e.target.value)}
                    placeholder="Add an encrypted note or story caption..."
                    className="w-full px-4 py-2.5 rounded-xl text-xs text-white outline-none"
                    style={{
                      backgroundColor: 'var(--color-elevated)',
                      border: '1px solid var(--color-border)',
                    }}
                    onFocus={(e) => (e.target.style.borderColor = 'var(--color-gold-bright)')}
                    onBlur={(e) => (e.target.style.borderColor = 'var(--color-border)')}
                  />
                </div>

                {/* Duration Picker */}
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--color-gold-bright)' }}>
                    Disappear Duration (S'ovo Feature)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setNewDuration(1)}
                      className="p-3 rounded-xl text-left border transition"
                      style={{
                        backgroundColor: newDuration === 1 ? 'var(--color-gold-dim)' : 'var(--color-elevated)',
                        borderColor: newDuration === 1 ? 'var(--color-gold-bright)' : 'var(--color-border)',
                        color: newDuration === 1 ? 'var(--color-gold-bright)' : 'var(--color-text-secondary)',
                      }}
                    >
                      <p className="text-xs font-bold flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> 24 Hours Standard
                      </p>
                      <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                        Disappears for all contacts
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setNewDuration(3)}
                      className="p-3 rounded-xl text-left border transition"
                      style={{
                        backgroundColor: newDuration === 3 ? 'var(--color-gold-dim)' : 'var(--color-elevated)',
                        borderColor: newDuration === 3 ? 'var(--color-gold-bright)' : 'var(--color-border)',
                        color: newDuration === 3 ? 'var(--color-gold-bright)' : 'var(--color-text-secondary)',
                        boxShadow: newDuration === 3 ? '0 0 10px var(--color-gold-glow)' : undefined,
                      }}
                    >
                      <p className="text-xs font-bold flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--color-gold-bright)' }} /> 3-Day Extended VIP
                      </p>
                      <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                        Retained 72 hours for chosen contacts
                      </p>
                    </button>
                  </div>
                </div>

                {/* Privacy Audience */}
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                    Audience & Visibility
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { key: 'all_contacts', label: 'All Contacts' },
                      { key: 'close_friends', label: 'Close VIPs' },
                      { key: 'specific_contacts', label: 'Specific List' },
                    ].map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setNewPrivacy(opt.key as StoryPrivacy)}
                        className="py-2 px-1 text-center rounded-xl text-[11px] font-semibold border transition"
                        style={{
                          backgroundColor: newPrivacy === opt.key ? 'var(--color-gold-dim)' : 'var(--color-elevated)',
                          borderColor: newPrivacy === opt.key ? 'var(--color-gold)' : 'var(--color-border)',
                          color: newPrivacy === opt.key ? 'var(--color-gold-bright)' : 'var(--color-text-secondary)',
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isPosting || !newMediaFile}
                  className="w-full py-3.5 rounded-xl gold-glossy-button text-black font-display font-bold text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg active:scale-98 disabled:opacity-50"
                >
                  {isPosting ? (
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4 text-black fill-black" />
                  )}
                  <span>{isPosting ? 'Posting...' : `Publish Status (${newDuration === 3 ? '3-Day' : '24h'})`}</span>
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
