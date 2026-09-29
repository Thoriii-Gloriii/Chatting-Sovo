import React, { useState } from 'react';
import { motion } from 'motion/react';
import { SyncedContact } from '../types';
import {
  Users,
  Search,
  ShieldCheck,
  Lock,
  MessageSquare,
  Sparkles,
  X,
  AtSign,
} from 'lucide-react';
import { sound } from '../lib/sound';

interface ContactsSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  contacts: SyncedContact[];
  onStartDirectChat: (contact: SyncedContact) => void;
}

export const ContactsSyncModal: React.FC<ContactsSyncModalProps> = ({
  isOpen,
  onClose,
  contacts,
  onStartDirectChat,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'discover' | 'username'>('discover');
  const [globalUsernameInput, setGlobalUsernameInput] = useState('');
  const [globalSearchResult, setGlobalSearchResult] = useState<SyncedContact | null>(null);
  const [searchAttempted, setSearchAttempted] = useState(false);

  if (!isOpen) return null;

  const handleSearchUsername = (e: React.FormEvent) => {
    e.preventDefault();
    if (!globalUsernameInput.trim()) return;
    sound.playTap();
    const cleanHandle = globalUsernameInput.trim().replace(/^@/, '').toLowerCase();
    const found = contacts.find((c) => c.sovoUsername?.toLowerCase() === cleanHandle);
    setGlobalSearchResult(found || null);
    setSearchAttempted(true);
  };

  const filteredContacts = contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.sovoUsername?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const inputStyle: React.CSSProperties = {
    backgroundColor: "var(--color-elevated)",
    border: "1px solid var(--color-border)",
    color: "var(--color-text)",
    borderRadius: "var(--radius-md)",
    outline: "none",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md"
      style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-lg max-h-[85vh] p-6 shadow-2xl flex flex-col relative overflow-hidden"
        style={{
          backgroundColor: "var(--color-surface)",
          border: "1px solid rgba(212,175,55,0.35)",
          borderRadius: "var(--radius-xl)",
          color: "var(--color-text)",
        }}
        id="sovo-contacts-sync-modal"
      >
        {/* Ambient glow */}
        <div
          className="absolute -top-20 right-10 w-48 h-48 rounded-full blur-3xl pointer-events-none"
          style={{ backgroundColor: "rgba(212,175,55,0.12)" }}
        />

        {/* Header */}
        <div
          className="flex items-center justify-between mb-4 pb-3"
          style={{ borderBottom: "1px solid var(--color-border)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="p-2.5"
              style={{
                borderRadius: "var(--radius-md)",
                backgroundColor: "rgba(212,175,55,0.12)",
                border: "1px solid rgba(212,175,55,0.40)",
                color: "var(--color-gold-bright)",
              }}
            >
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-lg text-gold-glossy">
                Address Book &amp; Discovery
              </h3>
              <p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
                Find contacts anonymously on S&apos;ovo
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => { sound.playTap(); onClose(); }}
            className="p-1.5 rounded-full transition"
            style={{
              color: "var(--color-text-secondary)",
              backgroundColor: "var(--color-elevated)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-text)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-text-secondary)")}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Privacy banner */}
        <div
          className="flex items-start gap-2.5 p-3 mb-4 text-xs"
          style={{
            backgroundColor: "var(--color-elevated)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
          }}
        >
          <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "var(--color-gold-bright)" }} />
          <div className="text-[11px] leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
            <span className="font-semibold" style={{ color: "var(--color-text)" }}>
              Find real S&apos;ovo accounts:{' '}
            </span>
            Browse everyone currently registered, or jump straight to someone by their @username.
          </div>
        </div>

        {/* Tab switcher */}
        <div
          className="grid grid-cols-2 gap-2 p-1 mb-4 text-xs font-semibold"
          style={{
            backgroundColor: "var(--color-elevated)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
          }}
        >
          {(['discover', 'username'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => { sound.playTap(); setActiveTab(tab); }}
              className="py-2 transition"
              style={{
                borderRadius: "var(--radius-sm)",
                backgroundColor: activeTab === tab ? "rgba(212,175,55,0.12)" : "transparent",
                border: activeTab === tab ? "1px solid rgba(212,175,55,0.40)" : "1px solid transparent",
                color: activeTab === tab ? "var(--color-gold-bright)" : "var(--color-text-secondary)",
              }}
            >
              {tab === 'discover' ? `Discover (${contacts.length})` : 'Search by @Username'}
            </button>
          ))}
        </div>

        {activeTab === 'discover' ? (
          <>
            {/* Search bar */}
            <div className="flex items-center gap-2 mb-4">
              <div className="relative flex-1">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                  style={{ color: "var(--color-text-secondary)" }}
                />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Filter people or handles..."
                  className="w-full pl-9 pr-3 py-2 text-xs"
                  style={inputStyle}
                  onFocus={(e) => (e.target.style.borderColor = "var(--color-gold)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
                />
              </div>
            </div>

            {/* Contacts list */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
              <div>
                <p
                  className="text-[11px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1"
                  style={{ color: "var(--color-gold)" }}
                >
                  <Sparkles className="w-3 h-3" /> On S&apos;ovo ({filteredContacts.length})
                </p>

                {filteredContacts.length === 0 ? (
                  <p className="text-xs py-6 text-center" style={{ color: "var(--color-text-muted)" }}>
                    No one else has signed up yet — invite a friend!
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {filteredContacts.map((contact) => (
                      <div
                        key={contact.id}
                        className="p-2.5 flex items-center justify-between transition"
                        style={{
                          backgroundColor: "var(--color-elevated)",
                          border: "1px solid var(--color-border)",
                          borderRadius: "var(--radius-md)",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(212,175,55,0.40)")}
                        onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--color-border)")}
                      >
                        <div className="flex items-center gap-3">
                          <img
                            src={contact.sovoAvatar || 'https://ui-avatars.com/api/?name=?&background=222230&color=ffd700'}
                            alt={contact.name}
                            className="w-10 h-10 rounded-full object-cover"
                            style={{ border: "1px solid rgba(212,175,55,0.40)" }}
                          />
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold" style={{ color: "var(--color-text)" }}>
                                {contact.name}
                              </span>
                              <span className="text-[11px] font-mono" style={{ color: "var(--color-gold-bright)" }}>
                                @{contact.sovoUsername}
                              </span>
                            </div>
                            <p className="text-[10px] truncate max-w-[200px]" style={{ color: "var(--color-text-secondary)" }}>
                              {contact.status || "S\u2019ovo member"}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => { sound.playTap(); onStartDirectChat(contact); onClose(); }}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold cursor-pointer active:scale-95 transition"
                          style={{
                            backgroundColor: "rgba(212,175,55,0.10)",
                            border: "1px solid rgba(212,175,55,0.50)",
                            color: "var(--color-gold-bright)",
                            borderRadius: "var(--radius-sm)",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--color-gold-bright)")}
                          onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(212,175,55,0.50)")}
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Chat</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          /* @Username search tab */
          <div className="space-y-4">
            <form onSubmit={handleSearchUsername} className="space-y-3">
              <div>
                <label
                  className="block text-xs font-semibold mb-1.5"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  Find Anyone by Unique @Username (Strict Anonymity)
                </label>
                <div className="relative">
                  <AtSign
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4"
                    style={{ color: "var(--color-gold-bright)" }}
                  />
                  <input
                    type="text"
                    value={globalUsernameInput}
                    onChange={(e) => { setGlobalUsernameInput(e.target.value); setSearchAttempted(false); setGlobalSearchResult(null); }}
                    placeholder="e.g. elena_r or thorne_x"
                    className="w-full pl-10 pr-4 py-2.5 text-xs"
                    style={inputStyle}
                    onFocus={(e) => (e.target.style.borderColor = "var(--color-gold)")}
                    onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 gold-glossy-button font-display font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow active:scale-98"
                style={{ borderRadius: "var(--radius-md)", color: "var(--color-bg)" }}
              >
                <Search className="w-3.5 h-3.5" />
                <span>Search S&apos;ovo Directory</span>
              </button>
            </form>

            {globalSearchResult && (
              <div
                className="p-4 flex items-center justify-between"
                style={{
                  backgroundColor: "var(--color-elevated)",
                  border: "1px solid rgba(212,175,55,0.40)",
                  borderRadius: "var(--radius-md)",
                }}
              >
                <div className="flex items-center gap-3">
                  <img
                    src={globalSearchResult.sovoAvatar}
                    alt={globalSearchResult.name}
                    className="w-11 h-11 rounded-full object-cover"
                    style={{ border: "2px solid var(--color-gold)" }}
                  />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold" style={{ color: "var(--color-text)" }}>
                        {globalSearchResult.name}
                      </span>
                      <span className="text-[11px] font-mono" style={{ color: "var(--color-gold-bright)" }}>
                        @{globalSearchResult.sovoUsername}
                      </span>
                    </div>
                    <p className="text-[10px] flex items-center gap-1 mt-0.5" style={{ color: "var(--color-text-secondary)" }}>
                      <Lock className="w-3 h-3" style={{ color: "var(--color-gold)" }} />
                      End-to-End Encrypted Identity
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => { sound.playTap(); onStartDirectChat(globalSearchResult); onClose(); }}
                  className="px-3.5 py-2 gold-gradient-bg font-semibold text-xs flex items-center gap-1.5 shadow cursor-pointer active:scale-95"
                  style={{ borderRadius: "var(--radius-sm)", color: "var(--color-bg)" }}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Start Chat</span>
                </button>
              </div>
            )}

            {searchAttempted && !globalSearchResult && (
              <p className="text-xs text-center py-4" style={{ color: "var(--color-text-muted)" }}>
                No S&apos;ovo account found with that username.
              </p>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
};
