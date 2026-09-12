import React, { useState } from 'react';
import { motion } from 'motion/react';
import { SyncedContact, Conversation } from '../types';
import { Users, ShieldCheck, Sparkles, Check, X, Camera, Lock } from 'lucide-react';
import { sound } from '../lib/sound';
import { generateKeyFingerprint } from '../lib/crypto';

interface GroupCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  contacts: SyncedContact[];
  currentUserId: string;
  onCreateGroup: (newGroup: Conversation) => void;
}

export const GroupCreateModal: React.FC<GroupCreateModalProps> = ({
  isOpen,
  onClose,
  contacts,
  currentUserId,
  onCreateGroup,
}) => {
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([
    'usr_002',
    'usr_003',
  ]);
  const [groupAvatar, setGroupAvatar] = useState(
    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&auto=format&fit=crop&q=80'
  );

  if (!isOpen) return null;

  const toggleContact = (id: string) => {
    sound.playTap();
    if (selectedContactIds.includes(id)) {
      setSelectedContactIds((prev) => prev.filter((i) => i !== id));
    } else {
      if (selectedContactIds.length >= 499) {
        alert('Maximum group capacity of 500 members reached.');
        return;
      }
      setSelectedContactIds((prev) => [...prev, id]);
    }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;
    sound.playSend();

    const newGroup: Conversation = {
      id: `conv_grp_${Date.now()}`,
      type: 'group',
      name: groupName.trim(),
      avatar: groupAvatar,
      members: [currentUserId, ...selectedContactIds],
      memberCount: selectedContactIds.length + 1,
      maxMembers: 500,
      adminIds: [currentUserId],
      unreadCount: 0,
      isEncrypted: true,
      e2eeKeyFingerprint: generateKeyFingerprint(`grp_${groupName}`),
      isPinned: false,
      disappearingTimerHours: 0,
      createdAt: Date.now(),
      groupDescription: description || 'Encrypted group on S’ovo with up to 500 participants.',
    };

    onCreateGroup(newGroup);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-md max-h-[90vh] bg-[#0b0b10] border border-[#d4af37]/40 rounded-3xl p-6 shadow-2xl flex flex-col text-white relative overflow-hidden"
        id="sovo-group-create-modal"
      >
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#202028]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[#1c180e] border border-[#d4af37]/40 text-[#ffd700]">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-lg text-gold-glossy">
                New Encrypted Group
              </h3>
              <p className="text-xs text-gray-400">Up to 500 members with multi-party E2EE</p>
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

        <form onSubmit={handleCreate} className="space-y-4 flex-1 overflow-y-auto pr-1">
          {/* Group Capacity Counter */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-[#12121a] border border-[#272635]">
            <span className="text-xs text-gray-300 font-medium">Group Member Capacity</span>
            <span className="text-xs font-mono font-bold text-[#ffd700] bg-[#221c0e] px-2.5 py-1 rounded-lg border border-[#d4af37]/40">
              {selectedContactIds.length + 1} / 500 Members
            </span>
          </div>

          {/* Group Name & Avatar */}
          <div className="flex items-center gap-3">
            <div className="relative w-14 h-14 rounded-2xl overflow-hidden border-2 border-[#d4af37] flex-shrink-0">
              <img src={groupAvatar} alt="Group Avatar" className="w-full h-full object-cover" />
            </div>

            <div className="flex-1">
              <label className="block text-[11px] font-semibold text-gray-300 mb-1">
                Group Name
              </label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="e.g. Zurich Cryptographic Syndicate"
                className="w-full px-3.5 py-2.5 bg-[#14141d] border border-[#2c2b3a] focus:border-[#ffd700] rounded-xl text-xs text-white outline-none"
                required
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-300 mb-1">
              Group Topic / Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this encrypted room about?"
              rows={2}
              className="w-full px-3.5 py-2 bg-[#14141d] border border-[#2c2b3a] focus:border-[#ffd700] rounded-xl text-xs text-white outline-none resize-none"
            />
          </div>

          {/* Add Members from contacts */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">
              Select Participants ({selectedContactIds.length} chosen)
            </label>

            <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
              {contacts
                .filter((c) => c.isRegistered)
                .map((contact) => {
                  const isSelected = selectedContactIds.includes(contact.sovoUserId || contact.id);

                  return (
                    <div
                      key={contact.id}
                      onClick={() => toggleContact(contact.sovoUserId || contact.id)}
                      className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                        isSelected
                          ? 'bg-[#221c0e] border-[#ffd700]'
                          : 'bg-[#121218] border-[#22212d] hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <img
                          src={contact.sovoAvatar || ''}
                          alt={contact.name}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                        <div>
                          <p className="text-xs font-semibold text-white">{contact.name}</p>
                          <p className="text-[10px] text-[#d4af37] font-mono">
                            @{contact.sovoUsername}
                          </p>
                        </div>
                      </div>

                      <div
                        className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                          isSelected ? 'bg-[#ffd700] border-[#ffd700] text-black' : 'border-gray-600'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* E2EE Info */}
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#0e0e14] border border-[#22212d] text-[11px] text-gray-400">
            <Lock className="w-3.5 h-3.5 text-[#ffd700]" />
            <span>Group keys are ratcheted using sender keys for up to 500 members.</span>
          </div>

          <button
            type="submit"
            disabled={!groupName.trim()}
            className="w-full py-3.5 rounded-xl gold-glossy-button text-black font-display font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg disabled:opacity-50 active:scale-98"
          >
            <Sparkles className="w-4 h-4 text-black fill-black" />
            <span>Create 500-Member Group Chat</span>
          </button>
        </form>
      </motion.div>
    </div>
  );
};
