import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { supabase } from './supabase';

// Push notifications for new messages while the app is closed or in the
// background. Only runs inside the Android app; on the web it does nothing.
// Setup steps are in supabase/PUSH_SETUP.md.

const TOKEN_KEY = 'sovo.pushToken';
const CHANNEL_ID = 'messages';

let started = false;
let registeredFor: string | null = null;

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage unavailable. The token is simply fetched again next launch.
  }
}

async function saveToken(token: string): Promise<void> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return;
  const { error } = await supabase.rpc('register_device_token', {
    p_token: token,
    p_platform: 'android',
  });
  if (error) console.error('Could not save push token', error);
}

async function enablePush(): Promise<void> {
  let status = (await PushNotifications.checkPermissions()).receive;
  if (status === 'prompt' || status === 'prompt-with-rationale') {
    status = (await PushNotifications.requestPermissions()).receive;
  }
  if (status !== 'granted') return;

  await PushNotifications.createChannel({
    id: CHANNEL_ID,
    name: 'Messages',
    description: 'New message alerts',
    importance: 4,
    visibility: 0,
    vibration: true,
  });
  await PushNotifications.register();
}

export function initPush(): void {
  if (started || !Capacitor.isNativePlatform()) return;
  started = true;

  void PushNotifications.addListener('registration', (t) => {
    writeToken(t.value);
    void saveToken(t.value);
  });

  void PushNotifications.addListener('registrationError', (err) => {
    console.error('Push registration failed', err);
  });

  void PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    const conversationId = action.notification.data?.conversationId;
    if (conversationId) {
      window.dispatchEvent(
        new CustomEvent('sovo:open-conversation', { detail: { conversationId } })
      );
    }
  });

  supabase.auth.onAuthStateChange((event, session) => {
    // Deferred so no Supabase call runs inside the auth callback itself.
    setTimeout(() => {
      if (session?.user) {
        if (registeredFor === session.user.id) return;
        registeredFor = session.user.id;
        enablePush().catch((e) => console.error('Push setup failed', e));
        const known = readToken();
        if (known) void saveToken(known);
      } else if (event === 'SIGNED_OUT') {
        registeredFor = null;
        const token = readToken();
        writeToken(null);
        if (token) {
          supabase
            .rpc('unregister_device_token', { p_token: token })
            .then(({ error }) => {
              if (error) console.error('Could not remove push token', error);
            });
        }
      }
    }, 0);
  });
}
