import {
  User, Conversation, Message, UserStatusStory, StatusItem,
  SyncedContact, LinkedDevice, CallRecord, UserSettings,
} from "../types";

export const CURRENT_USER: User = {
  id: "usr_me_001",
  username: "lindiwe_m",
  displayName: "Lindiwe M.",
  phoneNumber: "+27 71 234 5678",
  avatarUrl: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=400&auto=format&fit=crop&q=80",
  bio: "Soshanguve 💛 | Privacy matters.",
  isOnline: true,
  lastSeen: Date.now(),
  e2eePublicKey: "MCowBQYDK2VuAyEAhH...",
  e2eeFingerprint: "A1B2 C3D4 E5F6 7890 ABCD EF12 3456 7890",
  phoneSyncHash: "sha256:abc123",
  joinedAt: "2024-01-15",
  devicesCount: 2,
  biometricEnabled: true,
  pinCode: "7788",
};

export const INITIAL_SETTINGS: UserSettings = {
  readReceipts: true,
  biometricLock: true,
  autoLockMinutes: 5,
  phoneVisibility: "contacts",
  lastSeenVisibility: "contacts",
  darkMode: true,
  e2eeAlwaysEnforced: true,
  soundEffects: true,
  highQualityUploads: true,
  defaultStoryDuration: 1,
  activeDevicePlatform: "Android",
};

const saAvatars = [
  "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=400&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&auto=format&fit=crop&q=80",
];

const groupAvatar = "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&auto=format&fit=crop&q=80";

export const INITIAL_CONVERSATIONS: Conversation[] = [
  {
    id: "conv_direct_001",
    type: "direct",
    name: "Lindiwe M.",
    username: "lindiwe_m",
    avatar: saAvatars[0],
    isOnline: true,
    lastSeen: Date.now(),
    members: ["usr_me_001", "usr_002"],
    memberCount: 2,
    maxMembers: 2,
    adminIds: [],
    lastMessage: {
      id: "lm1", conversationId: "conv_direct_001", senderId: "usr_002",
      senderName: "Lindiwe M.", text: "Typing...", isEncrypted: true,
      status: "delivered", timestamp: Date.now() - 60000,
    } as Message,
    unreadCount: 0,
    isEncrypted: true,
    e2eeKeyFingerprint: "A1B2 C3D4 E5F6",
    isPinned: false,
    createdAt: Date.now() - 1000 * 60 * 60 * 24,
  },
  {
    id: "conv_direct_002",
    type: "direct",
    name: "Thabo K.",
    username: "thabo_k",
    avatar: saAvatars[1],
    isOnline: false,
    lastSeen: Date.now() - 1000 * 60 * 30,
    members: ["usr_me_001", "usr_003"],
    memberCount: 2,
    maxMembers: 2,
    adminIds: [],
    lastMessage: {
      id: "lm2", conversationId: "conv_direct_002", senderId: "usr_003",
      senderName: "Thabo K.", text: "See you there!", isEncrypted: true,
      status: "read", timestamp: Date.now() - 1000 * 60 * 22,
    } as Message,
    unreadCount: 0,
    isEncrypted: true,
    e2eeKeyFingerprint: "B3C4 D5E6 F7A8",
    createdAt: Date.now() - 1000 * 60 * 60 * 48,
  },
  {
    id: "conv_group_001",
    type: "group",
    name: "Project Phoenix",
    avatar: groupAvatar,
    members: ["usr_me_001", "usr_002", "usr_003", "usr_004"],
    memberCount: 4,
    maxMembers: 500,
    adminIds: ["usr_me_001"],
    lastMessage: {
      id: "lm3", conversationId: "conv_group_001", senderId: "usr_004",
      senderName: "Sibusiso", text: "Sbusiso: Updated the file", isEncrypted: true,
      status: "read", timestamp: Date.now() - 1000 * 60 * 39,
    } as Message,
    unreadCount: 12,
    isEncrypted: true,
    e2eeKeyFingerprint: "C5D6 E7F8 A9B0",
    groupDescription: "Soshanguve dev team 🚀",
    createdAt: Date.now() - 1000 * 60 * 60 * 72,
  },
  {
    id: "conv_direct_003",
    type: "direct",
    name: "Zanele D.",
    username: "zanele_d",
    avatar: saAvatars[3],
    isOnline: true,
    lastSeen: Date.now(),
    members: ["usr_me_001", "usr_005"],
    memberCount: 2,
    maxMembers: 2,
    adminIds: [],
    lastMessage: {
      id: "lm4", conversationId: "conv_direct_003", senderId: "usr_005",
      senderName: "Zanele D.", text: "", mediaType: "voice_note",
      isEncrypted: true, status: "read", timestamp: Date.now() - 1000 * 60 * 82,
      audioDurationSeconds: 47,
    } as Message,
    unreadCount: 0,
    isEncrypted: true,
    e2eeKeyFingerprint: "D7E8 F9A0 B1C2",
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 2,
  },
  {
    id: "conv_group_002",
    type: "group",
    name: "Family Group",
    avatar: "https://images.unsplash.com/photo-1511895426328-dc8714191011?w=400&auto=format&fit=crop&q=80",
    members: ["usr_me_001", "usr_002", "usr_003"],
    memberCount: 8,
    maxMembers: 500,
    adminIds: ["usr_me_001"],
    lastMessage: {
      id: "lm5", conversationId: "conv_group_002", senderId: "usr_002",
      senderName: "Mom", text: "Mom: Dinner at 7pm 🍽", isEncrypted: true,
      status: "read", timestamp: Date.now() - 1000 * 60 * 97,
    } as Message,
    unreadCount: 5,
    isEncrypted: true,
    e2eeKeyFingerprint: "E9F0 A1B2 C3D4",
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 5,
  },
  {
    id: "conv_direct_004",
    type: "direct",
    name: "Neo M.",
    username: "neo_m",
    avatar: saAvatars[4],
    isOnline: false,
    lastSeen: Date.now() - 1000 * 60 * 60 * 3,
    members: ["usr_me_001", "usr_006"],
    memberCount: 2,
    maxMembers: 2,
    adminIds: [],
    lastMessage: {
      id: "lm6", conversationId: "conv_direct_004", senderId: "usr_006",
      senderName: "Neo M.", text: "", mediaType: "image",
      mediaUrl: "https://images.unsplash.com/photo-1564419320461-6870880221ad?w=800&auto=format&fit=crop&q=80",
      isEncrypted: true, status: "delivered", timestamp: Date.now() - 1000 * 60 * 60 * 23,
    } as Message,
    unreadCount: 0,
    isEncrypted: true,
    e2eeKeyFingerprint: "F1A2 B3C4 D5E6",
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 3,
  },
];

export const INITIAL_MESSAGES_MAP: Record<string, Message[]> = {
  conv_direct_002: [
    {
      id: "m_t_1", conversationId: "conv_direct_002", senderId: "usr_003",
      senderName: "Thabo K.",
      text: "Heita! You coming to the game tomorrow night?",
      isEncrypted: true, status: "read", timestamp: Date.now() - 1000 * 60 * 45,
    },
    {
      id: "m_t_2", conversationId: "conv_direct_002", senderId: "usr_me_001",
      senderName: "Lindiwe M.",
      text: "Yebo! Defitenly. What time does it start?",
      isEncrypted: true, status: "read", timestamp: Date.now() - 1000 * 60 * 40,
    },
    {
      id: "m_t_3", conversationId: "conv_direct_002", senderId: "usr_003",
      senderName: "Thabo K.",
      text: "7PM at the usual spot. See you there!",
      isEncrypted: true, status: "read", timestamp: Date.now() - 1000 * 60 * 22,
    },
  ],
  conv_group_001: [
    {
      id: "m_g_1", conversationId: "conv_group_001", senderId: "usr_003",
      senderName: "Thabo K.",
      senderAvatar: saAvatars[1],
      text: "Group capacity upgraded to 500 members with E2EE 🔐",
      isEncrypted: true, status: "read", timestamp: Date.now() - 1000 * 60 * 90,
    },
    {
      id: "m_g_2", conversationId: "conv_group_001", senderId: "usr_004",
      senderName: "Sibusiso",
      senderAvatar: saAvatars[4],
      text: "Updated the file — check the shared drive 👆",
      isEncrypted: true, status: "read", timestamp: Date.now() - 1000 * 60 * 39,
    },
    {
      id: "m_g_3", conversationId: "conv_group_001", senderId: "usr_003",
      senderName: "Thabo K.",
      senderAvatar: saAvatars[1],
      text: "Transferred the project brief.",
      mediaType: "encrypted_file",
      fileName: "ProjectPhoenix_Brief_v3.pdf",
      fileSize: "4.2 MB",
      isEncrypted: true, status: "delivered", timestamp: Date.now() - 1000 * 60 * 4,
    },
  ],
};

export const INITIAL_STATUS_STORIES: UserStatusStory[] = [
  {
    userId: "usr_me_001",
    username: "lindiwe_m",
    displayName: "Lindiwe M.",
    avatarUrl: saAvatars[0],
    isCurrentUser: true,
    hasUnseen: false,
    lastUpdated: Date.now() - 1000 * 60 * 30,
    items: [
      {
        id: "s_me_1", mediaUrl: "https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=1080&auto=format&fit=crop&q=85",
        mediaType: "image", caption: "Soshanguve vibes ✨", createdAt: Date.now() - 1000 * 60 * 30,
        expiresAt: Date.now() + 1000 * 60 * 60 * 18, durationDays: 1,
        likesCount: 24, viewsCount: 89, privacy: "all_contacts", isEncrypted: true,
      },
    ],
  },
  {
    userId: "usr_002",
    username: "lindiwe_m",
    displayName: "Lindiwe M.",
    avatarUrl: saAvatars[0],
    hasUnseen: true,
    lastUpdated: Date.now() - 1000 * 60 * 2,
    items: [
      {
        id: "s2_1", mediaUrl: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1080&auto=format&fit=crop&q=85",
        mediaType: "image", caption: "Focus on progress, not perfection. 🙏", createdAt: Date.now() - 1000 * 60 * 2,
        expiresAt: Date.now() + 1000 * 60 * 60 * 22, durationDays: 1,
        likesCount: 12, viewsCount: 45, privacy: "all_contacts", isEncrypted: true,
      },
    ],
  },
  {
    userId: "usr_003",
    username: "thabo_k",
    displayName: "Thabo K.",
    avatarUrl: saAvatars[1],
    hasUnseen: true,
    lastUpdated: Date.now() - 1000 * 60 * 122,
    items: [
      {
        id: "s3_1", mediaUrl: "https://images.unsplash.com/photo-1517649763962-0c623066013b?w=1080&auto=format&fit=crop&q=85",
        mediaType: "image", caption: "Training hard 💪", createdAt: Date.now() - 1000 * 60 * 122,
        expiresAt: Date.now() + 1000 * 60 * 60 * 12, durationDays: 1,
        likesCount: 31, viewsCount: 120, privacy: "all_contacts", isEncrypted: true,
      },
    ],
  },
  {
    userId: "usr_005",
    username: "zanele_d",
    displayName: "Zanele D.",
    avatarUrl: saAvatars[3],
    hasUnseen: false,
    lastUpdated: Date.now() - 1000 * 60 * 300,
    items: [
      {
        id: "s4_1", mediaUrl: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=1080&auto=format&fit=crop&q=85",
        mediaType: "image", caption: "Feeling blessed 🌟", createdAt: Date.now() - 1000 * 60 * 300,
        expiresAt: Date.now() + 1000 * 60 * 60 * 6, durationDays: 1,
        likesCount: 8, viewsCount: 33, privacy: "all_contacts", isEncrypted: true,
      },
    ],
  },
  {
    userId: "usr_006",
    username: "neo_m",
    displayName: "Neo M.",
    avatarUrl: saAvatars[4],
    hasUnseen: true,
    lastUpdated: Date.now() - 1000 * 60 * 600,
    items: [
      {
        id: "s5_1", mediaUrl: "https://images.unsplash.com/photo-1564419320461-6870880221ad?w=1080&auto=format&fit=crop&q=85",
        mediaType: "image", caption: "Weekend mood 🔥", createdAt: Date.now() - 1000 * 60 * 600,
        expiresAt: Date.now() + 1000 * 60 * 60 * 2, durationDays: 1,
        likesCount: 19, viewsCount: 72, privacy: "all_contacts", isEncrypted: true,
      },
    ],
  },
];

export const INITIAL_SYNCED_CONTACTS: SyncedContact[] = [
  { id: "c_1", name: "Thabo K.", phoneNumber: "+27 72 345 6789", isRegistered: true, sovoUsername: "thabo_k", sovoAvatar: saAvatars[1], sovoUserId: "usr_003" },
  { id: "c_2", name: "Zanele D.", phoneNumber: "+27 83 456 7890", isRegistered: true, sovoUsername: "zanele_d", sovoAvatar: saAvatars[3], sovoUserId: "usr_005" },
  { id: "c_3", name: "Sibusiso N.", phoneNumber: "+27 61 567 8901", isRegistered: true, sovoUsername: "sibusiso_n", sovoAvatar: saAvatars[4], sovoUserId: "usr_004" },
  { id: "c_4", name: "Neo M.", phoneNumber: "+27 74 678 9012", isRegistered: true, sovoUsername: "neo_m", sovoAvatar: saAvatars[4], sovoUserId: "usr_006" },
  { id: "c_5", name: "Boitumelo S.", phoneNumber: "+27 65 789 0123", isRegistered: true, sovoUsername: "boitumelo_s", sovoAvatar: saAvatars[5], sovoUserId: "usr_007" },
  { id: "c_6", name: "Mpho L.", phoneNumber: "+27 82 890 1234", isRegistered: false },
  { id: "c_7", name: "Kagiso R.", phoneNumber: "+27 79 901 2345", isRegistered: false },
];

export const INITIAL_LINKED_DEVICES: LinkedDevice[] = [
  { id: "dev_1", name: "Samsung Galaxy S24", platform: "Android", location: "Pretoria, South Africa", lastActive: Date.now(), isCurrent: true, ipAddress: "196.10.44.88 (Android Keystore E2EE)", iconType: "mobile" },
  { id: "dev_2", name: "Samsung Galaxy Tab S9", platform: "Android", browser: "S'ovo Android Tablet v2.1", location: "Johannesburg, South Africa", lastActive: Date.now() - 1000 * 60 * 45, isCurrent: false, ipAddress: "196.10.44.89", iconType: "tablet" },
];

export const INITIAL_CALLS: CallRecord[] = [
  { id: "call_1", peerId: "usr_002", peerName: "Lindiwe M.", peerUsername: "lindiwe_m", peerAvatar: saAvatars[0], type: "video", direction: "incoming", status: "completed", durationSeconds: 842, timestamp: Date.now() - 1000 * 60 * 60 * 2, isEncrypted: true },
  { id: "call_2", peerId: "usr_003", peerName: "Thabo K.", peerUsername: "thabo_k", peerAvatar: saAvatars[1], type: "audio", direction: "outgoing", status: "completed", durationSeconds: 318, timestamp: Date.now() - 1000 * 60 * 60 * 18, isEncrypted: true },
  { id: "call_3", peerId: "usr_005", peerName: "Zanele D.", peerUsername: "zanele_d", peerAvatar: saAvatars[3], type: "video", direction: "incoming", status: "missed", durationSeconds: 0, timestamp: Date.now() - 1000 * 60 * 60 * 28, isEncrypted: true },
];
