import type { User, UserSettings } from '../types';

/**
 * Small on-device persistence layer so the app opens straight into the signed-in
 * UI and keeps the user's settings, instead of resetting on every launch.
 *
 * Why a profile cache: the Supabase session token already persists, but the app
 * rebuilt `currentUser` from a network call on every start. Offline, that call
 * failed and the app either showed the login screen or fabricated a blank
 * profile. The cached copy lets us open instantly and refresh in the background.
 */

const SETTINGS_KEY = 'sovo.settings.v1';
const PROFILE_KEY = 'sovo.profile.v1';

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or unavailable — persistence is best-effort */
  }
}

export function loadSettings(defaults: UserSettings): UserSettings {
  const saved = readJson<Partial<UserSettings>>(SETTINGS_KEY);
  // activeDevicePlatform describes *this* run, so it is never restored.
  return { ...defaults, ...(saved ?? {}), activeDevicePlatform: defaults.activeDevicePlatform };
}

export function saveSettings(settings: UserSettings) {
  writeJson(SETTINGS_KEY, settings);
}

export function loadCachedProfile(): User | null {
  const u = readJson<User>(PROFILE_KEY);
  return u && typeof u.id === 'string' ? u : null;
}

export function cacheProfile(user: User) {
  writeJson(PROFILE_KEY, user);
}

export function clearCachedProfile() {
  try {
    localStorage.removeItem(PROFILE_KEY);
  } catch {
    /* ignore */
  }
}
