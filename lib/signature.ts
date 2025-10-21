/**
 * Signature Management Module
 * Handles wallet signature requests for vault unlocking
 * Uses deterministic message for consistent key derivation
 */

// Fixed message for deterministic signatures
// Same message = same signature = same encryption key
export const VAULT_UNLOCK_MESSAGE = "Unlock BaseAuth Vault";

/**
 * Request a signature from the user's wallet
 * @param walletClient The wallet client from wagmi
 * @returns Promise<string> The signature as hex string
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function requestVaultSignature(walletClient: any): Promise<string> {
  if (!walletClient) {
    throw new Error('Wallet client is required');
  }

  try {
    console.log('🔐 Requesting vault signature...');
    console.log('   Message:', VAULT_UNLOCK_MESSAGE);
    
    // Request signature using wagmi's signMessage
    const signature = await walletClient.signMessage({
      message: VAULT_UNLOCK_MESSAGE,
    });

    console.log('✅ Signature received:', signature);
    return signature;
  } catch (error) {
    console.error('❌ Signature request failed:', error);
    
    if (error instanceof Error) {
      // Handle common signature errors
      if (error.message.includes('User rejected')) {
        throw new Error('Signature rejected by user');
      }
      if (error.message.includes('User denied')) {
        throw new Error('Signature denied by user');
      }
      if (error.message.includes('not connected')) {
        throw new Error('Wallet not connected');
      }
    }
    
    throw new Error('Failed to get signature from wallet');
  }
}

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

/**
 * Get a deterministic signature hash for key derivation
 * This ensures the same signature always produces the same hash
 * @param signature The signature hex string
 * @returns Promise<Uint8Array> SHA-256 hash of the signature
 */
export async function getSignatureHash(signature: string): Promise<Uint8Array> {
  if (!isValidSignature(signature)) {
    throw new Error('Invalid signature format');
  }

  // Convert hex signature to bytes
  const signatureBytes = hexToUint8Array(signature);
  
  // Hash with SHA-256
  const hashBuffer = await crypto.subtle.digest('SHA-256', signatureBytes.buffer as ArrayBuffer);
  
  return new Uint8Array(hashBuffer);
}
