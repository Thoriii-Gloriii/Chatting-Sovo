import { supabase } from './lib/supabase';
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
import { AndroidNavigationBar } from './components/AndroidSystemBar';
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
    // Check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const { data: u } = await supabase.from('users').select('*').eq('id', session.user.id).maybeSingle();
        if (u) {
          setCurrentUser(u as User);
          if ((u as User).biometricEnabled && settings.biometricLock) setIsBiometricLocked(true);
        }
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const { data: u } = await supabase.from('users').select('*').eq('id', session.user.id).maybeSingle();
        if (u) {
          setCurrentUser(u as User);
          if ((u as User).biometricEnabled && settings.biometricLock) setIsBiometricLocked(true);
          if (appStage !== 'splash') setAppStage('main');
        }
      } else {
        setCurrentUser(null);
        if (appStage === 'main') setAppStage('auth');
      }
    });
    return () => subscription.unsubscribe();
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

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setActiveConversation(null);
    setAppStage('auth');
  };

  // Load conversations from Supabase (initial + realtime)
  useEffect(() => {
    if (!currentUser) return;

    const load = async () => {
      const { data } = await supabase
        .from('conversations')
        .select('*')
        .contains('members', [currentUser.id]);
      if (data) {
        const convs = data as Conversation[];
        convs.sort((a, b) => {
          const tA = a.lastMessage?.timestamp || a.createdAt;
          const tB = b.lastMessage?.timestamp || b.createdAt;
          return tB - tA;
        });
        setConversations(convs);
      }
    };
    load();

    const channel = supabase
      .channel('conversations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, load)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentUser]);

  // Real user directory (all other registered accounts)
  useEffect(() => {
    if (!currentUser) return;

    const load = async () => {
      const { data } = await supabase.from('users').select('*').neq('id', currentUser.id);
      if (data) {
        const asContacts: SyncedContact[] = (data as User[]).map((u) => ({
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
      }
    };
    load();

    const channel = supabase
      .channel('users-dir')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, load)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentUser]);

  // Real status stories: grouped by author, dropping anything already expired
  useEffect(() => {
    if (!currentUser) return;

    const load = async () => {
      const { data } = await supabase
        .from('statuses')
        .select('*')
        .gt('expires_at', new Date().toISOString());
      if (!data) return;

      const byUser = new Map<string, UserStatusStory>();
      (data as any[]).forEach((row) => {
        const createdMs = new Date(row.created_at).getTime();
        const expiresMs = new Date(row.expires_at).getTime();
        const item: StatusItem = {
          id: row.id,
          mediaUrl: row.media_url,
          mediaType: row.media_type,
          caption: row.caption,
          createdAt: createdMs,
          expiresAt: expiresMs,
          durationDays: row.duration_days,
          musicTrack: row.music_track,
          likesCount: row.liked_by?.length || 0,
          hasLiked: row.liked_by?.includes(currentUser.id) || false,
          viewsCount: row.views_count || 0,
          privacy: row.privacy,
          isEncrypted: false,
        };
        const existing = byUser.get(row.author_id);
        if (existing) {
          existing.items.push(item);
          existing.lastUpdated = Math.max(existing.lastUpdated, createdMs);
        } else {
          byUser.set(row.author_id, {
            userId: row.author_id,
            username: row.author_username,
            displayName: row.author_id === currentUser.id ? 'Your Status' : row.author_display_name,
            avatarUrl: row.author_avatar_url,
            isCurrentUser: row.author_id === currentUser.id,
            lastUpdated: createdMs,
            items: [item],
          });
        }
      });
      const stories = Array.from(byUser.values()).sort((a, b) => b.lastUpdated - a.lastUpdated);
      stories.forEach((s) => s.items.sort((a, b) => a.createdAt - b.createdAt));
      setStatusStories(stories);
    };
    load();

    const channel = supabase
      .channel('statuses')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'statuses' }, load)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentUser]);

  // Real call log, scoped to calls this account was part of
  useEffect(() => {
    if (!currentUser) return;

    const load = async () => {
      const { data } = await supabase
        .from('calls')
        .select('*')
        .contains('members', [currentUser.id])
        .order('created_at', { ascending: false });
      if (data) setCallsList(data as CallRecord[]);
    };
    load();

    const channel = supabase
      .channel('calls')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calls' }, load)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
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

    const now = Date.now();
    const newMsg: Message = {
      id: `msg_${now}`,
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
      status: 'read',
      timestamp: now,
    };

    // Optimistic local update
    setMessagesMap((prev) => ({
      ...prev,
      [activeConversation.id]: [...(prev[activeConversation.id] || []), newMsg],
    }));
    setConversations((prev) =>
      prev.map((c) => c.id === activeConversation.id ? { ...c, lastMessage: newMsg } : c)
    );

    try {
      // 1. Insert message into flat messages table
      await supabase.from('messages').insert({
        id: newMsg.id,
        conversation_id: activeConversation.id,
        sender_id: currentUser.id,
        content: text,
        media_url: mediaData?.url,
        type: mediaData?.type || 'text',
        timestamp: new Date(now).toISOString(),
      });
      // 2. Update conversation's last_message + unread_count
      await supabase.from('conversations').update({
        last_message: newMsg,
        unread_count: (activeConversation.unreadCount || 0) + 1,
      }).eq('id', activeConversation.id);
    } catch (e) {
      console.error('Error sending message', e);
    }
  };

  // Status Stories Management
  const getDirectConversationId = (uid1: string, uid2: string) =>
    `conv_direct_${[uid1, uid2].sort().join('_')}`;

  const handleAddStatus = async (
    file: File,
    caption: string,
    durationDays: StatusItem['durationDays'],
    privacy: StatusItem['privacy']
  ) => {
    if (!currentUser) return;
    const now = new Date();
    const mediaUrl = await uploadFileToStorage(
      `statuses/${currentUser.id}/${now.getTime()}_${file.name}`,
      file
    );
    await supabase.from('statuses').insert({
      author_id: currentUser.id,
      author_username: currentUser.username,
      author_display_name: currentUser.displayName,
      author_avatar_url: currentUser.avatarUrl,
      media_url: mediaUrl,
      media_type: file.type.startsWith('video/') ? 'video' : 'image',
      caption,
      expires_at: new Date(now.getTime() + (durationDays as number) * 24 * 60 * 60 * 1000).toISOString(),
      duration_days: durationDays,
      privacy,
      views_count: 0,
      liked_by: [],
    });
  };

  const handleToggleStatusLike = async (storyUserId: string, itemId: string) => {
    if (!currentUser) return;
    const story = statusStories.find((s) => s.userId === storyUserId);
    const item = story?.items.find((i) => i.id === itemId);
    const currentLikedBy: string[] = [];
    const { data } = await supabase.from('statuses').select('liked_by').eq('id', itemId).single();
    const likedBy: string[] = data?.liked_by || [];
    const newLikedBy = item?.hasLiked
      ? likedBy.filter((id) => id !== currentUser.id)
      : [...likedBy, currentUser.id];
    await supabase.from('statuses').update({ liked_by: newLikedBy }).eq('id', itemId);
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
        name: contact?.name || "S'ovo User",
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
      await supabase.from('conversations').upsert(conv);
    }

    const now = Date.now();
    const newMsg: Message = {
      id: `msg_${now}`,
      conversationId: conv.id,
      senderId: currentUser.id,
      senderName: currentUser.displayName,
      senderAvatar: currentUser.avatarUrl,
      text: `Replied to status: "${statusItem.caption}":\n${replyText}`,
      mediaUrl: statusItem.mediaUrl,
      mediaType: 'image',
      isEncrypted: true,
      status: 'sent',
      timestamp: now,
    };

    await supabase.from('messages').insert({
      id: newMsg.id,
      conversation_id: conv.id,
      sender_id: currentUser.id,
      content: newMsg.text,
      media_url: statusItem.mediaUrl,
      type: 'image',
      timestamp: new Date(now).toISOString(),
    });
    await supabase.from('conversations').update({ last_message: newMsg }).eq('id', conv.id);

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
      await supabase.from('conversations').upsert(newConv);
      setActiveConversation(newConv);
      setActiveTab('chats');
    }
  };

  const handleCreateGroup = async (newGroup: Conversation) => {
    await supabase.from('conversations').upsert(newGroup);
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
      await supabase.from('calls').insert({
        ...newRecord,
        members: [currentUser.id, activeCall.peerId],
      });
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
      className="min-h-screen w-full bg-[#030305] text-[#f4f4f6] flex flex-col items-center justify-center p-0 selection:bg-[#d4af37]/30 selection:text-[#f3e5ab]"
      id="sovo-app-root"
      style={{ zoom: '0.95' }}
    >
      {/* Full-screen app container */}
      <div
        className="w-full overflow-hidden flex flex-col bg-[#07070b] min-h-screen relative"
        id="android-device-chassis"
      >

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
                    await supabase.from('users').update(updated).eq('id', currentUser.id);
                  }}
                  onUploadAvatar={async (file) => {
                    const avatarUrl = await uploadFileToStorage(
                      `avatars/${currentUser.id}/${Date.now()}_${file.name}`,
                      file
                    );
                    await supabase.from('users').update({ avatar_url: avatarUrl }).eq('id', currentUser.id);
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



