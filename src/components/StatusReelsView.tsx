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

interface StatusReelsViewProps {
  stories: UserStatusStory[];
  currentUser: User;
  onSendStatusReply: (contactId: string, replyText: string, statusItem: StatusItem) => void;
  onAddStatus: (newItem: StatusItem) => void;
  onToggleLike: (storyUserId: string, itemId: string) => void;
}

export const StatusReelsView: React.FC<StatusReelsViewProps> = ({
  stories,
  currentUser,
  onSendStatusReply,
  onAddStatus,
  onToggleLike,
}) => {
  const [currentUserIndex, setCurrentUserIndex] = useState(0);
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
  const [newMediaUrl, setNewMediaUrl] = useState(
    'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=1080&auto=format&fit=crop&q=85'
  );
  const [newMusicTitle, setNewMusicTitle] = useState('Obsidian Echoes - Hans Zimmer');

  const containerRef = useRef<HTMLDivElement>(null);
  const activeUserStory = stories[currentUserIndex] || stories[0];
  const activeItem = activeUserStory?.items[currentItemIndex] || activeUserStory?.items[0];

  // Auto-progress bar timer
  useEffect(() => {
    if (!activeItem || isPaused || showAddModal) return;

    const timer = setInterval(() => {
      handleNextItem();
    }, 6500); // 6.5s per status slide

    return () => clearInterval(timer);
  }, [currentUserIndex, currentItemIndex, isPaused, showAddModal, activeItem]);

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

  const handleCreateStatus = (e: React.FormEvent) => {
    e.preventDefault();
    sound.playSend();

    const durationMs = newDuration * 24 * 60 * 60 * 1000;
    const newItem: StatusItem = {
      id: `st_${Date.now()}`,
      mediaUrl: newMediaUrl,
      mediaType: 'image',
      caption: newCaption || 'Captured with S’ovo E2EE Camera',
      createdAt: Date.now(),
      expiresAt: Date.now() + durationMs,
      durationDays: newDuration,
      privacy: newPrivacy,
      musicTrack: newMusicTitle ? { title: newMusicTitle, artist: 'S’ovo Audio' } : undefined,
      likesCount: 0,
      hasLiked: false,
      viewsCount: 1,
      isEncrypted: true,
    };

    onAddStatus(newItem);
    setShowAddModal(false);
    setNewCaption('');
  };

  const expirationInfo = activeItem
    ? formatStoryExpiration(activeItem.expiresAt, activeItem.durationDays)
    : null;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[calc(100vh-68px)] md:h-[calc(100vh-80px)] max-w-md mx-auto bg-black rounded-none md:rounded-3xl overflow-hidden shadow-2xl border-0 md:border border-[#2d2b1f] select-none"
      id="sovo-tiktok-reels-container"
    >
      {/* Top Header Stories Navigation Avatars Carousel */}
      <div className="absolute top-2 left-0 right-0 z-30 px-3 py-1 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
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
            <div className="relative w-11 h-11 rounded-full p-0.5 border-2 border-dashed border-[#d4af37] flex items-center justify-center bg-[#171510]">
              <img
                src={currentUser.avatarUrl}
                alt="My profile"
                className="w-full h-full rounded-full object-cover"
              />
              <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#d4af37] text-black flex items-center justify-center text-xs font-bold shadow">
                <Plus className="w-3 h-3 text-black stroke-[3]" />
              </div>
            </div>
            <span className="text-[10px] text-[#ffd700] font-medium mt-1">Post Reel</span>
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
                      ? 'ring-2 ring-[#ffd700] ring-offset-2 ring-offset-black scale-105'
                      : is3DayUser
                      ? 'border-2 border-[#d4af37]/80'
                      : 'border-2 border-zinc-600'
                  }`}
                >
                  <img
                    src={story.avatarUrl}
                    alt={story.displayName}
                    className="w-full h-full rounded-full object-cover"
                  />
                  {is3DayUser && (
                    <div className="absolute -top-1 -right-1 px-1 bg-[#d4af37] text-[8px] font-extrabold text-black rounded-full shadow">
                      3D
                    </div>
                  )}
                </div>
                <span
                  className={`text-[10px] mt-1 max-w-[54px] truncate ${
                    isActive ? 'text-[#ffd700] font-semibold' : 'text-gray-400'
                  }`}
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
                  {isFinished && <div className="h-full w-full bg-[#ffd700]" />}
                  {isCurrent && (
                    <motion.div
                      initial={{ width: '0%' }}
                      animate={{ width: isPaused ? '0%' : '100%' }}
                      transition={{ duration: 6.5, ease: 'linear' }}
                      className="h-full bg-gradient-to-r from-[#d4af37] to-[#fff3a8] rounded-full"
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
          {/* Background image / video display */}
          <img
            src={activeItem.mediaUrl}
            alt={activeItem.caption}
            className="w-full h-full object-cover transform scale-100 transition-transform duration-700"
          />

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
                style={{ left: heart.x - 24, top: heart.y - 24 }}
                className="absolute z-40 pointer-events-none text-[#ffd700]"
              >
                <Heart className="w-12 h-12 fill-[#ffd700] text-[#fff2a3] drop-shadow-[0_0_15px_rgba(255,215,0,0.8)]" />
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Top Contact Info & Security Tags */}
          <div className="absolute top-20 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
            <div className="flex items-center gap-2.5">
              <img
                src={activeUserStory.avatarUrl}
                alt={activeUserStory.displayName}
                className="w-9 h-9 rounded-full object-cover border border-[#d4af37]/60 shadow"
              />
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-white drop-shadow">
                    {activeUserStory.displayName}
                  </span>
                  <span className="text-xs font-mono text-[#d4af37]">
                    @{activeUserStory.username}
                  </span>
                </div>

                {/* Expiration and Privacy Badge */}
                {expirationInfo && (
                  <div className="flex items-center gap-1.5 text-[11px] text-[#ffd700] font-medium">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        expirationInfo.is3Day
                          ? 'bg-[#d4af37] text-black shadow-sm'
                          : 'bg-black/60 text-[#ffd700] border border-[#d4af37]/40'
                      }`}
                    >
                      <Clock className="w-3 h-3" />
                      <span>{expirationInfo.label}</span>
                    </span>

                    <span className="text-white/70 text-[10px] flex items-center gap-0.5">
                      <Lock className="w-2.5 h-2.5 text-[#ffd700]" /> E2EE
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
              className="p-2 rounded-full bg-black/50 backdrop-blur-md border border-white/15 text-white hover:text-[#ffd700] pointer-events-auto cursor-pointer"
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>

          {/* Right Action Rail (TikTok Style: Like, Views, Share, 3-Day Tag) */}
          <div className="absolute right-3.5 bottom-28 z-20 flex flex-col items-center gap-4 pointer-events-auto">
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
                    ? 'bg-[#d4af37] text-black scale-110 shadow-[0_0_12px_#d4af37]'
                    : 'bg-black/60 text-white border border-white/20 hover:border-[#ffd700]'
                }`}
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
                <Eye className="w-5 h-5 text-[#ffd700]" />
              </div>
              <span className="text-[10px] font-medium text-gray-300">
                {activeItem.viewsCount}
              </span>
            </div>

            {/* TikTok swipe helper arrows */}
            <div className="flex flex-col gap-1 mt-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleVerticalScroll('up');
                }}
                disabled={currentUserIndex === 0}
                className="p-2 rounded-full bg-black/50 text-white disabled:opacity-30 hover:text-[#ffd700] cursor-pointer"
                title="Previous Reel (Swipe Up)"
              >
                <ChevronUp className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleVerticalScroll('down');
                }}
                disabled={currentUserIndex === stories.length - 1}
                className="p-2 rounded-full bg-black/50 text-white disabled:opacity-30 hover:text-[#ffd700] cursor-pointer"
                title="Next Reel (Swipe Down)"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Bottom Caption & Music Tag */}
          <div className="absolute left-4 right-20 bottom-24 z-20 pointer-events-none">
            <p className="text-sm font-medium text-white drop-shadow-md mb-2 leading-snug">
              {activeItem.caption}
            </p>

            {activeItem.musicTrack && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-[#d4af37]/30 text-xs text-[#ffd700]">
                <Music className="w-3 h-3 animate-spin" />
                <span className="truncate max-w-[200px] font-mono text-[11px]">
                  {activeItem.musicTrack.title} — {activeItem.musicTrack.artist}
                </span>
              </div>
            )}
          </div>

          {/* Bottom Reply Bar */}
          <div className="absolute bottom-3 left-3 right-3 z-30 pointer-events-auto">
            <form
              onSubmit={handleSendReply}
              className="flex items-center gap-2 p-1.5 pl-4 rounded-full bg-[#121217]/90 backdrop-blur-xl border border-[#d4af37]/40 shadow-2xl"
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
              className="w-full max-w-md bg-[#0d0d12] border border-[#d4af37]/40 rounded-3xl p-6 shadow-2xl text-white"
            >
              <div className="flex items-center justify-between mb-4 border-b border-[#24232c] pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#ffd700]" />
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
                {/* Media Preview / Selection */}
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                    Select Media or Preset
                  </label>
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    {[
                      {
                        url: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=1080&auto=format&fit=crop&q=85',
                        title: 'Golden Horizon',
                      },
                      {
                        url: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?w=1080&auto=format&fit=crop&q=85',
                        title: 'Amalfi Coast',
                      },
                      {
                        url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1080&auto=format&fit=crop&q=85',
                        title: 'Kyoto Sanctuary',
                      },
                    ].map((preset, idx) => (
                      <div
                        key={idx}
                        onClick={() => setNewMediaUrl(preset.url)}
                        className={`relative h-20 rounded-xl overflow-hidden cursor-pointer border-2 transition ${
                          newMediaUrl === preset.url
                            ? 'border-[#ffd700] ring-2 ring-[#d4af37]/50'
                            : 'border-transparent opacity-70 hover:opacity-100'
                        }`}
                      >
                        <img
                          src={preset.url}
                          alt={preset.title}
                          className="w-full h-full object-cover"
                        />
                        {newMediaUrl === preset.url && (
                          <div className="absolute inset-0 bg-[#d4af37]/20 flex items-center justify-center">
                            <Check className="w-5 h-5 text-[#ffd700] bg-black/60 rounded-full p-0.5" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Caption input */}
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                    Status Caption
                  </label>
                  <input
                    type="text"
                    value={newCaption}
                    onChange={(e) => setNewCaption(e.target.value)}
                    placeholder="Add an encrypted note or story caption..."
                    className="w-full px-4 py-2.5 bg-[#14141c] border border-[#2d2c38] focus:border-[#ffd700] rounded-xl text-xs text-white outline-none"
                  />
                </div>

                {/* Duration Picker (24h vs 3-Day Retention feature requested) */}
                <div>
                  <label className="block text-xs font-semibold text-[#ffd700] mb-1.5">
                    Disappear Duration (S’ovo Feature)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setNewDuration(1)}
                      className={`p-3 rounded-xl text-left border transition ${
                        newDuration === 1
                          ? 'bg-[#1e1c14] border-[#ffd700] text-[#ffd700]'
                          : 'bg-[#14141c] border-[#2d2c38] text-gray-400'
                      }`}
                    >
                      <p className="text-xs font-bold flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> 24 Hours Standard
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        Disappears for all contacts
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setNewDuration(3)}
                      className={`p-3 rounded-xl text-left border transition ${
                        newDuration === 3
                          ? 'bg-[#2b2410] border-[#ffd700] text-[#ffd700] shadow-[0_0_10px_rgba(212,175,55,0.2)]'
                          : 'bg-[#14141c] border-[#2d2c38] text-gray-400'
                      }`}
                    >
                      <p className="text-xs font-bold flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-[#ffd700]" /> 3-Day Extended VIP
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        Retained 72 hours for chosen contacts
                      </p>
                    </button>
                  </div>
                </div>

                {/* Privacy Audience */}
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">
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
                        className={`py-2 px-1 text-center rounded-xl text-[11px] font-semibold border transition ${
                          newPrivacy === opt.key
                            ? 'bg-[#252014] border-[#d4af37] text-[#ffd700]'
                            : 'bg-[#14141c] border-[#2a2936] text-gray-400'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 rounded-xl gold-glossy-button text-black font-display font-bold text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg active:scale-98"
                >
                  <Sparkles className="w-4 h-4 text-black fill-black" />
                  <span>Publish Encrypted Reel ({newDuration === 3 ? '3-Day' : '24h'})</span>
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
