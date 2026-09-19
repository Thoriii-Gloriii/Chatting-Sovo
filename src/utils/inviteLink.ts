/**
 * inviteLink.ts
 * Handles invite-link generation and handling for S'ovo Chat.
 *
 * Flow (sender side):
 *   1. Call getOrCreateInviteCode() → gets/creates a code in Supabase via get_my_invite_code()
 *   2. Call buildInviteUrl(code) → returns the shareable URL
 *   3. Share URL via Web Share API / clipboard
 *
 * Flow (receiver side):
 *   1. App loads → captureInviteFromUrl() saves the code to localStorage
 *   2. After Google sign-in redirects back, the code is still in localStorage
 *   3. Call consumePendingInvite(supabase, currentUserId) → opens a direct chat
 */

import { createClient } from "@supabase/supabase-js";

const INVITE_STORAGE_KEY = "sovo_pending_invite";

/** The base URL where GitHub Pages hosts the app. */
const APP_BASE = `${window.location.origin}${window.location.pathname.replace(/\/$/, "")}`;

// ─── Sender side ─────────────────────────────────────────────────────────────

/**
 * Fetches the current user's invite code from Supabase.
 * Creates one automatically if it doesn't exist yet.
 */
export async function getOrCreateInviteCode(
  supabase: ReturnType<typeof createClient>
): Promise<string> {
  const { data, error } = await supabase.rpc("get_my_invite_code");
  if (error) throw error;
  return data as string;
}

/**
 * Builds the shareable invite URL.
 * e.g. https://thoriii-gloriii.github.io/Chatting-Sovo/?invite=abc123
 */
export function buildInviteUrl(code: string): string {
  return `${APP_BASE}/?invite=${encodeURIComponent(code)}`;
}

/**
 * Shares the invite link using the Web Share API,
 * falling back to copying it to the clipboard.
 */
export async function shareInviteLink(code: string): Promise<void> {
  const url = buildInviteUrl(code);
  const shareData = {
    title: "Chat with me on S'ovo",
    text: "Tap to open a chat with me on S'ovo Chat:",
    url,
  };

  if (navigator.share) {
    try {
      await navigator.share(shareData);
      return;
    } catch (_) {
      // User cancelled or share failed — fall through to clipboard
    }
  }

  await navigator.clipboard.writeText(url);
  alert("Invite link copied to clipboard!");
}

// ─── Receiver side ───────────────────────────────────────────────────────────

/**
 * Call this ONCE when the app loads (before any auth redirect).
 * Reads ?invite=CODE from the current URL and saves it to localStorage,
 * then strips the param from the URL so sign-in redirects don't lose it.
 */
export function captureInviteFromUrl(): void {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("invite");
  if (!code) return;

  localStorage.setItem(INVITE_STORAGE_KEY, code);

  // Remove ?invite=... from the URL bar without a page reload
  params.delete("invite");
  const newSearch = params.toString();
  const newUrl =
    window.location.pathname + (newSearch ? `?${newSearch}` : "");
  window.history.replaceState({}, "", newUrl);
}

/**
 * After the user has signed in, call this to check for a pending invite.
 * If one exists:
 *   - resolves the code to the sender's userId via resolve_invite()
 *   - calls start_direct_chat() to open or create the conversation
 *   - clears the pending invite from storage
 *
 * Returns the conversationId if a chat was opened, or null otherwise.
 */
export async function consumePendingInvite(
  supabase: ReturnType<typeof createClient>,
  currentUserId: string
): Promise<string | null> {
  const code = localStorage.getItem(INVITE_STORAGE_KEY);
  if (!code) return null;

  // Clear early so a failed attempt doesn't loop
  localStorage.removeItem(INVITE_STORAGE_KEY);

  // Look up the sender by code
  const { data: senderId, error: resolveErr } = await supabase.rpc(
    "resolve_invite",
    { p_code: code }
  );
  if (resolveErr || !senderId) {
    console.warn("Invalid or expired invite code:", code);
    return null;
  }

  // Don't open a chat with yourself
  if (senderId === currentUserId) return null;

  // Open or create the direct conversation safely
  const { data: convId, error: chatErr } = await supabase.rpc(
    "start_direct_chat",
    { other_user_id: senderId }
  );
  if (chatErr) {
    console.error("start_direct_chat error:", chatErr);
    return null;
  }

  return convId as string;
}

/** True if there is an unprocessed invite waiting in storage. */
export function hasPendingInvite(): boolean {
  return !!localStorage.getItem(INVITE_STORAGE_KEY);
}
