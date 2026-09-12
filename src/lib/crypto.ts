/**
 * End-to-End Encryption (E2EE) and Privacy Cryptographic Utility for S'ovo
 * Simulates Signal-protocol style double ratchet & public-key fingerprint verification.
 */

// Generate a readable 60-digit security code formatted in blocks of 5 digits
export function generateSafetyNumber(userId1: string, userId2: string): string {
  // Deterministic seed based on sorted IDs
  const combined = [userId1, userId2].sort().join(':');
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    hash = (hash << 5) - hash + combined.charCodeAt(i);
    hash |= 0;
  }
  
  const blocks: string[] = [];
  let seed = Math.abs(hash) + 123456789;
  for (let i = 0; i < 12; i++) {
    seed = (seed * 9301 + 49297) % 233280;
    const num = Math.floor(10000 + (seed / 233280) * 89999);
    blocks.push(num.toString());
  }
  return blocks.join(' ');
}

// Generate key fingerprint
export function generateKeyFingerprint(id: string): string {
  let hash = 5381;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 33) ^ id.charCodeAt(i);
  }
  const hex = Math.abs(hash).toString(16).toUpperCase().padStart(8, 'A');
  return `SOVO-E2EE-${hex.slice(0, 4)}-${hex.slice(4, 8)}-${Date.now().toString(16).slice(-4).toUpperCase()}`;
}

// Hash phone number for privacy-preserving contact matching
export function hashPhoneNumber(phone: string): string {
  const sanitized = phone.replace(/[^0-9+]/g, '');
  let hash = 0;
  for (let i = 0; i < sanitized.length; i++) {
    hash = ((hash << 5) - hash) + sanitized.charCodeAt(i);
    hash |= 0;
  }
  return 'ph_' + Math.abs(hash).toString(16);
}

// Format relative expiration time for statuses (e.g. "Expires in 18h", "3-Day VIP (Expires in 2d)")
export function formatStoryExpiration(expiresAt: number, durationDays: 1 | 3): {
  label: string;
  is3Day: boolean;
  timeLeft: string;
  percentRemaining: number;
} {
  const now = Date.now();
  const totalDurationMs = durationDays * 24 * 60 * 60 * 1000;
  const remainingMs = Math.max(0, expiresAt - now);
  const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
  const remainingMinutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
  const percentRemaining = Math.max(0, Math.min(100, (remainingMs / totalDurationMs) * 100));

  let timeLeft = '';
  if (remainingHours >= 24) {
    const days = Math.floor(remainingHours / 24);
    const hours = remainingHours % 24;
    timeLeft = `${days}d ${hours}h left`;
  } else if (remainingHours > 0) {
    timeLeft = `${remainingHours}h ${remainingMinutes}m left`;
  } else {
    timeLeft = `${remainingMinutes}m left`;
  }

  const is3Day = durationDays === 3;
  const label = is3Day ? `3-Day VIP • ${timeLeft}` : `24h Status • ${timeLeft}`;

  return { label, is3Day, timeLeft, percentRemaining };
}

// Format bytes into readable size (e.g. 1.4 GB / 2 GB)
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
