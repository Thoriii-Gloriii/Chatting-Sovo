import { storage, ref, uploadBytes, getDownloadURL } from './firebase';

/**
 * Uploads a file to Firebase Storage under the given path and returns its
 * public download URL. Used for profile pictures, status media, and chat
 * attachments so real files (not local blob: URLs) are shared between users.
 */
export async function uploadFileToStorage(path: string, file: File | Blob): Promise<string> {
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, file);
  return getDownloadURL(fileRef);
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB

export function validateImageFile(file: File): string | null {
  if (!file.type.startsWith('image/')) return 'Please choose an image file.';
  if (file.size > MAX_IMAGE_BYTES) return 'Image must be smaller than 10MB.';
  return null;
}
