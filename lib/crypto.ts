import CryptoJS from 'crypto-js';

/**
 * Encrypts a 2FA secret using AES encryption with a user's wallet address as the key
 * @param secret The 2FA secret to encrypt
 * @param walletAddress The user's wallet address (used as encryption key)
 * @returns The encrypted secret as a string
 */
export function encryptSecret(secret: string, walletAddress: string): string {
  if (!secret || !walletAddress) {
    throw new Error('Secret and wallet address are required for encryption');
  }
  
  // Use the wallet address as the encryption key
  const encrypted = CryptoJS.AES.encrypt(secret, walletAddress).toString();
  return encrypted;
}

/**
 * Decrypts a 2FA secret using AES decryption with a user's wallet address as the key
 * @param encryptedSecret The encrypted secret string
 * @param walletAddress The user's wallet address (used as decryption key)
 * @returns The decrypted secret as a string
 */
export function decryptSecret(encryptedSecret: string, walletAddress: string): string {
  if (!encryptedSecret || !walletAddress) {
    throw new Error('Encrypted secret and wallet address are required for decryption');
  }
  
  try {
    const decrypted = CryptoJS.AES.decrypt(encryptedSecret, walletAddress);
    const decryptedString = decrypted.toString(CryptoJS.enc.Utf8);
    
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

