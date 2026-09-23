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
  onOpenReelsView: () => void;
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
    <div
      className="flex flex-col h-full w-full relative select-none"
      style={{ backgroundColor: "var(--color-surface)" }}
      id="sovo-chats-dashboard"
    >
      {/* Header */}
      <div
        className="px-4 pt-4 pb-3 flex items-center justify-between"
        style={{ backgroundColor: "var(--color-surface)" }}
      >
        <button
          type="button"
          className="p-2 transition tap-target flex items-center justify-center"
          style={{ color: "var(--color-text-secondary)", borderRadius: "var(--radius-sm)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-text)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-text-secondary)")}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
          </svg>
        </button>
        <h2
          className="text-lg font-display font-bold tracking-wide"
          style={{ color: "var(--color-text)" }}
        >
          Chats
        </h2>
        <button
          type="button"
          onClick={() => { sound.playTap(); onOpenSyncContacts(); }}
          className="p-2 transition tap-target flex items-center justify-center"
          style={{ color: "var(--color-text-secondary)", borderRadius: "var(--radius-sm)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-gold-bright)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-text-secondary)")}
        >
          <Edit className="w-5 h-5" />
        </button>
      </div>

      {/* Status story row */}
      <div className="px-4 pb-3 overflow-x-auto scrollbar-none">
        <div className="flex items-start gap-4 min-w-max">
          {/* My Status */}
          <button
            type="button"
            onClick={() => { sound.playTap(); onOpenReelsView(); }}
            className="flex flex-col items-center gap-1.5 flex-shrink-0 cursor-pointer"
          >
            <div className="relative status-avatar-scaled">
              <img
                src={currentUser.avatarUrl}
                alt="My Status"
                className="status-avatar-scaled rounded-full object-cover"
                style={{ border: "2px solid var(--color-border)" }}
              />
              <div
                className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full gold-gradient-bg flex items-center justify-center"
                style={{ border: "2px solid var(--color-surface)" }}
              >
                <Plus className="w-3 h-3 text-black stroke-[3]"/>
              </div>
            </div>
            <span className="text-[10px] font-medium" style={{ color: "var(--color-text-secondary)" }}>
              My Status
            </span>
          </button>

          {/* Other stories */}
          {statusStories.filter((s) => !s.isCurrentUser).slice(0, 6).map((story) => {
            const ts = story.items[0]?.createdAt || Date.now();
            return (
              <button
                key={story.userId}
                type="button"
                onClick={() => { sound.playTap(); onOpenReelsView(); }}
                className="flex flex-col items-center gap-1.5 flex-shrink-0 cursor-pointer group"
              >
                <div
                  className="status-avatar-scaled rounded-full p-0.5"
                  style={{
                    background: story.hasUnseen
                      ? "linear-gradient(135deg, var(--color-gold-bright), var(--color-gold), #aa7c11)"
                      : "var(--color-border)",
                  }}
                >
                  <img
                    src={story.avatarUrl}
                    alt={story.displayName}
                    className="w-full h-full rounded-full object-cover"
                    style={{ border: "2px solid var(--color-surface)" }}
                  />
                </div>
                <span
                  className="text-[10px] font-medium max-w-[56px] truncate"
                  style={{ color: "var(--color-text)" }}
                >
                  {story.displayName.split(" ")[0]}
                </span>
                <span className="text-[9px] -mt-1" style={{ color: "var(--color-text-muted)" }}>
                  {timeAgo(ts)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Search bar */}
      <div className="px-4 pb-3">
        <div className="relative flex items-center">
          <Search
            className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: "var(--color-text-muted)" }}
          />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search chats"
            className="w-full pl-10 pr-4 py-2.5 text-sm outline-none transition border"
            style={{
              backgroundColor: "var(--color-elevated)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
              borderRadius: "var(--radius-xl)",
            }}
            onFocus={(e) => (e.target.style.borderColor = "rgba(212,175,55,0.40)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
          />
        </div>
      </div>

      {/* Conversations list */}
      <div
        className="flex-1 overflow-y-auto scrollbar-thin"
        style={{ borderTop: "1px solid var(--color-elevated)" }}
      >
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <Lock className="w-10 h-10 mb-3" style={{ color: "rgba(212,175,55,0.30)" }}/>
            <p className="text-sm font-medium" style={{ color: "var(--color-text-secondary)" }}>
              No conversations found
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
              Sync contacts or search by @username
            </p>
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
              <div
                key={conv.id}
                onClick={() => { sound.playTap(); onSelectConversation(conv); }}
                className="px-4 py-3.5 flex items-center gap-3 cursor-pointer transition"
                style={{ borderBottom: "1px solid var(--color-elevated)" }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--color-elevated)")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <img
                    src={conv.avatar}
                    alt={conv.name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  {conv.type === "direct" && conv.isOnline && (
                    <div
                      className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-500"
                      style={{ border: "2px solid var(--color-surface)" }}
                    />
                  )}
                  {conv.type === "group" && (
                    <div
                      className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center"
                      style={{
                        backgroundColor: "var(--color-surface)",
                        border: "1px solid rgba(212,175,55,0.40)",
                      }}
                    >
                      <Users className="w-2.5 h-2.5" style={{ color: "var(--color-gold)" }}/>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-sm font-semibold truncate" style={{ color: "var(--color-text)" }}>
                      {conv.name}
                    </span>
                    <span className="text-[11px] ml-2 flex-shrink-0" style={{ color: "var(--color-text-muted)" }}>
                      {lastMsg ? formatTime(lastMsg.timestamp) : ""}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-xs truncate" style={{ color: "var(--color-text-muted)" }}>
                      {isMe && lastMsg && (
                        lastMsg.status === "read"
                          ? <CheckCheck className="w-3.5 h-3.5 flex-shrink-0" style={{ color: settings.readReceipts ? "var(--color-gold-bright)" : "var(--color-text-muted)" }}/>
                          : <Check className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--color-text-muted)" }}/>
                      )}
                      <span className="truncate">{preview}</span>
                    </div>
                    {conv.unreadCount > 0 && (
                      <span
                        className="ml-2 flex-shrink-0 min-w-[18px] h-[18px] px-1.5 rounded-full gold-gradient-bg font-bold text-[10px] flex items-center justify-center"
                        style={{ color: "black" }}
                      >
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
      <button
        type="button"
        onClick={() => { sound.playTap(); onOpenSyncContacts(); }}
        className="absolute right-5 bottom-6 w-14 h-14 gold-gradient-bg flex items-center justify-center shadow-[0_8px_25px_rgba(212,175,55,0.45)] transition transform active:scale-90 hover:scale-105 cursor-pointer z-20"
        style={{ borderRadius: "var(--radius-lg)", color: "black" }}
      >
        <Edit className="w-6 h-6 stroke-[2]"/>
      </button>
    </div>
  );
};
