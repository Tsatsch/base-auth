const ITERATIONS = 100000;
const KEY_LENGTH = 256;

function stringToUint8Array(str: string): Uint8Array {
  const encoder = new TextEncoder();
  return new Uint8Array(encoder.encode(str));
}

function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function deriveKeyFromSignature(signature: string, salt: Uint8Array): Promise<CryptoKey> {
  const signatureBytes = hexToUint8Array(signature);
  const signatureHash = await crypto.subtle.digest('SHA-256', signatureBytes.buffer as ArrayBuffer);
  
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    signatureHash,
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

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

function hexToUint8Array(hexString: string): Uint8Array {
  const cleanHex = hexString.startsWith('0x') ? hexString.slice(2) : hexString;
  
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substr(i, 2), 16);
  }
  
  return new Uint8Array(bytes);
}

export async function encryptSecretGCM(
  secret: string,
  signature: string
): Promise<{ encrypted: string; iv: string; salt: string }> {
  if (!secret || !signature) {
    throw new Error('Secret and signature are required for encryption');
  }

  try {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const key = await deriveKeyFromSignature(signature, salt);

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
    throw new Error('Failed to encrypt secret');
  }
}

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
    const encryptedBuffer = base64ToArrayBuffer(encryptedData);
    const ivBuffer = base64ToArrayBuffer(iv);
    const saltBuffer = new Uint8Array(base64ToArrayBuffer(salt));

    const key = await deriveKeyFromSignature(signature, saltBuffer);

    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: new Uint8Array(ivBuffer),
      },
      key,
      encryptedBuffer
    );

    const decoder = new TextDecoder();
    const decryptedString = decoder.decode(decryptedBuffer);

    if (!decryptedString) {
      throw new Error('Decryption failed - invalid secret or key');
    }

    return decryptedString;
  } catch (error) {
    throw new Error('Failed to decrypt secret');
  }
}

export function validateSecret(secret: string): boolean {
  const cleanSecret = secret.replace(/\s/g, '').toUpperCase();
  
  const base32Regex = /^[A-Z2-7]+=*$/;
  
  return base32Regex.test(cleanSecret) && cleanSecret.length >= 16;
}

export function cleanSecret(secret: string): string {
  return secret.replace(/\s/g, '').toUpperCase();
}

export async function encryptBundleGCM(
  bundleData: unknown,
  signature: string
): Promise<{ encrypted: string; iv: string; salt: string }> {
  if (!bundleData || !signature) {
    throw new Error('Bundle data and signature are required for encryption');
  }

  try {
    const bundleJson = JSON.stringify(bundleData);
    
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const key = await deriveKeyFromSignature(signature, salt);

    const encryptedBuffer = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: new Uint8Array(iv),
      },
      key,
      stringToUint8Array(bundleJson).buffer as ArrayBuffer
    );

    return {
      encrypted: arrayBufferToBase64(encryptedBuffer),
      iv: arrayBufferToBase64(iv),
      salt: arrayBufferToBase64(salt),
    };
  } catch (error) {
    throw new Error('Failed to encrypt bundle');
  }
}

export async function decryptBundleGCM(
  encryptedData: string,
  iv: string,
  salt: string,
  signature: string
): Promise<unknown> {
  if (!encryptedData || !iv || !salt || !signature) {
    throw new Error('All parameters are required for bundle decryption');
  }

  try {
    const encryptedBuffer = base64ToArrayBuffer(encryptedData);
    const ivBuffer = base64ToArrayBuffer(iv);
    const saltBuffer = new Uint8Array(base64ToArrayBuffer(salt));

    const key = await deriveKeyFromSignature(signature, saltBuffer);

    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: new Uint8Array(ivBuffer),
      },
      key,
      encryptedBuffer
    );

    const decoder = new TextDecoder();
    const decryptedString = decoder.decode(decryptedBuffer);

    if (!decryptedString) {
      throw new Error('Bundle decryption failed - invalid data or key');
    }

    return JSON.parse(decryptedString);
  } catch (error) {
    throw new Error('Failed to decrypt bundle - wrong signature or corrupted data');
  }
}
