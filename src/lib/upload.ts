import { supabase } from './supabase';

/**
 * Uploads a file to Supabase Storage under the given path and returns its
 * public download URL. Used for profile pictures, status media, and chat
 * attachments so real files (not local blob: URLs) are shared between users.
 *
 * Path format:  "<bucket>/<rest-of-path>"
 *   avatars/<uid>/filename        → bucket: avatars
 *   statuses/<uid>/filename       → bucket: chat-media
 *   <convId>/filename             → bucket: chat-media
 */
export async function uploadFileToStorage(path: string, file: File | Blob): Promise<string> {
  // Determine bucket from path prefix
  let bucket = 'chat-media';
  let filePath = path;

  if (path.startsWith('avatars/')) {
    bucket = 'avatars';
    filePath = path.slice('avatars/'.length);
  } else if (path.startsWith('statuses/')) {
    // keep full path under chat-media
    filePath = path;
  }

  const { error } = await supabase.storage.from(bucket).upload(filePath, file, {
    upsert: true,
    cacheControl: '3600',
  });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
  return data.publicUrl;
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB

export function validateImageFile(file: File): string | null {
  if (!file.type.startsWith('image/')) return 'Please choose an image file.';
  if (file.size > MAX_IMAGE_BYTES) return 'Image must be smaller than 10MB.';
  return null;
}
