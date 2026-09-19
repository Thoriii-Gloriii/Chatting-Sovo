/**
 * e2ee.ts  –  End-to-end encryption for S'ovo Chat
 *
 * Scheme (adapted from shub-garg/E2E-Chat-Application-with-Encryption, MIT):
 *   • Each device generates an RSA-OAEP key pair on first run.
 *   • The public key is stored in profiles.e2eePublicKey (base64-encoded SPKI).
 *   • To send a message:
 *       1. Generate a random AES-GCM 256 key.
 *       2. Encrypt the plaintext with AES-GCM.
 *       3. Wrap the AES key with RSA-OAEP for the recipient AND for yourself
 *          (so you can read your own sent messages).
 *       4. Store: iv, ciphertext, wrappedKeyForRecipient, wrappedKeyForSender.
 *   • To decrypt a message:
 *       1. Identify which wrappedKey is yours (sender or recipient).
 *       2. Unwrap the AES key with your RSA private key.
 *       3. Decrypt the ciphertext with the AES key + stored iv.
 *
 * Limitations (acceptable trade-offs):
 *   • Clearing app data / switching devices = cannot read old messages.
 *     (A passphrase-protected key export can be added later.)
 *   • Group chats: NOT encrypted (wrapping for N members is too heavy).
 *   • Existing messages stay as plain text; only new ones are encrypted.
 *   • Images / voice notes: NOT encrypted yet.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EncryptedPayload {
  /** AES-GCM initialisation vector, base64 */
  iv: string;
  /** Encrypted message body, base64 */
  ciphertext: string;
  /** AES key wrapped for the message SENDER, base64 */
  wrappedKeyForSender: string;
  /** AES key wrapped for the message RECIPIENT, base64 */
  wrappedKeyForRecipient: string;
}

// ─── Key storage keys ─────────────────────────────────────────────────────────

const LS_PRIVATE_KEY = "sovo_e2ee_privateKey";
const LS_PUBLIC_KEY = "sovo_e2ee_publicKey";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buf2b64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function b642buf(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

const RSA_PARAMS: RsaHashedKeyGenParams = {
  name: "RSA-OAEP",
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: "SHA-256",
};

// ─── Key management ───────────────────────────────────────────────────────────

/**
 * Returns the local RSA key pair, generating and persisting it if needed.
 * Call once on app init; the result is safe to cache for the session.
 */
export async function getOrCreateKeyPair(): Promise<CryptoKeyPair> {
  const storedPriv = localStorage.getItem(LS_PRIVATE_KEY);
  const storedPub = localStorage.getItem(LS_PUBLIC_KEY);

  if (storedPriv && storedPub) {
    const privateKey = await crypto.subtle.importKey(
      "pkcs8",
      b642buf(storedPriv),
      RSA_PARAMS,
      false,
      ["unwrapKey"]
    );
    const publicKey = await crypto.subtle.importKey(
      "spki",
      b642buf(storedPub),
      RSA_PARAMS,
      true,
      ["wrapKey"]
    );
    return { privateKey, publicKey };
  }

  const pair = await crypto.subtle.generateKey(RSA_PARAMS, true, [
    "wrapKey",
    "unwrapKey",
  ]);

  const privBuf = await crypto.subtle.exportKey("pkcs8", pair.privateKey);
  const pubBuf = await crypto.subtle.exportKey("spki", pair.publicKey);
  localStorage.setItem(LS_PRIVATE_KEY, buf2b64(privBuf));
  localStorage.setItem(LS_PUBLIC_KEY, buf2b64(pubBuf));

  return pair;
}

/**
 * Returns the base64-encoded SPKI public key for this device.
 * This is what gets stored in profiles.e2eePublicKey.
 */
export async function getPublicKeyB64(): Promise<string> {
  const { publicKey } = await getOrCreateKeyPair();
  const buf = await crypto.subtle.exportKey("spki", publicKey);
  return buf2b64(buf);
}

/**
 * Imports a recipient's public key from the base64 string stored in their profile.
 */
async function importPublicKey(b64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("spki", b642buf(b64), RSA_PARAMS, false, [
    "wrapKey",
  ]);
}

/**
 * Returns the fingerprint (SHA-256 hex) of the local public key.
 * Show this on the "Verify contact" / safety number screen.
 */
export async function getKeyFingerprint(): Promise<string> {
  const { publicKey } = await getOrCreateKeyPair();
  const spki = await crypto.subtle.exportKey("spki", publicKey);
  const hash = await crypto.subtle.digest("SHA-256", spki);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ─── Encrypt / Decrypt ────────────────────────────────────────────────────────

/**
 * Encrypts a plaintext string for a direct chat.
 *
 * @param plaintext          The message text to encrypt.
 * @param recipientPubKeyB64 The recipient's profiles.e2eePublicKey value.
 * @returns                  An EncryptedPayload to store in messages.text.
 */
export async function encryptMessage(
  plaintext: string,
  recipientPubKeyB64: string
): Promise<EncryptedPayload> {
  const { publicKey: myPublicKey } = await getOrCreateKeyPair();
  const recipientPublicKey = await importPublicKey(recipientPubKeyB64);

  // 1. Generate a fresh AES-GCM key for this message
  const aesKey = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );

  // 2. Encrypt the message
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertextBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    encoded
  );

  // 3. Wrap the AES key for both parties (so sender can read their own sent msgs)
  const wrapForRecipient = await crypto.subtle.wrapKey(
    "raw",
    aesKey,
    recipientPublicKey,
    { name: "RSA-OAEP" }
  );
  const wrapForSender = await crypto.subtle.wrapKey(
    "raw",
    aesKey,
    myPublicKey,
    { name: "RSA-OAEP" }
  );

  return {
    iv: buf2b64(iv.buffer),
    ciphertext: buf2b64(ciphertextBuf),
    wrappedKeyForSender: buf2b64(wrapForSender),
    wrappedKeyForRecipient: buf2b64(wrapForRecipient),
  };
}

/**
 * Decrypts a message.
 *
 * @param payload      The EncryptedPayload stored in messages.text.
 * @param iAmTheSender Pass true if auth.uid() === message.senderId.
 * @returns            The decrypted plaintext, or null on failure.
 */
export async function decryptMessage(
  payload: EncryptedPayload,
  iAmTheSender: boolean
): Promise<string | null> {
  try {
    const { privateKey } = await getOrCreateKeyPair();
    const wrappedKey = iAmTheSender
      ? payload.wrappedKeyForSender
      : payload.wrappedKeyForRecipient;

    // Unwrap the AES key with our RSA private key
    const aesKey = await crypto.subtle.unwrapKey(
      "raw",
      b642buf(wrappedKey),
      privateKey,
      { name: "RSA-OAEP" },
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"]
    );

    // Decrypt the message
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: b642buf(payload.iv) },
      aesKey,
      b642buf(payload.ciphertext)
    );

    return new TextDecoder().decode(decrypted);
  } catch (err) {
    console.error("Decryption failed:", err);
    return null;
  }
}

/**
 * Tries to parse a message's text field as an EncryptedPayload.
 * Returns null if the text is plain (unencrypted legacy message).
 */
export function parseEncryptedText(text: string): EncryptedPayload | null {
  try {
    const parsed = JSON.parse(text);
    if (
      parsed &&
      typeof parsed.iv === "string" &&
      typeof parsed.ciphertext === "string" &&
      typeof parsed.wrappedKeyForSender === "string" &&
      typeof parsed.wrappedKeyForRecipient === "string"
    ) {
      return parsed as EncryptedPayload;
    }
  } catch (_) {}
  return null;
}
