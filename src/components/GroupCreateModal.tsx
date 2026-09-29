import React, { useState } from 'react';
import { motion } from 'motion/react';
import { SyncedContact, Conversation } from '../types';
import { Users, Sparkles, Check, X, Lock } from 'lucide-react';
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
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [groupAvatar] = useState(
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
      groupDescription: description || "Encrypted group on S\u2019ovo with up to 500 participants.",
    };

    onCreateGroup(newGroup);
    onClose();
  };

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
        className="w-full max-w-md max-h-[90vh] p-6 shadow-2xl flex flex-col relative overflow-hidden"
        style={{
          backgroundColor: "var(--color-surface)",
          border: "1px solid rgba(212,175,55,0.40)",
          borderRadius: "var(--radius-xl)",
          color: "var(--color-text)",
        }}
        id="sovo-group-create-modal"
      >
        {/* Header */}
        <div
          className="flex items-center justify-between mb-5 pb-4"
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
              <h3 className="font-display font-bold text-lg text-gold-glossy">New Encrypted Group</h3>
              <p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
                Up to 500 members with multi-party E2EE
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => { sound.playTap(); onClose(); }}
            className="p-1.5 rounded-full transition"
            style={{ color: "var(--color-text-secondary)", backgroundColor: "var(--color-elevated)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-text)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-text-secondary)")}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleCreate} className="space-y-4 flex-1 overflow-y-auto pr-1">
          {/* Member counter */}
          <div
            className="flex items-center justify-between p-3"
            style={{
              backgroundColor: "var(--color-elevated)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
            }}
          >
            <span className="text-xs font-medium" style={{ color: "var(--color-text-secondary)" }}>
              Group Member Capacity
            </span>
            <span
              className="text-xs font-mono font-bold px-2.5 py-1"
              style={{
                color: "var(--color-gold-bright)",
                backgroundColor: "rgba(212,175,55,0.10)",
                border: "1px solid rgba(212,175,55,0.35)",
                borderRadius: "var(--radius-sm)",
              }}
            >
              {selectedContactIds.length + 1} / 500 Members
            </span>
          </div>

          {/* Group avatar + name */}
          <div className="flex items-center gap-3">
            <div
              className="relative w-14 h-14 overflow-hidden flex-shrink-0"
              style={{
                borderRadius: "var(--radius-md)",
                border: "2px solid var(--color-gold)",
              }}
            >
              <img src={groupAvatar} alt="Group Avatar" className="w-full h-full object-cover" />
            </div>

            <div className="flex-1">
              <label className="block text-[11px] font-semibold mb-1" style={{ color: "var(--color-text-secondary)" }}>
                Group Name
              </label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="e.g. Zurich Cryptographic Syndicate"
                className="w-full px-3.5 py-2.5 text-xs"
                style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = "var(--color-gold)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
                required
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-[11px] font-semibold mb-1" style={{ color: "var(--color-text-secondary)" }}>
              Group Topic / Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this encrypted room about?"
              rows={2}
              className="w-full px-3.5 py-2 text-xs resize-none"
              style={inputStyle}
              onFocus={(e) => (e.target.style.borderColor = "var(--color-gold)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
            />
          </div>

          {/* Member select */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--color-text-secondary)" }}>
              Select Participants ({selectedContactIds.length} chosen)
            </label>

            <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
              {contacts.filter((c) => c.isRegistered).map((contact) => {
                const isSelected = selectedContactIds.includes(contact.sovoUserId || contact.id);
                return (
                  <div
                    key={contact.id}
                    onClick={() => toggleContact(contact.sovoUserId || contact.id)}
                    className="p-2.5 flex items-center justify-between cursor-pointer transition"
                    style={{
                      borderRadius: "var(--radius-sm)",
                      backgroundColor: isSelected ? "rgba(212,175,55,0.10)" : "var(--color-elevated)",
                      border: `1px solid ${isSelected ? "var(--color-gold)" : "var(--color-border)"}`,
                    }}
                  >
                    <div className="flex items-center gap-2.5">
                      <img
                        src={contact.sovoAvatar || ''}
                        alt={contact.name}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                      <div>
                        <p className="text-xs font-semibold" style={{ color: "var(--color-text)" }}>
                          {contact.name}
                        </p>
                        <p className="text-[10px] font-mono" style={{ color: "var(--color-gold)" }}>
                          @{contact.sovoUsername}
                        </p>
                      </div>
                    </div>

                    <div
                      className="w-5 h-5 rounded-full border flex items-center justify-center"
                      style={{
                        backgroundColor: isSelected ? "var(--color-gold-bright)" : "transparent",
                        borderColor: isSelected ? "var(--color-gold-bright)" : "var(--color-text-muted)",
                        color: "black",
                      }}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* E2EE info */}
          <div
            className="flex items-center gap-2 p-2.5 text-[11px]"
            style={{
              backgroundColor: "var(--color-bg)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              color: "var(--color-text-secondary)",
            }}
          >
            <Lock className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--color-gold)" }} />
            <span>Group keys are ratcheted using sender keys for up to 500 members.</span>
          </div>

          <button
            type="submit"
            disabled={!groupName.trim()}
            className="w-full py-3.5 gold-glossy-button font-display font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg disabled:opacity-50 active:scale-98"
            style={{ borderRadius: "var(--radius-md)", color: "var(--color-bg)" }}
          >
            <Sparkles className="w-4 h-4 fill-current" />
            <span>Create 500-Member Group Chat</span>
          </button>
        </form>
      </motion.div>
    </div>
  );
};
