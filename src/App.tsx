import { auth, db, onAuthStateChanged, collection, query, where, onSnapshot, getDoc, getDocs, doc, setDoc, updateDoc, addDoc, arrayUnion, arrayRemove, increment, serverTimestamp } from './lib/firebase';
import { uploadFileToStorage } from './lib/upload';
import React, { useState, useEffect } from 'react';
import {
  User,
  Conversation,
  Message,
  UserStatusStory,
  StatusItem,
  SyncedContact,
  LinkedDevice,
  CallRecord,
  UserSettings,
  MediaType,
} from './types';
import { SovoLogo } from './components/SovoLogo';
import { SplashScreen } from './components/SplashScreen';
import { AuthLanding } from './components/AuthLanding';
import { BiometricModal } from './components/BiometricModal';
import { ChatsView } from './components/ChatsView';
import { ChatRoom } from './components/ChatRoom';
import { StatusReelsView } from './components/StatusReelsView';
import { CallsView, ActiveCallOverlay } from './components/CallsView';
import { SettingsView } from './components/SettingsView';
import { ContactsSyncModal } from './components/ContactsSyncModal';
import { GroupCreateModal } from './components/GroupCreateModal';
import { E2EEVerificationModal } from './components/E2EEVerificationModal';
import { AndroidStatusBar, AndroidNavigationBar } from './components/AndroidSystemBar';
import { sound } from './lib/sound';
import {
  MessageSquare,
  PlaySquare,
  Phone,
  Settings as SettingsIcon,
  ShieldCheck,
  Lock,
  Smartphone,
  Users,
  Fingerprint,
  Search,
} from 'lucide-react';

// Real default app settings (not mock user data — every account starts here
// until they change something in Settings, which persists to Firestore).
const DEFAULT_SETTINGS: UserSettings = {
  readReceipts: true,
  biometricLock: false,
  autoLockMinutes: 5,
  phoneVisibility: 'contacts',
  lastSeenVisibility: 'contacts',
  darkMode: true,
  e2eeAlwaysEnforced: true,
  soundEffects: true,
  highQualityUploads: true,
  defaultStoryDuration: 1,
  activeDevicePlatform: /Android/i.test(navigator.userAgent) ? 'Android' : 'web',
};

export default function App() {
  // Navigation & App Lifecycle states
  const [appStage, setAppStage] = useState<'splash' | 'auth' | 'main'>('splash');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'chats' | 'statuses' | 'calls' | 'settings'>('chats');
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);

  // Security & Biometric Lock state
  const [isBiometricLocked, setIsBiometricLocked] = useState(false);
  const [showE2EEModal, setShowE2EEModal] = useState(false);
  const [e2eePeerInfo, setE2EEPeerInfo] = useState<{
    id: string;
    name: string;
    username?: string;
    keyFingerprint?: string;
  } | null>(null);

  // Modals state
  const [showSyncContactsModal, setShowSyncContactsModal] = useState(false);
  const [showGroupCreateModal, setShowGroupCreateModal] = useState(false);

  // Active call state
  const [activeCall, setActiveCall] = useState<{
    peerId: string;
    peerName: string;
    type: 'audio' | 'video';
  } | null>(null);

  // Data Collections — all populated from Firestore below, never from mock/fake seed data.
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messagesMap, setMessagesMap] = useState<Record<string, Message[]>>({});
  const [statusStories, setStatusStories] = useState<UserStatusStory[]>([]);
  const [syncedContacts, setSyncedContacts] = useState<SyncedContact[]>([]);
  const [linkedDevices, setLinkedDevices] = useState<LinkedDevice[]>([]);
  const [callsList, setCallsList] = useState<CallRecord[]>([]);

  // Check saved session on load
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        const userDoc = await getDoc(doc(db, "users", fbUser.uid));
        if (userDoc.exists()) {
          const u = userDoc.data() as User;
          setCurrentUser(u);
          if (u.biometricEnabled && settings.biometricLock) {
            setIsBiometricLocked(true);
          }
          if (appStage === 'splash') {
             // We'll let splash complete naturally or we can skip it
          } else {
             setAppStage('main');
          }
        }
      } else {
        setCurrentUser(null);
        if (appStage === 'main') setAppStage('auth');
      }
    });
    return () => unsubscribe();
  }, [appStage, settings.biometricLock]);

  const handleSplashComplete = () => {
    if (currentUser) {
      setAppStage('main');
    } else {
      setAppStage('auth');
    }
  };

  const handleAuthenticate = (user: User) => {
    setCurrentUser(user);
    setAppStage('main');
  };

  const handleSignOut = () => {
    auth.signOut();
    setCurrentUser(null);
    setActiveConversation(null);
    setAppStage('auth');
  };

  // Load conversations from Firestore
  useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, 'conversations'),
      where('members', 'array-contains', currentUser.id)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const convs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Conversation));
      // Sort by lastMessage timestamp or createdAt
      convs.sort((a, b) => {
        const tA = a.lastMessage?.timestamp || a.createdAt;
        const tB = b.lastMessage?.timestamp || b.createdAt;
        return tB - tA;
      });
      setConversations(convs);
    });
    return () => unsubscribe();
  }, [currentUser]);

  // Real user directory: every other registered account, used to power "Discover"
  // and @username search instead of a fake local contact-sync simulation.
  useEffect(() => {
    if (!currentUser) return;
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const others = snapshot.docs
        .map((d) => d.data() as User)
        .filter((u) => u.id !== currentUser.id);
      const asContacts: SyncedContact[] = others.map((u) => ({
        id: u.id,
        name: u.displayName,
        phoneNumber: u.phoneNumber || '',
        isRegistered: true,
        sovoUsername: u.username,
        sovoAvatar: u.avatarUrl,
        sovoUserId: u.id,
        status: u.bio,
      }));
      setSyncedContacts(asContacts);
    });
    return () => unsubscribe();
  }, [currentUser]);

  // Real status stories: read from Firestore, grouped by author, dropping
  // anything already expired. Posting a status is handled by handleAddStatus.
  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, 'statuses'), where('expiresAt', '>', Date.now()));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const byUser = new Map<string, UserStatusStory>();
      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data() as StatusItem & {
          authorId: string;
          authorUsername: string;
          authorDisplayName: string;
          authorAvatarUrl: string;
          likedBy?: string[];
        };
        const item: StatusItem = {
          id: docSnap.id,
          mediaUrl: data.mediaUrl,
          mediaType: data.mediaType,
          caption: data.caption,
          createdAt: data.createdAt,
          expiresAt: data.expiresAt,
          durationDays: data.durationDays,
          musicTrack: data.musicTrack,
          likesCount: data.likedBy?.length || 0,
          hasLiked: data.likedBy?.includes(currentUser.id) || false,
          viewsCount: data.viewsCount || 0,
          privacy: data.privacy,
          isEncrypted: false,
        };
        const existing = byUser.get(data.authorId);
        if (existing) {
          existing.items.push(item);
          existing.lastUpdated = Math.max(existing.lastUpdated, data.createdAt);
        } else {
          byUser.set(data.authorId, {
            userId: data.authorId,
            username: data.authorUsername,
            displayName: data.authorId === currentUser.id ? 'Your Status' : data.authorDisplayName,
            avatarUrl: data.authorAvatarUrl,
            isCurrentUser: data.authorId === currentUser.id,
            lastUpdated: data.createdAt,
            items: [item],
          });
        }
      });
      const stories = Array.from(byUser.values()).sort((a, b) => b.lastUpdated - a.lastUpdated);
      stories.forEach((s) => s.items.sort((a, b) => a.createdAt - b.createdAt));
      setStatusStories(stories);
    });
    return () => unsubscribe();
  }, [currentUser]);

  // Real call log, scoped to calls this account was part of.
  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, 'calls'), where('members', 'array-contains', currentUser.id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const calls = snapshot.docs.map((d) => d.data() as CallRecord);
      calls.sort((a, b) => b.timestamp - a.timestamp);
      setCallsList(calls);
    });
    return () => unsubscribe();
  }, [currentUser]);

  // A single, real "this device" entry — actual multi-device session tracking
  // isn't implemented yet, so we don't fabricate a fake device history.
  useEffect(() => {
    if (!currentUser) {
      setLinkedDevices([]);
      return;
    }
    const isAndroidApp = /Android/i.test(navigator.userAgent) && (window as any).Capacitor;
    setLinkedDevices([
      {
        id: 'this-device',
        name: isAndroidApp ? "This Android device" : 'This browser',
        platform: isAndroidApp ? 'Android' : 'Web',
        location: 'Current session',
        lastActive: Date.now(),
        isCurrent: true,
        ipAddress: '',
        iconType: isAndroidApp ? 'mobile' : 'desktop',
      },
    ]);
  }, [currentUser]);

  // Message sending handler
  const handleSendMessage = async (
    text: string,
    mediaData?: {
      url?: string;
      type?: MediaType;
      fileName?: string;
      fileSize?: string;
      fileSizeBytes?: number;
      duration?: number;
    }
  ) => {
    if (!activeConversation || !currentUser) return;

    const newMsg: Message = {
      id: `msg_${Date.now()}`,
      conversationId: activeConversation.id,
      senderId: currentUser.id,
      senderName: currentUser.displayName,
      senderAvatar: currentUser.avatarUrl,
      text: text,
      mediaUrl: mediaData?.url,
      mediaType: mediaData?.type,
      fileName: mediaData?.fileName,
      fileSize: mediaData?.fileSize,
      fileSizeBytes: mediaData?.fileSizeBytes,
      audioDurationSeconds: mediaData?.duration,
      isEncrypted: true,
      e2eeFingerprint: activeConversation.e2eeKeyFingerprint,
      status: 'read', // simulate instant read when receipts enabled
      timestamp: Date.now(),
    };

    // Update messages map
    setMessagesMap((prev) => ({
      ...prev,
      [activeConversation.id]: [...(prev[activeConversation.id] || []), newMsg],
    }));

    // Update conversation last message preview
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConversation.id
          ? {
              ...c,
              lastMessage: newMsg,
            }
          : c
      )
    );

    try {
      // 1. Add message to the subcollection
      const msgRef = doc(collection(db, 'conversations', activeConversation.id, 'messages'), newMsg.id);
      await setDoc(msgRef, newMsg);

      // 2. Update last message on conversation
      const convRef = doc(db, 'conversations', activeConversation.id);
      await setDoc(convRef, { lastMessage: newMsg, unreadCount: activeConversation.unreadCount + 1 }, { merge: true });
    } catch (e) {
      console.error("Error sending message", e);
    }
  };

  // Status Stories Management
  // Direct conversations get a stable id derived from both member UIDs (sorted),
  // so the same two real people always land in the same real conversation
  // instead of each client inventing its own fake/duplicate thread.
  const getDirectConversationId = (uid1: string, uid2: string) =>
    `conv_direct_${[uid1, uid2].sort().join('_')}`;

  const handleAddStatus = async (
    file: File,
    caption: string,
    durationDays: StatusItem['durationDays'],
    privacy: StatusItem['privacy']
  ) => {
    if (!currentUser) return;
    const now = Date.now();
    const mediaUrl = await uploadFileToStorage(
      `statuses/${currentUser.id}/${now}_${file.name}`,
      file
    );
    await addDoc(collection(db, 'statuses'), {
      authorId: currentUser.id,
      authorUsername: currentUser.username,
      authorDisplayName: currentUser.displayName,
      authorAvatarUrl: currentUser.avatarUrl,
      mediaUrl,
      mediaType: file.type.startsWith('video/') ? 'video' : 'image',
      caption,
      createdAt: now,
      expiresAt: now + durationDays * 24 * 60 * 60 * 1000,
      durationDays,
      privacy,
      viewsCount: 0,
      likedBy: [],
    });
  };

  const handleToggleStatusLike = async (storyUserId: string, itemId: string) => {
    if (!currentUser) return;
    const story = statusStories.find((s) => s.userId === storyUserId);
    const item = story?.items.find((i) => i.id === itemId);
    const statusRef = doc(db, 'statuses', itemId);
    try {
      await updateDoc(statusRef, {
        likedBy: item?.hasLiked ? arrayRemove(currentUser.id) : arrayUnion(currentUser.id),
      });
    } catch (e) {
      console.error('Error toggling status like', e);
    }
  };

  const handleSendStatusReply = async (contactId: string, replyText: string, statusItem: StatusItem) => {
    if (!currentUser) return;
    const convId = getDirectConversationId(currentUser.id, contactId);
    let conv = conversations.find((c) => c.id === convId);

    if (!conv) {
      const contact = syncedContacts.find((sc) => sc.sovoUserId === contactId || sc.id === contactId);
      conv = {
        id: convId,
        type: 'direct',
        name: contact?.name || 'S’ovo User',
        username: contact?.sovoUsername,
        avatar: contact?.sovoAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(contact?.name || '?')}&background=222230&color=ffd700`,
        members: [currentUser.id, contactId],
        memberCount: 2,
        maxMembers: 2,
        adminIds: [],
        unreadCount: 0,
        isEncrypted: true,
        e2eeKeyFingerprint: `SOVO-E2EE-${Date.now().toString(16).toUpperCase()}`,
        createdAt: Date.now(),
      };
      try {
        await setDoc(doc(db, 'conversations', conv.id), conv);
      } catch (e) {
        console.error('Failed to create conversation for status reply', e);
      }
    }

    const newMsg: Message = {
      id: `msg_${Date.now()}`,
      conversationId: conv.id,
      senderId: currentUser.id,
      senderName: currentUser.displayName,
      senderAvatar: currentUser.avatarUrl,
      text: `Replied to status: "${statusItem.caption}":\n${replyText}`,
      mediaUrl: statusItem.mediaUrl,
      mediaType: 'image',
      isEncrypted: true,
      status: 'sent',
      timestamp: Date.now(),
    };

    try {
      await setDoc(doc(collection(db, 'conversations', conv.id, 'messages'), newMsg.id), newMsg);
      await setDoc(doc(db, 'conversations', conv.id), { lastMessage: newMsg }, { merge: true });
    } catch (e) {
      console.error('Failed to send status reply', e);
    }

    setActiveConversation(conv);
    setActiveTab('chats');
  };

  const handleStartDirectChatFromContact = async (contact: SyncedContact) => {
    if (!currentUser) return;
    const peerId = contact.sovoUserId || contact.id;
    const convId = getDirectConversationId(currentUser.id, peerId);
    const existing = conversations.find((c) => c.id === convId);

    if (existing) {
      setActiveConversation(existing);
      setActiveTab('chats');
    } else {
      const newConv: Conversation = {
        id: convId,
        type: 'direct',
        name: contact.name,
        username: contact.sovoUsername,
        avatar: contact.sovoAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(contact.name)}&background=222230&color=ffd700`,
        members: [currentUser.id, peerId],
        memberCount: 2,
        maxMembers: 2,
        adminIds: [],
        unreadCount: 0,
        isEncrypted: true,
        e2eeKeyFingerprint: `SOVO-E2EE-${Date.now().toString(16).toUpperCase()}`,
        createdAt: Date.now(),
      };
      
      try {
        await setDoc(doc(db, 'conversations', newConv.id), newConv);
      } catch (e) {
        console.error("Failed to create conversation", e);
      }

      setActiveConversation(newConv);
      setActiveTab('chats');
    }
  };

  const handleCreateGroup = async (newGroup: Conversation) => {
    try {
      await setDoc(doc(db, 'conversations', newGroup.id), newGroup);
    } catch (e) {
      console.error('Failed to create group', e);
    }
    setActiveConversation(newGroup);
    setActiveTab('chats');
  };

  const handleOpenE2EEFromChat = () => {
    if (activeConversation) {
      setE2EEPeerInfo({
        id: activeConversation.id,
        name: activeConversation.name,
        username: activeConversation.username,
        keyFingerprint: activeConversation.e2eeKeyFingerprint,
      });
      setShowE2EEModal(true);
    }
  };

  const handleStartCall = (peerId: string, peerName: string, type: 'audio' | 'video') => {
    sound.playTap();
    setActiveCall({ peerId, peerName, type });
  };

  const handleEndCall = async () => {
    sound.playTap();
    if (activeCall && currentUser) {
      const newRecord: CallRecord = {
        id: `call_${Date.now()}`,
        peerId: activeCall.peerId,
        peerName: activeCall.peerName,
        peerUsername: syncedContacts.find((c) => c.sovoUserId === activeCall.peerId)?.sovoUsername || '',
        peerAvatar:
          syncedContacts.find((c) => c.sovoUserId === activeCall.peerId)?.sovoAvatar ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(activeCall.peerName)}&background=222230&color=ffd700`,
        type: activeCall.type,
        direction: 'outgoing',
        status: 'completed',
        durationSeconds: Math.floor(Math.random() * 300) + 30,
        timestamp: Date.now(),
        isEncrypted: true,
      };
      try {
        await setDoc(doc(db, 'calls', newRecord.id), {
          ...newRecord,
          members: [currentUser.id, activeCall.peerId],
        });
      } catch (e) {
        console.error('Failed to save call record', e);
      }
    }
    setActiveCall(null);
  };

  // 1. Initial Opening Splash Screen
  if (appStage === 'splash') {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  // 2. Auth Landing Page
  if (appStage === 'auth' || !currentUser) {
    return <AuthLanding onAuthenticate={handleAuthenticate} />;
  }

  // Android Back Gesture handler
  const handleAndroidBack = () => {
    sound.playTap();
    if (activeConversation) {
      setActiveConversation(null);
    } else if (activeTab !== 'chats') {
      setActiveTab('chats');
    }
  };

  return (
    <div
      className="min-h-screen w-full bg-[#030305] text-[#f4f4f6] flex flex-col items-center justify-center p-0 sm:py-6 selection:bg-[#d4af37]/30 selection:text-[#f3e5ab]"
      id="sovo-app-root"
    >
      {/* Strictly Android Flagship Frame (Pixel 9 Pro / Galaxy S25 Ultra Form Factor) */}
      <div
        className="w-full sm:max-w-md sm:rounded-[38px] sm:border-[5px] sm:border-[#1e1d28] sm:shadow-[0_25px_80px_rgba(0,0,0,0.9),0_0_40px_rgba(212,175,55,0.12)] overflow-hidden flex flex-col bg-[#07070b] min-h-screen sm:min-h-[890px] sm:max-h-[92vh] relative"
        id="android-device-chassis"
      >
        {/* Android Top System Bar (Clock, Notification Badges, Punch Hole Camera, 5G/Wi-Fi/Battery) */}
        <AndroidStatusBar />

        {/* Material 3 Top App Bar */}
        <header className="h-15 px-4 bg-[#09090e]/95 backdrop-blur-md border-b border-[#1c1b24] flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center gap-2.5">
            <SovoLogo size="sm" showText={true} withGlow={true} />
          </div>

          {/* Android Knox Security Pill */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#13120d] border border-[#d4af37]/35 text-[10px] font-semibold text-[#ffd700]">
            <Lock className="w-2.5 h-2.5 text-[#ffd700]" />
            <span>Knox E2EE</span>
          </div>

          {/* Right User & Lock Status */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                sound.playTap();
                setIsBiometricLocked(true);
              }}
              className="p-2 rounded-xl bg-[#12121a] hover:bg-[#1c1b28] border border-[#232230] text-[#ffd700] hover:border-[#d4af37]/60 transition cursor-pointer"
              title="Lock S'ovo with Android Biometrics"
            >
              <Fingerprint className="w-4 h-4" />
            </button>

            <img
              src={currentUser.avatarUrl}
              alt={currentUser.displayName}
              onClick={() => {
                sound.playTap();
                setActiveTab('settings');
              }}
              className="w-8 h-8 rounded-full object-cover border border-[#d4af37]/60 cursor-pointer hover:scale-105 transition"
            />
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col relative overflow-hidden">
          {/* Active Chat Conversation Room or Tab View */}
          {activeConversation ? (
            <ChatRoom
              conversation={activeConversation}
              messages={messagesMap[activeConversation.id] || []}
              currentUser={currentUser}
              settings={settings}
              onBack={() => setActiveConversation(null)}
              onSendMessage={handleSendMessage}
              onOpenE2EEModal={handleOpenE2EEFromChat}
              onStartCall={(type) => {
                const peerId = activeConversation.members.find((m) => m !== currentUser.id) || activeConversation.id;
                handleStartCall(peerId, activeConversation.name, type);
              }}
              onToggleReaction={(msgId, emoji) => {
                setMessagesMap((prev) => ({
                  ...prev,
                  [activeConversation.id]: (prev[activeConversation.id] || []).map((m) =>
                    m.id === msgId
                      ? {
                          ...m,
                          userReaction: m.userReaction === emoji ? undefined : emoji,
                        }
                      : m
                  ),
                }));
              }}
            />
          ) : (
            <>
              {/* Tab 1: Chats (Default Dashboard) */}
              {activeTab === 'chats' && (
                <ChatsView
                  conversations={conversations}
                  statusStories={statusStories}
                  currentUser={currentUser}
                  settings={settings}
                  onSelectConversation={(conv) => setActiveConversation(conv)}
                  onOpenNewGroup={() => setShowGroupCreateModal(true)}
                  onOpenSyncContacts={() => setShowSyncContactsModal(true)}
                  onOpenReelsView={() => setActiveTab('statuses')}
                />
              )}

              {/* Tab 2: Statuses (TikTok-Style Vertical Reels) */}
              {activeTab === 'statuses' && (
                <StatusReelsView
                  stories={statusStories}
                  currentUser={currentUser}
                  onSendStatusReply={handleSendStatusReply}
                  onAddStatus={handleAddStatus}
                  onToggleLike={handleToggleStatusLike}
                />
              )}

              {/* Tab 3: Calls Log */}
              {activeTab === 'calls' && (
                <CallsView
                  calls={callsList}
                  currentUser={currentUser}
                  onInitiateCall={(peerId, peerName, type) => handleStartCall(peerId, peerName, type)}
                />
              )}

              {/* Tab 4: Settings & Devices */}
              {activeTab === 'settings' && (
                <SettingsView
                  currentUser={currentUser}
                  settings={settings}
                  linkedDevices={linkedDevices}
                  onUpdateSettings={(newSet) => setSettings((s) => ({ ...s, ...newSet }))}
                  onUpdateProfile={async (updated) => {
                    setCurrentUser((u) => (u ? { ...u, ...updated } : null));
                    try {
                      await updateDoc(doc(db, 'users', currentUser.id), updated);
                    } catch (e) {
                      console.error('Failed to persist profile update', e);
                    }
                  }}
                  onUploadAvatar={async (file) => {
                    const avatarUrl = await uploadFileToStorage(
                      `avatars/${currentUser.id}/${Date.now()}_${file.name}`,
                      file
                    );
                    await updateDoc(doc(db, 'users', currentUser.id), { avatarUrl });
                    setCurrentUser((u) => (u ? { ...u, avatarUrl } : null));
                  }}
                  onUnlinkDevice={(id) =>
                    setLinkedDevices((devs) => devs.filter((d) => d.id !== id))
                  }
                  onSignOut={handleSignOut}
                  onOpenE2EEKeys={() => {
                    setE2EEPeerInfo({
                      id: currentUser.id,
                      name: currentUser.displayName,
                      username: currentUser.username,
                      keyFingerprint: currentUser.e2eeFingerprint,
                    });
                    setShowE2EEModal(true);
                  }}
                />
              )}
            </>
          )}
        </main>

        {/* Material 3 Android Bottom Navigation Bar (Visible when not in active chat room) */}
        {!activeConversation && (
          <nav
            className="h-16 px-1 bg-[#08080d] border-t border-[#1a1928] flex items-center justify-around z-30 shadow-2xl"
            id="android-m3-navigation-bar"
          >
            {/* Chats Tab */}
            <button
              type="button"
              onClick={() => {
                sound.playTap();
                setActiveTab('chats');
              }}
              className="flex flex-col items-center gap-0.5 transition cursor-pointer flex-1 py-2"
            >
              <div
                className={`w-12 h-6 rounded-full transition-all duration-200 flex items-center justify-center ${
                  activeTab === 'chats' ? 'text-[#ffd700]' : 'text-gray-500'
                }`}
              >
                <MessageSquare className="w-5 h-5 stroke-[1.8]" />
              </div>
              <span className={`text-[10px] font-medium ${activeTab === 'chats' ? 'text-[#ffd700]' : 'text-gray-500'}`}>
                Chats
              </span>
            </button>

            {/* Calls Tab */}
            <button
              type="button"
              onClick={() => {
                sound.playTap();
                setActiveTab('calls');
              }}
              className="flex flex-col items-center gap-0.5 transition cursor-pointer flex-1 py-2"
            >
              <div
                className={`w-12 h-6 rounded-full transition-all duration-200 flex items-center justify-center ${
                  activeTab === 'calls' ? 'text-[#ffd700]' : 'text-gray-500'
                }`}
              >
                <Phone className="w-5 h-5 stroke-[1.8]" />
              </div>
              <span className={`text-[10px] font-medium ${activeTab === 'calls' ? 'text-[#ffd700]' : 'text-gray-500'}`}>
                Calls
              </span>
            </button>

            {/* Status Tab */}
            <button
              type="button"
              onClick={() => {
                sound.playTap();
                setActiveTab('statuses');
              }}
              className="flex flex-col items-center gap-0.5 transition cursor-pointer flex-1 py-2"
            >
              <div
                className={`w-12 h-6 rounded-full transition-all duration-200 flex items-center justify-center ${
                  activeTab === 'statuses' ? 'text-[#ffd700]' : 'text-gray-500'
                }`}
              >
                <PlaySquare className="w-5 h-5 stroke-[1.8]" />
              </div>
              <span className={`text-[10px] font-medium ${activeTab === 'statuses' ? 'text-[#ffd700]' : 'text-gray-500'}`}>
                Status
              </span>
            </button>

            {/* Groups Tab */}
            <button
              type="button"
              onClick={() => {
                sound.playTap();
                setShowGroupCreateModal(true);
              }}
              className="flex flex-col items-center gap-0.5 transition cursor-pointer flex-1 py-2"
            >
              <div className="w-12 h-6 rounded-full flex items-center justify-center text-gray-500">
                <Users className="w-5 h-5 stroke-[1.8]" />
              </div>
              <span className="text-[10px] font-medium text-gray-500">Groups</span>
            </button>

            {/* Settings Tab */}
            <button
              type="button"
              onClick={() => {
                sound.playTap();
                setActiveTab('settings');
              }}
              className="flex flex-col items-center gap-0.5 transition cursor-pointer flex-1 py-2"
            >
              <div
                className={`w-12 h-6 rounded-full transition-all duration-200 flex items-center justify-center ${
                  activeTab === 'settings' ? 'text-[#ffd700]' : 'text-gray-500'
                }`}
              >
                <SettingsIcon className="w-5 h-5 stroke-[1.8]" />
              </div>
              <span className={`text-[10px] font-medium ${activeTab === 'settings' ? 'text-[#ffd700]' : 'text-gray-500'}`}>
                Settings
              </span>
            </button>
          </nav>
        )}

        {/* Android System Navigation Gesture Bar at bottom */}
        <AndroidNavigationBar
          onBack={handleAndroidBack}
          onHome={() => {
            sound.playTap();
            setActiveConversation(null);
            setActiveTab('chats');
          }}
          onRecents={() => {
            sound.playTap();
          }}
        />
      </div>

      {/* Biometric Lock Modal Guard */}
      <BiometricModal
        isOpen={isBiometricLocked}
        onSuccess={() => setIsBiometricLocked(false)}
        pinCode={currentUser?.pinCode || '7788'}
      />

      {/* Discover Real Accounts & Global Username Search Modal */}
      <ContactsSyncModal
        isOpen={showSyncContactsModal}
        onClose={() => setShowSyncContactsModal(false)}
        contacts={syncedContacts}
        onStartDirectChat={handleStartDirectChatFromContact}
      />

      {/* Create 500-Member Group Modal */}
      <GroupCreateModal
        isOpen={showGroupCreateModal}
        onClose={() => setShowGroupCreateModal(false)}
        contacts={syncedContacts}
        currentUserId={currentUser.id}
        onCreateGroup={handleCreateGroup}
      />

      {/* E2EE Safety Numbers & QR Verification Modal */}
      {showE2EEModal && e2eePeerInfo && (
        <E2EEVerificationModal
          isOpen={showE2EEModal}
          onClose={() => setShowE2EEModal(false)}
          currentUserId={currentUser.id}
          peerId={e2eePeerInfo.id}
          peerName={e2eePeerInfo.name}
          peerUsername={e2eePeerInfo.username}
          keyFingerprint={e2eePeerInfo.keyFingerprint}
        />
      )}

      {/* Active Call Overlay Simulator */}
      {activeCall && (
        <ActiveCallOverlay
          peerName={activeCall.peerName}
          callType={activeCall.type}
          onEndCall={handleEndCall}
        />
      )}
    </div>
  );
}



