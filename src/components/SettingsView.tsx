import React, { useState, useRef } from 'react';
import { User, UserSettings, LinkedDevice } from '../types';
import {
  ShieldCheck,
  Lock,
  Eye,
  Fingerprint,
  Smartphone,
  Laptop,
  Tablet,
  QrCode,
  Moon,
  HardDrive,
  Key,
  LogOut,
  ChevronRight,
  Trash2,
  AtSign,
  Camera,
  Volume2,
} from 'lucide-react';
import { sound } from '../lib/sound';
import InviteButton from './InviteButton';
import { supabase } from '../lib/supabase';
import { validateImageFile } from '../lib/upload';

interface SettingsViewProps {
  currentUser: User;
  settings: UserSettings;
  linkedDevices: LinkedDevice[];
  onUpdateSettings: (newSettings: Partial<UserSettings>) => void;
  onUpdateProfile: (updated: Partial<User>) => void;
  onUploadAvatar: (file: File) => Promise<void>;
  onUnlinkDevice: (deviceId: string) => void;
  onSignOut: () => void;
  onOpenE2EEKeys: () => void;
}

/* ── Shared sub-components ───────────────────────────────────────── */

/** Pill-style toggle switch */
const Toggle: React.FC<{ on: boolean; onChange: () => void }> = ({ on, onChange }) => (
  <button
    type="button"
    onClick={onChange}
    className="relative flex-shrink-0 cursor-pointer transition-colors"
    style={{
      width: 44,
      height: 24,
      borderRadius: 999,
      backgroundColor: on ? "var(--color-gold)" : "var(--color-elevated)",
      border: `1px solid ${on ? "var(--color-gold)" : "var(--color-border)"}`,
    }}
  >
    <div
      className="absolute w-4 h-4 rounded-full bg-black transition-transform"
      style={{
        top: 3,
        left: on ? undefined : 3,
        right: on ? 3 : undefined,
      }}
    />
  </button>
);

/** Section header */
const SectionHeader: React.FC<{ icon: React.ReactNode; label: string; action?: React.ReactNode }> = ({
  icon, label, action,
}) => (
  <div className="flex items-center justify-between px-1 mb-3">
    <div className="flex items-center gap-2">
      <span style={{ color: "var(--color-gold)" }}>{icon}</span>
      <span
        className="text-[11px] font-bold uppercase tracking-widest"
        style={{ color: "var(--color-gold)" }}
      >
        {label}
      </span>
    </div>
    {action}
  </div>
);

/** A single settings row inside a card */
const Row: React.FC<{
  icon?: React.ReactNode;
  label: string;
  sub?: string;
  right?: React.ReactNode;
  onClick?: () => void;
}> = ({ icon, label, sub, right, onClick }) => (
  <div
    className="flex items-center gap-4 px-4 py-4 transition cursor-default"
    style={{ borderBottom: "1px solid var(--color-border)" }}
    onClick={onClick}
    onMouseEnter={(e) => onClick && (e.currentTarget.style.backgroundColor = "var(--color-elevated)")}
    onMouseLeave={(e) => onClick && (e.currentTarget.style.backgroundColor = "transparent")}
  >
    {icon && (
      <div
        className="p-2 flex-shrink-0"
        style={{
          borderRadius: "var(--radius-sm)",
          backgroundColor: "rgba(212,175,55,0.10)",
          border: "1px solid rgba(212,175,55,0.25)",
          color: "var(--color-gold-bright)",
        }}
      >
        {icon}
      </div>
    )}
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>{label}</p>
      {sub && <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>{sub}</p>}
    </div>
    {right}
    {onClick && !right && <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: "var(--color-text-muted)" }} />}
  </div>
);

/** Card wrapper — groups rows with rounded corners */
const Card: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    className="overflow-hidden"
    style={{
      backgroundColor: "var(--color-surface)",
      border: "1px solid var(--color-border)",
      borderRadius: "var(--radius-lg)",
    }}
  >
    {children}
  </div>
);

/* ── Main Component ──────────────────────────────────────────────── */

export const SettingsView: React.FC<SettingsViewProps> = ({
  currentUser, settings, linkedDevices,
  onUpdateSettings, onUpdateProfile, onUploadAvatar,
  onUnlinkDevice, onSignOut, onOpenE2EEKeys,
}) => {
  const [showQrLinkModal, setShowQrLinkModal] = useState(false);
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState(currentUser.username);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const handleSaveUsername = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim()) return;
    sound.playTap();
    onUpdateProfile({ username: newUsername.trim().toLowerCase().replace(/[^a-z0-9_]/g, '') });
    setIsEditingUsername(false);
  };

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const error = validateImageFile(file);
    if (error) { setAvatarError(error); e.target.value = ''; return; }
    setAvatarError('');
    setIsUploadingAvatar(true);
    sound.playTap();
    try {
      await onUploadAvatar(file);
      sound.playBiometricSuccess();
    } catch (err: any) {
      setAvatarError(err?.message || 'Failed to update profile picture.');
    } finally {
      setIsUploadingAvatar(false);
      e.target.value = '';
    }
  };

  const selectStyle: React.CSSProperties = {
    backgroundColor: "var(--color-elevated)",
    border: "1px solid var(--color-border)",
    color: "var(--color-gold-bright)",
    borderRadius: "var(--radius-sm)",
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 600,
    outline: "none",
    cursor: "pointer",
  };

  return (
    <div
      className="flex flex-col w-full max-w-4xl mx-auto select-none"
      style={{
        height: "calc(100vh - 68px)",
        backgroundColor: "var(--color-bg)",
      }}
      id="sovo-settings-view"
    >
      {/* ── Header ── */}
      <div
        className="px-5 py-4 backdrop-blur-md flex items-center justify-between flex-shrink-0"
        style={{
          backgroundColor: "var(--color-surface)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <div>
          <h2 className="text-2xl font-display font-extrabold text-gold-glossy tracking-tight">
            Settings
          </h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--color-text-secondary)" }}>
            Privacy controls &amp; security preferences
          </p>
        </div>

        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
          style={{
            backgroundColor: "rgba(212,175,55,0.10)",
            border: "1px solid rgba(212,175,55,0.30)",
            color: "var(--color-gold-bright)",
          }}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Zero-Knowledge E2EE</span>
        </div>
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-6 space-y-8">

        {/* ── Profile card ── */}
        <div>
          <Card>
            {/* Identity row */}
            <div className="p-5 flex items-center gap-4">
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <img
                  src={currentUser.avatarUrl}
                  alt={currentUser.displayName}
                  className="w-16 h-16 rounded-full object-cover shadow-lg"
                  style={{ border: "2px solid var(--color-gold)" }}
                />
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarFileChange}
                />
                <button
                  type="button"
                  onClick={() => { sound.playTap(); avatarInputRef.current?.click(); }}
                  disabled={isUploadingAvatar}
                  className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full gold-gradient-bg text-black flex items-center justify-center cursor-pointer active:scale-90 transition"
                  style={{ border: "2px solid var(--color-surface)" }}
                  title="Change profile picture"
                >
                  {isUploadingAvatar
                    ? <div className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    : <Camera className="w-3 h-3" />
                  }
                </button>
              </div>

              {/* Name + handle */}
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold" style={{ color: "var(--color-text)" }}>
                  {currentUser.displayName}
                </h3>
                <div className="flex items-center gap-1 mt-0.5 text-xs font-mono" style={{ color: "var(--color-gold-bright)" }}>
                  <AtSign className="w-3 h-3" />
                  <span>{currentUser.username}</span>
                </div>
                <p className="text-[11px] mt-1 truncate" style={{ color: "var(--color-text-secondary)" }}>
                  {currentUser.bio}
                </p>
                {avatarError && (
                  <p className="text-[10px] mt-1" style={{ color: "#f87171" }}>{avatarError}</p>
                )}
              </div>

              <button
                type="button"
                onClick={() => { sound.playTap(); setIsEditingUsername(!isEditingUsername); }}
                className="px-3 py-1.5 text-xs font-semibold transition cursor-pointer flex-shrink-0"
                style={{
                  backgroundColor: "var(--color-elevated)",
                  border: "1px solid rgba(212,175,55,0.30)",
                  color: "var(--color-gold)",
                  borderRadius: "var(--radius-sm)",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(212,175,55,0.10)")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--color-elevated)")}
              >
                {isEditingUsername ? 'Close' : 'Edit handle'}
              </button>
            </div>

            {/* Inline username editor */}
            {isEditingUsername && (
              <form
                onSubmit={handleSaveUsername}
                className="px-5 pb-5 space-y-3"
                style={{ borderTop: "1px solid var(--color-border)" }}
              >
                <label
                  className="block text-xs font-semibold pt-4"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  Change anonymous @username
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    className="flex-1 px-3 py-2.5 text-xs outline-none"
                    style={{
                      backgroundColor: "var(--color-bg)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "var(--radius-sm)",
                      color: "var(--color-text)",
                    }}
                    onFocus={(e) => (e.target.style.borderColor = "var(--color-gold)")}
                    onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
                  />
                  <button
                    type="submit"
                    className="px-4 py-2.5 gold-glossy-button text-xs font-bold cursor-pointer flex-shrink-0"
                    style={{ borderRadius: "var(--radius-sm)", color: "var(--color-bg)" }}
                  >
                    Save
                  </button>
                </div>
                <p className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
                  Others can find you by @username without ever seeing your phone number.
                </p>
              </form>
            )}
          </Card>
        </div>

        {/* ── Privacy & Security ── */}
        <div>
          <SectionHeader icon={<Lock className="w-3.5 h-3.5" />} label="Privacy & Security" />
          <Card>
            {/* Read receipts */}
            <Row
              icon={<Eye className="w-4 h-4" />}
              label="Read Receipts"
              sub="Show gold double-checks when messages are read. Disabling hides your read status from others."
              right={
                <Toggle
                  on={settings.readReceipts}
                  onChange={() => { sound.playTap(); onUpdateSettings({ readReceipts: !settings.readReceipts }); }}
                />
              }
            />

            {/* Biometric lock */}
            <Row
              icon={<Fingerprint className="w-4 h-4" />}
              label="Biometric Lock"
              sub="Require Fingerprint, Face Unlock, or PIN when opening S'ovo."
              right={
                <Toggle
                  on={settings.biometricLock}
                  onChange={() => { sound.playTap(); onUpdateSettings({ biometricLock: !settings.biometricLock }); }}
                />
              }
            />

            {/* Auto-lock timer (sub-row, only when biometric enabled) */}
            {settings.biometricLock && (
              <div
                className="px-4 py-3 flex items-center justify-between"
                style={{ backgroundColor: "var(--color-bg)", borderBottom: "1px solid var(--color-border)" }}
              >
                <span className="text-xs font-medium" style={{ color: "var(--color-text-secondary)" }}>
                  Auto-lock after
                </span>
                <div className="flex items-center gap-1.5">
                  {[
                    { label: 'Immediately', val: 0 },
                    { label: '1 min', val: 1 },
                    { label: '5 mins', val: 5 },
                  ].map((opt) => (
                    <button
                      key={opt.val}
                      type="button"
                      onClick={() => { sound.playTap(); onUpdateSettings({ autoLockMinutes: opt.val }); }}
                      className="px-2.5 py-1 text-xs font-semibold transition cursor-pointer"
                      style={{
                        borderRadius: "var(--radius-sm)",
                        backgroundColor: settings.autoLockMinutes === opt.val ? "rgba(212,175,55,0.12)" : "var(--color-elevated)",
                        border: `1px solid ${settings.autoLockMinutes === opt.val ? "var(--color-gold)" : "var(--color-border)"}`,
                        color: settings.autoLockMinutes === opt.val ? "var(--color-gold-bright)" : "var(--color-text-secondary)",
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Phone visibility */}
            <Row
              label="Phone Number Visibility"
              sub="Control who can see your phone number."
              right={
                <select
                  value={settings.phoneVisibility}
                  onChange={(e) => { sound.playTap(); onUpdateSettings({ phoneVisibility: e.target.value as 'everyone' | 'contacts' | 'nobody' }); }}
                  style={selectStyle}
                >
                  <option value="nobody">Nobody</option>
                  <option value="contacts">Contacts only</option>
                  <option value="everyone">Everyone</option>
                </select>
              }
            />

            {/* Status duration — last row, no border-bottom */}
            <div
              className="flex items-center gap-4 px-4 py-4"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>Status Duration</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--color-text-secondary)" }}>
                  Default time before a posted status expires.
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {[1, 3].map((dur) => (
                  <button
                    key={dur}
                    type="button"
                    onClick={() => { sound.playTap(); onUpdateSettings({ defaultStoryDuration: dur as 1 | 3 }); }}
                    className="px-3 py-1.5 text-xs font-bold transition cursor-pointer"
                    style={{
                      borderRadius: "var(--radius-sm)",
                      backgroundColor: settings.defaultStoryDuration === dur ? "rgba(212,175,55,0.12)" : "var(--color-elevated)",
                      border: `1px solid ${settings.defaultStoryDuration === dur ? "var(--color-gold)" : "var(--color-border)"}`,
                      color: settings.defaultStoryDuration === dur ? "var(--color-gold-bright)" : "var(--color-text-secondary)",
                    }}
                  >
                    {dur === 1 ? '24 h' : '3 days'}
                  </button>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* ── Sound ── */}
        <div>
          <SectionHeader icon={<Volume2 className="w-3.5 h-3.5" />} label="Sound" />
          <Card>
            <Row
              icon={<Volume2 className="w-4 h-4" />}
              label="Sound Effects"
              sub="Play subtle tap and notification sounds in-app."
              right={
                <Toggle
                  on={settings.soundEffects}
                  onChange={() => { sound.playTap(); onUpdateSettings({ soundEffects: !settings.soundEffects }); }}
                />
              }
            />
          </Card>
        </div>

        {/* ── Linked Devices ── */}
        <div>
          <SectionHeader
            icon={<Smartphone className="w-3.5 h-3.5" />}
            label={`Linked Devices (${linkedDevices.length})`}
            action={
              <button
                type="button"
                onClick={() => { sound.playTap(); setShowQrLinkModal(true); }}
                className="flex items-center gap-1 text-xs font-semibold cursor-pointer"
                style={{ color: "var(--color-gold-bright)" }}
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Link Device</span>
              </button>
            }
          />
          <Card>
            {linkedDevices.map((dev, i) => (
              <div
                key={dev.id}
                className="flex items-center gap-4 px-4 py-4 transition"
                style={{ borderBottom: i < linkedDevices.length - 1 ? "1px solid var(--color-border)" : "none" }}
              >
                <div
                  className="p-2.5 flex-shrink-0"
                  style={{
                    borderRadius: "var(--radius-sm)",
                    backgroundColor: "var(--color-elevated)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-gold-bright)",
                  }}
                >
                  {dev.iconType === 'desktop' ? <Laptop className="w-4 h-4" />
                    : dev.iconType === 'tablet' ? <Tablet className="w-4 h-4" />
                    : <Smartphone className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>{dev.name}</p>
                    {dev.isCurrent && (
                      <span
                        className="px-2 py-0.5 text-[9px] font-bold rounded-full"
                        style={{
                          backgroundColor: "rgba(212,175,55,0.10)",
                          border: "1px solid rgba(212,175,55,0.35)",
                          color: "var(--color-gold-bright)",
                        }}
                      >
                        This Device
                      </span>
                    )}
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: "var(--color-text-secondary)" }}>
                    {dev.location}{dev.ipAddress ? ` • ${dev.ipAddress}` : ''}
                  </p>
                </div>
                {!dev.isCurrent && (
                  <button
                    type="button"
                    onClick={() => { sound.playTap(); onUnlinkDevice(dev.id); }}
                    className="p-2 transition cursor-pointer"
                    style={{ color: "var(--color-text-muted)", borderRadius: "var(--radius-sm)" }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = "#f87171"; e.currentTarget.style.backgroundColor = "rgba(239,68,68,0.10)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "var(--color-text-muted)"; e.currentTarget.style.backgroundColor = "transparent"; }}
                    title="Revoke session"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </Card>
        </div>

        {/* ── Storage ── */}
        <div>
          <SectionHeader icon={<HardDrive className="w-3.5 h-3.5" />} label="Storage" />
          <Card>
            <div className="px-4 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--color-border)" }}>
              <span className="text-xs" style={{ color: "var(--color-text-secondary)" }}>File transfer limit</span>
              <span className="text-xs font-mono font-bold" style={{ color: "var(--color-gold-bright)" }}>2.0 GB per message</span>
            </div>
            <div className="px-4 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--color-border)" }}>
              <span className="text-xs" style={{ color: "var(--color-text-secondary)" }}>Local encrypted cache</span>
              <span className="text-xs font-mono" style={{ color: "var(--color-text-muted)" }}>128.4 MB / Auto-Purge</span>
            </div>
            <button
              type="button"
              onClick={() => { sound.playTap(); alert('Local cached media decrypted blocks cleared.'); }}
              className="w-full px-4 py-4 text-xs font-semibold text-left transition cursor-pointer"
              style={{ color: "var(--color-text-secondary)" }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--color-elevated)"; e.currentTarget.style.color = "var(--color-text)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = "var(--color-text-secondary)"; }}
            >
              Clear Temporary Decrypted Cache
            </button>
          </Card>
        </div>

        {/* ── Actions ── */}
        <div className="space-y-3 pb-4">
          {/* Invite */}
          <Card>
            <div style={{ borderBottom: "none" }}>
              <InviteButton supabase={supabase} />
            </div>
          </Card>

          {/* E2EE keys */}
          <button
            type="button"
            onClick={() => { sound.playTap(); onOpenE2EEKeys(); }}
            className="w-full py-4 flex items-center justify-center gap-2 text-sm font-bold transition cursor-pointer"
            style={{
              backgroundColor: "rgba(212,175,55,0.08)",
              border: "1px solid rgba(212,175,55,0.35)",
              borderRadius: "var(--radius-lg)",
              color: "var(--color-gold-bright)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(212,175,55,0.14)")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "rgba(212,175,55,0.08)")}
          >
            <Key className="w-4 h-4" />
            <span>View Cryptographic Identity</span>
          </button>

          {/* Sign out */}
          <button
            type="button"
            onClick={() => { sound.playTap(); onSignOut(); }}
            className="w-full py-4 flex items-center justify-center gap-2 text-sm font-bold transition cursor-pointer"
            style={{
              backgroundColor: "rgba(239,68,68,0.06)",
              border: "1px solid rgba(239,68,68,0.25)",
              borderRadius: "var(--radius-lg)",
              color: "#f87171",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(239,68,68,0.12)")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "rgba(239,68,68,0.06)")}
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* ── Link device QR modal ── */}
      {showQrLinkModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md"
          style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
        >
          <div
            className="w-full max-w-sm p-6 shadow-2xl text-center relative"
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid rgba(212,175,55,0.40)",
              borderRadius: "var(--radius-xl)",
              color: "var(--color-text)",
            }}
          >
            <h3 className="font-display font-bold text-lg text-gold-glossy mb-1">Link Desktop / Mobile</h3>
            <p className="text-xs mb-5" style={{ color: "var(--color-text-secondary)" }}>
              Scan this QR code from your other S&apos;ovo device to synchronise keys and chat history.
            </p>

            <div
              className="p-4 rounded-2xl inline-block mb-5 shadow-xl"
              style={{ backgroundColor: "#ffffff", border: "2px solid var(--color-gold)" }}
            >
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
              className="w-full py-3 text-xs font-semibold transition cursor-pointer"
              style={{
                backgroundColor: "var(--color-elevated)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
                color: "var(--color-text-secondary)",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-text)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-text-secondary)")}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
