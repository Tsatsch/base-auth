# Base Auth - Deployment Guide

This guide will walk you through deploying the Base Auth on-chain authenticator mini-app.

## Prerequisites

- Node.js 18+ and npm installed
- A Base wallet with some ETH for contract deployment
- A Vercel account (for hosting the mini-app)
- Access to the Base app

## Step 1: Deploy the Smart Contract

### Option A: Using Remix IDE (Recommended for Beginners)

1. Go to [Remix IDE](https://remix.ethereum.org/)
2. Create a new file called `TwoFactorAuthenticator.sol`
3. Copy the contract code from `contracts/TwoFactorAuthenticator.sol`
4. Compile the contract using Solidity compiler 0.8.20 or higher
5. Deploy to Base mainnet:
   - Switch to the "Deploy & Run Transactions" tab
   - Select "Injected Provider - MetaMask" as the environment
   - Make sure your wallet is connected to Base mainnet
   - Click "Deploy"
   - Confirm the transaction in your wallet
6. Copy the deployed contract address

### Option B: Using Foundry

```bash
# Install Foundry if you haven't already
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Deploy the contract
forge create --rpc-url https://mainnet.base.org \
  --private-key YOUR_PRIVATE_KEY \
  contracts/TwoFactorAuthenticator.sol:TwoFactorAuthenticator

# Copy the deployed contract address from the output
```

### Option C: Using Hardhat

```bash
# Install Hardhat
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox

# Initialize Hardhat project (if not already done)
npx hardhat init

# Create deployment script
# Then run:
npx hardhat run scripts/deploy.ts --network base
```

## Step 2: Update Contract Address

After deploying the contract, update the contract address in `lib/contract.ts`:

```typescript
export const AUTHENTICATOR_CONTRACT_ADDRESS = "0xYOUR_DEPLOYED_CONTRACT_ADDRESS";
```

## Step 3: Deploy to Vercel

1. Push your code to a GitHub repository:
   ```bash
   git add .
   git commit -m "Setup Base Auth mini-app"
   git push origin main
   ```

2. Go to [Vercel](https://vercel.com) and sign in
3. Click "New Project"
4. Import your GitHub repository
5. Configure the project:
   - Framework Preset: Next.js
   - Root Directory: ./
   - Environment Variables: Add `NEXT_PUBLIC_ONCHAINKIT_API_KEY` if needed
6. Click "Deploy"
7. Wait for the deployment to complete and note your deployment URL

## Step 4: Update Manifest Configuration

Update `minikit.config.ts` with your Vercel deployment URL if it's different from the current configuration.

## Step 5: Generate Account Association

1. Go to [Base Build Account Association Tool](https://base.build/account-association)
2. Enter your Vercel deployment URL (e.g., `your-app.vercel.app`)
3. Click "Submit"
4. Click "Verify" and follow the instructions
5. Copy the generated `accountAssociation` object
6. Update `minikit.config.ts` with the new credentials

## Step 6: Test Your Mini-App

1. Go to [Base Build Preview Tool](https://base.dev/preview)
2. Enter your deployment URL
3. Test the following:
   - Embed preview displays correctly
   - Launch button opens the app
   - Account association is valid
   - All metadata is present

## Step 7: Publish to Base App

1. Open the Base app
2. Create a new post/cast
3. Include your deployment URL in the post
4. The app will automatically be recognized and embedded
5. Users can now discover and use your mini-app!

## Troubleshooting

### Contract Deployment Issues

- **Insufficient funds**: Make sure you have enough ETH on Base for gas fees
- **RPC errors**: Try using a different RPC endpoint or wait a few moments

### Mini-App Issues

- **App doesn't load**: Check browser console for errors
- **Wallet connection fails**: Ensure OnchainKit is properly configured
- **Contract calls fail**: Verify the contract address is correct and deployed

### Account Association Issues

- **Verification fails**: Ensure your deployment is live and the manifest file is accessible
- **Invalid signature**: Regenerate the account association credentials

## Security Notes

⚠️ **Important Security Considerations:**

1. **Client-Side Encryption**: The 2FA secrets are encrypted client-side using the user's wallet address as the key
2. **Private Key Security**: Never commit private keys or sensitive data to version control
3. **Contract Immutability**: Once deployed, the contract cannot be upgraded. Test thoroughly on testnet first
4. **Data Privacy**: While encrypted, data is stored on-chain and is permanently recorded
5. **Key Management**: If a user loses access to their wallet, they lose access to their 2FA secrets

## Testnet Deployment (Recommended First)

Before deploying to mainnet, test on Base Sepolia testnet:

1. Get Base Sepolia ETH from a [faucet](https://www.alchemy.com/faucets/base-sepolia)
2. Deploy contract to Base Sepolia (RPC: https://sepolia.base.org)
3. Test all functionality thoroughly
4. Once verified, deploy to mainnet

## Support

For issues or questions:
- Base Documentation: https://docs.base.org
- Base Discord: https://base.org/discord
- OnchainKit Docs: https://onchainkit.xyz

## License

MIT License - see LICENSE file for details

