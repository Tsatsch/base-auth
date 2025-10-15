# Base Auth - On-Chain Authenticator

<div align="center">
  <h3>Secure two-factor authentication management on the Base blockchain</h3>
  <p>Store and manage your 2FA secrets with blockchain security</p>
</div>

## 🔐 Overview

Base Auth is a decentralized authenticator mini-app built for the Base blockchain, similar to Google Authenticator but with the added security and portability of blockchain technology. Your 2FA secrets are encrypted client-side and stored on-chain, accessible only through your wallet.

## ✨ Features

- **🔗 Wallet-Based Authentication**: Your wallet is your identity - no passwords needed
- **🔒 Client-Side Encryption**: All secrets are encrypted locally before blockchain storage
- **⛓️ Blockchain Security**: Immutable, censorship-resistant storage on Base
- **📱 Mobile-Friendly**: Clean, responsive design optimized for mobile devices
- **⚡ Real-Time TOTP**: 6-digit codes that refresh every 30 seconds
- **🎨 Base Brand Design**: Beautiful UI following Base's official design guidelines

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
  - Store encrypted 2FA secrets
  - Retrieve user-specific secrets
  - Update and delete secrets
  - Event emission for tracking

### Security
- **Encryption**: AES encryption using CryptoJS
- **Key Derivation**: User's wallet address as encryption key
- **TOTP Generation**: OTPAuth library with SHA1/30-second period
- **Data Privacy**: All sensitive data encrypted before blockchain storage

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
   ```bash
   cp .env.example .env.local
   ```
   
   Edit `.env.local` and configure:
   - `NEXT_PUBLIC_NETWORK`: Set to `testnet` or `mainnet`
   - `NEXT_PUBLIC_CONTRACT_ADDRESS`: Your deployed contract address
   - `NEXT_PUBLIC_ONCHAINKIT_API_KEY`: (Optional) Your OnchainKit API key

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
│   └── TwoFactorAuthenticator.sol # Smart contract
├── lib/
│   ├── contract.ts               # Contract ABI and address
│   ├── crypto.ts                 # Encryption/decryption utilities
│   └── totp.ts                   # TOTP generation utilities
├── minikit.config.ts             # Mini-app manifest configuration
├── DEPLOYMENT.md                 # Deployment guide
└── README.md                     # This file
```

## 🔐 How It Works

### Adding a 2FA Account

1. User connects their wallet
2. User enters account name and 2FA secret
3. Secret is validated (base32 format check)
4. Secret is encrypted using AES with wallet address as key
5. Encrypted secret is stored on-chain via smart contract
6. Transaction is confirmed on Base blockchain

### Generating Codes

1. App reads encrypted secrets from smart contract
2. Secrets are decrypted client-side using wallet address
3. TOTP codes are generated using the decrypted secrets
4. Codes refresh every 30 seconds automatically
5. Timer displays countdown until next refresh

### Security Model

- **Client-Side Encryption**: No plaintext secrets ever leave the client
- **Wallet-Based Key**: Only the wallet owner can decrypt their secrets
- **Blockchain Immutability**: Secrets cannot be tampered with once stored
- **No Server Storage**: Zero server-side storage of sensitive data

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

- [Base Documentation](https://docs.base.org)
- [Base Mini-Apps Guide](https://docs.base.org/mini-apps)
- [OnchainKit Documentation](https://onchainkit.xyz)
- [Wagmi Documentation](https://wagmi.sh)
- [TOTP RFC 6238](https://tools.ietf.org/html/rfc6238)

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
