import { PinataSDK } from "pinata";
import { encryptBundleGCM, decryptBundleGCM } from "./crypto";

export interface TOTPAccount {
  id: string;
  accountName: string;
  encryptedSecret: string;
  algorithm: string;
  period: number;
  digits: number;
  timestamp: number;
  iv: string;
  salt: string;
  logoCID?: string;
}

export interface UserTOTPBundle {
  accounts: TOTPAccount[];
  userAddress: string;
  lastUpdated: number;
  version: number;
}

export interface EncryptedBundle {
  encryptedData: string;
  iv: string;
  salt: string;
  version: number;
}

export interface SecretMetadata {
  accountName: string;
  encryptedSecret: string;
  algorithm: string;
  period: number;
  digits: number;
  timestamp: number;
  iv: string;
  salt: string;
  logoCID?: string;
}

function getPinataClient() {
  const pinataJwt = process.env.NEXT_PUBLIC_PINATA_JWT;
  const pinataGateway = process.env.NEXT_PUBLIC_PINATA_GATEWAY;

  if (!pinataJwt) {
    throw new Error(
      'Pinata JWT not configured. Please set NEXT_PUBLIC_PINATA_JWT in your .env.local file. ' +
      'Get your JWT at: https://app.pinata.cloud/developers/api-keys'
    );
  }

  if (!pinataGateway) {
    throw new Error(
      'Pinata Gateway not configured. Please set NEXT_PUBLIC_PINATA_GATEWAY in your .env.local file. ' +
      'Example: example-gateway.mypinata.cloud'
    );
  }

  return new PinataSDK({
    pinataJwt,
    pinataGateway,
  });
}

export async function uploadToIPFS(metadata: SecretMetadata): Promise<string> {
  try {
    const pinata = getPinataClient();

    const jsonString = JSON.stringify(metadata);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const file = new File([blob], `2FA-${metadata.accountName}-${Date.now()}.json`, {
      type: 'application/json',
    });

    const upload = await pinata.upload.public.file(file);

    return upload.cid;
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Unauthorized') || error.message.includes('401')) {
        throw new Error(
          'Pinata Authentication Error: Invalid JWT token. ' +
          'Please create a new API key with JWT at: https://app.pinata.cloud/developers/api-keys'
        );
      }
      
      if (error.message.includes('403')) {
        throw new Error(
          'Pinata Permission Error: Your API key lacks required permissions. ' +
          'Please create a new key with "Admin" permissions at: https://app.pinata.cloud/developers/api-keys'
        );
      }

      throw new Error(`Failed to upload to IPFS: ${error.message}`);
    }
    
    throw new Error('Failed to upload to IPFS: Unknown error');
  }
}

export async function retrieveFromIPFS(cid: string): Promise<SecretMetadata> {
  if (!cid) {
    throw new Error('IPFS CID is required');
  }

  try {
    const pinata = getPinataClient();

    const data = await pinata.gateways.public.get(cid);

    const metadata = (typeof data.data === 'string' ? JSON.parse(data.data) : data.data) as SecretMetadata;
    
    if (!metadata.encryptedSecret || !metadata.iv || !metadata.salt) {
      throw new Error('Invalid metadata structure retrieved from IPFS');
    }

    return metadata;
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('404')) {
        throw new Error(
          `IPFS content not found: ${cid}. ` +
          'The content may not be pinned or may have been unpinned.'
        );
      }

      if (error.message.includes('Gateway timeout')) {
        throw new Error(
          'IPFS Gateway timeout. Please try again in a moment. ' +
          'The content may still be propagating through the network.'
        );
      }

      throw new Error(`Failed to retrieve from IPFS: ${error.message}`);
    }
    
    throw new Error('Failed to retrieve from IPFS: Unknown error');
  }
}

export async function createSignedURL(cid: string, expiresIn: number = 30): Promise<string> {
  try {
    const pinata = getPinataClient();

    const url = await pinata.gateways.public.convert(cid);

    return url;
  } catch (error) {
    throw new Error(`Failed to create signed URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function unpinContent(fileId: string): Promise<void> {
  try {
    const pinata = getPinataClient();

    await pinata.files.public.delete([fileId]);

  } catch (error) {
  }
}

export async function listPinnedFiles() {
  try {
    const pinata = getPinataClient();

    const files = await pinata.files.public.list();

    return files.files || [];
  } catch (error) {
    throw new Error(`Failed to list files: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function uploadImageToIPFS(file: File, accountName: string): Promise<string> {
  try {
    const pinata = getPinataClient();

    const upload = await pinata.upload.public.file(file);

    return upload.cid;
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Unauthorized') || error.message.includes('401')) {
        throw new Error(
          'Pinata Authentication Error: Invalid JWT token. ' +
          'Please create a new API key with JWT at: https://app.pinata.cloud/developers/api-keys'
        );
      }
      
      if (error.message.includes('403')) {
        throw new Error(
          'Pinata Permission Error: Your API key lacks required permissions. ' +
          'Please create a new key with "Admin" permissions at: https://app.pinata.cloud/developers/api-keys'
        );
      }

      throw new Error(`Failed to upload image to IPFS: ${error.message}`);
    }
    
    throw new Error('Failed to upload image to IPFS: Unknown error');
  }
}

export function getIPFSImageURL(cid: string): string {
  const gateway = process.env.NEXT_PUBLIC_PINATA_GATEWAY;
  
  if (!gateway) {
    throw new Error('Pinata Gateway not configured');
  }

  return `https://${gateway}/ipfs/${cid}`;
}

async function getFileIdFromCID(cid: string): Promise<string | null> {
  try {
    const pinata = getPinataClient();
    const files = await pinata.files.public.list();
    
    const file = files.files?.find(f => f.cid === cid);
    return file?.id || null;
  } catch (error) {
    return null;
  }
}

export async function uploadBundleToIPFS(
  bundle: UserTOTPBundle, 
  signature: string,
  oldCID?: string | null
): Promise<string> {
  try {
    const pinata = getPinataClient();

    const { encrypted, iv, salt } = await encryptBundleGCM(bundle, signature);
    
    const encryptedBundle: EncryptedBundle = {
      encryptedData: encrypted,
      iv,
      salt,
      version: 2,
    };

    const jsonString = JSON.stringify(encryptedBundle);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const file = new File([blob], `2FA-Encrypted-Bundle-${bundle.userAddress}-${Date.now()}.json`, {
      type: 'application/json',
    });

    const upload = await pinata.upload.public.file(file);

    if (oldCID && oldCID !== upload.cid) {
      const oldFileId = await getFileIdFromCID(oldCID);
      if (oldFileId) {
        await unpinContent(oldFileId);
      }
    }

    return upload.cid;
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Unauthorized') || error.message.includes('401')) {
        throw new Error(
          'Pinata Authentication Error: Invalid JWT token. ' +
          'Please create a new API key with JWT at: https://app.pinata.cloud/developers/api-keys'
        );
      }
      
      if (error.message.includes('403')) {
        throw new Error(
          'Pinata Permission Error: Your API key lacks required permissions. ' +
          'Please create a new key with "Admin" permissions at: https://app.pinata.cloud/developers/api-keys'
        );
      }

      throw new Error(`Failed to upload bundle to IPFS: ${error.message}`);
    }
    
    throw new Error('Failed to upload bundle to IPFS: Unknown error');
  }
}

export async function retrieveBundleFromIPFS(cid: string, signature: string): Promise<UserTOTPBundle> {
  if (!cid) {
    throw new Error('IPFS CID is required');
  }

  if (!signature) {
    throw new Error('Wallet signature is required for bundle decryption');
  }

  try {
    const pinata = getPinataClient();

    const data = await pinata.gateways.public.get(cid);

    const rawData = (typeof data.data === 'string' ? JSON.parse(data.data) : data.data);
    
    if (rawData.version === 2 && rawData.encryptedData) {
      const encryptedBundle = rawData as EncryptedBundle;
      
      const decryptedBundle = await decryptBundleGCM(
        encryptedBundle.encryptedData,
        encryptedBundle.iv,
        encryptedBundle.salt,
        signature
      ) as UserTOTPBundle;
      
      if (!decryptedBundle.accounts || !Array.isArray(decryptedBundle.accounts)) {
        throw new Error('Invalid bundle structure after decryption');
      }

      return decryptedBundle;
    } else {
      const bundle = rawData as UserTOTPBundle;
      
      if (!bundle.accounts || !Array.isArray(bundle.accounts)) {
        throw new Error('Invalid bundle structure retrieved from IPFS');
      }

      return bundle;
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('404')) {
        throw new Error(
          `IPFS bundle not found: ${cid}. ` +
          'The content may not be pinned or may have been unpinned.'
        );
      }

      if (error.message.includes('Gateway timeout')) {
        throw new Error(
          'IPFS Gateway timeout. Please try again in a moment. ' +
          'The content may still be propagating through the network.'
        );
      }

      if (error.message.includes('decrypt')) {
        throw new Error(
          'Failed to decrypt bundle. This may be due to:\n' +
          '1. Wrong wallet signature\n' +
          '2. Corrupted data on IPFS\n' +
          '3. Bundle was encrypted with a different signature'
        );
      }

      throw new Error(`Failed to retrieve bundle from IPFS: ${error.message}`);
    }
    
    throw new Error('Failed to retrieve bundle from IPFS: Unknown error');
  }
}

export function createEmptyBundle(userAddress: string): UserTOTPBundle {
  return {
    accounts: [],
    userAddress,
    lastUpdated: Date.now(),
    version: 1,
  };
}

export function addAccountToBundle(bundle: UserTOTPBundle, account: TOTPAccount): UserTOTPBundle {
  return {
    ...bundle,
    accounts: [...bundle.accounts, account],
    lastUpdated: Date.now(),
  };
}

export function removeAccountFromBundle(bundle: UserTOTPBundle, accountId: string): UserTOTPBundle {
  return {
    ...bundle,
    accounts: bundle.accounts.filter(acc => acc.id !== accountId),
    lastUpdated: Date.now(),
  };
}

export function updateAccountInBundle(
  bundle: UserTOTPBundle, 
  accountId: string, 
  updates: Partial<TOTPAccount>
): UserTOTPBundle {
  return {
    ...bundle,
    accounts: bundle.accounts.map(acc => 
      acc.id === accountId ? { ...acc, ...updates } : acc
    ),
    lastUpdated: Date.now(),
  };
}

export function getAccountFromBundle(bundle: UserTOTPBundle, accountId: string): TOTPAccount | undefined {
  return bundle.accounts.find(acc => acc.id === accountId);
}
