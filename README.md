# Base Auth - Decentralized 2FA Authenticator

<div align="center">
  <h3>Secure two-factor authentication with IPFS and Base blockchain</h3>
  <p>Store encrypted 2FA secrets on IPFS with immutable blockchain references</p>
</div> 

## 🚀 Why Base Auth?

**Signature-Based Encryption for Maximum Security**: Unlike traditional crypto solutions that tie encryption directly to wallet addresses, Base Auth uses **cryptographic signatures** as the encryption key. When you store TOTP secrets, the system requires you to sign a message with your wallet - this signature becomes the encryption key for your 2FA data. This means your sensitive authentication codes are encrypted using the unique signature you generate, not your wallet address or private key, providing enhanced security and privacy.


**Familiar Experience, Enhanced Security**: Works exactly like Google Authenticator or Authy, but with the added benefits of:
- **Zero Server Storage**: Your secrets never touch our servers
- **Decentralized Storage**: Data stored on IPFS, not centralized databases  
- **Blockchain Immutability**: Only encrypted references stored on-chain
- **Encryption**: AES-256-GCM with signature-derived keys
- **Seamless Migration**: Import from existing authenticators without starting over

## Overview

Base Auth is a decentralized authenticator mini-app that combines IPFS storage with Base blockchain security. Your 2FA secrets are encrypted with AES-256-GCM using signature-derived keys, stored on IPFS, and referenced via immutable Content Identifiers (CIDs) on the blockchain. Only you can decrypt your secrets using your wallet signature.

## Features

- **Signature-Based Authentication**: Uses wallet signatures, not wallets address or private keys
- **Base Name Resolution**: Displays your Base name when available
- **Encryption Functions**: AES-256-GCM with PBKDF2 key derivation from signatures
- **IPFS Storage**: Encrypted secrets stored on decentralized IPFS network
- **Blockchain References**: Only immutable IPFS CIDs stored on-chain
- **Mobile-Friendly**: Originally build for mobile usage for Base Mini Apps
- **Real-Time TOTP**: 6-digit codes that refresh every 30 seconds
- **Maximum Privacy**: No raw secrets on blockchain, all encryption client-side
- **Import/Export**: Migrate from Google Authenticator and other apps
- **QR Code Support**: Scan and generate QR codes for easy setup

## Complete Data Flow & Architecture

### What's Stored Where

**Smart Contract Storage** (`TwoFactorAuthenticator.sol`):
```solidity
struct UserData {
    string ipfsCID;        // IPFS Content Identifier pointing to encrypted bundle
    uint256 timestamp;     // Last update timestamp
    bool exists;           // Track if user has data
}
```
- **Only IPFS CIDs**: No raw secrets, just immutable references
- **User-specific mapping**: `mapping(address => UserData) private userData`
- **Events**: `UserDataUpdated`, `UserDataRemoved` for transparency

**IPFS Bundle Structure**:
```typescript
interface UserTOTPBundle {
  userAddress: string;
  lastUpdated: number;
  version: number;
  accounts: TOTPAccount[];
}

interface TOTPAccount {
  id: string;
  accountName: string;
  encryptedSecret: string;  // AES-256-GCM encrypted
  algorithm: string;
  period: number;
  digits: number;
  timestamp: number;
  iv: string;              // Initialization vector
  salt: string;            // PBKDF2 salt
  logoCID?: string;        // Optional logo stored separately
}
```

### Encryption Process

**1. Adding a 2FA Account**:
```
User Input → Wallet Signature → Key Derivation → Encryption → IPFS → Blockchain
     ↓              ↓               ↓             ↓         ↓        ↓
Account Name → Sign Message → PBKDF2 + Salt → AES-256-GCM → Bundle → CID
```

**2. Key Derivation** (`lib/crypto.ts`):
```typescript
// 1. User signs a message with their wallet
const signature = await wallet.signMessage("Base Auth Vault Access");

// 2. Signature is hashed with SHA-256
const signatureHash = await crypto.subtle.digest('SHA-256', signatureBytes);

// 3. PBKDF2 key derivation with random salt
const key = await crypto.subtle.deriveKey({
  name: 'PBKDF2',
  salt: randomSalt,           // 16-byte random salt
  iterations: 100000,          // 100k iterations
  hash: 'SHA-256',
}, keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
```

**3. Encryption Process**:
```typescript
// Each secret is encrypted individually
const { encrypted, iv, salt } = await encryptSecretGCM(secret, signature);

// Bundle structure for IPFS
const encryptedBundle: EncryptedBundle = {
  encryptedData: encrypted,    // AES-256-GCM encrypted JSON
  iv: iv,                      // 12-byte random IV
  salt: salt,                  // 16-byte random salt
  version: 2
};
```

### IPFS Storage & Retrieval

**Upload Process**:
1. **Encrypt Bundle**: All user accounts encrypted as single bundle
2. **Create JSON**: Bundle serialized to JSON
3. **Upload to IPFS**: Via Pinata Cloud with JWT authentication
4. **Receive CID**: Content Identifier (e.g., `QmXxXxXx...`)
5. **Store CID on-chain**: Only the CID stored in smart contract

**Retrieval Process**:
1. **Read CID**: Get IPFS CID from smart contract
2. **Fetch from IPFS**: Download encrypted bundle using CID
3. **Decrypt**: Use wallet signature + stored salt to derive key
4. **Parse Bundle**: Extract individual TOTP accounts
5. **Generate Codes**: Create 6-digit TOTP codes

### Security & Decentralization

**Security Features**:
- **Signature-Based Keys**: No private key exposure, uses wallet signing
- **Client-Side Encryption**: All encryption/decryption in browser
- **Authenticated Encryption**: AES-256-GCM prevents tampering
- **Unique Salts**: Each encryption uses random salt
- **No Server Storage**: Zero server-side sensitive data

**Decentralization**:
- **IPFS Storage**: Decentralized file system, not centralized databases
- **Blockchain References**: Immutable CIDs on Base blockchain
- **No Single Point of Failure**: IPFS + blockchain redundancy
- **User Control**: Only user can decrypt with their signature


## Import & Export - Your TOTP Codes Migration From Other Services

### Migrating from Google Authenticator

**Step 1: Export from Google Authenticator**
1. Open Google Authenticator app
2. Tap the three dots menu → "Transfer accounts"
3. Select "Export accounts" → "Next"
4. Choose accounts to export → "Next"
5. Scan the QR code with Base Auth

**Step 2: Import to Base Auth**
1. Open Base Auth and connect your wallet
2. Tap "Import from Google Authenticator"
3. Scan the migration QR code
4. Select which accounts to import
5. Tap "Import" - accounts are encrypted and stored

### Exporting to Other Apps

**Step 1: Export from Base Auth**
1. In Base Auth, tap "Export Accounts"
2. Review security warning and tap "I Understand"
3. Scan each QR code with your target app

**Step 2: Import to Target App**
1. Open your target authenticator app
2. Look for "Import" or "Add Account" option
3. Scan the QR codes from Base Auth
4. Accounts are now available in your target app

### Migration Security

**What's Protected**:
- **Encrypted Transfer**: QR codes contain encrypted data, not plain secrets
- **Temporary Display**: QR codes only shown during export process
- **No Server Storage**: Migration data never touches our servers
- **User Control**: You choose which accounts to migrate

**Supported Formats**:
- Google Authenticator migration format
- Standard `otpauth://` URIs
- Base32 secret strings
- Batch migration (multiple accounts)


## Development

```bash
# Run linter
npm run lint

# Build for production
npm run build

# Start production server
npm start
```

## Resources

- [Base Documentation](https://docs.base.org)
- [Base Mini-Apps Guide](https://docs.base.org/mini-apps)
- [OnchainKit Documentation](https://onchainkit.xyz)
- [Pinata Documentation](https://docs.pinata.cloud)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see LICENSE file for details

---

<div align="center">
  <p>Built with 💙 on Base</p>
  <p>
    <a href="https://base.org">Base</a> •
    <a href="https://docs.base.org/mini-apps">Mini-Apps</a> •
    <a href="https://onchainkit.xyz">OnchainKit</a>
  </p>
</div>
