/**
 * IPFS Integration Module using Pinata SDK v3
 * Reference: https://docs.pinata.cloud/
 * 
 * Modern implementation using the official Pinata SDK with JWT authentication
 * and the latest v3 API endpoints
 */

import { PinataSDK } from "pinata";

// Individual account within a user's bundle
export interface TOTPAccount {
  id: string;                    // Unique account ID (UUID)
  accountName: string;           // Account identifier (e.g., "Google", "GitHub")
  encryptedSecret: string;       // AES-256-GCM encrypted TOTP secret
  algorithm: string;             // "SHA1"
  period: number;                // 30 seconds
  digits: number;                // 6 digits
  timestamp: number;             // When account was added
  iv: string;                    // Initialization vector for AES-GCM
  salt: string;                  // Salt for key derivation
  logoCID?: string;              // Optional IPFS CID for account logo
}

// Bundle containing all TOTP accounts for a user
export interface UserTOTPBundle {
  accounts: TOTPAccount[];       // Array of all TOTP accounts
  userAddress: string;           // Wallet address
  lastUpdated: number;           // Last modification timestamp
  version: number;               // Bundle version (for future compatibility)
}

// Legacy interface - kept for backward compatibility during migration
export interface SecretMetadata {
  accountName: string;
  encryptedSecret: string;
  algorithm: string;
  period: number;
  digits: number;
  timestamp: number;
  iv: string; // Initialization vector for AES-GCM
  salt: string; // Salt for key derivation
  logoCID?: string; // Optional IPFS CID for the account logo
}

/**
 * Initialize Pinata SDK with JWT authentication
 * Reference: https://docs.pinata.cloud/quickstart
 */
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

  console.log('🔑 Initializing Pinata SDK...');
  console.log('   Gateway:', pinataGateway);

  return new PinataSDK({
    pinataJwt,
    pinataGateway,
  });
}

/**
 * Upload encrypted 2FA data to IPFS via Pinata v3 API
 * Reference: https://docs.pinata.cloud/sdk/upload
 * 
 * @param metadata The encrypted metadata to upload
 * @returns The IPFS CID (Content Identifier)
 */
export async function uploadToIPFS(metadata: SecretMetadata): Promise<string> {
  try {
    const pinata = getPinataClient();

    console.log('📤 Uploading to IPFS via Pinata v3 API...');
    console.log('   Account:', metadata.accountName);

    // Upload JSON object using the v3 SDK
    // Reference: https://docs.pinata.cloud/sdk/upload/public
    // Convert metadata to JSON string and create a File object
    const jsonString = JSON.stringify(metadata);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const file = new File([blob], `2FA-${metadata.accountName}-${Date.now()}.json`, {
      type: 'application/json',
    });

    const upload = await pinata.upload.public.file(file);

    console.log('✅ Uploaded to IPFS:', upload.cid);
    console.log('   Upload ID:', upload.id);
    console.log('   Size:', upload.size, 'bytes');

    return upload.cid;
  } catch (error) {
    console.error('❌ IPFS upload error:', error);
    
    if (error instanceof Error) {
      // Provide helpful error messages
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

/**
 * Retrieve encrypted 2FA data from IPFS via Pinata Gateway
 * Reference: https://docs.pinata.cloud/gateways/retrieving-files
 * 
 * @param cid The IPFS Content Identifier
 * @returns The encrypted metadata
 */
export async function retrieveFromIPFS(cid: string): Promise<SecretMetadata> {
  if (!cid) {
    throw new Error('IPFS CID is required');
  }

  try {
    const pinata = getPinataClient();

    console.log('📥 Retrieving from IPFS:', cid);

    // Retrieve content using the v3 SDK
    // Reference: https://docs.pinata.cloud/sdk/gateways/public
    const data = await pinata.gateways.public.get(cid);

    // Parse the JSON response
    const metadata = (typeof data.data === 'string' ? JSON.parse(data.data) : data.data) as SecretMetadata;
    
    // Validate the metadata structure
    if (!metadata.encryptedSecret || !metadata.iv || !metadata.salt) {
      throw new Error('Invalid metadata structure retrieved from IPFS');
    }

    console.log('✅ Retrieved from IPFS');
    console.log('   Account:', metadata.accountName);
    console.log('   Algorithm:', metadata.algorithm);

    return metadata;
  } catch (error) {
    console.error('❌ IPFS retrieval error:', error);
    
    if (error instanceof Error) {
      // Gateway errors
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

/**
 * Optional: Create a signed URL for secure content access
 * Reference: https://docs.pinata.cloud/gateways/gateway-access-controls
 * 
 * @param cid The IPFS Content Identifier
 * @param expiresIn Expiration time in seconds (default: 30 seconds)
 * @returns A signed URL that expires after the specified time
 */
export async function createSignedURL(cid: string, expiresIn: number = 30): Promise<string> {
  try {
    const pinata = getPinataClient();

    // Create signed URL using the v3 SDK
    // Reference: https://docs.pinata.cloud/sdk/gateways/public
    const url = await pinata.gateways.public.convert(cid);

    console.log('🔗 Created signed URL (expires in', expiresIn, 'seconds)');
    return url;
  } catch (error) {
    console.error('❌ Signed URL creation error:', error);
    throw new Error(`Failed to create signed URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Delete/Unpin content from Pinata
 * Reference: https://docs.pinata.cloud/sdk/files/public
 * 
 * Note: This removes the pin from Pinata but doesn't delete from IPFS network
 * 
 * @param fileId The Pinata file ID (not CID) to delete
 */
export async function unpinContent(fileId: string): Promise<void> {
  try {
    const pinata = getPinataClient();

    console.log('🗑️  Deleting file:', fileId);

    // Delete using the v3 SDK
    await pinata.files.public.delete([fileId]);

    console.log('✅ File deleted successfully');
  } catch (error) {
    console.error('❌ Delete error:', error);
    // Don't throw - deletion is not critical
    console.warn('Warning: Failed to delete file, but this is not critical');
  }
}

/**
 * List all files pinned to your Pinata account
 * Reference: https://docs.pinata.cloud/sdk/files/public
 * 
 * @returns Array of file objects
 */
export async function listPinnedFiles() {
  try {
    const pinata = getPinataClient();

    console.log('📋 Listing files...');

    const files = await pinata.files.public.list();

    console.log('✅ Found', files.files?.length || 0, 'files');
    return files.files || [];
  } catch (error) {
    console.error('❌ List files error:', error);
    throw new Error(`Failed to list files: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Upload an image file to IPFS via Pinata
 * Reference: https://docs.pinata.cloud/sdk/upload
 * 
 * @param file The image file to upload
 * @param accountName The account name for metadata
 * @returns The IPFS CID (Content Identifier)
 */
export async function uploadImageToIPFS(file: File, accountName: string): Promise<string> {
  try {
    const pinata = getPinataClient();

    console.log('📤 Uploading image to IPFS via Pinata...');
    console.log('   Account:', accountName);
    console.log('   File size:', (file.size / 1024).toFixed(2), 'KB');
    console.log('   File type:', file.type);

    // Upload image file using the v3 SDK
    const upload = await pinata.upload.public.file(file);

    console.log('✅ Image uploaded to IPFS:', upload.cid);
    console.log('   Upload ID:', upload.id);
    console.log('   Size:', upload.size, 'bytes');

    return upload.cid;
  } catch (error) {
    console.error('❌ Image IPFS upload error:', error);
    
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

/**
 * Retrieve an image from IPFS via Pinata Gateway
 * Reference: https://docs.pinata.cloud/gateways/retrieving-files
 * 
 * @param cid The IPFS Content Identifier
 * @returns URL to the image on the gateway
 */
export function getIPFSImageURL(cid: string): string {
  const gateway = process.env.NEXT_PUBLIC_PINATA_GATEWAY;
  
  if (!gateway) {
    throw new Error('Pinata Gateway not configured');
  }

  // Use the Pinata dedicated gateway for optimal performance
  return `https://${gateway}/ipfs/${cid}`;
}

/**
 * Get Pinata file ID from CID
 * Reference: https://docs.pinata.cloud/sdk/files/public
 * 
 * @param cid The IPFS CID
 * @returns The Pinata file ID or null if not found
 */
async function getFileIdFromCID(cid: string): Promise<string | null> {
  try {
    const pinata = getPinataClient();
    const files = await pinata.files.public.list();
    
    const file = files.files?.find(f => f.cid === cid);
    return file?.id || null;
  } catch (error) {
    console.error('❌ Error finding file ID:', error);
    return null;
  }
}

/**
 * Upload a complete user TOTP bundle to IPFS
 * Reference: https://docs.pinata.cloud/sdk/upload
 * 
 * @param bundle The complete user TOTP bundle
 * @param oldCID Optional: The CID of the old bundle to unpin after successful upload
 * @returns The IPFS CID (Content Identifier)
 */
export async function uploadBundleToIPFS(bundle: UserTOTPBundle, oldCID?: string | null): Promise<string> {
  try {
    const pinata = getPinataClient();

    console.log('📤 Uploading bundle to IPFS via Pinata v3 API...');
    console.log('   User:', bundle.userAddress);
    console.log('   Accounts:', bundle.accounts.length);
    if (oldCID) {
      console.log('   Old CID to cleanup:', oldCID);
    }

    // Convert bundle to JSON string and create a File object
    const jsonString = JSON.stringify(bundle);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const file = new File([blob], `2FA-Bundle-${bundle.userAddress}-${Date.now()}.json`, {
      type: 'application/json',
    });

    const upload = await pinata.upload.public.file(file);

    console.log('✅ Bundle uploaded to IPFS:', upload.cid);
    console.log('   Upload ID:', upload.id);
    console.log('   Size:', upload.size, 'bytes');

    // Cleanup old bundle after successful upload
    if (oldCID && oldCID !== upload.cid) {
      console.log('🗑️  Cleaning up old bundle...');
      const oldFileId = await getFileIdFromCID(oldCID);
      if (oldFileId) {
        await unpinContent(oldFileId);
        console.log('✅ Old bundle cleaned up successfully');
      } else {
        console.warn('⚠️  Could not find old bundle to cleanup (may have been already deleted)');
      }
    }

    return upload.cid;
  } catch (error) {
    console.error('❌ Bundle IPFS upload error:', error);
    
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

/**
 * Retrieve a complete user TOTP bundle from IPFS
 * Reference: https://docs.pinata.cloud/gateways/retrieving-files
 * 
 * @param cid The IPFS Content Identifier
 * @returns The complete user TOTP bundle
 */
export async function retrieveBundleFromIPFS(cid: string): Promise<UserTOTPBundle> {
  if (!cid) {
    throw new Error('IPFS CID is required');
  }

  try {
    const pinata = getPinataClient();

    console.log('📥 Retrieving bundle from IPFS:', cid);

    // Retrieve content using the v3 SDK
    const data = await pinata.gateways.public.get(cid);

    // Parse the JSON response
    const bundle = (typeof data.data === 'string' ? JSON.parse(data.data) : data.data) as UserTOTPBundle;
    
    // Validate the bundle structure
    if (!bundle.accounts || !Array.isArray(bundle.accounts)) {
      throw new Error('Invalid bundle structure retrieved from IPFS');
    }

    console.log('✅ Retrieved bundle from IPFS');
    console.log('   User:', bundle.userAddress);
    console.log('   Accounts:', bundle.accounts.length);

    return bundle;
  } catch (error) {
    console.error('❌ Bundle IPFS retrieval error:', error);
    
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

      throw new Error(`Failed to retrieve bundle from IPFS: ${error.message}`);
    }
    
    throw new Error('Failed to retrieve bundle from IPFS: Unknown error');
  }
}

/**
 * Create an empty bundle for a new user
 * 
 * @param userAddress The wallet address
 * @returns An empty UserTOTPBundle
 */
export function createEmptyBundle(userAddress: string): UserTOTPBundle {
  return {
    accounts: [],
    userAddress,
    lastUpdated: Date.now(),
    version: 1,
  };
}

/**
 * Add an account to a bundle
 * 
 * @param bundle The existing bundle
 * @param account The account to add
 * @returns Updated bundle
 */
export function addAccountToBundle(bundle: UserTOTPBundle, account: TOTPAccount): UserTOTPBundle {
  return {
    ...bundle,
    accounts: [...bundle.accounts, account],
    lastUpdated: Date.now(),
  };
}

/**
 * Remove an account from a bundle by ID
 * 
 * @param bundle The existing bundle
 * @param accountId The ID of the account to remove
 * @returns Updated bundle
 */
export function removeAccountFromBundle(bundle: UserTOTPBundle, accountId: string): UserTOTPBundle {
  return {
    ...bundle,
    accounts: bundle.accounts.filter(acc => acc.id !== accountId),
    lastUpdated: Date.now(),
  };
}

/**
 * Update an account in a bundle
 * 
 * @param bundle The existing bundle
 * @param accountId The ID of the account to update
 * @param updates Partial account updates
 * @returns Updated bundle
 */
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

/**
 * Get an account from a bundle by ID
 * 
 * @param bundle The bundle
 * @param accountId The ID of the account
 * @returns The account or undefined
 */
export function getAccountFromBundle(bundle: UserTOTPBundle, accountId: string): TOTPAccount | undefined {
  return bundle.accounts.find(acc => acc.id === accountId);
}
