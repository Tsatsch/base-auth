/**
 * Signature Management Module
 * Handles wallet signature requests for vault unlocking
 * Uses deterministic message for consistent key derivation
 */

// Fixed message for deterministic signatures
// Same message = same signature = same encryption key
export const VAULT_UNLOCK_MESSAGE = "Unlock BaseAuth Vault";


/**
 * Validate signature format (basic hex string check)
 * @param signature The signature to validate
 * @returns boolean True if valid format
 */
export function isValidSignature(signature: string): boolean {
  if (!signature || typeof signature !== 'string') {
    return false;
  }
  
  // Check if it's a valid hex string (starts with 0x and has valid hex chars)
  const hexRegex = /^0x[a-fA-F0-9]+$/;
  return hexRegex.test(signature) && signature.length >= 130; // 0x + 64 bytes = 130 chars
}

/**
 * Convert hex string to Uint8Array for crypto operations
 * @param hexString The hex string to convert
 * @returns Uint8Array
 */
export function hexToUint8Array(hexString: string): Uint8Array {
  // Remove 0x prefix if present
  const cleanHex = hexString.startsWith('0x') ? hexString.slice(2) : hexString;
  
  // Convert hex pairs to bytes
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substr(i, 2), 16);
  }
  
  return bytes;
}

