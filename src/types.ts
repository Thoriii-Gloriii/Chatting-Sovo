export interface User {
  id: string;
  username: string;
  displayName: string;
  phoneNumber?: string;
  avatarUrl: string;
  bio: string;
  isOnline: boolean;
  lastSeen: number; // timestamp
  e2eePublicKey: string;
  e2eeFingerprint: string;
  phoneSyncHash?: string;
  joinedAt: string;
  devicesCount: number;
  biometricEnabled: boolean;
  pinCode?: string;
}

export type StoryDuration = 1 | 3; // 1 day (24h) or 3 days (72h)
export type StoryPrivacy = 'all_contacts' | 'specific_contacts' | 'close_friends';

export interface StatusItem {
  id: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  caption: string;
  createdAt: number;
  expiresAt: number;
  durationDays: StoryDuration;
  musicTrack?: {
    title: string;
    artist: string;
  };
  likesCount: number;
  hasLiked?: boolean;
  viewsCount: number;
  privacy: StoryPrivacy;
  allowedContactIds?: string[];
  isEncrypted: boolean;
}

export interface UserStatusStory {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  isVerified?: boolean;
  isCurrentUser?: boolean;
  items: StatusItem[];
  hasUnseen?: boolean;
  lastUpdated: number;
}

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read';
export type MediaType = 'image' | 'video' | 'audio' | 'document' | 'voice_note' | 'encrypted_file';

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  text: string;
  mediaUrl?: string;
  mediaType?: MediaType;
  fileName?: string;
  fileSize?: string; // e.g., "1.4 GB", "42 MB"
  fileSizeBytes?: number;
  audioDurationSeconds?: number;
  isEncrypted: boolean;
  e2eeFingerprint?: string;
  status: MessageStatus;
  timestamp: number;
  replyTo?: {
    id: string;
    senderName: string;
    text: string;
  };
  reactions?: Record<string, number>; // emoji -> count
  userReaction?: string;
  isDisappearing?: boolean;
  expiresAt?: number;
}

export interface Conversation {
  id: string;
  type: 'direct' | 'group';
  name: string;
  username?: string; // for direct chats
  avatar: string;
  isOnline?: boolean;
  lastSeen?: number;
  members: string[]; // user IDs
  memberCount: number;
  maxMembers: number; // 500
  adminIds: string[];
  lastMessage?: Message;
  unreadCount: number;
  isEncrypted: boolean;
  e2eeKeyFingerprint: string;
  isPinned?: boolean;
  isMuted?: boolean;
  disappearingTimerHours?: number; // 0 for off, 24, 72
  createdAt: number;
  groupDescription?: string;
}

export interface SyncedContact {
  id: string;
  name: string;
  phoneNumber: string;
  isRegistered: boolean;
  sovoUsername?: string;
  sovoAvatar?: string;
  sovoUserId?: string;
  status?: string;
}

export interface LinkedDevice {
  id: string;
  name: string;
  platform: 'iOS' | 'Android' | 'macOS' | 'Windows' | 'Web';
  browser?: string;
  location: string;
  lastActive: number;
  isCurrent: boolean;
  ipAddress: string;
  iconType: 'mobile' | 'desktop' | 'tablet';
}

export interface CallRecord {
  id: string;
  peerId: string;
  peerName: string;
  peerUsername: string;
  peerAvatar: string;
  type: 'audio' | 'video';
  direction: 'incoming' | 'outgoing' | 'missed';
  status: 'completed' | 'missed' | 'declined';
  durationSeconds: number;
  timestamp: number;
  isEncrypted: boolean;
}

export interface UserSettings {
  readReceipts: boolean; // toggle in settings
  biometricLock: boolean; // FaceID/Fingerprint
  autoLockMinutes: number; // 0 = immediately, 1, 5, 15
  phoneVisibility: 'everyone' | 'contacts' | 'nobody';
  lastSeenVisibility: 'everyone' | 'contacts' | 'nobody';
  darkMode: boolean;
  e2eeAlwaysEnforced: boolean;
  soundEffects: boolean;
  highQualityUploads: boolean;
  defaultStoryDuration: StoryDuration; // 1 or 3 days
  activeDevicePlatform: 'iOS' | 'Android' | 'web';
}
