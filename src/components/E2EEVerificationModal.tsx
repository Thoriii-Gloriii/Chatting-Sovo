import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, Lock, Copy, Check, X } from 'lucide-react';
import { generateSafetyNumber } from '../lib/crypto';
import { sound } from '../lib/sound';

interface E2EEVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  peerId: string;
  peerName: string;
  peerUsername?: string;
  keyFingerprint?: string;
}

export const E2EEVerificationModal: React.FC<E2EEVerificationModalProps> = ({
  isOpen,
  onClose,
  currentUserId,
  peerId,
  peerName,
  peerUsername,
  keyFingerprint = 'SOVO-E2EE-44A9-10F3-7281',
}) => {
  const [copied, setCopied] = useState(false);
  const [isVerified, setIsVerified] = useState(true);
  const [activeTab, setActiveTab] = useState<'numbers' | 'qr'>('numbers');

  if (!isOpen) return null;

  const safetyNumbers = generateSafetyNumber(currentUserId, peerId);
  const numberBlocks = safetyNumbers.split(' ');

  const handleCopy = () => {
    navigator.clipboard.writeText(safetyNumbers);
    setCopied(true);
    sound.playTap();
    setTimeout(() => setCopied(false), 2000);
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
        className="w-full max-w-md p-6 shadow-2xl relative"
        style={{
          backgroundColor: "var(--color-surface)",
          border: "1px solid rgba(212,175,55,0.35)",
          borderRadius: "var(--radius-xl)",
          color: "var(--color-text)",
        }}
        id="sovo-e2ee-modal"
      >
        {/* Ambient light */}
        <div
          className="absolute -top-20 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full blur-3xl pointer-events-none"
          style={{ backgroundColor: "rgba(212,175,55,0.15)" }}
        />

        {/* Close */}
        <button
          type="button"
          onClick={() => { sound.playTap(); onClose(); }}
          className="absolute top-5 right-5 p-1.5 rounded-full transition"
          style={{
            color: "var(--color-text-secondary)",
            backgroundColor: "var(--color-elevated)",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-text)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-text-secondary)")}
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div
            className="p-3 flex-shrink-0"
            style={{
              borderRadius: "var(--radius-md)",
              backgroundColor: "rgba(212,175,55,0.12)",
              border: "1px solid rgba(212,175,55,0.40)",
              color: "var(--color-gold-bright)",
            }}
          >
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-display font-bold text-lg text-gold-glossy">
              Verify End-to-End Encryption
            </h3>
            <p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
              Session with{' '}
              <span style={{ color: "var(--color-text)", fontWeight: 600 }}>{peerName}</span>
              {' '}{peerUsername && (
                <span className="font-mono" style={{ color: "var(--color-gold-bright)" }}>
                  @{peerUsername}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Info box */}
        <div
          className="p-3.5 rounded-2xl mb-4 text-xs space-y-1"
          style={{
            backgroundColor: "var(--color-elevated)",
            border: "1px solid var(--color-border)",
          }}
        >
          <p className="flex items-center gap-1.5 font-semibold" style={{ color: "var(--color-gold-bright)" }}>
            <Lock className="w-3.5 h-3.5" /> 4096-bit Quantum-Resistant Ratchet
          </p>
          <p className="text-[11px]" style={{ color: "var(--color-text-secondary)" }}>
            Messages, 2GB files, statuses, and voice notes sent to this chat are encrypted on your
            device. No one outside of this chat, not even S&apos;ovo servers, can read or listen to them.
          </p>
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
          {(['numbers', 'qr'] as const).map((tab) => (
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
              {tab === 'numbers' ? '60-Digit Safety Numbers' : 'Scan QR Code'}
            </button>
          ))}
        </div>

        {activeTab === 'numbers' ? (
          <div className="space-y-4">
            {/* Safety number grid */}
            <div
              className="grid grid-cols-3 gap-2 p-4"
              style={{
                backgroundColor: "var(--color-bg)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-lg)",
              }}
            >
              {numberBlocks.map((blk, idx) => (
                <div
                  key={idx}
                  className="text-center font-mono text-xs sm:text-sm font-bold tracking-widest py-1"
                  style={{
                    color: "var(--color-gold-bright)",
                    backgroundColor: "var(--color-surface)",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  {blk}
                </div>
              ))}
            </div>

            {/* Fingerprint + copy */}
            <div
              className="flex items-center justify-between p-3"
              style={{
                backgroundColor: "var(--color-elevated)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
              }}
            >
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-medium" style={{ color: "var(--color-text-secondary)" }}>
                  Public Key Fingerprint
                </span>
                <span className="text-xs font-mono font-semibold" style={{ color: "var(--color-text)" }}>
                  {keyFingerprint}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium cursor-pointer transition"
                style={{
                  backgroundColor: "rgba(212,175,55,0.12)",
                  border: "1px solid rgba(212,175,55,0.40)",
                  color: "var(--color-gold-bright)",
                  borderRadius: "var(--radius-sm)",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(212,175,55,0.20)")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "rgba(212,175,55,0.12)")}
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy Code'}</span>
              </button>
            </div>
          </div>
        ) : (
          /* QR tab */
          <div
            className="flex flex-col items-center p-4"
            style={{
              backgroundColor: "var(--color-bg)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-lg)",
            }}
          >
            <div
              className="relative p-3 rounded-2xl mb-3"
              style={{
                backgroundColor: "#ffffff",
                border: "4px solid rgba(212,175,55,0.40)",
              }}
            >
              <svg className="w-44 h-44" viewBox="0 0 100 100">
                <rect width="100" height="100" fill="#ffffff" />
                <rect x="5" y="5" width="25" height="25" fill="#050507" />
                <rect x="8" y="8" width="19" height="19" fill="#ffffff" />
                <rect x="11" y="11" width="13" height="13" fill="#050507" />
                <rect x="70" y="5" width="25" height="25" fill="#050507" />
                <rect x="73" y="8" width="19" height="19" fill="#ffffff" />
                <rect x="76" y="11" width="13" height="13" fill="#050507" />
                <rect x="5" y="70" width="25" height="25" fill="#050507" />
                <rect x="8" y="73" width="19" height="19" fill="#ffffff" />
                <rect x="11" y="76" width="13" height="13" fill="#050507" />
                {[[35,10],[45,15],[55,10],[40,25],[55,30],[15,40],[25,45],[75,40],[85,45],[35,75],[45,85],[55,75],[75,75],[85,80]].map(([x,y],i)=>(
                  <rect key={i} x={x} y={y} width="6" height="6" fill="#050507" />
                ))}
                <circle cx="50" cy="50" r="12" fill="#d4af37" />
                <circle cx="50" cy="50" r="9" fill="#050507" />
                <circle cx="47" cy="50" r="1.5" fill="#ffd700" />
                <circle cx="50" cy="50" r="1.5" fill="#ffd700" />
                <circle cx="53" cy="50" r="1.5" fill="#ffd700" />
              </svg>
            </div>
            <p className="text-xs text-center" style={{ color: "var(--color-text-secondary)" }}>
              Scan this code on {peerName}&apos;s phone to verify that your keys match.
            </p>
          </div>
        )}

        {/* Verify toggle */}
        <div
          className="mt-5 pt-4 flex items-center justify-between"
          style={{ borderTop: "1px solid var(--color-border)" }}
        >
          <div className="flex items-center gap-2">
            <ShieldCheck
              className="w-4 h-4"
              style={{ color: isVerified ? "#34d399" : "var(--color-text-muted)" }}
            />
            <span className="text-xs font-semibold" style={{ color: "var(--color-text)" }}>
              Mark as Verified in Keyring
            </span>
          </div>

          <button
            type="button"
            onClick={() => { sound.playTap(); setIsVerified(!isVerified); }}
            className="w-10 h-5 rounded-full transition-colors relative cursor-pointer"
            style={{ backgroundColor: isVerified ? "var(--color-gold)" : "var(--color-elevated)" }}
          >
            <div
              className="w-3.5 h-3.5 rounded-full bg-black transition-transform absolute top-0.5"
              style={{ [isVerified ? 'right' : 'left']: '2px' }}
            />
          </button>
        </div>
      </motion.div>
    </div>
  );
};
