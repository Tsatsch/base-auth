# Base Auth - User Guide

Complete guide to using the Base Auth on-chain authenticator mini-app.

## 🚀 Getting Started

### Step 1: Access the App

1. Open the Base app on your mobile device
2. Navigate to the Base Auth mini-app
3. Tap to launch the application

### Step 2: Connect Your Wallet

1. When the app loads, you'll see a "Connect Wallet" button
2. Tap the button to connect your Base wallet
3. Approve the connection in your wallet app
4. Your wallet address will appear in the top right corner

## 📱 Using Base Auth

### Adding Your First 2FA Account

1. **Tap the "+" button** at the bottom right of the screen

2. **Enter Account Details**:
   - **Account Name**: Enter a recognizable name (e.g., "Google", "GitHub", "Coinbase")
   - **2FA Secret Key**: Paste your 2FA secret

3. **Finding Your 2FA Secret**:
   
   Most services provide the secret key when you set up 2FA:

   #### For New 2FA Setup:
   - When setting up 2FA on a service, look for "Can't scan QR code?" or "Manual entry"
   - Copy the provided secret key (usually a long string of letters and numbers)
   - Paste this into Base Auth
   
   #### For Existing 2FA:
   - You'll need to re-enable 2FA on the service to get the secret again
   - Disable 2FA temporarily
   - Re-enable it and choose manual/text entry option
   - Copy the secret key provided

4. **Save to Blockchain**:
   - Tap "Add Account"
   - Approve the transaction in your wallet
   - Wait for blockchain confirmation (usually 1-2 seconds on Base)

### Generating 2FA Codes

Once you've added accounts:

1. **View Your Codes**: All your accounts appear on the main screen
2. **Copy Code**: Tap on any 6-digit code to copy it to clipboard
3. **Watch Timer**: The circular timer shows seconds until the code refreshes
4. **Auto-Refresh**: Codes automatically regenerate every 30 seconds

### Managing Accounts

#### Delete an Account

1. Find the account you want to remove
2. Tap the trash icon (🗑️) on the right
3. Approve the transaction in your wallet
4. The account will be removed after blockchain confirmation

#### Account Ordering

- Accounts are displayed in the order they were added
- Most recently added accounts appear at the bottom

## 🔐 Security Best Practices

### Wallet Security

✅ **DO:**
- Use a hardware wallet for maximum security
- Keep your wallet seed phrase in a secure, offline location
- Use strong wallet passwords/PINs
- Enable biometric authentication on your wallet app

❌ **DON'T:**
- Share your wallet private keys or seed phrase
- Store seed phrases digitally (photos, cloud storage, etc.)
- Use the same wallet for high-value transactions if possible
- Access your wallet on public/untrusted devices

### 2FA Secret Management

✅ **DO:**
- Keep backup copies of your 2FA secrets in a secure location
- Test each account immediately after adding
- Store critical 2FA secrets in multiple secure locations
- Use Base Auth as one part of your security strategy

❌ **DON'T:**
- Rely solely on Base Auth for 2FA storage
- Add secrets for critical financial accounts without backups
- Share your 2FA secrets with anyone
- Use weak or reused secrets

### Account Recovery

**Important**: If you lose access to your wallet, you will lose access to your 2FA secrets stored in Base Auth.

**Recovery Strategy**:
1. Always maintain independent backups of your 2FA secrets
2. Store recovery codes provided by services when setting up 2FA
3. Consider using multiple 2FA methods for critical accounts
4. Test your wallet recovery process before relying on Base Auth

## 🎯 Use Cases

### Ideal For:

- 🌐 **Web3 Accounts**: Crypto exchanges, DeFi platforms, NFT marketplaces
- 💼 **Professional Accounts**: Work email, Slack, company tools
- 🎮 **Gaming Accounts**: Discord, gaming platforms, social networks
- 📧 **Personal Accounts**: Gmail, social media, cloud storage

### Consider Alternatives For:

- 🏦 **Banking**: Use bank-recommended 2FA methods
- 🏥 **Healthcare**: Use approved security methods
- 🏛️ **Government**: Follow official security guidelines

## 🐛 Troubleshooting

### App Won't Load

**Symptoms**: Blank screen, loading spinner doesn't disappear

**Solutions**:
1. Check your internet connection
2. Refresh the app
3. Ensure you're using a compatible wallet
4. Try disconnecting and reconnecting your wallet

### Codes Not Working

**Symptoms**: Generated codes are rejected by services

**Solutions**:
1. **Check time sync**: Your device clock must be accurate
   - Go to device settings → Date & Time
   - Enable "Automatic date & time"
2. **Verify secret**: Ensure you entered the correct secret
3. **Try next code**: Wait for the next 30-second cycle
4. **Re-add account**: Delete and re-add the account with a fresh secret

### Transaction Failures

**Symptoms**: "Transaction failed" errors when adding/deleting accounts

**Solutions**:
1. **Check wallet balance**: Ensure you have enough ETH for gas fees
2. **Increase gas limit**: Try adjusting gas settings in your wallet
3. **Wait and retry**: Network congestion may cause temporary issues
4. **Check contract**: Verify the contract address is correct

### Can't Connect Wallet

**Symptoms**: Wallet connection button doesn't work

**Solutions**:
1. Ensure your wallet app is updated to the latest version
2. Try a different wallet (MetaMask, Coinbase Wallet, etc.)
3. Check that you're on the Base network
4. Clear browser cache and reload

### Missing Accounts

**Symptoms**: Previously added accounts don't appear

**Solutions**:
1. Verify you're connected with the correct wallet address
2. Check blockchain explorer to confirm transactions
3. Wait for network sync (may take a few moments)
4. Ensure the contract address hasn't changed

## 💡 Tips & Tricks

### Organizing Accounts

- Use clear, consistent naming (e.g., "Work Gmail" vs "Personal Gmail")
- Group related accounts with prefixes (e.g., "Work - Slack", "Work - Email")
- Add most-used accounts first for easy access

### Backup Strategy

1. **Primary**: Base Auth on-chain
2. **Secondary**: Encrypted text file on USB drive
3. **Tertiary**: Paper backup in secure physical location
4. **Recovery**: Save all service-provided recovery codes

### Performance Tips

- Keep the number of accounts under 20 for optimal performance
- Delete unused or old accounts to keep the list clean
- Close the app completely between uses to save battery

## 🆘 Emergency Access

If you need immediate access to your accounts and Base Auth is unavailable:

1. **Use recovery codes**: Most services provide one-time recovery codes
2. **Contact service support**: Many services can help if you've lost 2FA access
3. **Use backup authenticator**: If you maintained backups, use a standard authenticator app
4. **Account recovery**: Follow each service's account recovery process

## 📊 Understanding the Interface

### Main Screen Elements

- **Top Bar**: App title and wallet connection status
- **Account Cards**: Each card shows one 2FA account
- **Account Name**: The name you assigned to the account
- **6-Digit Code**: Current TOTP code (tap to copy)
- **Timer Circle**: Visual countdown to next code refresh
- **Timer Number**: Seconds remaining until refresh
- **Delete Button**: Trash icon to remove account
- **Add Button**: Blue "+" button to add new accounts

### Add Account Modal

- **Account Name Field**: Text input for account identifier
- **Secret Key Field**: Text area for 2FA secret
- **Hint Text**: Helpful information about secret format
- **Error Messages**: Red box showing validation errors
- **Add Button**: Blue button to submit and save to blockchain

## 🌐 Blockchain Transparency

Your 2FA data is stored on the Base blockchain:

- **View Your Data**: Use [BaseScan](https://basescan.org) to view your transactions
- **Verify Encryption**: All secrets are encrypted before storage
- **Audit Trail**: Every add/delete action is recorded on-chain
- **Immutable**: Historical data cannot be modified, only appended

## ❓ FAQ

**Q: How much does it cost to use Base Auth?**
A: Each add/delete operation costs gas fees (typically $0.01-0.05 on Base). Reading codes is free.

**Q: Can I use the same account on multiple devices?**
A: Yes! Just connect the same wallet on different devices.

**Q: What happens if I lose my phone?**
A: As long as you have your wallet, you can access Base Auth on any device.

**Q: Are my secrets really secure?**
A: Secrets are encrypted client-side with your wallet address as the key. Only you can decrypt them.

**Q: Can I export my secrets?**
A: Secrets are stored encrypted on-chain. You can decrypt them with your wallet, but there's no bulk export feature.

**Q: What if the app is discontinued?**
A: Your data is on the blockchain forever. You could build a new interface or export the data yourself.

**Q: Can someone see my 2FA secrets?**
A: No. They're encrypted and only you (via your wallet) can decrypt them.

## 📞 Getting Help

If you need assistance:

1. Check this guide and the main README
2. Visit the [GitHub Issues](https://github.com/yourusername/base-auth/issues)
3. Join the [Base Discord](https://base.org/discord)
4. Ask in the Base community forums

---

**Remember**: Base Auth is a powerful tool, but you are responsible for your own security. Always maintain backups and follow security best practices! 🔐

