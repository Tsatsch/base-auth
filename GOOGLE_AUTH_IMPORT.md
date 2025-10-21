# Google Authenticator Import Feature

## Overview

Your app now supports importing 2FA accounts from Google Authenticator's export QR codes! This feature allows users to migrate all their accounts from Google Authenticator in one scan.

## How It Works

### Format Detection

The app now automatically detects two types of QR codes:

1. **Standard TOTP QR codes** (single account):
   ```
   otpauth://totp/Issuer:Account?secret=ABC123&issuer=Issuer
   ```

2. **Google Authenticator Migration QR codes** (multiple accounts):
   ```
   otpauth-migration://offline?data=<ENCODED_DATA>
   ```

### Technical Implementation

The migration QR code contains:
- **URL-encoded** → **Base64-encoded** → **Protocol Buffers** serialized data
- Multiple accounts with metadata (issuer, account name, algorithm, digits, type)
- Batch information (version, batch size, batch ID)

Reference: [qistoph/otp_export](https://github.com/qistoph/otp_export)

## Features

✅ **Automatic Detection**: Scans both single-account and multi-account QR codes  
✅ **Batch Import**: Import multiple accounts from one QR code scan  
✅ **Selective Import**: Choose which accounts to import via a modal UI  
✅ **Full Metadata Support**: Preserves algorithm (SHA1/SHA256/SHA512/MD5), digits (6/8), and type (TOTP/HOTP)  
✅ **Secure Storage**: All secrets are encrypted with AES-256-GCM before storage  
✅ **Protocol Buffers Parsing**: Uses `protobufjs` to decode Google's proprietary format

## User Flow

### Single Account Import (Existing)
1. Click "Add Account"
2. Click camera icon to scan QR code
3. Scan a standard `otpauth://totp/` QR code
4. Account details auto-fill
5. Submit to add account

### Multi-Account Import (NEW!)
1. Click "Add Account"
2. Click camera icon to scan QR code
3. Scan a Google Authenticator export QR code (`otpauth-migration://`)
4. **New Modal Opens** showing all detected accounts
5. Select which accounts to import (or select all)
6. Click "Import X Accounts"
7. All selected accounts are encrypted and stored

## Files Added/Modified

### New Files
- `lib/googleAuthMigration.ts` - Parser for Google Authenticator migration format
- `components/MigrationImport.tsx` - UI component for multi-account import modal

### Modified Files
- `lib/qrScanner.ts` - Added migration format detection
- `app/page.tsx` - Added batch import handler and modal integration
- `package.json` - Added `protobufjs` dependency

## Testing

### Test with Real Google Authenticator Export

1. Open Google Authenticator app
2. Go to Settings → Transfer accounts → Export accounts
3. Select accounts to export
4. Generate QR code
5. Scan it with your app's camera
6. You should see the migration import modal!

### Test with Sample Data

For testing purposes, you can generate test migration QR codes using the Python script from the [otp_export repo](https://github.com/qistoph/otp_export) or create a test QR code programmatically.

## Supported Algorithms & Formats

| Feature | Support |
|---------|---------|
| SHA1 | ✅ |
| SHA256 | ✅ |
| SHA512 | ✅ |
| MD5 | ✅ |
| 6-digit codes | ✅ |
| 8-digit codes | ✅ |
| TOTP | ✅ |
| HOTP | ⚠️ Parsed but treated as TOTP in storage |

## Security Notes

- All secrets are encrypted with AES-256-GCM before storage
- The wallet signature is used as the encryption key
- Only the IPFS CID (hash) is stored on-chain
- The actual encrypted secrets are stored on IPFS
- No secrets are logged or exposed in plaintext

## Example Migration Data Structure

When a Google Authenticator export QR is scanned, the app parses:

```typescript
{
  accounts: [
    {
      secret: "JBSWY3DPEHPK3PXP",
      name: "Google:user@example.com",
      issuer: "Google",
      accountName: "user@example.com",
      algorithm: "SHA1",
      digits: 6,
      type: "TOTP"
    },
    {
      secret: "HXDMVJECJJWSRB3H",
      name: "GitHub:username",
      issuer: "GitHub",
      accountName: "username",
      algorithm: "SHA1",
      digits: 6,
      type: "TOTP"
    }
  ],
  metadata: {
    version: 1,
    batchSize: 2,
    batchIndex: 0,
    batchId: 1234567890
  }
}
```

## Troubleshooting

**Q: The QR code isn't being recognized**  
A: Make sure the QR code is a Google Authenticator export QR code starting with `otpauth-migration://`. Standard `otpauth://totp/` codes will import as single accounts.

**Q: Some accounts failed to import**  
A: Check the console logs for detailed error messages. The app will attempt to import all valid accounts and skip any that fail parsing.

**Q: Can I import from Authy or other apps?**  
A: This feature specifically supports Google Authenticator's export format. Other apps may use different formats. Standard `otpauth://totp/` QR codes work universally.

**Q: What happens to my existing accounts?**  
A: Imported accounts are added to your existing bundle. No accounts are replaced or deleted during import.

## Future Enhancements

Potential improvements:
- Support for other authenticator app export formats
- Duplicate detection before import
- Logo matching for common services
- Support for HOTP counter preservation
- Batch export feature (reverse migration)

## Dependencies

- `protobufjs` - Protocol Buffers JavaScript implementation for parsing Google's binary format
- `qr-scanner` - QR code scanning (already in use)
- `otpauth` - TOTP/HOTP generation (already in use)

---

**Implementation complete!** 🎉

The app now seamlessly handles both single-account and multi-account imports from Google Authenticator.

