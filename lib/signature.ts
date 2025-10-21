export const VAULT_UNLOCK_MESSAGE = "Unlock BaseAuth Vault";

export function isValidSignature(signature: string): boolean {
  if (!signature || typeof signature !== 'string') {
    return false;
  }
  
  const hexRegex = /^0x[a-fA-F0-9]+$/;
  return hexRegex.test(signature) && signature.length >= 130;
}

export function hexToUint8Array(hexString: string): Uint8Array {
  const cleanHex = hexString.startsWith('0x') ? hexString.slice(2) : hexString;
  
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substr(i, 2), 16);
  }
  
  return bytes;
}
