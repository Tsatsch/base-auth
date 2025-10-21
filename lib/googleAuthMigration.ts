/**
 * Google Authenticator Migration Parser
 * Parses the otpauth-migration:// format used by Google Authenticator export
 * 
 * Format: otpauth-migration://offline?data=<URL_ENCODED_BASE64_PROTOBUF>
 * Reference: https://github.com/qistoph/otp_export
 */

import protobuf from 'protobufjs';

// Protocol Buffers schema for Google Authenticator migration
const migrationProto = `
syntax = "proto3";

enum Algorithm {
  ALGORITHM_TYPE_UNSPECIFIED = 0;
  SHA1 = 1;
  SHA256 = 2;
  SHA512 = 3;
  MD5 = 4;
}

enum DigitCount {
  DIGIT_COUNT_UNSPECIFIED = 0;
  SIX = 1;
  EIGHT = 2;
}

enum OtpType {
  OTP_TYPE_UNSPECIFIED = 0;
  HOTP = 1;
  TOTP = 2;
}

message OtpParameters {
  bytes secret = 1;
  string name = 2;
  string issuer = 3;
  Algorithm algorithm = 4;
  DigitCount digits = 5;
  OtpType type = 6;
  int64 counter = 7;
}

message MigrationPayload {
  repeated OtpParameters otp_parameters = 1;
  int32 version = 2;
  int32 batch_size = 3;
  int32 batch_index = 4;
  int32 batch_id = 5;
}
`;

// Parse account interface
export interface ParsedMigrationAccount {
  secret: string;           // Base32 encoded secret
  name: string;             // Full name (e.g., "Issuer:Account")
  issuer: string;           // Issuer name
  accountName: string;      // Account name
  algorithm: 'SHA1' | 'SHA256' | 'SHA512' | 'MD5';
  digits: 6 | 8;
  type: 'TOTP' | 'HOTP';
  counter?: number;         // For HOTP only
}

export interface MigrationParseResult {
  success: boolean;
  accounts?: ParsedMigrationAccount[];
  error?: string;
  metadata?: {
    version: number;
    batchSize: number;
    batchIndex: number;
    batchId: number;
  };
}

let migrationRoot: protobuf.Root | null = null;

/**
 * Initialize the Protocol Buffers schema
 */
function getProtoRoot(): protobuf.Root {
  if (!migrationRoot) {
    migrationRoot = protobuf.parse(migrationProto).root;
  }
  return migrationRoot;
}

/**
 * Convert algorithm enum to string
 */
function algorithmToString(algorithm: number): 'SHA1' | 'SHA256' | 'SHA512' | 'MD5' {
  switch (algorithm) {
    case 1: return 'SHA1';
    case 2: return 'SHA256';
    case 3: return 'SHA512';
    case 4: return 'MD5';
    default: return 'SHA1';
  }
}

/**
 * Convert digit count enum to number
 */
function digitsToNumber(digits: number): 6 | 8 {
  switch (digits) {
    case 1: return 6;
    case 2: return 8;
    default: return 6;
  }
}

/**
 * Convert OTP type enum to string
 */
function typeToString(type: number): 'TOTP' | 'HOTP' {
  switch (type) {
    case 1: return 'HOTP';
    case 2: return 'TOTP';
    default: return 'TOTP';
  }
}

/**
 * Convert bytes to base32 string (for the secret)
 */
function bytesToBase32(bytes: Uint8Array): string {
  const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;

    while (bits >= 5) {
      output += base32Chars[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += base32Chars[(value << (5 - bits)) & 31];
  }

  // Add padding
  while (output.length % 8 !== 0) {
    output += '=';
  }

  return output;
}

/**
 * Parse a Google Authenticator migration URL
 * @param uri The otpauth-migration:// URI
 * @returns Parsed accounts or error
 */
export function parseMigrationURI(uri: string): MigrationParseResult {
  try {
    // Validate URI format
    if (!uri.startsWith('otpauth-migration://offline?data=')) {
      return {
        success: false,
        error: 'Invalid migration URI format. Expected otpauth-migration://offline?data=...'
      };
    }

    // Extract the data parameter
    const url = new URL(uri);
    const encodedData = url.searchParams.get('data');
    
    if (!encodedData) {
      return {
        success: false,
        error: 'No data parameter found in migration URI'
      };
    }

    // Decode: URL decode -> Base64 decode
    const urlDecoded = decodeURIComponent(encodedData);
    const base64Decoded = Buffer.from(urlDecoded, 'base64');

    // Parse Protocol Buffers
    const root = getProtoRoot();
    const MigrationPayload = root.lookupType('MigrationPayload');
    const message = MigrationPayload.decode(base64Decoded);
    const payload = MigrationPayload.toObject(message, {
      longs: Number,
      bytes: Uint8Array,
    });

    console.log('📦 Decoded migration payload:', payload);

    // Parse accounts
    const accounts: ParsedMigrationAccount[] = [];
    
    if (payload.otpParameters && Array.isArray(payload.otpParameters)) {
      for (const param of payload.otpParameters) {
        try {
          // Convert secret bytes to base32
          const secretBytes = param.secret instanceof Uint8Array 
            ? param.secret 
            : new Uint8Array(param.secret);
          const secret = bytesToBase32(secretBytes);

          // Parse name (format: "Issuer:Account" or just "Account")
          const nameParts = param.name ? param.name.split(':') : [];
          let issuer = param.issuer || '';
          let accountName = param.name || 'Imported Account';

          if (nameParts.length === 2) {
            // Format: "Issuer:Account"
            if (!issuer) issuer = nameParts[0];
            accountName = nameParts[1];
          } else if (nameParts.length === 1) {
            // Format: just "Account"
            accountName = nameParts[0];
          }

          // Clean up names
          issuer = issuer.trim() || 'Unknown';
          accountName = accountName.trim() || 'Account';

          accounts.push({
            secret,
            name: param.name || `${issuer}:${accountName}`,
            issuer,
            accountName,
            algorithm: algorithmToString(param.algorithm || 1),
            digits: digitsToNumber(param.digits || 1),
            type: typeToString(param.type || 2),
            counter: param.counter ? Number(param.counter) : undefined,
          });
        } catch (err) {
          console.error('Failed to parse account from migration:', err);
          // Continue with other accounts
        }
      }
    }

    if (accounts.length === 0) {
      return {
        success: false,
        error: 'No valid accounts found in migration data'
      };
    }

    return {
      success: true,
      accounts,
      metadata: {
        version: payload.version || 1,
        batchSize: payload.batchSize || accounts.length,
        batchIndex: payload.batchIndex || 0,
        batchId: payload.batchId || 0,
      }
    };
  } catch (error) {
    console.error('Error parsing migration URI:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to parse migration data'
    };
  }
}

/**
 * Check if a URI is a Google Authenticator migration URI
 */
export function isMigrationURI(uri: string): boolean {
  return uri.startsWith('otpauth-migration://offline');
}

