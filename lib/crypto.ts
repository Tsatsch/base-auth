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
  return encoder.encode(str);
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
 * Derives a cryptographic key from wallet address using PBKDF2
 * @param walletAddress The user's wallet address
 * @param salt The salt for key derivation
 * @returns CryptoKey for AES-GCM encryption
 */
async function deriveKey(walletAddress: string, salt: Uint8Array): Promise<CryptoKey> {
  // Import the wallet address as key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    stringToUint8Array(walletAddress.toLowerCase()),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  // Derive a key using PBKDF2
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
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
 * Encrypts a 2FA secret using AES-256-GCM with wallet-derived key
 * @param secret The 2FA secret to encrypt
 * @param walletAddress The user's wallet address (used for key derivation)
 * @returns Object containing encrypted data, IV, and salt
 */
export async function encryptSecretGCM(
  secret: string,
  walletAddress: string
): Promise<{ encrypted: string; iv: string; salt: string }> {
  if (!secret || !walletAddress) {
    throw new Error('Secret and wallet address are required for encryption');
  }

  try {
    // Generate random salt and IV
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12)); // 12 bytes for GCM

    // Derive encryption key
    const key = await deriveKey(walletAddress, salt);

    // Encrypt the secret
    const encryptedBuffer = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      key,
      stringToUint8Array(secret)
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
 * Decrypts a 2FA secret using AES-256-GCM with wallet-derived key
 * @param encryptedData The encrypted secret (base64)
 * @param iv The initialization vector (base64)
 * @param salt The salt used for key derivation (base64)
 * @param walletAddress The user's wallet address (used for key derivation)
 * @returns The decrypted secret
 */
export async function decryptSecretGCM(
  encryptedData: string,
  iv: string,
  salt: string,
  walletAddress: string
): Promise<string> {
  if (!encryptedData || !iv || !salt || !walletAddress) {
    throw new Error('All parameters are required for decryption');
  }

  try {
    // Convert from base64
    const encryptedBuffer = base64ToArrayBuffer(encryptedData);
    const ivBuffer = base64ToArrayBuffer(iv);
    const saltBuffer = new Uint8Array(base64ToArrayBuffer(salt));

    // Derive decryption key (same as encryption)
    const key = await deriveKey(walletAddress, saltBuffer);

    // Decrypt the data
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: ivBuffer,
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
