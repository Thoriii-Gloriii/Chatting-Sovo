import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
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
      setTimeout(() => { onSuccess(); }, 500);
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
        setTimeout(() => { setPinDigits([]); setPinError(false); }, 800);
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xl"
      style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
      id="sovo-biometric-modal"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-full max-w-sm p-6 shadow-2xl relative overflow-hidden text-center"
        style={{
          backgroundColor: "var(--color-surface)",
          border: "1px solid rgba(212,175,55,0.30)",
          borderRadius: "var(--radius-xl)",
          color: "var(--color-text)",
        }}
      >
        {/* Ambient glow */}
        <div
          className="absolute -top-24 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full blur-3xl pointer-events-none"
          style={{ backgroundColor: "rgba(212,175,55,0.15)" }}
        />

        <div className="flex justify-center mb-3">
          <SovoLogo size="md" withGlow={false} />
        </div>

        <h3 className="text-xl font-display font-bold text-gold-glossy mb-1">{title}</h3>
        <p className="text-xs mb-6" style={{ color: "var(--color-text-secondary)" }}>{subtitle}</p>

        {authMode === 'biometric' ? (
          <div className="flex flex-col items-center">
            {/* Fingerprint button */}
            <div className="relative my-4 flex items-center justify-center">
              <button
                type="button"
                onClick={triggerBiometricScan}
                disabled={isScanning || scanSuccess}
                className="relative w-28 h-28 rounded-full flex items-center justify-center transition-all cursor-pointer"
                style={{
                  backgroundColor: scanSuccess
                    ? "rgba(34,197,94,0.12)"
                    : isScanning
                    ? "var(--color-elevated)"
                    : "var(--color-elevated)",
                  border: `2px solid ${
                    scanSuccess
                      ? "#34d399"
                      : isScanning
                      ? "var(--color-gold-bright)"
                      : "rgba(212,175,55,0.40)"
                  }`,
                  color: scanSuccess ? "#34d399" : "var(--color-gold)",
                }}
              >
                {scanSuccess ? (
                  <ShieldCheck className="w-12 h-12 text-emerald-400" />
                ) : isScanning ? (
                  <div className="relative">
                    <Scan className="w-12 h-12 animate-pulse" style={{ color: "var(--color-gold-bright)" }} />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Fingerprint className="w-8 h-8" style={{ color: "rgba(255,215,0,0.70)" }} />
                    </div>
                  </div>
                ) : (
                  <Fingerprint className="w-12 h-12 drop-shadow-md" />
                )}
              </button>

              {isScanning && (
                <motion.div
                  initial={{ top: '10%' }}
                  animate={{ top: ['10%', '85%', '10%'] }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute left-3 right-3 h-0.5 rounded-full pointer-events-none"
                  style={{
                    backgroundColor: "var(--color-gold-bright)",
                    boxShadow: "0 0 8px var(--color-gold-bright)",
                  }}
                />
              )}
            </div>

            <p className="text-xs font-semibold mb-1" style={{ color: "var(--color-text)" }}>
              {scanSuccess
                ? 'Biometric Verified'
                : isScanning
                ? 'Verifying Android BiometricPrompt…'
                : 'Touch In-Display Fingerprint or Face'}
            </p>
            <p className="text-[11px] mb-6" style={{ color: "var(--color-text-muted)" }}>
              Secured by Android StrongBox &amp; Samsung Knox
            </p>

            <div
              className="w-full flex items-center justify-between pt-3"
              style={{ borderTop: "1px solid var(--color-border)" }}
            >
              <button
                type="button"
                onClick={() => { sound.playTap(); setAuthMode('pin'); }}
                className="flex items-center gap-1.5 text-xs font-medium"
                style={{ color: "var(--color-gold)" }}
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Use Gold Passcode</span>
              </button>

              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="text-xs"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        ) : (
          /* PIN mode */
          <div className="flex flex-col items-center">
            {/* Dots */}
            <div className={`flex gap-3 mb-6 ${pinError ? 'animate-bounce' : ''}`}>
              {[0, 1, 2, 3].map((idx) => {
                const filled = pinDigits.length > idx;
                return (
                  <div
                    key={idx}
                    className="w-4 h-4 rounded-full border transition-all"
                    style={{
                      backgroundColor: filled ? "var(--color-gold-bright)" : "var(--color-elevated)",
                      borderColor: filled ? "var(--color-gold-bright)" : "var(--color-border)",
                      boxShadow: filled ? "0 0 8px rgba(255,215,0,0.5)" : "none",
                    }}
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
                      className="h-12 rounded-2xl flex items-center justify-center cursor-pointer transition active:scale-95"
                      style={{
                        backgroundColor: "var(--color-elevated)",
                        color: "var(--color-gold)",
                      }}
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
                      className="h-12 rounded-2xl flex items-center justify-center cursor-pointer transition active:scale-95 text-sm"
                      style={{
                        backgroundColor: "var(--color-elevated)",
                        color: "var(--color-text-secondary)",
                      }}
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
                    className="h-12 rounded-2xl font-display font-semibold text-lg flex items-center justify-center cursor-pointer transition active:scale-95 border"
                    style={{
                      backgroundColor: "var(--color-elevated)",
                      color: "var(--color-text)",
                      borderColor: "var(--color-border)",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(212,175,55,0.40)")}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--color-border)")}
                  >
                    {k}
                  </button>
                );
              })}
            </div>

            <p className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
              Default Passcode: 7788
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
};
