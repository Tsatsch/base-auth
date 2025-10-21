/**
 * Enhanced Cryptography Module
 * Uses Web Crypto API with AES-256-GCM for secure client-side encryption
 * Key derivation from wallet address using PBKDF2
 */

const ITERATIONS = 100000; // PBKDF2 iterations for key derivation
const KEY_LENGTH = 256; // AES-256

/**
 * Converts a string to Uint8Array
 */
function stringToUint8Array(str: string): Uint8Array {
  const encoder = new TextEncoder();
  return new Uint8Array(encoder.encode(str));
}

/**
 * Converts ArrayBuffer or Uint8Array to base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Converts base64 string to ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Derives a cryptographic key from wallet signature using PBKDF2
 * @param signature The user's wallet signature (hex string)
 * @param salt The salt for key derivation
 * @returns CryptoKey for AES-GCM encryption
 */
async function deriveKeyFromSignature(signature: string, salt: Uint8Array): Promise<CryptoKey> {
  // Convert hex signature to bytes and hash with SHA-256
  const signatureBytes = hexToUint8Array(signature);
  const signatureHash = await crypto.subtle.digest('SHA-256', signatureBytes.buffer as ArrayBuffer);
  
  // Import the signature hash as key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    signatureHash,
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  // Derive a key using PBKDF2
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: new Uint8Array(salt),
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );

  return key;
}

/**
 * Convert hex string to Uint8Array for crypto operations
 * @param hexString The hex string to convert
 * @returns Uint8Array
 */
function hexToUint8Array(hexString: string): Uint8Array {
  // Remove 0x prefix if present
  const cleanHex = hexString.startsWith('0x') ? hexString.slice(2) : hexString;
  
  // Convert hex pairs to bytes
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substr(i, 2), 16);
  }
  
  return new Uint8Array(bytes);
}

/**
 * Encrypts a 2FA secret using AES-256-GCM with signature-derived key
 * @param secret The 2FA secret to encrypt
 * @param signature The user's wallet signature (used for key derivation)
 * @returns Object containing encrypted data, IV, and salt
 */
export async function encryptSecretGCM(
  secret: string,
  signature: string
): Promise<{ encrypted: string; iv: string; salt: string }> {
  if (!secret || !signature) {
    throw new Error('Secret and signature are required for encryption');
  }

  try {
    // Generate random salt and IV
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12)); // 12 bytes for GCM

    // Derive encryption key from signature
    const key = await deriveKeyFromSignature(signature, salt);

    // Encrypt the secret
    const encryptedBuffer = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: new Uint8Array(iv),
      },
      key,
      stringToUint8Array(secret).buffer as ArrayBuffer
    );

    return {
      encrypted: arrayBufferToBase64(encryptedBuffer),
      iv: arrayBufferToBase64(iv),
      salt: arrayBufferToBase64(salt),
    };
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt secret');
  }
}

/**
 * Decrypts a 2FA secret using AES-256-GCM with signature-derived key
 * @param encryptedData The encrypted secret (base64)
 * @param iv The initialization vector (base64)
 * @param salt The salt used for key derivation (base64)
 * @param signature The user's wallet signature (used for key derivation)
 * @returns The decrypted secret
 */
export async function decryptSecretGCM(
  encryptedData: string,
  iv: string,
  salt: string,
  signature: string
): Promise<string> {
  if (!encryptedData || !iv || !salt || !signature) {
    throw new Error('All parameters are required for decryption');
  }

  try {
    // Convert from base64
    const encryptedBuffer = base64ToArrayBuffer(encryptedData);
    const ivBuffer = base64ToArrayBuffer(iv);
    const saltBuffer = new Uint8Array(base64ToArrayBuffer(salt));

    // Derive decryption key from signature (same as encryption)
    const key = await deriveKeyFromSignature(signature, saltBuffer);

    // Decrypt the data
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: new Uint8Array(ivBuffer),
      },
      key,
      encryptedBuffer
    );

    // Convert back to string
    const decoder = new TextDecoder();
    const decryptedString = decoder.decode(decryptedBuffer);

    if (!decryptedString) {
      throw new Error('Decryption failed - invalid secret or key');
    }

    return decryptedString;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt secret');
  }
}

/**
 * Validates a 2FA secret format (base32 encoded)
 * @param secret The secret to validate
 * @returns true if valid, false otherwise
 */
export function validateSecret(secret: string): boolean {
  // Remove spaces and convert to uppercase
  const cleanSecret = secret.replace(/\s/g, '').toUpperCase();
  
  // Base32 alphabet check
  const base32Regex = /^[A-Z2-7]+=*$/;
  
  return base32Regex.test(cleanSecret) && cleanSecret.length >= 16;
}

/**
 * Cleans and formats a 2FA secret
 * @param secret The secret to clean
 * @returns The cleaned secret
 */
export function cleanSecret(secret: string): string {
  return secret.replace(/\s/g, '').toUpperCase();
}
