import protobuf from 'protobufjs';

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

export interface ParsedMigrationAccount {
  secret: string;
  name: string;
  issuer: string;
  accountName: string;
  algorithm: 'SHA1' | 'SHA256' | 'SHA512' | 'MD5';
  digits: 6 | 8;
  type: 'TOTP' | 'HOTP';
  counter?: number;
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

function getProtoRoot(): protobuf.Root {
  if (!migrationRoot) {
    migrationRoot = protobuf.parse(migrationProto).root;
  }
  return migrationRoot;
}

function algorithmToString(algorithm: number): 'SHA1' | 'SHA256' | 'SHA512' | 'MD5' {
  switch (algorithm) {
    case 1: return 'SHA1';
    case 2: return 'SHA256';
    case 3: return 'SHA512';
    case 4: return 'MD5';
    default: return 'SHA1';
  }
}

function digitsToNumber(digits: number): 6 | 8 {
  switch (digits) {
    case 1: return 6;
    case 2: return 8;
    default: return 6;
  }
}

function typeToString(type: number): 'TOTP' | 'HOTP' {
  switch (type) {
    case 1: return 'HOTP';
    case 2: return 'TOTP';
    default: return 'TOTP';
  }
}

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

  while (output.length % 8 !== 0) {
    output += '=';
  }

  return output;
}

export function parseMigrationURI(uri: string): MigrationParseResult {
  try {
    if (!uri.startsWith('otpauth-migration://offline?data=')) {
      return {
        success: false,
        error: 'Invalid migration URI format. Expected otpauth-migration://offline?data=...'
      };
    }

    const url = new URL(uri);
    const encodedData = url.searchParams.get('data');
    
    if (!encodedData) {
      return {
        success: false,
        error: 'No data parameter found in migration URI'
      };
    }

    const urlDecoded = decodeURIComponent(encodedData);
    const base64Decoded = Buffer.from(urlDecoded, 'base64');

    const root = getProtoRoot();
    const MigrationPayload = root.lookupType('MigrationPayload');
    const message = MigrationPayload.decode(base64Decoded);
    const payload = MigrationPayload.toObject(message, {
      longs: Number,
      bytes: Uint8Array,
    });

    const accounts: ParsedMigrationAccount[] = [];
    
    if (payload.otpParameters && Array.isArray(payload.otpParameters)) {
      for (const param of payload.otpParameters) {
        try {
          const secretBytes = param.secret instanceof Uint8Array 
            ? param.secret 
            : new Uint8Array(param.secret);
          const secret = bytesToBase32(secretBytes);

          const nameParts = param.name ? param.name.split(':') : [];
          let issuer = param.issuer || '';
          let accountName = param.name || 'Imported Account';

          if (nameParts.length === 2) {
            if (!issuer) issuer = nameParts[0];
            accountName = nameParts[1];
          } else if (nameParts.length === 1) {
            accountName = nameParts[0];
          }

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
        } catch {
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
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to parse migration data'
    };
  }
}

export function isMigrationURI(uri: string): boolean {
  return uri.startsWith('otpauth-migration://offline');
}

function base32ToBytes(base32: string): Uint8Array {
  const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  
  base32 = base32.replace(/=+$/, '').toUpperCase();
  
  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (let i = 0; i < base32.length; i++) {
    const idx = base32Chars.indexOf(base32[i]);
    if (idx === -1) {
      throw new Error(`Invalid base32 character: ${base32[i]}`);
    }
    
    value = (value << 5) | idx;
    bits += 5;

    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return new Uint8Array(output);
}

function stringToAlgorithm(algorithm: string): number {
  switch (algorithm.toUpperCase()) {
    case 'SHA1': return 1;
    case 'SHA256': return 2;
    case 'SHA512': return 3;
    case 'MD5': return 4;
    default: return 1;
  }
}

function numberToDigits(digits: number): number {
  switch (digits) {
    case 6: return 1;
    case 8: return 2;
    default: return 1;
  }
}

function stringToType(type: string): number {
  switch (type.toUpperCase()) {
    case 'HOTP': return 1;
    case 'TOTP': return 2;
    default: return 2;
  }
}

export function createMigrationURI(accounts: ParsedMigrationAccount[]): string {
  try {
    const root = getProtoRoot();
    const MigrationPayload = root.lookupType('MigrationPayload');

    const otpParameters = accounts.map(account => {
      const secretBytes = base32ToBytes(account.secret);
      
      const fullName = account.issuer && account.issuer !== 'Unknown' 
        ? `${account.issuer}:${account.accountName}`
        : account.accountName;

      return {
        secret: secretBytes,
        name: fullName,
        issuer: account.issuer && account.issuer !== 'Unknown' ? account.issuer : '',
        algorithm: stringToAlgorithm(account.algorithm),
        digits: numberToDigits(account.digits),
        type: stringToType(account.type),
        counter: account.counter || 0,
      };
    });

    const payload = {
      otpParameters,
      version: 1,
      batchSize: accounts.length,
      batchIndex: 0,
      batchId: Math.floor(Math.random() * 1000000),
    };

    const message = MigrationPayload.create(payload);
    const buffer = MigrationPayload.encode(message).finish();

    const base64Encoded = Buffer.from(buffer).toString('base64');
    const urlEncoded = encodeURIComponent(base64Encoded);

    const uri = `otpauth-migration://offline?data=${urlEncoded}`;
    
    return uri;
  } catch (error) {
    throw new Error(`Failed to create migration URI: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
