# Base Auth - IPFS-Enabled Authenticator

<div align="center">
  <h3>Secure two-factor authentication with IPFS and blockchain</h3>
  <p>Store encrypted 2FA secrets on IPFS with immutable blockchain references</p>
</div> 

## 🔐 Overview

Base Auth is a decentralized authenticator mini-app that combines IPFS storage with Base blockchain security. Unlike traditional authenticators, your 2FA secrets are encrypted with military-grade AES-256-GCM, stored on IPFS, and referenced via immutable Content Identifiers (CIDs) on the blockchain. Only you can decrypt your secrets using your wallet.

## ✨ Features

- **🔗 Wallet-Based Authentication**: Your wallet is your identity - no passwords needed
- **🔒 Military-Grade Encryption**: AES-256-GCM with PBKDF2 key derivation (100k iterations)
- **📦 IPFS Storage**: Encrypted secrets stored on decentralized IPFS network
- **⛓️ Blockchain References**: Only immutable IPFS CIDs stored on-chain
- **📱 Mobile-Friendly**: Clean, responsive design optimized for mobile devices
- **⚡ Real-Time TOTP**: 6-digit codes that refresh every 30 seconds
- **🎨 Base Brand Design**: Beautiful UI following Base's official design guidelines
- **🔐 Maximum Privacy**: No raw secrets on blockchain, all encryption client-side

## 🏗️ Architecture

### Frontend
- **Framework**: Next.js 15 with React 19
- **Styling**: CSS Modules with Base brand colors
- **Blockchain Interaction**: Wagmi + Viem
- **Mini-App SDK**: OnchainKit + Farcaster MiniApp SDK

### Smart Contract
- **Language**: Solidity ^0.8.20
- **Network**: Base (Ethereum L2)
- **Features**: 
  - Store IPFS CIDs (not secrets directly)
  - Retrieve user-specific CID references
  - Update and delete CID records
  - CID format validation
  - Event emission for tracking

### IPFS Integration
- **Provider**: Pinata Cloud v3 SDK
- **Package**: `pinata` (modern SDK)
- **Authentication**: JWT-based
- **Storage**: Encrypted metadata objects
- **Pinning**: Automatic pinning for availability
- **Gateway**: Dedicated Pinata gateway
- **Reference**: [docs.pinata.cloud](https://docs.pinata.cloud/)

### Security
- **Encryption**: AES-256-GCM (Web Crypto API)
- **Key Derivation**: PBKDF2 with 100,000 iterations + random salt
- **IV Generation**: Unique random IV per encryption
- **TOTP Generation**: OTPAuth library with SHA1/30-second period
- **Data Privacy**: No secrets on blockchain, only IPFS CIDs
- **Authentication**: GCM provides authenticated encryption

## 🚀 Quick Start

### Prerequisites

- Node.js 18 or higher
- npm or yarn
- A Base wallet (MetaMask, Coinbase Wallet, etc.)
- Git

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/base-auth.git
   cd base-auth
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   Create a `.env.local` file with:
   ```bash
   # Pinata IPFS Configuration (v3 SDK with JWT)
   # Get JWT from: https://app.pinata.cloud/developers/api-keys
   NEXT_PUBLIC_PINATA_JWT=your_pinata_jwt_token
   NEXT_PUBLIC_PINATA_GATEWAY=example-gateway.mypinata.cloud
   
   # Smart Contract Address
   NEXT_PUBLIC_CONTRACT_ADDRESS=your_deployed_contract_address
   ```
   
   **Get Pinata JWT**: Sign up at [pinata.cloud](https://app.pinata.cloud), create an API key with "Admin" permissions, and copy the JWT token
   
   See [ENV_SETUP.md](./ENV_SETUP.md) and [PINATA_SETUP.md](./PINATA_SETUP.md) for detailed instructions

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## 📦 Deployment

For complete deployment instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md).

Quick overview:
1. Deploy the smart contract to Base
2. Update the contract address in `lib/contract.ts`
3. Deploy to Vercel
4. Generate account association credentials
5. Publish to Base app

## 🎨 Design System

Base Auth strictly follows the [Base brand guidelines](https://www.base.org/brand/color):

### Colors
- **Primary Accent**: `rgb(0, 0, 255)` - Base Blue (used sparingly for CTAs)
- **Background**: `rgb(255, 255, 255)` - White
- **Primary Text**: `rgb(10, 11, 13)` - Gray 100
- **Secondary Text**: `rgb(177, 183, 195)` - Gray 30
- **Borders**: `rgb(222, 225, 231)` - Gray 15

### Typography
- **Primary Font**: Inter
- **Monospace Font**: Source Code Pro

### Design Principles
- Clean, minimalist interface
- Generous negative space
- Clear visual hierarchy
- WCAG AA contrast compliance
- Mobile-first responsive design

## 🔧 Project Structure

```
base-auth/
├── app/
│   ├── api/
│   │   └── auth/
│   │       └── route.ts          # Authentication endpoint
│   ├── layout.tsx                # Root layout with metadata
│   ├── page.tsx                  # Main authenticator UI
│   ├── page.module.css           # Component styles
│   ├── globals.css               # Global styles with Base brand colors
│   └── rootProvider.tsx          # OnchainKit provider setup
├── contracts/
│   └── TwoFactorAuthenticator.sol # IPFS-enabled smart contract
├── lib/
│   ├── contract.ts               # Contract ABI and address
│   ├── crypto.ts                 # AES-256-GCM encryption (Web Crypto API)
│   ├── ipfs.ts                   # IPFS upload/retrieval via Pinata
│   └── totp.ts                   # TOTP generation utilities
├── minikit.config.ts             # Mini-app manifest configuration
├── DEPLOYMENT.md                 # Deployment guide
└── README.md                     # This file
```

## 🔐 How It Works

### Adding a 2FA Account

1. **User Input**: User connects wallet and enters account name + 2FA secret
2. **Validation**: Secret is validated (base32 format check)
3. **Encryption**: 
   - Derives encryption key from wallet address using PBKDF2 (100k iterations)
   - Generates random 12-byte IV (Initialization Vector)
   - Generates random 16-byte salt
   - Encrypts secret with AES-256-GCM
4. **IPFS Upload**:
   - Creates metadata object (encrypted secret, IV, salt, algorithm params)
   - Uploads to IPFS via Pinata
   - Receives IPFS CID (Content Identifier)
5. **Blockchain Storage**:
   - Stores only the IPFS CID on-chain via smart contract
   - Transaction confirmed on Base blockchain
6. **Result**: Encrypted data on IPFS, immutable CID reference on-chain

### Generating Codes

1. **Retrieve CIDs**: App reads IPFS CIDs from smart contract
2. **Fetch from IPFS**: Downloads encrypted metadata from IPFS using CID
3. **Decrypt**: 
   - Derives same key from wallet address + stored salt
   - Decrypts using stored IV and AES-256-GCM
4. **Generate TOTP**: Creates 6-digit code from decrypted secret
5. **Display**: Codes refresh every 30 seconds with countdown timer

### Security Model

- **Client-Side Only**: All encryption/decryption happens in browser
- **No Secrets On-Chain**: Only IPFS CIDs stored on blockchain
- **Wallet-Based Keys**: Only wallet owner can derive encryption keys
- **Authenticated Encryption**: GCM mode prevents tampering
- **Random IVs & Salts**: Each encryption uses unique random values
- **IPFS Immutability**: Encrypted data cannot be modified after upload
- **No Server Storage**: Zero server-side storage of any sensitive data

## ⚠️ Security Considerations

### Important Notes

1. **Wallet Security is Critical**: If you lose access to your wallet, you lose access to your 2FA secrets
2. **Backup Independently**: Always keep independent backups of your 2FA secrets
3. **Test Before Use**: Thoroughly test with non-critical accounts first
4. **Blockchain Permanence**: Data stored on-chain is permanent and cannot be deleted (only marked as removed)
5. **Public Blockchain**: While encrypted, your data structure is visible on-chain

### Best Practices

- Use a hardware wallet for maximum security
- Never share your wallet private keys
- Keep backups of your 2FA secrets in a secure location
- Test recovery procedures before relying on the app
- Use strong, unique secrets for each account

## 🧪 Testing

```bash
# Run linter
npm run lint

# Build for production
npm run build

# Start production server
npm start
```

## 📚 Documentation

### Project Documentation
- [IPFS Integration Guide](./IPFS_INTEGRATION.md) - Detailed IPFS architecture
- [Pinata v3 Migration](./PINATA_V3_MIGRATION.md) - v2 to v3 SDK migration guide
- [Pinata Setup Guide](./PINATA_SETUP.md) - Detailed Pinata configuration
- [Environment Setup](./ENV_SETUP.md) - Configuration instructions
- [Migration Guide](./MIGRATION_GUIDE.md) - Migrate from old contract
- [Deployment Guide](./DEPLOYMENT.md) - Deploy to production

### External Resources
- [Base Documentation](https://docs.base.org)
- [Base Mini-Apps Guide](https://docs.base.org/mini-apps)
- [OnchainKit Documentation](https://onchainkit.xyz)
- [Wagmi Documentation](https://wagmi.sh)
- [IPFS Documentation](https://docs.ipfs.tech)
- [Pinata Documentation](https://docs.pinata.cloud)
- [TOTP RFC 6238](https://tools.ietf.org/html/rfc6238)
- [AES-GCM Spec](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38d.pdf)

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Write/update tests if applicable
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- [Base](https://base.org) for the incredible L2 platform
- [Coinbase](https://coinbase.com) for OnchainKit
- [Farcaster](https://farcaster.xyz) for the MiniApp SDK
- The open-source community

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/base-auth/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/base-auth/discussions)
- **Base Discord**: [base.org/discord](https://base.org/discord)
- **Twitter**: [@base](https://twitter.com/base)

---

<div align="center">
  <p>Built with 💙 on Base</p>
  <p>
    <a href="https://base.org">Base</a> •
    <a href="https://docs.base.org/mini-apps">Mini-Apps</a> •
    <a href="https://onchainkit.xyz">OnchainKit</a>
  </p>
</div>
