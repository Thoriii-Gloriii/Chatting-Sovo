import { supabase } from './supabase';

/**
 * Supabase Storage helpers.
 *
 * Buckets (see supabase/schema.sql):
 *   avatars     — profile pictures
 *   chat-media  — status media and chat attachments
 *
 * Callers pass a logical path; this module decides the bucket and strips the
 * bucket name off the object key. Previously a caller that passed
 * "chat-media/<conv>/<file>" had the prefix left in place, producing the key
 * "chat-media/chat-media/<conv>/<file>" inside the chat-media bucket — the
 * upload still succeeded, so nothing looked broken, but every attachment was
 * filed one directory deeper than the storage policies and cleanup logic
 * expect. Both spellings are now normalised to the same key.
 */

/** Object keys must be ASCII-safe: strip anything that would need escaping. */
function sanitizeSegment(segment: string): string {
  const cleaned = segment
    .normalize('NFKD')
    .replace(/[^\w.\- ]+/g, '')
    .replace(/\s+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^[._]+/, '');
  return cleaned.length ? cleaned.slice(-120) : 'file';
}

/** Splits "<maybe-bucket>/<rest>" into the real bucket plus a clean object key. */
function resolveTarget(path: string): { bucket: string; key: string } {
  const parts = path.split('/').filter(Boolean);

  let bucket = 'chat-media';
  if (parts[0] === 'avatars') {
    bucket = 'avatars';
    parts.shift();
  } else if (parts[0] === 'chat-media') {
    parts.shift();
  }

  const key = parts.map(sanitizeSegment).join('/');
  return { bucket, key: key || `misc/${Date.now()}` };
}

export interface UploadOptions {
  /** Called with 0-100 as the upload advances. */
  onProgress?: (percent: number) => void;
  /** Explicit MIME type; inferred from the Blob when omitted. */
  contentType?: string;
}

/**
 * Uploads a file to Supabase Storage and returns its public download URL.
 * Throws with a readable message on failure so callers can surface it.
 */
export async function uploadFileToStorage(
  path: string,
  file: File | Blob,
  options: UploadOptions = {}
): Promise<string> {
  const { bucket, key } = resolveTarget(path);
  const contentType = options.contentType || file.type || 'application/octet-stream';

  options.onProgress?.(5);

  const { error } = await supabase.storage.from(bucket).upload(key, file, {
    upsert: true,
    cacheControl: '3600',
    contentType,
  });

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  options.onProgress?.(95);

  const { data } = supabase.storage.from(bucket).getPublicUrl(key);
  if (!data?.publicUrl) {
    throw new Error('Upload succeeded but no public URL was returned.');
  }

  options.onProgress?.(100);
  return data.publicUrl;
}

/** 25MB — the practical ceiling for a Supabase free-tier storage object. */
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export function validateImageFile(file: File): string | null {
  if (!file.type.startsWith('image/')) return 'Please choose an image file.';
  if (file.size > MAX_IMAGE_BYTES) return 'Image must be smaller than 10MB.';
  return null;
}

/** Shared guard for status media and chat attachments. */
export function validateAttachment(file: File, maxBytes = MAX_ATTACHMENT_BYTES): string | null {
  if (file.size === 0) return 'That file is empty.';
  if (file.size > maxBytes) {
    return `File is ${(file.size / 1024 / 1024).toFixed(1)}MB — the limit is ${Math.round(
      maxBytes / 1024 / 1024
    )}MB.`;
  }
  return null;
}
