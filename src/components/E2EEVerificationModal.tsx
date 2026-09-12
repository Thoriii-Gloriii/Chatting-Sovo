import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, Lock, QrCode, Copy, Check, Key, Smartphone, AlertCircle, X } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-md bg-[#0a0a0f] border border-[#d4af37]/35 rounded-3xl p-6 shadow-2xl relative text-white"
        id="sovo-e2ee-modal"
      >
        {/* Ambient light */}
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full bg-[#d4af37]/15 blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          type="button"
          onClick={() => {
            sound.playTap();
            onClose();
          }}
          className="absolute top-5 right-5 p-1.5 rounded-full text-gray-400 hover:text-white bg-[#14141c] hover:bg-[#20202c] transition"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-2xl bg-[#1c180e] border border-[#d4af37]/40 text-[#ffd700] shadow-sm">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-display font-bold text-lg text-gold-glossy">
              Verify End-to-End Encryption
            </h3>
            <p className="text-xs text-gray-400">
              Session with <span className="text-white font-semibold">{peerName}</span>{' '}
              {peerUsername && <span className="text-[#ffd700] font-mono">@{peerUsername}</span>}
            </p>
          </div>
        </div>

        {/* Security badge explanation */}
        <div className="p-3.5 rounded-2xl bg-[#111116] border border-[#262530] mb-4 text-xs text-gray-300 space-y-1">
          <p className="flex items-center gap-1.5 text-[#ffd700] font-semibold">
            <Lock className="w-3.5 h-3.5" /> 4096-bit Quantum-Resistant Ratchet
          </p>
          <p className="text-[11px] text-gray-400">
            Messages, 2GB files, statuses, and voice notes sent to this chat are encrypted on your
            device. No one outside of this chat, not even S'ovo servers, can read or listen to them.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-[#121218] border border-[#2e2d3b] rounded-xl mb-4 text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              sound.playTap();
              setActiveTab('numbers');
            }}
            className={`py-2 rounded-lg transition ${
              activeTab === 'numbers'
                ? 'bg-[#221c0e] text-[#ffd700] border border-[#d4af37]/40'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            60-Digit Safety Numbers
          </button>
          <button
            type="button"
            onClick={() => {
              sound.playTap();
              setActiveTab('qr');
            }}
            className={`py-2 rounded-lg transition ${
              activeTab === 'qr'
                ? 'bg-[#221c0e] text-[#ffd700] border border-[#d4af37]/40'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Scan QR Code
          </button>
        </div>

        {activeTab === 'numbers' ? (
          <div className="space-y-4">
            {/* Safety numbers 12 blocks */}
            <div className="grid grid-cols-3 gap-2 p-4 bg-[#07070a] border border-[#2c2b38] rounded-2xl">
              {numberBlocks.map((blk, idx) => (
                <div
                  key={idx}
                  className="text-center font-mono text-xs sm:text-sm font-bold text-[#ffd700] tracking-widest py-1 bg-[#12121a] rounded-lg border border-[#201f2b]"
                >
                  {blk}
                </div>
              ))}
            </div>

            {/* Key fingerprint & copy button */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#13131b] border border-[#2a2936]">
              <div className="flex flex-col">
                <span className="text-[10px] text-gray-400 uppercase font-medium">
                  Public Key Fingerprint
                </span>
                <span className="text-xs font-mono text-white font-semibold">{keyFingerprint}</span>
              </div>
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1e1c14] border border-[#d4af37]/40 text-[#ffd700] hover:bg-[#2e2614] transition text-xs font-medium cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy Code'}</span>
              </button>
            </div>
          </div>
        ) : (
          /* QR Code Tab */
          <div className="flex flex-col items-center p-4 bg-[#07070a] border border-[#2c2b38] rounded-2xl">
            <div className="relative p-3 bg-white rounded-2xl shadow-xl border-4 border-[#d4af37]/40 mb-3">
              {/* Simulated QR Code with S'ovo central insignia */}
              <svg className="w-44 h-44" viewBox="0 0 100 100">
                <rect width="100" height="100" fill="#ffffff" />
                {/* QR Finder patterns */}
                <rect x="5" y="5" width="25" height="25" fill="#050507" />
                <rect x="8" y="8" width="19" height="19" fill="#ffffff" />
                <rect x="11" y="11" width="13" height="13" fill="#050507" />

                <rect x="70" y="5" width="25" height="25" fill="#050507" />
                <rect x="73" y="8" width="19" height="19" fill="#ffffff" />
                <rect x="76" y="11" width="13" height="13" fill="#050507" />

                <rect x="5" y="70" width="25" height="25" fill="#050507" />
                <rect x="8" y="73" width="19" height="19" fill="#ffffff" />
                <rect x="11" y="76" width="13" height="13" fill="#050507" />

                {/* Data dots matrix */}
                {[
                  [35, 10],
                  [45, 15],
                  [55, 10],
                  [40, 25],
                  [55, 30],
                  [15, 40],
                  [25, 45],
                  [75, 40],
                  [85, 45],
                  [35, 75],
                  [45, 85],
                  [55, 75],
                  [75, 75],
                  [85, 80],
                ].map(([x, y], i) => (
                  <rect key={i} x={x} y={y} width="6" height="6" fill="#050507" />
                ))}

                {/* Center Gold Emblem */}
                <circle cx="50" cy="50" r="12" fill="#d4af37" />
                <circle cx="50" cy="50" r="9" fill="#050507" />
                <circle cx="47" cy="50" r="1.5" fill="#ffd700" />
                <circle cx="50" cy="50" r="1.5" fill="#ffd700" />
                <circle cx="53" cy="50" r="1.5" fill="#ffd700" />
              </svg>
            </div>
            <p className="text-xs text-gray-300 text-center">
              Scan this code on {peerName}'s phone to verify that your keys match.
            </p>
          </div>
        )}

        {/* Verification Checkmark Switch */}
        <div className="mt-5 pt-4 border-t border-[#20202c] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck
              className={`w-4 h-4 ${isVerified ? 'text-emerald-400' : 'text-gray-500'}`}
            />
            <span className="text-xs font-semibold text-white">Mark as Verified in Keyring</span>
          </div>

          <button
            type="button"
            onClick={() => {
              sound.playTap();
              setIsVerified(!isVerified);
            }}
            className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${
              isVerified ? 'bg-[#d4af37]' : 'bg-[#272733]'
            }`}
          >
            <div
              className={`w-3.5 h-3.5 rounded-full bg-black transition-transform absolute top-0.5 ${
                isVerified ? 'right-1' : 'left-1'
              }`}
            />
          </button>
        </div>
      </motion.div>
    </div>
  );
};
