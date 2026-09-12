import React, { useState } from 'react';
import { User, UserSettings, LinkedDevice } from '../types';
import {
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  Fingerprint,
  Smartphone,
  Laptop,
  Tablet,
  QrCode,
  Check,
  Moon,
  Sun,
  HardDrive,
  Key,
  Share2,
  LogOut,
  Bell,
  Sparkles,
  ChevronRight,
  Trash2,
  Volume2,
  Sliders,
  AtSign,
} from 'lucide-react';
import { sound } from '../lib/sound';

interface SettingsViewProps {
  currentUser: User;
  settings: UserSettings;
  linkedDevices: LinkedDevice[];
  onUpdateSettings: (newSettings: Partial<UserSettings>) => void;
  onUpdateProfile: (updated: Partial<User>) => void;
  onUnlinkDevice: (deviceId: string) => void;
  onSignOut: () => void;
  onOpenE2EEKeys: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  currentUser,
  settings,
  linkedDevices,
  onUpdateSettings,
  onUpdateProfile,
  onUnlinkDevice,
  onSignOut,
  onOpenE2EEKeys,
}) => {
  const [showQrLinkModal, setShowQrLinkModal] = useState(false);
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState(currentUser.username);

  const handleSaveUsername = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim()) return;
    sound.playTap();
    onUpdateProfile({ username: newUsername.trim().toLowerCase().replace(/[^a-z0-9_]/g, '') });
    setIsEditingUsername(false);
  };

  return (
    <div
      className="flex flex-col h-[calc(100vh-68px)] md:h-[calc(100vh-80px)] w-full max-w-4xl mx-auto bg-[#07070b] border-x border-[#1c1b24] shadow-2xl relative select-none"
      id="sovo-settings-view"
    >
      {/* Top Header */}
      <div className="p-4 bg-[#0c0c12]/95 backdrop-blur-md border-b border-[#22212d] flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-extrabold text-gold-glossy tracking-tight">
            Settings & Security
          </h2>
          <p className="text-xs text-gray-400">Cryptographic preferences & privacy controls</p>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#17150e] border border-[#d4af37]/30 text-xs font-semibold text-[#ffd700]">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>4096-bit Zero-Knowledge</span>
        </div>
      </div>

      {/* Settings Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin">
        {/* User Identity Profile Card */}
        <div className="p-4 rounded-3xl bg-[#0e0e14] border border-[#272635] flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <img
              src={currentUser.avatarUrl}
              alt={currentUser.displayName}
              className="w-14 h-14 rounded-full object-cover border-2 border-[#d4af37] shadow-lg"
            />
            <div>
              <h3 className="text-base font-bold text-white">{currentUser.displayName}</h3>
              <div className="flex items-center gap-1 text-xs font-mono text-[#ffd700] mt-0.5">
                <AtSign className="w-3 h-3" />
                <span>{currentUser.username}</span>
              </div>
              <p className="text-[11px] text-gray-400 mt-1">{currentUser.bio}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              sound.playTap();
              setIsEditingUsername(!isEditingUsername);
            }}
            className="px-3 py-1.5 rounded-xl bg-[#181824] hover:bg-[#252436] text-xs font-semibold text-[#d4af37] border border-[#d4af37]/30 transition cursor-pointer"
          >
            {isEditingUsername ? 'Close' : 'Edit @handle'}
          </button>
        </div>

        {/* Inline @Username Editor */}
        {isEditingUsername && (
          <form
            onSubmit={handleSaveUsername}
            className="p-4 rounded-2xl bg-[#12121b] border border-[#d4af37]/40 space-y-3 animate-fadeIn"
          >
            <label className="block text-xs font-semibold text-gray-300">
              Change S'ovo Anonymous @Username
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className="flex-1 px-3 py-2 bg-[#09090e] border border-[#2d2c3c] focus:border-[#ffd700] rounded-xl text-xs text-white outline-none"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-xl gold-glossy-button text-black text-xs font-bold cursor-pointer"
              >
                Save
              </button>
            </div>
            <p className="text-[11px] text-gray-400">
              Other users can find and message you using this username without ever seeing your phone
              number.
            </p>
          </form>
        )}

        {/* Section: Privacy & Security Controls (Read Receipts, Biometrics, Phone Privacy) */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#d4af37] px-1 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" /> Privacy & Cryptographic Preferences
          </h4>

          <div className="divide-y divide-[#1e1d29] rounded-3xl bg-[#0c0c12] border border-[#232230] overflow-hidden">
            {/* Read Receipts Toggle */}
            <div className="p-4 flex items-center justify-between hover:bg-[#12121a] transition">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-[#17150e] border border-[#d4af37]/30 text-[#ffd700] mt-0.5">
                  <Eye className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Read Receipts</p>
                  <p className="text-xs text-gray-400">
                    Show glowing gold double checks when you read messages. If disabled, contacts
                    won't see read status.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  sound.playTap();
                  onUpdateSettings({ readReceipts: !settings.readReceipts });
                }}
                className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 cursor-pointer ml-3 ${
                  settings.readReceipts ? 'bg-[#d4af37]' : 'bg-[#272733]'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-black transition-transform absolute top-1 ${
                    settings.readReceipts ? 'right-1' : 'left-1'
                  }`}
                />
              </button>
            </div>

            {/* Biometric Authentication Lock Toggle */}
            <div className="p-4 flex items-center justify-between hover:bg-[#12121a] transition">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-[#17150e] border border-[#d4af37]/30 text-[#ffd700] mt-0.5">
                  <Fingerprint className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Android Biometric Lock</p>
                  <p className="text-xs text-gray-400">
                    Require Fingerprint, Face Unlock, or Gold PIN when opening S'ovo.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  sound.playTap();
                  onUpdateSettings({ biometricLock: !settings.biometricLock });
                }}
                className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 cursor-pointer ml-3 ${
                  settings.biometricLock ? 'bg-[#d4af37]' : 'bg-[#272733]'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-black transition-transform absolute top-1 ${
                    settings.biometricLock ? 'right-1' : 'left-1'
                  }`}
                />
              </button>
            </div>

            {/* Auto Lock Timeout Selection */}
            {settings.biometricLock && (
              <div className="p-4 bg-[#08080c] flex items-center justify-between text-xs">
                <span className="text-gray-300 font-medium">Auto-Lock Timer</span>
                <div className="flex items-center gap-1.5">
                  {[
                    { label: 'Immediately', val: 0 },
                    { label: '1 Min', val: 1 },
                    { label: '5 Mins', val: 5 },
                  ].map((opt) => (
                    <button
                      key={opt.val}
                      type="button"
                      onClick={() => {
                        sound.playTap();
                        onUpdateSettings({ autoLockMinutes: opt.val });
                      }}
                      className={`px-2.5 py-1 rounded-lg border transition ${
                        settings.autoLockMinutes === opt.val
                          ? 'bg-[#221c0e] border-[#ffd700] text-[#ffd700] font-bold'
                          : 'bg-[#14141c] border-[#292836] text-gray-400'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Phone Number Anonymity Visibility */}
            <div className="p-4 flex items-center justify-between hover:bg-[#12121a] transition">
              <div>
                <p className="text-sm font-semibold text-white">Phone Number Privacy</p>
                <p className="text-xs text-gray-400">
                  Prioritize anonymity by hiding your phone number from everyone.
                </p>
              </div>

              <select
                value={settings.phoneVisibility}
                onChange={(e) => {
                  sound.playTap();
                  onUpdateSettings({
                    phoneVisibility: e.target.value as 'everyone' | 'contacts' | 'nobody',
                  });
                }}
                className="bg-[#14141d] border border-[#2b2a38] text-[#ffd700] text-xs font-semibold rounded-xl px-3 py-1.5 outline-none cursor-pointer"
              >
                <option value="nobody">Nobody (Maximum Anonymity)</option>
                <option value="contacts">My Contacts Only</option>
                <option value="everyone">Everyone</option>
              </select>
            </div>

            {/* Default Status Disappear Duration */}
            <div className="p-4 flex items-center justify-between hover:bg-[#12121a] transition">
              <div>
                <p className="text-sm font-semibold text-white">Default Status Retention</p>
                <p className="text-xs text-gray-400">
                  Choose standard 24 hours or 3-day extended VIP status duration.
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                {[1, 3].map((dur) => (
                  <button
                    key={dur}
                    type="button"
                    onClick={() => {
                      sound.playTap();
                      onUpdateSettings({ defaultStoryDuration: dur as 1 | 3 });
                    }}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition ${
                      settings.defaultStoryDuration === dur
                        ? 'bg-[#221c0e] border-[#ffd700] text-[#ffd700]'
                        : 'bg-[#14141c] border-[#292836] text-gray-400'
                    }`}
                  >
                    {dur === 1 ? '24 Hours' : '3 Days VIP'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Section: Cross-Platform Syncing & Linked Devices */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#d4af37] flex items-center gap-1.5">
              <Laptop className="w-3.5 h-3.5" /> Cross-Platform Syncing ({linkedDevices.length}{' '}
              Devices)
            </h4>

            <button
              type="button"
              onClick={() => {
                sound.playTap();
                setShowQrLinkModal(true);
              }}
              className="flex items-center gap-1 text-xs text-[#ffd700] hover:underline font-semibold cursor-pointer"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Link New Device</span>
            </button>
          </div>

          <div className="divide-y divide-[#1e1d29] rounded-3xl bg-[#0c0c12] border border-[#232230] overflow-hidden">
            {linkedDevices.map((dev) => (
              <div
                key={dev.id}
                className="p-4 flex items-center justify-between hover:bg-[#12121a] transition"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-[#161622] border border-[#2a2938] text-[#ffd700]">
                    {dev.iconType === 'desktop' ? (
                      <Laptop className="w-4 h-4" />
                    ) : dev.iconType === 'tablet' ? (
                      <Tablet className="w-4 h-4" />
                    ) : (
                      <Smartphone className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-white">{dev.name}</p>
                      {dev.isCurrent && (
                        <span className="px-2 py-0.5 rounded-full bg-[#1c180e] border border-[#d4af37]/40 text-[9px] text-[#ffd700] font-bold">
                          This Device
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">
                      {dev.location} • {dev.ipAddress}
                    </p>
                  </div>
                </div>

                {!dev.isCurrent && (
                  <button
                    type="button"
                    onClick={() => {
                      sound.playTap();
                      onUnlinkDevice(dev.id);
                    }}
                    className="p-2 rounded-xl text-gray-400 hover:text-red-400 hover:bg-red-950/30 transition cursor-pointer"
                    title="Revoke session key"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Section: Storage & 2GB File Transfers */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#d4af37] px-1 flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5" /> Storage & 2GB Encrypted File Transfers
          </h4>

          <div className="p-4 rounded-3xl bg-[#0c0c12] border border-[#232230] space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-300">File Transfer Limit</span>
              <span className="font-mono text-[#ffd700] font-bold">2.0 GB per message</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-300">Local Encrypted Cache</span>
              <span className="font-mono text-gray-400">128.4 MB / Auto-Purge</span>
            </div>

            <button
              type="button"
              onClick={() => {
                sound.playTap();
                alert('Local cached media decrypted blocks cleared.');
              }}
              className="w-full py-2.5 rounded-xl bg-[#14141c] hover:bg-[#1f1e29] border border-[#2a2938] text-xs font-semibold text-gray-300 hover:text-white transition cursor-pointer"
            >
              Clear Temporary Decrypted Cache
            </button>
          </div>
        </div>

        {/* Section: Master E2EE Safety Keys & Sign Out */}
        <div className="pt-2 space-y-2">
          <button
            type="button"
            onClick={() => {
              sound.playTap();
              onOpenE2EEKeys();
            }}
            className="w-full py-3.5 rounded-2xl bg-[#16140e] border border-[#d4af37]/40 text-[#ffd700] text-xs font-bold flex items-center justify-center gap-2 hover:bg-[#252014] transition cursor-pointer"
          >
            <Key className="w-4 h-4" />
            <span>Export & View 4096-bit Cryptographic Identity</span>
          </button>

          <button
            type="button"
            onClick={() => {
              sound.playTap();
              onSignOut();
            }}
            className="w-full py-3.5 rounded-2xl bg-red-950/20 hover:bg-red-950/40 border border-red-800/30 text-red-400 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out of S'ovo Session</span>
          </button>
        </div>
      </div>

      {/* Link New Device QR Modal */}
      {showQrLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="w-full max-w-sm bg-[#0c0c12] border border-[#d4af37]/40 rounded-3xl p-6 shadow-2xl text-center text-white relative">
            <h3 className="font-display font-bold text-lg text-gold-glossy mb-1">
              Link Desktop / Mobile
            </h3>
            <p className="text-xs text-gray-400 mb-4">
              Scan this QR code from your other S'ovo device to synchronize keys and chat history.
            </p>

            <div className="p-4 bg-white rounded-2xl inline-block mb-4 shadow-xl border-2 border-[#d4af37]">
              {/* QR representation */}
              <svg className="w-40 h-40" viewBox="0 0 100 100">
                <rect width="100" height="100" fill="#ffffff" />
                <rect x="10" y="10" width="20" height="20" fill="#050507" />
                <rect x="70" y="10" width="20" height="20" fill="#050507" />
                <rect x="10" y="70" width="20" height="20" fill="#050507" />
                <rect x="40" y="40" width="20" height="20" fill="#d4af37" />
              </svg>
            </div>

            <button
              type="button"
              onClick={() => setShowQrLinkModal(false)}
              className="w-full py-2.5 rounded-xl bg-[#161622] text-xs font-semibold text-gray-300 hover:text-white"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
