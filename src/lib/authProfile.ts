import { User as AuthUser } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { User } from '../types';

/**
 * Given a Supabase auth user (from sign-up, sign-in, or OAuth), returns the
 * matching row from the public.profiles table — creating one from the auth
 * user's metadata first if it doesn't exist yet (e.g. the profile insert
 * during sign-up failed or was interrupted, or this is a first-time OAuth
 * login). Centralizing this avoids the "fallback profile" object being
 * duplicated (and drifting) across every sign-in path.
 */
export async function ensureProfile(authUser: AuthUser, displayNameHint?: string): Promise<User> {
  const { data: existing, error: selectError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authUser.id)
    .maybeSingle();

  if (selectError) {
    console.error('Failed to look up profile', selectError);
  }
  if (existing) return existing as User;

  const fallbackName =
    displayNameHint ||
    (authUser.user_metadata?.display_name as string | undefined) ||
    (authUser.user_metadata?.full_name as string | undefined) ||
    authUser.email?.split('@')[0] ||
    "S'ovo User";

  const username = (authUser.email?.split('@')[0] || authUser.id)
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_');

  const newProfile: User = {
    id: authUser.id,
    username,
    displayName: fallbackName,
    phoneNumber: authUser.phone || '',
    avatarUrl:
      (authUser.user_metadata?.avatar_url as string | undefined) ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(fallbackName)}&background=222230&color=ffd700`,
    bio: "Hey there! I am using S'ovo.",
    isOnline: true,
    lastSeen: Date.now(),
    joinedAt: new Date().toISOString(),
    devicesCount: 1,
    biometricEnabled: false,
    pinCode: '0000',
    e2eePublicKey: 'GEN_KEY',
    e2eeFingerprint: 'SOVO-E2EE-GEN',
  };

  const { error: insertError } = await supabase.from('profiles').insert(newProfile);
  if (insertError) {
    console.error('Failed to create profile row', insertError);
  }
  return newProfile;
}
