import { supabase } from './lib/supabase';
import { ensureProfile } from './lib/authProfile';
import { uploadFileToStorage } from './lib/upload';
import { useUIDensity } from './hooks/useUIDensity';
import React, { useState, useEffect, useRef } from 'react';
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
import { CallsView, ActiveCallOverlay, IncomingCallModal } from './components/CallsView';
import { SettingsView } from './components/SettingsView';
import { ContactsSyncModal } from './components/ContactsSyncModal';
import { GroupCreateModal } from './components/GroupCreateModal';
import { E2EEVerificationModal } from './components/E2EEVerificationModal';
import { AndroidNavigationBar } from './components/AndroidSystemBar';
import { sound } from './lib/sound';
import {
  SovoCall,
  listenForIncomingCalls,
  callingSupported,
  CallInvite,
  CallState,
  CallType,
  CallEndReason,
} from './lib/webrtc';
import { getPublicKeyB64, getKeyFingerprint, encryptMessage } from './crypto/e2ee';
import { captureInviteFromUrl, consumePendingInvite } from './utils/inviteLink';
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
  // Keeps --ui-scale / [data-density] on the document root in sync with
  // the device's actual resolution/DPI (spacing & sizing only — never
  // font-size). See src/hooks/useUIDensity.ts.
  useUIDensity();

  // Navigation & App Lifecycle states
  const [appStage, setAppStage] = useState<'splash' | 'auth' | 'main'>('splash');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'chats' | 'statuses' | 'calls' | 'settings'>('chats');
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  // Which specific person's story the full-screen status viewer should open
  // on, when entered by tapping a particular avatar rather than the generic
  // Statuses tab. Null just opens on the first available story.
  const [statusViewerUserId, setStatusViewerUserId] = useState<string | null>(null);

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

  // Active call state. `session` is the live RTCPeerConnection wrapper; the
  // overlay renders the streams it produces rather than a stock photo.
  const [activeCall, setActiveCall] = useState<{
    session: SovoCall;
    peerId: string;
    peerName: string;
    peerAvatar: string;
    type: CallType;
    direction: 'incoming' | 'outgoing';
  } | null>(null);
  const [callState, setCallState] = useState<CallState>('idle');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [callError, setCallError] = useState<string | null>(null);
  const [incomingInvite, setIncomingInvite] = useState<CallInvite | null>(null);

  // Data Collections — all populated from Firestore below, never from mock/fake seed data.
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messagesMap, setMessagesMap] = useState<Record<string, Message[]>>({});
  const [statusStories, setStatusStories] = useState<UserStatusStory[]>([]);
  const [syncedContacts, setSyncedContacts] = useState<SyncedContact[]>([]);
  const [linkedDevices, setLinkedDevices] = useState<LinkedDevice[]>([]);
  const [callsList, setCallsList] = useState<CallRecord[]>([]);

  // Direct-chat header identity fix: a 1:1 conversation's stored `name`/
  // `avatar` fields used to be whichever contact-list name the creator
  // happened to have saved, baked in once at creation time — so the other
  // participant would see themselves mislabeled (or worse, "S'ovo User")
  // in their own conversation header. Instead we resolve each direct
  // conversation's displayed name/avatar live, per-viewer, from the OTHER
  // member's real profile — so both phones always show the correspondent's
  // actual name, never the viewer's own or a stale cached one.
  const [memberProfiles, setMemberProfiles] = useState<
    Record<string, { displayName: string; avatarUrl: string }>
  >({});
  const fetchedProfileIds = useRef<Set<string>>(new Set());

  // Check saved session on load, and react to sign-in/sign-out afterward.
  useEffect(() => {
    let cancelled = false;

    const applySession = async (authUser: import('@supabase/supabase-js').User | null) => {
      if (authUser) {
        const u = await ensureProfile(authUser);
        if (cancelled) return;
        setCurrentUser((prev) => prev || u);
        if (u.biometricEnabled && settings.biometricLock) {
          setIsBiometricLocked(true);
        }
        setAppStage((prev) => (prev === 'auth' ? 'main' : prev));
      } else {
        setCurrentUser(null);
        setAppStage((prev) => (prev === 'main' ? 'auth' : prev));
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => applySession(session?.user ?? null));

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session?.user ?? null);
    });
    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Capture ?invite=<code> before any auth redirect can strip it.
  useEffect(() => {
    captureInviteFromUrl();
  }, []);

  // Keep the sound engine in step with the user's preference.
  useEffect(() => {
    sound.setEnabled(settings.soundEffects);
  }, [settings.soundEffects]);

  /**
   * Publish this device's real E2EE public key.
   *
   * Profiles were being created with the literal placeholders 'GEN_KEY' and
   * 'SOVO-E2EE-GEN', so there was never a key to encrypt to — which is why the
   * crypto module existed but every message still went out in clear text.
   */
  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;

    (async () => {
      try {
        const [publicKey, fingerprint] = await Promise.all([
          getPublicKeyB64(),
          getKeyFingerprint(),
        ]);
        if (cancelled) return;
        if (currentUser.e2eePublicKey === publicKey) return;

        const readable = `SOVO-E2EE-${fingerprint.slice(0, 4).toUpperCase()}-${fingerprint
          .slice(4, 8)
          .toUpperCase()}-${fingerprint.slice(8, 12).toUpperCase()}`;

        const { error } = await supabase
          .from('profiles')
          .update({ e2eePublicKey: publicKey, e2eeFingerprint: readable })
          .eq('id', currentUser.id);
        if (error) throw error;

        setCurrentUser((u) =>
          u ? { ...u, e2eePublicKey: publicKey, e2eeFingerprint: readable } : u
        );
      } catch (err) {
        // Messaging still works unencrypted if this fails; don't block the app.
        console.error('Failed to publish E2EE public key', err);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  // Redeem a pending invite link once signed in.
  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    (async () => {
      try {
        const convId = await consumePendingInvite(supabase, currentUser.id);
        if (cancelled || !convId) return;
        const { data } = await supabase
          .from('conversations')
          .select('*')
          .eq('id', convId)
          .maybeSingle();
        if (!cancelled && data) {
          setActiveConversation(data as Conversation);
          setActiveTab('chats');
        }
      } catch (err) {
        console.error('Failed to redeem invite link', err);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

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
    supabase.auth.signOut();
    setCurrentUser(null);
    setActiveConversation(null);
    setAppStage('auth');
  };

  const sortConversations = (list: Conversation[]) =>
    [...list].sort((a, b) => {
      const tA = a.lastMessage?.timestamp || a.createdAt;
      const tB = b.lastMessage?.timestamp || b.createdAt;
      return tB - tA;
    });

  // Load conversations, then keep them live via a realtime channel. Postgres
  // realtime filters can't express "array contains", so we subscribe to all
  // changes on the table and filter client-side against membership.
  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;

    supabase
      .from('conversations')
      .select('*')
      .contains('members', [currentUser.id])
      .then(({ data, error }) => {
        if (error) console.error('Failed to load conversations', error);
        if (!cancelled && data) setConversations(sortConversations(data as Conversation[]));
      });

    const channel = supabase
      .channel(`conversations-${currentUser.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations' },
        (payload) => {
          const row = (payload.new ?? payload.old) as Conversation | undefined;
          if (!row?.members?.includes(currentUser.id)) return;
          setConversations((prev) => {
            let next: Conversation[];
            if (payload.eventType === 'DELETE') {
              next = prev.filter((c) => c.id !== row.id);
            } else {
              const idx = prev.findIndex((c) => c.id === row.id);
              const updated = payload.new as Conversation;
              next = idx >= 0 ? prev.map((c, i) => (i === idx ? updated : c)) : [...prev, updated];
            }
            return sortConversations(next);
          });
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [currentUser]);

  // Resolve the real display name/avatar of the OTHER person in each direct
  // conversation, live. Fetch any member profiles we don't have cached yet,
  // then keep them fresh via realtime so a name/avatar change on either
  // phone shows up on both without needing to reopen the chat.
  useEffect(() => {
    if (!currentUser) return;

    const otherMemberIds = new Set<string>();
    conversations.forEach((c) => {
      if (c.type !== 'direct') return;
      const otherId = c.members.find((m) => m !== currentUser.id);
      if (otherId) otherMemberIds.add(otherId);
    });
    if (otherMemberIds.size === 0) return;

    const idsToFetch = Array.from(otherMemberIds).filter(
      (id) => !fetchedProfileIds.current.has(id)
    );
    if (idsToFetch.length === 0) return;
    idsToFetch.forEach((id) => fetchedProfileIds.current.add(id));

    supabase
      .from('profiles')
      .select('id, displayName, avatarUrl')
      .in('id', idsToFetch)
      .then(({ data, error }) => {
        if (error) {
          console.error('Failed to load conversation partner profiles', error);
          // Allow a retry on the next pass instead of caching the failure.
          idsToFetch.forEach((id) => fetchedProfileIds.current.delete(id));
          return;
        }
        if (!data || data.length === 0) return;
        setMemberProfiles((prev) => {
          const next = { ...prev };
          for (const row of data as { id: string; displayName: string; avatarUrl: string }[]) {
            next[row.id] = { displayName: row.displayName, avatarUrl: row.avatarUrl };
          }
          return next;
        });
      });
  }, [conversations, currentUser]);

  // Live-update a conversation partner's name/avatar if they change it —
  // e.g. so it updates on the other person's screen without a refresh.
  useEffect(() => {
    if (!currentUser) return;
    const watchedIds = new Set<string>();
    conversations.forEach((c) => {
      if (c.type !== 'direct') return;
      const otherId = c.members.find((m) => m !== currentUser.id);
      if (otherId) watchedIds.add(otherId);
    });
    if (watchedIds.size === 0) return;

    const channel = supabase
      .channel(`partner-profiles-${currentUser.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles' },
        (payload) => {
          const row = payload.new as { id: string; displayName: string; avatarUrl: string };
          if (!row?.id || !watchedIds.has(row.id)) return;
          setMemberProfiles((prev) => ({
            ...prev,
            [row.id]: { displayName: row.displayName, avatarUrl: row.avatarUrl },
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversations, currentUser]);

  // A direct conversation's true display name/avatar is always the OTHER
  // member's live profile — never the raw DB row, which only reflects
  // whichever contact name the conversation's creator happened to save.
  // Group conversations are unaffected (their name is the group's own).
  const resolveConversationDisplay = (conv: Conversation): Conversation => {
    if (conv.type !== 'direct' || !currentUser) return conv;
    const otherId = conv.members.find((m) => m !== currentUser.id);
    const profile = otherId ? memberProfiles[otherId] : undefined;
    if (!profile) return conv;
    return { ...conv, name: profile.displayName, avatar: profile.avatarUrl || conv.avatar };
  };

  // Real user directory: every other registered account, used to power "Discover"
  // and @username search instead of a fake local contact-sync simulation.
  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;

    const mapToContacts = (rows: User[]): SyncedContact[] =>
      rows
        .filter((u) => u.id !== currentUser.id)
        .map((u) => ({
          id: u.id,
          name: u.displayName,
          phoneNumber: u.phoneNumber || '',
          isRegistered: true,
          sovoUsername: u.username,
          sovoAvatar: u.avatarUrl,
          sovoUserId: u.id,
          status: u.bio,
        }));

    const loadContacts = () => {
      supabase
        .from('profiles')
        .select('*')
        .then(({ data, error }) => {
          if (error) console.error('Failed to load user directory', error);
          if (!cancelled && data) setSyncedContacts(mapToContacts(data as User[]));
        });
    };
    loadContacts();

    const channel = supabase
      .channel('profiles-directory')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, loadContacts)
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [currentUser]);

  // Real status stories: read from Supabase, grouped by author, dropping
  // anything already expired. Posting a status is handled by handleAddStatus.
  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;

    type StatusRow = StatusItem & {
      authorId: string;
      authorUsername: string;
      authorDisplayName: string;
      authorAvatarUrl: string;
      likedBy?: string[];
    };

    const groupAndSet = (rows: StatusRow[]) => {
      const byUser = new Map<string, UserStatusStory>();
      rows.forEach((data) => {
        const item: StatusItem = {
          id: data.id,
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
      if (!cancelled) setStatusStories(stories);
    };

    const loadStatuses = () => {
      supabase
        .from('statuses')
        .select('*')
        .gt('expiresAt', Date.now())
        .then(({ data, error }) => {
          if (error) console.error('Failed to load statuses', error);
          if (data) groupAndSet(data as StatusRow[]);
        });
    };
    loadStatuses();

    const channel = supabase
      .channel('statuses-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'statuses' }, loadStatuses)
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [currentUser]);

  // Real call log, scoped to calls this account was part of.
  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;

    const loadCalls = () => {
      supabase
        .from('calls')
        .select('*')
        .contains('members', [currentUser.id])
        .then(({ data, error }) => {
          if (error) console.error('Failed to load call log', error);
          if (!cancelled && data) {
            const calls = (data as CallRecord[]).slice().sort((a, b) => b.timestamp - a.timestamp);
            setCallsList(calls);
          }
        });
    };
    loadCalls();

    const channel = supabase
      .channel(`calls-${currentUser.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'calls' },
        (payload) => {
          const row = (payload.new ?? payload.old) as (CallRecord & { members: string[] }) | undefined;
          if (row?.members?.includes(currentUser.id)) loadCalls();
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
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

  /** Collision-proof id. `msg_${Date.now()}` clashed whenever two messages
   *  landed in the same millisecond, and the primary key rejected the second. */
  const newId = (prefix: string) =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? `${prefix}_${crypto.randomUUID()}`
      : `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  /** A published RSA public key is base64 SPKI; the old placeholder was 'GEN_KEY'. */
  const isUsableKey = (key?: string | null) =>
    !!key && key !== 'GEN_KEY' && key.length > 100;

  const peerKeyCache = React.useRef<Record<string, string | null>>({});

  const fetchPeerPublicKey = async (peerId: string): Promise<string | null> => {
    if (peerKeyCache.current[peerId] !== undefined) return peerKeyCache.current[peerId];
    const { data } = await supabase
      .from('profiles')
      .select('e2eePublicKey')
      .eq('id', peerId)
      .maybeSingle();
    const key = isUsableKey(data?.e2eePublicKey) ? (data!.e2eePublicKey as string) : null;
    peerKeyCache.current[peerId] = key;
    return key;
  };

  /** Short, readable preview text for the chat list (never raw ciphertext). */
  const previewFor = (text: string, encrypted: boolean, mediaType?: MediaType) => {
    if (mediaType === 'image') return '\u{1F4F7} Photo';
    if (mediaType === 'video') return '\u{1F3A5} Video';
    if (mediaType === 'voice_note') return '\u{1F3A4} Voice note';
    if (mediaType === 'audio') return '\u{1F3B5} Audio';
    if (mediaType === 'document' || mediaType === 'encrypted_file') return '\u{1F4CE} Attachment';
    if (encrypted) return '\u{1F512} Encrypted message';
    return text;
  };

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

    // Encrypt direct-chat text. Group chats stay in clear text for now (wrapping
    // a key for up to 500 members per message is not viable), and if the peer
    // has not published a key yet we send readable text rather than dropping
    // the message — but we do not then claim it was encrypted.
    let storedText = text;
    let encrypted = false;

    if (text && activeConversation.type === 'direct') {
      const peerId = activeConversation.members.find((m) => m !== currentUser.id);
      if (peerId) {
        try {
          const peerKey = await fetchPeerPublicKey(peerId);
          if (peerKey) {
            storedText = JSON.stringify(await encryptMessage(text, peerKey));
            encrypted = true;
          }
        } catch (err) {
          console.error('Encryption failed; sending unencrypted', err);
        }
      }
    }

    const timestamp = Date.now();
    const newMsg: Message = {
      id: newId('msg'),
      conversationId: activeConversation.id,
      senderId: currentUser.id,
      senderName: currentUser.displayName,
      senderAvatar: currentUser.avatarUrl,
      text: storedText,
      mediaUrl: mediaData?.url,
      mediaType: mediaData?.type,
      fileName: mediaData?.fileName,
      fileSize: mediaData?.fileSize,
      fileSizeBytes: mediaData?.fileSizeBytes,
      audioDurationSeconds: mediaData?.duration,
      isEncrypted: encrypted,
      e2eeFingerprint: activeConversation.e2eeKeyFingerprint,
      // 'sent' is what we can actually attest to. It was hardcoded to 'read',
      // so every message showed blue double-ticks the instant it left, whether
      // or not anyone had opened the chat.
      status: 'sent',
      timestamp,
    };

    setMessagesMap((prev) => ({
      ...prev,
      [activeConversation.id]: [...(prev[activeConversation.id] || []), newMsg],
    }));

    const preview: Message = {
      ...newMsg,
      text: previewFor(text, encrypted, mediaData?.type),
    };

    setConversations((prev) =>
      prev.map((c) => (c.id === activeConversation.id ? { ...c, lastMessage: preview } : c))
    );

    try {
      const { error: msgError } = await supabase.from('messages').insert(newMsg);
      if (msgError) throw msgError;

      // Only the conversation preview is updated here. unreadCount used to be
      // incremented by the *sender*, so your own outgoing messages inflated
      // your own unread badge.
      const { error: convError } = await supabase
        .from('conversations')
        .update({ lastMessage: preview })
        .eq('id', activeConversation.id);
      if (convError) throw convError;
    } catch (e) {
      console.error('Error sending message', e);
      setMessagesMap((prev) => ({
        ...prev,
        [activeConversation.id]: (prev[activeConversation.id] || []).map((m) =>
          m.id === newMsg.id ? { ...m, status: 'sending' } : m
        ),
      }));
    }
  };

  /** Persists a reaction so the other side actually sees it. */
  const handleToggleReaction = async (messageId: string, emoji: string) => {
    if (!currentUser) return;
    const { data, error } = await supabase
      .from('messages')
      .select('userReaction')
      .eq('id', messageId)
      .maybeSingle();
    if (error) {
      console.error('Failed to read reaction', error);
      return;
    }
    const next = data?.userReaction === emoji ? null : emoji;
    const { error: updateError } = await supabase
      .from('messages')
      .update({ userReaction: next })
      .eq('id', messageId);
    if (updateError) console.error('Failed to save reaction', updateError);
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
      `chat-media/statuses/${currentUser.id}/${now}_${file.name}`,
      file,
      { contentType: file.type }
    );
    const { error } = await supabase.from('statuses').insert({
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
    if (error) console.error('Failed to post status', error);
  };

  const handleToggleStatusLike = async (storyUserId: string, itemId: string) => {
    if (!currentUser) return;
    const { error } = await supabase.rpc('toggle_status_like', {
      status_id: itemId,
      liker_id: currentUser.id,
    });
    if (error) console.error('Error toggling status like', error);
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
        const { error } = await supabase
          .from('conversations')
          .upsert(conv, { onConflict: 'id', ignoreDuplicates: true });
        if (error) throw error;
      } catch (e) {
        console.error('Failed to create conversation for status reply', e);
      }
    }

    const newMsg: Message = {
      id: newId('msg'),
      conversationId: conv.id,
      senderId: currentUser.id,
      senderName: currentUser.displayName,
      senderAvatar: currentUser.avatarUrl,
      text: `Replied to status: "${statusItem.caption}":\n${replyText}`,
      mediaUrl: statusItem.mediaUrl,
      mediaType: statusItem.mediaType,
      isEncrypted: false,
      status: 'sent',
      timestamp: Date.now(),
    };

    try {
      const { error: msgError } = await supabase.from('messages').insert(newMsg);
      if (msgError) throw msgError;
      const { error: convError } = await supabase
        .from('conversations')
        .update({ lastMessage: newMsg })
        .eq('id', conv.id);
      if (convError) throw convError;
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
        const { error } = await supabase
          .from('conversations')
          .upsert(newConv, { onConflict: 'id', ignoreDuplicates: true });
        if (error) throw error;
      } catch (e) {
        console.error("Failed to create conversation", e);
      }

      setActiveConversation(newConv);
      setActiveTab('chats');
    }
  };

  const handleCreateGroup = async (newGroup: Conversation) => {
    const { error } = await supabase.from('conversations').insert(newGroup);
    if (error) console.error('Failed to create group', error);
    setActiveConversation(newGroup);
    setActiveTab('chats');
  };

  const handleOpenE2EEFromChat = () => {
    if (activeConversation) {
      const display = resolveConversationDisplay(activeConversation);
      setE2EEPeerInfo({
        id: activeConversation.id,
        name: display.name,
        username: activeConversation.username,
        keyFingerprint: activeConversation.e2eeKeyFingerprint,
      });
      setShowE2EEModal(true);
    }
  };

  // ── Calling ────────────────────────────────────────────────────────────────
  //
  // Calls used to be a front-end illusion: an overlay, a timer, and a call-log
  // row whose durationSeconds was Math.floor(Math.random() * 300) + 30. The
  // person being "called" was never contacted. Everything below drives a real
  // RTCPeerConnection over Supabase Realtime signalling (see lib/webrtc.ts).

  const avatarFor = (peerId: string, peerName: string) =>
    syncedContacts.find((c) => c.sovoUserId === peerId || c.id === peerId)?.sovoAvatar ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(peerName)}&background=222230&color=ffd700`;

  const logCall = async (record: {
    peerId: string;
    peerName: string;
    peerAvatar: string;
    type: CallType;
    direction: 'incoming' | 'outgoing' | 'missed';
    status: 'completed' | 'missed' | 'declined';
    durationSeconds: number;
  }) => {
    if (!currentUser) return;
    try {
      const { error } = await supabase.from('calls').insert({
        id: newId('call'),
        peerId: record.peerId,
        peerName: record.peerName,
        peerUsername:
          syncedContacts.find((c) => c.sovoUserId === record.peerId)?.sovoUsername || '',
        peerAvatar: record.peerAvatar,
        type: record.type,
        direction: record.direction,
        status: record.status,
        durationSeconds: record.durationSeconds,
        timestamp: Date.now(),
        isEncrypted: true,
        members: [currentUser.id, record.peerId],
      });
      if (error) throw error;
    } catch (e) {
      console.error('Failed to save call record', e);
    }
  };

  const resetCallState = () => {
    setActiveCall(null);
    setCallState('idle');
    setLocalStream(null);
    setRemoteStream(null);
    setCallError(null);
    sound.stopRinging();
  };

  const buildCallHandlers = (meta: {
    peerId: string;
    peerName: string;
    peerAvatar: string;
    type: CallType;
    direction: 'incoming' | 'outgoing';
  }) => ({
    onStateChange: setCallState,
    onLocalStream: setLocalStream,
    onRemoteStream: (stream: MediaStream) => setRemoteStream(stream),
    onError: (message: string) => setCallError(message),
    onEnded: (reason: CallEndReason, durationSeconds: number) => {
      void logCall({
        peerId: meta.peerId,
        peerName: meta.peerName,
        peerAvatar: meta.peerAvatar,
        type: meta.type,
        direction: meta.direction,
        status:
          durationSeconds > 0
            ? 'completed'
            : reason === 'declined'
            ? 'declined'
            : 'missed',
        durationSeconds,
      });
      // Leave a failure on screen briefly so the reason is readable.
      if (reason === 'failed' || reason === 'permission-denied') {
        setCallState('ended');
        setTimeout(resetCallState, 2500);
      } else {
        resetCallState();
      }
    },
  });

  const handleStartCall = async (peerId: string, peerName: string, type: CallType) => {
    if (!currentUser) return;
    sound.resume();
    sound.playTap();

    if (!callingSupported()) {
      setCallError('This device cannot place calls.');
      return;
    }
    if (activeCall || incomingInvite) return;

    const peerAvatar = avatarFor(peerId, peerName);
    const meta = { peerId, peerName, peerAvatar, type, direction: 'outgoing' as const };

    const session = new SovoCall({
      peerId,
      type,
      isCaller: true,
      handlers: buildCallHandlers(meta),
    });

    setCallError(null);
    setActiveCall({ session, ...meta });
    setCallState('ringing-out');

    await session.place({
      id: currentUser.id,
      name: currentUser.displayName,
      avatar: currentUser.avatarUrl,
    });
  };

  const handleEndCall = () => {
    sound.playTap();
    void activeCall?.session.hangup();
  };

  // Refs so the invite listener always sees current values without resubscribing.
  const activeCallRef = React.useRef(activeCall);
  const incomingInviteRef = React.useRef(incomingInvite);
  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);
  useEffect(() => {
    incomingInviteRef.current = incomingInvite;
  }, [incomingInvite]);

  // Listen for incoming calls for as long as the user is signed in.
  useEffect(() => {
    if (!currentUser) return;
    const unsubscribe = listenForIncomingCalls(
      currentUser.id,
      (invite) => {
        // Busy: refuse rather than silently dropping the caller.
        if (activeCallRef.current || incomingInviteRef.current) {
          void new SovoCall({
            callId: invite.callId,
            peerId: invite.fromUserId,
            type: invite.type,
            isCaller: false,
          }).decline(currentUser.id);
          return;
        }
        setIncomingInvite(invite);
      },
      (callId) => {
        // The caller hung up before we answered.
        setIncomingInvite((prev) => {
          if (prev?.callId !== callId) return prev;
          void logCall({
            peerId: prev.fromUserId,
            peerName: prev.fromName,
            peerAvatar: prev.fromAvatar,
            type: prev.type,
            direction: 'incoming',
            status: 'missed',
            durationSeconds: 0,
          });
          return null;
        });
      }
    );
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  const handleAcceptIncomingCall = async () => {
    if (!currentUser || !incomingInvite) return;
    const invite = incomingInvite;
    setIncomingInvite(null);
    sound.stopRinging();
    sound.resume();

    const meta = {
      peerId: invite.fromUserId,
      peerName: invite.fromName,
      peerAvatar: invite.fromAvatar,
      type: invite.type,
      direction: 'incoming' as const,
    };

    const session = new SovoCall({
      callId: invite.callId,
      peerId: invite.fromUserId,
      type: invite.type,
      isCaller: false,
      handlers: buildCallHandlers(meta),
    });

    setCallError(null);
    setActiveCall({ session, ...meta });
    setCallState('connecting');
    await session.accept(currentUser.id);
  };

  const handleDeclineIncomingCall = async () => {
    if (!currentUser || !incomingInvite) return;
    const invite = incomingInvite;
    setIncomingInvite(null);
    sound.stopRinging();

    await new SovoCall({
      callId: invite.callId,
      peerId: invite.fromUserId,
      type: invite.type,
      isCaller: false,
    }).decline(currentUser.id);

    void logCall({
      peerId: invite.fromUserId,
      peerName: invite.fromName,
      peerAvatar: invite.fromAvatar,
      type: invite.type,
      direction: 'incoming',
      status: 'declined',
      durationSeconds: 0,
    });
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

        {/* Material 3 Top App Bar — hidden while a status is open full-screen,
            so nothing but the story content is visible (Instagram/Snapchat-
            style immersive viewer). */}
        {activeTab !== 'statuses' && (
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
        )}

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col relative overflow-hidden">
          {/* Active Chat Conversation Room or Tab View */}
          {activeConversation ? (
            <ChatRoom
              conversation={resolveConversationDisplay(activeConversation)}
              messages={messagesMap[activeConversation.id] || []}
              currentUser={currentUser}
              settings={settings}
              onBack={() => setActiveConversation(null)}
              onSendMessage={handleSendMessage}
              onOpenE2EEModal={handleOpenE2EEFromChat}
              onStartCall={(type) => {
                const peerId = activeConversation.members.find((m) => m !== currentUser.id);
                if (!peerId || activeConversation.type === 'group') {
                  // Group calling needs an SFU; don't pretend to place one.
                  setCallError('Group calls are not supported yet — open a direct chat to call.');
                  return;
                }
                void handleStartCall(peerId, resolveConversationDisplay(activeConversation).name, type);
              }}
              onToggleReaction={handleToggleReaction}
            />
          ) : (
            <>
              {/* Tab 1: Chats (Default Dashboard) */}
              {activeTab === 'chats' && (
                <ChatsView
                  conversations={conversations.map(resolveConversationDisplay)}
                  statusStories={statusStories}
                  currentUser={currentUser}
                  settings={settings}
                  onSelectConversation={(conv) => setActiveConversation(conv)}
                  onOpenNewGroup={() => setShowGroupCreateModal(true)}
                  onOpenSyncContacts={() => setShowSyncContactsModal(true)}
                  onOpenReelsView={(userId) => {
                    setStatusViewerUserId(userId ?? null);
                    setActiveTab('statuses');
                  }}
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
                  initialUserId={statusViewerUserId ?? undefined}
                  onClose={() => {
                    setStatusViewerUserId(null);
                    setActiveTab('chats');
                  }}
                />
              )}

              {/* Tab 3: Calls Log */}
              {activeTab === 'calls' && (
                <CallsView
                  calls={callsList}
                  currentUser={currentUser}
                  onInitiateCall={(peerId, peerName, type) => {
                    void handleStartCall(peerId, peerName, type);
                  }}
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
                      const { error } = await supabase
                        .from('profiles')
                        .update(updated)
                        .eq('id', currentUser.id);
                      if (error) throw error;
                    } catch (e) {
                      console.error('Failed to persist profile update', e);
                    }
                  }}
                  onUploadAvatar={async (file) => {
                    const avatarUrl = await uploadFileToStorage(
                      `avatars/${currentUser.id}/${Date.now()}_${file.name}`,
                      file,
                      { contentType: file.type }
                    );
                    const { error } = await supabase
                      .from('profiles')
                      .update({ avatarUrl })
                      .eq('id', currentUser.id);
                    if (error) console.error('Failed to persist avatar update', error);
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

        {/* Material 3 Android Bottom Navigation Bar (Visible when not in active
            chat room, and hidden during the full-screen status viewer) */}
        {!activeConversation && activeTab !== 'statuses' && (
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
              className="flex flex-col items-center gap-0.5 transition cursor-pointer flex-1 py-2 nav-tap-target"
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
              className="flex flex-col items-center gap-0.5 transition cursor-pointer flex-1 py-2 nav-tap-target"
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
                setStatusViewerUserId(null);
                setActiveTab('statuses');
              }}
              className="flex flex-col items-center gap-0.5 transition cursor-pointer flex-1 py-2 nav-tap-target"
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
              className="flex flex-col items-center gap-0.5 transition cursor-pointer flex-1 py-2 nav-tap-target"
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
              className="flex flex-col items-center gap-0.5 transition cursor-pointer flex-1 py-2 nav-tap-target"
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

        {/* Android System Navigation Gesture Bar at bottom — hidden during
            the full-screen status viewer for a true edge-to-edge immersive
            view; the viewer has its own close (X) button instead. */}
        {activeTab !== 'statuses' && (
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
        )}
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

      {/* Incoming call ring screen */}
      {incomingInvite && !activeCall && (
        <IncomingCallModal
          invite={incomingInvite}
          onAccept={() => void handleAcceptIncomingCall()}
          onDecline={() => void handleDeclineIncomingCall()}
        />
      )}

      {/* Live call screen, bound to the real MediaStreams */}
      {activeCall && (
        <ActiveCallOverlay
          peerName={activeCall.peerName}
          peerAvatar={activeCall.peerAvatar}
          callType={activeCall.type}
          callState={callState}
          localStream={localStream}
          remoteStream={remoteStream}
          errorMessage={callError}
          onToggleMute={(muted) => activeCall.session.setMuted(muted)}
          onToggleCamera={(off) => activeCall.session.setCameraOff(off)}
          onSwitchCamera={() => void activeCall.session.switchCamera()}
          onEndCall={handleEndCall}
        />
      )}

      {/* Call failures that happen before an overlay exists (e.g. group call) */}
      {!activeCall && callError && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[70] px-4 py-2.5 rounded-xl bg-red-950/90 border border-red-700 text-xs text-red-100 shadow-2xl max-w-xs text-center">
          {callError}
          <button
            type="button"
            onClick={() => setCallError(null)}
            className="ml-2 text-red-300 hover:text-white font-bold"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}



