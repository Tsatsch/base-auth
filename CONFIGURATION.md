# Configuration Guide

This document explains all the environment variables and configuration options for Base Auth.

## Environment Variables

All environment variables should be set in `.env.local` (for local development) or in your deployment platform's environment settings (e.g., Vercel).

### Required Variables

#### `NEXT_PUBLIC_NETWORK`
- **Purpose**: Specifies which blockchain network to use (automatically configures the correct RPC endpoint)
- **Options**: 
  - `testnet` - Base Sepolia testnet (https://sepolia.base.org)
  - `mainnet` - Base mainnet (https://mainnet.base.org)
- **Default**: `testnet`
- **Example**: `NEXT_PUBLIC_NETWORK=testnet`

#### `NEXT_PUBLIC_CONTRACT_ADDRESS`
- **Purpose**: The deployed TwoFactorAuthenticator smart contract address
- **Format**: Ethereum address (0x...)
- **Default**: `0xA5D0BB0D13D23c09b1aB7075708296C3FA290e08` (testnet deployment)
- **Example**: `NEXT_PUBLIC_CONTRACT_ADDRESS=0xA5D0BB0D13D23c09b1aB7075708296C3FA290e08`
- **Note**: You must deploy your own contract and update this value

### Optional Variables

#### `NEXT_PUBLIC_ONCHAINKIT_API_KEY`
- **Purpose**: API key for OnchainKit enhanced features
- **Get Key**: https://portal.cdp.coinbase.com/
- **Example**: `NEXT_PUBLIC_ONCHAINKIT_API_KEY=abc123...`
- **Benefits**:
  - Enhanced wallet connection features
  - Better error messages
  - Analytics and insights

## Configuration Files

### `.env.example`
Template file with all available environment variables. **This file is tracked in git** and should contain example values only.

### `.env.local`
Your actual environment variables. **This file is NOT tracked in git** (in `.gitignore`) and should contain your real values.

### Setup Process

1. Copy the example file:
   ```bash
   cp .env.example .env.local
   ```

2. Edit `.env.local` with your values:
   ```bash
   # For testnet development
   NEXT_PUBLIC_NETWORK=testnet
   NEXT_PUBLIC_CONTRACT_ADDRESS=0xYourContractAddress
   ```

3. For production (mainnet):
   ```bash
   NEXT_PUBLIC_NETWORK=mainnet
   NEXT_PUBLIC_CONTRACT_ADDRESS=0xYourMainnetContractAddress
   ```

## Network-Specific Settings

### Testnet (Base Sepolia)
- **Config Value**: `testnet`
- **RPC**: `https://sepolia.base.org` (automatically configured)
- **Chain ID**: 84532
- **Explorer**: https://sepolia.basescan.org
- **Use For**: Testing, development
- **Getting Testnet ETH**: https://www.alchemy.com/faucets/base-sepolia

### Mainnet (Base)
- **Config Value**: `mainnet`
- **RPC**: `https://mainnet.base.org` (automatically configured)
- **Chain ID**: 8453
- **Explorer**: https://basescan.org
- **Use For**: Production
- **Requirements**: Real ETH for gas fees

## Switching Networks

To switch from testnet to mainnet:

1. Deploy your contract to Base mainnet
2. Update `.env.local`:
   ```bash
   NEXT_PUBLIC_NETWORK=mainnet
   NEXT_PUBLIC_CONTRACT_ADDRESS=0xYourMainnetAddress
   ```
3. Restart your development server or redeploy

The RPC endpoint is automatically configured based on the network.

## Deployment Platforms

### Vercel
Set environment variables in Project Settings → Environment Variables:
- `NEXT_PUBLIC_NETWORK`: `testnet` or `mainnet`
- `NEXT_PUBLIC_CONTRACT_ADDRESS`: Your contract address
- `NEXT_PUBLIC_ONCHAINKIT_API_KEY`: (Optional) Your API key
- Set different values for Production/Preview/Development environments

### Other Platforms
Most platforms have similar environment variable configuration:
- Netlify: Site Settings → Environment Variables
- Railway: Project → Variables
- Render: Environment → Environment Variables

## Troubleshooting

### "Network mismatch" errors
- Ensure your wallet is connected to the same network as `NEXT_PUBLIC_NETWORK`
- Check that the contract address matches the network

### "Contract not found" errors
- Verify `NEXT_PUBLIC_CONTRACT_ADDRESS` is correct
- Ensure the contract is deployed to the selected network
- Check the network setting matches where you deployed

### RPC connection issues
- The app uses public RPC endpoints by default
- If you experience rate limiting, consider using a premium provider like Alchemy or Infura (requires code modification)
- Check if the RPC endpoint is accessible from your location

## Security Notes

⚠️ **Important**:
- Never commit `.env.local` to version control
- Keep your API keys private
- Use testnet for development/testing
- Test thoroughly before deploying to mainnet
- Private keys should NEVER be in environment variables

## Support

For configuration issues:
- Check the [Deployment Guide](DEPLOYMENT.md)
- Review [Base Documentation](https://docs.base.org)
- Visit [OnchainKit Docs](https://onchainkit.xyz)

