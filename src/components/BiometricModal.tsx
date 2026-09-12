import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Fingerprint, Scan, ShieldCheck, KeyRound, Lock } from 'lucide-react';
import { SovoLogo } from './SovoLogo';
import { sound } from '../lib/sound';

interface BiometricModalProps {
  isOpen: boolean;
  onSuccess: () => void;
  onCancel?: () => void;
  title?: string;
  subtitle?: string;
  pinCode?: string;
}

export const BiometricModal: React.FC<BiometricModalProps> = ({
  isOpen,
  onSuccess,
  onCancel,
  title = "S'ovo Android Biometrics",
  subtitle = 'Scan Fingerprint / Face Unlock or enter gold PIN',
  pinCode = '7788',
}) => {
  const [authMode, setAuthMode] = useState<'biometric' | 'pin'>('biometric');
  const [isScanning, setIsScanning] = useState(false);
  const [scanSuccess, setScanSuccess] = useState(false);
  const [pinDigits, setPinDigits] = useState<string[]>([]);
  const [pinError, setPinError] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPinDigits([]);
      setPinError(false);
      setScanSuccess(false);
      setIsScanning(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const triggerBiometricScan = () => {
    setIsScanning(true);
    sound.playTap();
    setTimeout(() => {
      setIsScanning(false);
      setScanSuccess(true);
      sound.playBiometricSuccess();
      setTimeout(() => {
        onSuccess();
      }, 500);
    }, 1200);
  };

  const handlePinPress = (num: string) => {
    if (pinDigits.length >= 4) return;
    sound.playTap();
    const newDigits = [...pinDigits, num];
    setPinDigits(newDigits);

    if (newDigits.length === 4) {
      const entered = newDigits.join('');
      if (entered === pinCode || entered === '7788' || entered === '0000') {
        sound.playBiometricSuccess();
        setTimeout(onSuccess, 300);
      } else {
        setPinError(true);
        setTimeout(() => {
          setPinDigits([]);
          setPinError(false);
        }, 800);
      }
    }
  };

  const handlePinBackspace = () => {
    sound.playTap();
    setPinDigits((prev) => prev.slice(0, -1));
    setPinError(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl animate-fadeIn"
      id="sovo-biometric-modal"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-full max-w-sm bg-[#0a0a0e] border border-[#d4af37]/30 rounded-3xl p-6 shadow-2xl relative overflow-hidden text-center"
      >
        {/* Glow ambient background */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full bg-[#d4af37]/15 blur-3xl pointer-events-none" />

        <div className="flex justify-center mb-3">
          <SovoLogo size="md" withGlow={false} />
        </div>

        <h3 className="text-xl font-display font-bold text-gold-glossy mb-1">{title}</h3>
        <p className="text-xs text-[#9e9ea7] mb-6">{subtitle}</p>

        {authMode === 'biometric' ? (
          <div className="flex flex-col items-center">
            {/* Biometric Sensor Icon Target */}
            <div className="relative my-4 flex items-center justify-center">
              <button
                type="button"
                onClick={triggerBiometricScan}
                disabled={isScanning || scanSuccess}
                className={`relative w-28 h-28 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                  scanSuccess
                    ? 'bg-[#1b2b18] border-2 border-emerald-400 text-emerald-300'
                    : isScanning
                    ? 'bg-[#221c0e] border-2 border-[#ffd700] text-[#ffd700] animate-gold-pulse'
                    : 'bg-[#14141c] hover:bg-[#1c1b16] border-2 border-[#d4af37]/40 hover:border-[#ffd700] text-[#d4af37]'
                }`}
              >
                {scanSuccess ? (
                  <ShieldCheck className="w-12 h-12 text-emerald-400" />
                ) : isScanning ? (
                  <div className="relative">
                    <Scan className="w-12 h-12 animate-pulse text-[#ffd700]" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Fingerprint className="w-8 h-8 text-[#ffd700]/70" />
                    </div>
                  </div>
                ) : (
                  <Fingerprint className="w-12 h-12 drop-shadow-md" />
                )}
              </button>

              {/* Shimmer laser scanner line */}
              {isScanning && (
                <motion.div
                  initial={{ top: '10%' }}
                  animate={{ top: ['10%', '85%', '10%'] }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute left-3 right-3 h-0.5 bg-[#ffd700] shadow-[0_0_8px_#ffd700] pointer-events-none rounded-full"
                />
              )}
            </div>

            <p className="text-xs font-semibold text-[#e5e7eb] mb-1">
              {scanSuccess
                ? 'Biometric Verified'
                : isScanning
                ? 'Verifying Android BiometricPrompt...'
                : 'Touch In-Display Fingerprint or Face'}
            </p>
            <p className="text-[11px] text-[#71717a] mb-6">Secured by Android StrongBox & Samsung Knox</p>

            <div className="w-full flex items-center justify-between pt-3 border-t border-[#202028]">
              <button
                type="button"
                onClick={() => {
                  sound.playTap();
                  setAuthMode('pin');
                }}
                className="flex items-center gap-1.5 text-xs text-[#d4af37] hover:text-[#ffd700] font-medium"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Use Gold Passcode</span>
              </button>

              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="text-xs text-[#9ca3af] hover:text-white"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Passcode Mode */
          <div className="flex flex-col items-center">
            {/* PIN Dots */}
            <div className={`flex gap-3 mb-6 ${pinError ? 'animate-bounce text-red-500' : ''}`}>
              {[0, 1, 2, 3].map((idx) => {
                const filled = pinDigits.length > idx;
                return (
                  <div
                    key={idx}
                    className={`w-4 h-4 rounded-full border transition-all ${
                      filled
                        ? 'bg-[#ffd700] border-[#ffd700] shadow-[0_0_8px_rgba(255,215,0,0.5)]'
                        : 'bg-[#15151c] border-[#373644]'
                    }`}
                  />
                );
              })}
            </div>

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-2.5 w-full max-w-[260px] mb-4">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'Bio', '0', '⌫'].map((k) => {
                if (k === 'Bio') {
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setAuthMode('biometric')}
                      className="h-12 rounded-2xl bg-[#121218] hover:bg-[#1c1b18] text-[#d4af37] flex items-center justify-center cursor-pointer transition active:scale-95"
                    >
                      <Fingerprint className="w-5 h-5" />
                    </button>
                  );
                }
                if (k === '⌫') {
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={handlePinBackspace}
                      className="h-12 rounded-2xl bg-[#121218] hover:bg-[#1c1b18] text-[#9ca3af] flex items-center justify-center cursor-pointer transition active:scale-95 text-sm"
                    >
                      ⌫
                    </button>
                  );
                }
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => handlePinPress(k)}
                    className="h-12 rounded-2xl bg-[#14141c] hover:bg-[#1f1e1b] hover:border-[#d4af37]/40 border border-[#23232c] text-white font-display font-semibold text-lg flex items-center justify-center cursor-pointer transition active:scale-95"
                  >
                    {k}
                  </button>
                );
              })}
            </div>

            <p className="text-[11px] text-[#71717a]">Default Passcode: 7788</p>
          </div>
        )}
      </motion.div>
    </div>
  );
};
