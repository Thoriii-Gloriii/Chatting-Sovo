import React, { useState } from "react";
import { Conversation, UserStatusStory, User, UserSettings } from "../types";
import { Search, Plus, Lock, Check, CheckCheck, Users, Edit } from "lucide-react";
import { sound } from "../lib/sound";

interface ChatsViewProps {
  conversations: Conversation[];
  statusStories: UserStatusStory[];
  currentUser: User;
  settings: UserSettings;
  onSelectConversation: (conv: Conversation) => void;
  onOpenNewGroup: () => void;
  onOpenSyncContacts: () => void;
  onOpenReelsView: (userId?: string) => void;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return "Yesterday";
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export const ChatsView: React.FC<ChatsViewProps> = ({
  conversations, statusStories, currentUser, settings,
  onSelectConversation, onOpenNewGroup, onOpenSyncContacts, onOpenReelsView,
}) => {
  const [searchTerm, setSearchTerm] = useState("");

  const filtered = conversations.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.lastMessage?.text?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full w-full bg-[#07070b] relative select-none" id="sovo-chats-dashboard">

      {/* Header */}
      <div className="px-4 pt-4 pb-3 bg-[#07070b] flex items-center justify-between">
        <button type="button" className="p-2 rounded-xl text-gray-400 hover:text-white transition">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
          </svg>
        </button>
        <h2 className="text-lg font-display font-bold text-white tracking-wide">Chats</h2>
        <button type="button" onClick={() => { sound.playTap(); onOpenSyncContacts(); }}
          className="p-2 rounded-xl text-gray-400 hover:text-[#ffd700] transition">
          <Edit className="w-5 h-5" />
        </button>
      </div>

      {/* Status story row */}
      <div className="px-4 pb-3 overflow-x-auto scrollbar-none">
        <div className="flex items-start gap-4 min-w-max">
          {/* My Status */}
          <button type="button" onClick={() => { sound.playTap(); onOpenReelsView(); }}
            className="flex flex-col items-center gap-1.5 flex-shrink-0 cursor-pointer">
            <div className="relative status-avatar-scaled">
              <img src={currentUser.avatarUrl} alt="My Status"
                className="status-avatar-scaled rounded-full object-cover border-2 border-[#222230]"/>
              <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full gold-gradient-bg flex items-center justify-center border-2 border-[#07070b]">
                <Plus className="w-3 h-3 text-black stroke-[3]"/>
              </div>
            </div>
            <span className="text-[10px] text-gray-400 font-medium">My Status</span>
          </button>

          {/* Other stories */}
          {statusStories.filter(s => !s.isCurrentUser).slice(0, 6).map((story) => {
            const ts = story.items[0]?.createdAt || Date.now();
            return (
              <button key={story.userId} type="button"
                onClick={() => { sound.playTap(); onOpenReelsView(story.userId); }}
                className="flex flex-col items-center gap-1.5 flex-shrink-0 cursor-pointer group">
                <div className={`status-avatar-scaled rounded-full p-0.5 ${story.hasUnseen ? "bg-gradient-to-br from-[#ffd700] via-[#d4af37] to-[#aa7c11]" : "bg-[#333]"}`}>
                  <img src={story.avatarUrl} alt={story.displayName}
                    className="w-full h-full rounded-full object-cover border-2 border-[#07070b]"/>
                </div>
                <span className="text-[10px] text-gray-300 font-medium max-w-[56px] truncate">{story.displayName.split(" ")[0]}</span>
                <span className="text-[9px] text-[#555568] -mt-1">{timeAgo(ts)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Search bar */}
      <div className="px-4 pb-3">
        <div className="relative flex items-center">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555568]"/>
          <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search chats"
            className="w-full pl-10 pr-4 py-2.5 bg-[#111118] border border-[#222230] focus:border-[#d4af37]/40 rounded-2xl text-sm text-white placeholder-[#444456] outline-none transition"/>
          <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555568] hover:text-[#d4af37] transition">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Conversations list */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#111118] scrollbar-thin">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center text-gray-500">
            <Lock className="w-10 h-10 text-[#d4af37]/30 mb-3"/>
            <p className="text-sm font-medium text-gray-400">No conversations found</p>
            <p className="text-xs text-gray-600 mt-1">Sync contacts or search by @username</p>
          </div>
        ) : (
          filtered.map((conv) => {
            const isMe = conv.lastMessage?.senderId === currentUser.id;
            const lastMsg = conv.lastMessage;
            const preview = lastMsg?.mediaType === "voice_note" ? "🎤 Voice note"
              : lastMsg?.mediaType === "image" ? "📷 Photo"
              : lastMsg?.mediaType === "encrypted_file" ? `📎 ${lastMsg.fileName}`
              : lastMsg?.text || "Encrypted channel established";

            return (
              <div key={conv.id}
                onClick={() => { sound.playTap(); onSelectConversation(conv); }}
                className="px-4 py-3.5 hover:bg-[#0e0e16] transition flex items-center gap-3 cursor-pointer">
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <img src={conv.avatar} alt={conv.name}
                    className="w-12 h-12 rounded-full object-cover"/>
                  {conv.type === "direct" && conv.isOnline && (
                    <div className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-[#07070b]"/>
                  )}
                  {conv.type === "group" && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-[#1a1825] border border-[#d4af37]/40 flex items-center justify-center">
                      <Users className="w-2.5 h-2.5 text-[#d4af37]"/>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-sm font-semibold text-white truncate">{conv.name}</span>
                    <span className="text-[11px] text-[#555568] ml-2 flex-shrink-0">
                      {lastMsg ? formatTime(lastMsg.timestamp) : ""}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-xs text-[#666675] truncate">
                      {isMe && lastMsg && (
                        lastMsg.status === "read"
                          ? <CheckCheck className={`w-3.5 h-3.5 flex-shrink-0 ${settings.readReceipts ? "text-[#ffd700]" : "text-[#555568]"}`}/>
                          : <Check className="w-3.5 h-3.5 flex-shrink-0 text-[#555568]"/>
                      )}
                      <span className="truncate">{preview}</span>
                    </div>
                    {conv.unreadCount > 0 && (
                      <span className="ml-2 flex-shrink-0 min-w-[18px] h-[18px] px-1.5 rounded-full gold-gradient-bg text-black font-bold text-[10px] flex items-center justify-center">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* FAB */}
      <button type="button"
        onClick={() => { sound.playTap(); onOpenSyncContacts(); }}
        className="absolute right-5 bottom-6 w-14 h-14 rounded-2xl gold-gradient-bg text-black flex items-center justify-center shadow-[0_8px_25px_rgba(212,175,55,0.5)] transition transform active:scale-90 hover:scale-105 cursor-pointer z-20">
        <Edit className="w-6 h-6 stroke-[2] text-black"/>
      </button>
    </div>
  );
};
