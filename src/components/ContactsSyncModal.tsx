import React, { useState } from 'react';
import { motion } from 'motion/react';
import { SyncedContact, Conversation, User } from '../types';

import {
  Users,
  Search,
  RefreshCw,
  ShieldCheck,
  Lock,
  UserPlus,
  MessageSquare,
  Sparkles,
  CheckCircle2,
  X,
  Share2,
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-lg max-h-[85vh] bg-[#0c0c11] border border-[#d4af37]/35 rounded-3xl p-6 shadow-2xl flex flex-col text-white relative overflow-hidden"
        id="sovo-contacts-sync-modal"
      >
        {/* Ambient Glow */}
        <div className="absolute -top-20 right-10 w-48 h-48 rounded-full bg-[#d4af37]/15 blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#202028]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[#1c180e] border border-[#d4af37]/40 text-[#ffd700]">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-lg text-gold-glossy">
                Address Book & Discovery
              </h3>
              <p className="text-xs text-gray-400">Find contacts anonymously on S'ovo</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              sound.playTap();
              onClose();
            }}
            className="p-1.5 rounded-full text-gray-400 hover:text-white bg-[#14141c] hover:bg-[#20202c]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Privacy banner */}
        <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-[#121219] border border-[#272635] mb-4 text-xs text-gray-300">
          <ShieldCheck className="w-4 h-4 text-[#ffd700] flex-shrink-0 mt-0.5" />
          <div className="text-[11px] leading-relaxed text-gray-300">
            <span className="font-semibold text-white">Find real S'ovo accounts: </span>
            Browse everyone currently registered, or jump straight to someone by their @username.
          </div>
        </div>

        {/* Tab switch: Discover real accounts vs Global @username search */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-[#14141d] border border-[#2b2a38] rounded-xl mb-4 text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              sound.playTap();
              setActiveTab('discover');
            }}
            className={`py-2 rounded-lg transition ${
              activeTab === 'discover'
                ? 'bg-[#221c0e] text-[#ffd700] border border-[#d4af37]/40 shadow-sm'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Discover ({contacts.length})
          </button>

          <button
            type="button"
            onClick={() => {
              sound.playTap();
              setActiveTab('username');
            }}
            className={`py-2 rounded-lg transition ${
              activeTab === 'username'
                ? 'bg-[#221c0e] text-[#ffd700] border border-[#d4af37]/40 shadow-sm'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Search by @Username
          </button>
        </div>

        {activeTab === 'discover' ? (
          <>
            {/* Search Bar */}
            <div className="flex items-center gap-2 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Filter people or handles..."
                  className="w-full pl-9 pr-3 py-2 bg-[#12121a] border border-[#2c2b38] focus:border-[#ffd700] rounded-xl text-xs text-white placeholder-gray-500 outline-none"
                />
              </div>
            </div>

            {/* Contacts Scrollable List */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#d4af37] mb-2 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> On S'ovo ({filteredContacts.length})
                </p>

                {filteredContacts.length === 0 ? (
                  <p className="text-xs text-gray-500 py-6 text-center">
                    No one else has signed up yet — invite a friend!
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {filteredContacts.map((contact) => (
                      <div
                        key={contact.id}
                        className="p-2.5 rounded-2xl bg-[#111117] hover:bg-[#181822] border border-[#24232f] hover:border-[#d4af37]/40 transition flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <img
                            src={contact.sovoAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                            alt={contact.name}
                            className="w-10 h-10 rounded-full object-cover border border-[#d4af37]/50"
                          />
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold text-white">{contact.name}</span>
                              <span className="text-[11px] font-mono text-[#ffd700]">
                                @{contact.sovoUsername}
                              </span>
                            </div>
                            <p className="text-[10px] text-gray-400 truncate max-w-[200px]">
                              {contact.status || 'S\u2019ovo member'}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            sound.playTap();
                            onStartDirectChat(contact);
                            onClose();
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#2a220f] to-[#17140b] border border-[#d4af37]/60 text-[#ffd700] text-xs font-semibold hover:border-[#ffd700] cursor-pointer active:scale-95"
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
          /* Global @Username Search Tab */
          <div className="space-y-4">
            <form onSubmit={handleSearchUsername} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  Find Anyone by Unique @Username (Strict Anonymity)
                </label>
                <div className="relative">
                  <AtSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#ffd700]" />
                  <input
                    type="text"
                    value={globalUsernameInput}
                    onChange={(e) => {
                      setGlobalUsernameInput(e.target.value);
                      setSearchAttempted(false);
                      setGlobalSearchResult(null);
                    }}
                    placeholder="e.g. elena_r or thorne_x"
                    className="w-full pl-10 pr-4 py-2.5 bg-[#12121a] border border-[#2c2b38] focus:border-[#ffd700] rounded-xl text-xs text-white placeholder-gray-500 outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl gold-glossy-button text-black font-display font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow active:scale-98"
              >
                <Search className="w-3.5 h-3.5 text-black" />
                <span>Search S'ovo Directory</span>
              </button>
            </form>

            {globalSearchResult && (
              <div className="p-4 rounded-2xl bg-[#111118] border border-[#d4af37]/40 flex items-center justify-between animate-fadeIn">
                <div className="flex items-center gap-3">
                  <img
                    src={globalSearchResult.sovoAvatar}
                    alt={globalSearchResult.name}
                    className="w-11 h-11 rounded-full object-cover border-2 border-[#d4af37]"
                  />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-white">
                        {globalSearchResult.name}
                      </span>
                      <span className="text-[11px] font-mono text-[#ffd700]">
                        @{globalSearchResult.sovoUsername}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                      <Lock className="w-3 h-3 text-[#d4af37]" /> End-to-End Encrypted Identity
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    sound.playTap();
                    onStartDirectChat(globalSearchResult);
                    onClose();
                  }}
                  className="px-3.5 py-2 rounded-xl gold-gradient-bg text-black font-semibold text-xs flex items-center gap-1.5 shadow cursor-pointer active:scale-95"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Start Chat</span>
                </button>
              </div>
            )}

            {searchAttempted && !globalSearchResult && (
              <p className="text-xs text-gray-500 text-center py-4">
                No S'ovo account found with that username.
              </p>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
};

