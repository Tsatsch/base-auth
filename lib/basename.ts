import { getName } from '@coinbase/onchainkit/identity';
import { base, baseSepolia } from 'wagmi/chains';

// Get current network configuration
const getCurrentNetworkConfig = () => {
  const network = process.env.NEXT_PUBLIC_NETWORK || "testnet";
  return network === "mainnet" 
    ? base
    : baseSepolia;
};

/**
 * Resolves a base name for a given wallet address
 * @param address - The wallet address to resolve
 * @returns Promise<string | null> - The base name if found, null otherwise
 */
export async function resolveBaseName(address: string): Promise<string | null> {
  try {
    if (!address) return null;
    
    const chain = getCurrentNetworkConfig();
    const name = await getName({ address: address as `0x${string}`, chain });
    
    // Return the name if it's a valid base name (ends with .base.eth)
    if (name && name.endsWith('.base.eth')) {
      return name;
    }
    
    return null;
  } catch (error) {
    console.warn('Failed to resolve base name:', error);
    return null;
  }
}

/**
 * Formats an address for display (truncated with ellipsis)
 * @param address - The wallet address to format
 * @returns string - Formatted address
 */
export function formatAddress(address: string): string {
  if (!address) return '';
  
  const start = address.slice(0, 6);
  const end = address.slice(-4);
  return `${start}...${end}`;
}

/**
 * Formats a base name for display (truncated if too long)
 * @param basename - The base name to format
 * @returns string - Formatted base name
 */
export function formatBaseName(basename: string): string {
  if (!basename) return '';
  
  // If the basename is too long, truncate it
  if (basename.length > 20) {
    const start = basename.slice(0, 15);
    const end = basename.slice(-5);
    return `${start}...${end}`;
  }
  
  return basename;
}
