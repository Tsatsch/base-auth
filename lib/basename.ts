import { getName } from '@coinbase/onchainkit/identity';
import { base, baseSepolia } from 'wagmi/chains';

const getCurrentNetworkConfig = () => {
  const network = process.env.NEXT_PUBLIC_NETWORK || "testnet";
  return network === "mainnet" 
    ? base
    : baseSepolia;
};

export async function resolveBaseName(address: string): Promise<string | null> {
  try {
    if (!address) return null;
    
    const chain = getCurrentNetworkConfig();
    const name = await getName({ address: address as `0x${string}`, chain });
    
    if (name && name.endsWith('.base.eth')) {
      return name;
    }
    
    return null;
  } catch {
    return null;
  }
}

export function formatAddress(address: string): string {
  if (!address) return '';
  
  const start = address.slice(0, 6);
  const end = address.slice(-4);
  return `${start}...${end}`;
}

export function formatBaseName(basename: string): string {
  if (!basename) return '';
  
  if (basename.length > 20) {
    const start = basename.slice(0, 15);
    const end = basename.slice(-5);
    return `${start}...${end}`;
  }
  
  return basename;
}
